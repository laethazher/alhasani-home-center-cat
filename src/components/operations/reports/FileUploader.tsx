import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  X,
  Check,
  Loader2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../../lib/utils';
import type {
  ParsedFileData,
  ColumnMapping,
  StaffTimingRecord,
  UploadedReportData,
} from '../../../pages/operations/reports/types';
import { categorizeRegion } from '../../../pages/operations/reports/types';
import { operationsReportsRepository } from '../../../data/repositories/operationsReportsRepository';

interface FileUploaderProps {
  onUploadComplete: (data: UploadedReportData) => void;
  onCancel?: () => void;
}

const COLUMN_LABELS: Record<keyof ColumnMapping, string> = {
  staffName: 'اسم الموظف',
  entryTime: 'وقت الدخول',
  exitTime: 'وقت الخروج',
  region: 'المنطقة',
  province: 'المحافظة',
  date: 'التاريخ',
};

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const rows = lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  });

  return { headers, rows };
}

function normalizeTime(value: unknown): string | null {
  if (value == null || value === '') return null;
  
  const str = String(value).trim();
  
  const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeMatch) {
    const h = String(timeMatch[1]).padStart(2, '0');
    const m = timeMatch[2];
    return `${h}:${m}`;
  }

  if (typeof value === 'number') {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  return null;
}

function normalizeDate(value: unknown): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  
  const str = String(value).trim();
  
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    return `${slashMatch[3]}-${String(slashMatch[2]).padStart(2, '0')}-${String(slashMatch[1]).padStart(2, '0')}`;
  }

  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }

  return new Date().toISOString().slice(0, 10);
}

export default function FileUploader({ onUploadComplete, onCancel }: FileUploaderProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'processing'>('upload');
  const [parsedData, setParsedData] = useState<ParsedFileData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({
    staffName: null,
    entryTime: null,
    exitTime: null,
    region: null,
    province: null,
    date: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [previewRecords, setPreviewRecords] = useState<StaffTimingRecord[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isCsv = fileName.endsWith('.csv');

    if (!isExcel && !isCsv) {
      setError('يرجى رفع ملف Excel (.xlsx, .xls) أو CSV (.csv)');
      return;
    }

    try {
      let headers: string[] = [];
      let rows: Record<string, string>[] = [];

      if (isCsv) {
        const text = await file.text();
        const parsed = parseCSV(text);
        headers = parsed.headers;
        rows = parsed.rows.map((row) => {
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => {
            obj[h] = row[i] || '';
          });
          return obj;
        });
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { header: 1 });

        if (json.length > 0) {
          headers = (json[0] as unknown[]).map((h) => String(h || '').trim());
          rows = json.slice(1).map((row) => {
            const obj: Record<string, string> = {};
            const rowArr = row as unknown[];
            headers.forEach((h, i) => {
              obj[h] = rowArr[i] != null ? String(rowArr[i]) : '';
            });
            return obj;
          });
        }
      }

      rows = rows.filter((row) => Object.values(row).some((v) => v && v.trim()));

      if (headers.length === 0 || rows.length === 0) {
        setError('الملف فارغ أو لا يحتوي على بيانات صالحة');
        return;
      }

      setParsedData({
        headers,
        rows,
        fileName: file.name,
        fileType: isExcel ? 'excel' : 'csv',
      });

      const autoMapping: ColumnMapping = {
        staffName: null,
        entryTime: null,
        exitTime: null,
        region: null,
        province: null,
        date: null,
      };

      for (const header of headers) {
        const h = header.toLowerCase();
        if (h.includes('اسم') || h.includes('name') || h.includes('موظف') || h.includes('staff')) {
          autoMapping.staffName = header;
        } else if (h.includes('دخول') || h.includes('entry') || h.includes('حضور') || h.includes('in')) {
          autoMapping.entryTime = header;
        } else if (h.includes('خروج') || h.includes('exit') || h.includes('انصراف') || h.includes('out')) {
          autoMapping.exitTime = header;
        } else if (h.includes('منطق') || h.includes('region')) {
          autoMapping.region = header;
        } else if (h.includes('محافظ') || h.includes('province') || h.includes('مدين') || h.includes('city')) {
          autoMapping.province = header;
        } else if (h.includes('تاريخ') || h.includes('date') || h.includes('يوم')) {
          autoMapping.date = header;
        }
      }

      setMapping(autoMapping);
      setStep('mapping');
    } catch (e) {
      console.error('Error parsing file:', e);
      setError('فشل في قراءة الملف. تأكد من أن الملف صالح.');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const processData = useCallback(() => {
    if (!parsedData || !mapping.staffName) {
      setError('يجب تحديد عمود اسم الموظف على الأقل');
      return;
    }

    const records: StaffTimingRecord[] = [];
    const defaultDate = new Date().toISOString().slice(0, 10);

    for (const row of parsedData.rows) {
      const staffName = row[mapping.staffName]?.trim();
      if (!staffName) continue;

      const province = mapping.province ? row[mapping.province]?.trim() : undefined;
      let region = mapping.region ? row[mapping.region]?.trim() : undefined;

      if (!region && province) {
        region = categorizeRegion(province);
      }

      const record: StaffTimingRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        staffName,
        region: (region as 'baghdad' | 'provinces') || 'provinces',
        province,
        date: mapping.date ? normalizeDate(row[mapping.date]) : defaultDate,
        entryTime: mapping.entryTime ? normalizeTime(row[mapping.entryTime]) : null,
        exitTime: mapping.exitTime ? normalizeTime(row[mapping.exitTime]) : null,
      };

      records.push(record);
    }

    if (records.length === 0) {
      setError('لم يتم العثور على سجلات صالحة');
      return;
    }

    setPreviewRecords(records);
    setStep('preview');
  }, [parsedData, mapping]);

  const confirmUpload = useCallback(() => {
    if (previewRecords.length === 0 || !parsedData) return;

    setStep('processing');

    const dates = previewRecords.map((r) => r.date).sort();
    const reportData: UploadedReportData = {
      id: `report-${Date.now()}`,
      fileName: parsedData.fileName,
      uploadedAt: new Date().toISOString(),
      recordCount: previewRecords.length,
      dateRange: { from: dates[0], to: dates[dates.length - 1] },
      records: previewRecords,
    };

    operationsReportsRepository.saveReport(reportData);

    setTimeout(() => {
      onUploadComplete(reportData);
    }, 500);
  }, [previewRecords, parsedData, onUploadComplete]);

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div
              className={cn(
                'relative rounded-2xl border-2 border-dashed p-12 text-center transition-colors',
                'border-slate-300 dark:border-slate-600 hover:border-cyan-500 dark:hover:border-cyan-400',
                'bg-slate-50/50 dark:bg-slate-800/50'
              )}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleInputChange}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-100 dark:bg-cyan-900/30">
                  <Upload className="h-8 w-8 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    اسحب الملف هنا أو اضغط للرفع
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    يدعم ملفات Excel (.xlsx, .xls) و CSV (.csv)
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1.5">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Excel</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 px-3 py-1.5">
                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">CSV</span>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-300">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </motion.div>
        )}

        {step === 'mapping' && parsedData && (
          <motion.div
            key="mapping"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
              <div className="flex items-center gap-3 mb-6">
                <FileSpreadsheet className="h-6 w-6 text-cyan-600" />
                <div>
                  <h3 className="font-bold text-lg">{parsedData.fileName}</h3>
                  <p className="text-sm text-slate-500">{parsedData.rows.length} صف</p>
                </div>
              </div>

              <h4 className="font-semibold mb-4">تحديد الأعمدة</h4>
              <p className="text-sm text-slate-500 mb-4">
                حدد أي عمود يقابل كل بيان. الحقول المطلوبة مميزة بنجمة.
              </p>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(Object.keys(COLUMN_LABELS) as (keyof ColumnMapping)[]).map((key) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {COLUMN_LABELS[key]}
                      {key === 'staffName' && <span className="text-red-500 mr-1">*</span>}
                    </label>
                    <div className="relative">
                      <select
                        value={mapping[key] || ''}
                        onChange={(e) =>
                          setMapping((prev) => ({ ...prev, [key]: e.target.value || null }))
                        }
                        className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 pr-10 text-sm"
                      >
                        <option value="">— اختر العمود —</option>
                        {parsedData.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-300">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  إلغاء
                </button>
              )}
              <button
                onClick={() => {
                  setStep('upload');
                  setParsedData(null);
                  setError(null);
                }}
                className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                رجوع
              </button>
              <button
                onClick={processData}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-700"
              >
                <Check className="h-4 w-4" />
                معاينة البيانات
              </button>
            </div>
          </motion.div>
        )}

        {step === 'preview' && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-lg">معاينة البيانات</h3>
                <p className="text-sm text-slate-500">{previewRecords.length} سجل سيتم حفظه</p>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-right text-sm font-semibold">#</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">الاسم</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">التاريخ</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">وقت الدخول</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">وقت الخروج</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">المنطقة</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">المحافظة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRecords.slice(0, 50).map((r, idx) => (
                      <tr
                        key={r.id}
                        className={cn(
                          'border-t border-slate-100 dark:border-slate-700',
                          idx % 2 === 0 && 'bg-slate-50/50 dark:bg-slate-800/50'
                        )}
                      >
                        <td className="px-4 py-2 text-sm text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-2 font-medium">{r.staffName}</td>
                        <td className="px-4 py-2 text-sm">{r.date}</td>
                        <td className="px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400">
                          {r.entryTime || '—'}
                        </td>
                        <td className="px-4 py-2 text-sm text-red-600 dark:text-red-400">
                          {r.exitTime || '—'}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {r.region === 'baghdad' ? 'بغداد' : 'المحافظات'}
                        </td>
                        <td className="px-4 py-2 text-sm">{r.province || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewRecords.length > 50 && (
                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-700/50 text-center text-sm text-slate-500">
                  عرض 50 من {previewRecords.length} سجل
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setStep('mapping')}
                className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                رجوع للتعديل
              </button>
              <button
                onClick={confirmUpload}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700"
              >
                <Check className="h-4 w-4" />
                تأكيد وحفظ
              </button>
            </div>
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <Loader2 className="h-12 w-12 animate-spin text-cyan-600" />
            <p className="mt-4 text-lg font-semibold">جاري حفظ البيانات...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
