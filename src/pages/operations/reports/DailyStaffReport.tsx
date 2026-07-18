import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  Users,
  MapPin,
  TrendingUp,
  Download,
  Upload,
  ChevronDown,
  FileSpreadsheet,
  Trash2,
  Settings,
  X,
  Save,
  Loader2,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import OperationsPageShell from '../../../components/operations/OperationsPageShell';
import FileUploader from '../../../components/operations/reports/FileUploader';
import { ComparisonGrid } from '../../../components/operations/reports/ComparisonCard';
import { operationsReportsRepository } from '../../../data/repositories/operationsReportsRepository';
import { exportToExcel } from '../../../lib/excelExport';
import type {
  StaffTimingRecord,
  DailyStaffSummary,
  UploadedReportData,
  RegionType,
  ComparisonData,
} from './types';
import { REGION_LABELS, DEFAULT_EXPECTED_TIMES } from './types';

type ViewMode = 'summary' | 'details' | 'upload' | 'settings';

export default function DailyStaffReport() {
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const dates = operationsReportsRepository.getUniqueDates();
    return dates[0] || new Date().toISOString().slice(0, 10);
  });
  const [selectedRegion, setSelectedRegion] = useState<RegionType>('all');
  const [reports, setReports] = useState<UploadedReportData[]>([]);
  const [records, setRecords] = useState<StaffTimingRecord[]>([]);
  const [summaries, setSummaries] = useState<DailyStaffSummary[]>([]);
  const [comparisons, setComparisons] = useState<ComparisonData[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expectedTimes, setExpectedTimes] = useState(DEFAULT_EXPECTED_TIMES);

  const loadData = useCallback(() => {
    const allReports = operationsReportsRepository.getReports();
    setReports(allReports);

    const dates = operationsReportsRepository.getUniqueDates();
    setAvailableDates(dates);

    if (dates.length > 0 && !dates.includes(selectedDate)) {
      setSelectedDate(dates[0]);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedDate) return;

    const dayRecords = operationsReportsRepository.getRecordsByDate(selectedDate);
    setRecords(dayRecords);

    const daySummaries = operationsReportsRepository.calculateDailySummary(
      dayRecords,
      selectedRegion
    );
    setSummaries(daySummaries);

    const dayComparisons = operationsReportsRepository.calculateComparisons(
      dayRecords,
      selectedDate
    );
    setComparisons(dayComparisons);
  }, [selectedDate, selectedRegion]);

  const handleUploadComplete = useCallback(
    (data: UploadedReportData) => {
      loadData();
      setSelectedDate(data.dateRange.to);
      setViewMode('summary');
    },
    [loadData]
  );

  const handleDeleteReport = useCallback(
    (id: string) => {
      if (!window.confirm('هل أنت متأكد من حذف هذا التقرير؟')) return;
      operationsReportsRepository.deleteReport(id);
      loadData();
    },
    [loadData]
  );

  const handleExport = useCallback(() => {
    if (records.length === 0) return;

    const headers = ['الاسم', 'التاريخ', 'وقت الدخول', 'وقت الخروج', 'المنطقة', 'المحافظة'];
    const rows = records.map((r) => [
      r.staffName,
      r.date,
      r.entryTime || '—',
      r.exitTime || '—',
      REGION_LABELS[r.region],
      r.province || '—',
    ]);

    exportToExcel([headers, ...rows], `تقرير_الكادر_${selectedDate}.xlsx`);
  }, [records, selectedDate]);

  const handleSaveSettings = useCallback(() => {
    const settings: Record<string, { region: RegionType; expectedEntryTime: string; expectedExitTime: string }> = {};
    for (const [region, times] of Object.entries(expectedTimes)) {
      settings[region] = {
        region: region as RegionType,
        expectedEntryTime: times.entry,
        expectedExitTime: times.exit,
      };
    }
    operationsReportsRepository.saveSettings(settings);
    setSettingsOpen(false);
    loadData();
  }, [expectedTimes, loadData]);

  const regionStats = useMemo(() => {
    const stats = {
      baghdad: { total: 0, firstEntry: null as string | null, lastExit: null as string | null },
      provinces: { total: 0, firstEntry: null as string | null, lastExit: null as string | null },
    };

    for (const s of summaries) {
      if (s.region === 'baghdad') {
        stats.baghdad.total += s.totalStaff;
        if (s.firstEntry && (!stats.baghdad.firstEntry || s.firstEntry < stats.baghdad.firstEntry)) {
          stats.baghdad.firstEntry = s.firstEntry;
        }
        if (s.lastExit && (!stats.baghdad.lastExit || s.lastExit > stats.baghdad.lastExit)) {
          stats.baghdad.lastExit = s.lastExit;
        }
      } else if (s.region === 'provinces') {
        stats.provinces.total += s.totalStaff;
        if (s.firstEntry && (!stats.provinces.firstEntry || s.firstEntry < stats.provinces.firstEntry)) {
          stats.provinces.firstEntry = s.firstEntry;
        }
        if (s.lastExit && (!stats.provinces.lastExit || s.lastExit > stats.provinces.lastExit)) {
          stats.provinces.lastExit = s.lastExit;
        }
      }
    }

    return stats;
  }, [summaries]);

  const totalStats = useMemo(() => {
    return {
      total: records.length,
      onTime: summaries.reduce((acc, s) => acc + s.onTimeCount, 0),
      late: summaries.reduce((acc, s) => acc + s.lateCount, 0),
    };
  }, [records, summaries]);

  return (
    <OperationsPageShell
      title="التقارير اليومية"
      subtitle="تقرير أوقات دخول وخروج كادر التجهيز مفصل حسب المحافظات"
      icon={Calendar}
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setViewMode('upload')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-700"
          >
            <Upload className="h-4 w-4" />
            رفع ملف
          </button>
          <button
            onClick={handleExport}
            disabled={records.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            تصدير
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <AnimatePresence mode="wait">
        {viewMode === 'upload' ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <FileUploader
              onUploadComplete={handleUploadComplete}
              onCancel={() => setViewMode('summary')}
            />
          </motion.div>
        ) : (
          <motion.div
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  التاريخ
                </label>
                <div className="relative">
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="appearance-none rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 pr-10 text-sm font-medium min-w-[160px]"
                  >
                    {availableDates.length === 0 && (
                      <option value="">لا توجد بيانات</option>
                    )}
                    {availableDates.map((d) => (
                      <option key={d} value={d}>
                        {new Date(d).toLocaleDateString('ar-IQ', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  المنطقة
                </label>
                <div className="relative">
                  <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value as RegionType)}
                    className="appearance-none rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 pr-10 text-sm font-medium min-w-[140px]"
                  >
                    <option value="all">الكل</option>
                    <option value="baghdad">بغداد</option>
                    <option value="provinces">المحافظات</option>
                  </select>
                  <ChevronDown className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('summary')}
                  className={cn(
                    'px-4 py-2.5 rounded-xl font-medium transition-colors',
                    viewMode === 'summary'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'
                  )}
                >
                  ملخص
                </button>
                <button
                  onClick={() => setViewMode('details')}
                  className={cn(
                    'px-4 py-2.5 rounded-xl font-medium transition-colors',
                    viewMode === 'details'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'
                  )}
                >
                  تفاصيل
                </button>
              </div>
            </div>

            {records.length === 0 ? (
              <div className="text-center py-16 text-slate-500 dark:text-slate-400">
                <FileSpreadsheet className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">لا توجد بيانات</p>
                <p className="text-sm mt-2">ارفع ملف Excel أو CSV لبدء التحليل</p>
                <button
                  onClick={() => setViewMode('upload')}
                  className="mt-4 px-6 py-2.5 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-700"
                >
                  رفع ملف
                </button>
              </div>
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 dark:bg-cyan-900/30">
                        <Users className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <span className="text-sm font-medium text-slate-500">إجمالي الكادر</span>
                    </div>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">
                      {totalStats.total}
                    </p>
                    <div className="mt-2 flex gap-3 text-sm">
                      <span className="text-emerald-600">{totalStats.onTime} في الوقت</span>
                      <span className="text-red-600">{totalStats.late} متأخر</span>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                        <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        أول دخول - بغداد
                      </span>
                    </div>
                    <p className="text-3xl font-black text-emerald-800 dark:text-emerald-200">
                      {regionStats.baghdad.firstEntry || '—'}
                    </p>
                    <p className="mt-2 text-sm text-emerald-600">
                      {regionStats.baghdad.total} موظف
                    </p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                        <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        أول دخول - المحافظات
                      </span>
                    </div>
                    <p className="text-3xl font-black text-blue-800 dark:text-blue-200">
                      {regionStats.provinces.firstEntry || '—'}
                    </p>
                    <p className="mt-2 text-sm text-blue-600">
                      {regionStats.provinces.total} موظف
                    </p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                        <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                        نسبة الالتزام
                      </span>
                    </div>
                    <p className="text-3xl font-black text-purple-800 dark:text-purple-200">
                      {totalStats.total > 0
                        ? Math.round((totalStats.onTime / totalStats.total) * 100)
                        : 0}
                      %
                    </p>
                    <p className="mt-2 text-sm text-purple-600">من إجمالي الكادر</p>
                  </motion.div>
                </div>

                {/* Region Summary Table */}
                {viewMode === 'summary' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6"
                  >
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="font-bold text-lg">ملخص حسب المنطقة</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50 dark:bg-slate-700/50">
                            <tr>
                              <th className="px-6 py-3 text-right text-sm font-semibold">المنطقة</th>
                              <th className="px-6 py-3 text-right text-sm font-semibold">عدد الكادر</th>
                              <th className="px-6 py-3 text-right text-sm font-semibold">أول دخول</th>
                              <th className="px-6 py-3 text-right text-sm font-semibold">اسم الموظف</th>
                              <th className="px-6 py-3 text-right text-sm font-semibold">آخر خروج</th>
                              <th className="px-6 py-3 text-right text-sm font-semibold">اسم الموظف</th>
                              <th className="px-6 py-3 text-right text-sm font-semibold">في الوقت</th>
                              <th className="px-6 py-3 text-right text-sm font-semibold">متأخرون</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summaries.map((s, idx) => (
                              <tr
                                key={`${s.date}-${s.region}-${s.province || ''}`}
                                className={cn(
                                  'border-t border-slate-100 dark:border-slate-700',
                                  idx % 2 === 0 && 'bg-slate-50/50 dark:bg-slate-800/50'
                                )}
                              >
                                <td className="px-6 py-3 font-medium">
                                  {s.province || REGION_LABELS[s.region]}
                                </td>
                                <td className="px-6 py-3">{s.totalStaff}</td>
                                <td className="px-6 py-3 text-emerald-600 dark:text-emerald-400 font-mono">
                                  {s.firstEntry || '—'}
                                </td>
                                <td className="px-6 py-3 text-sm text-slate-500">
                                  {s.firstEntryStaff || '—'}
                                </td>
                                <td className="px-6 py-3 text-red-600 dark:text-red-400 font-mono">
                                  {s.lastExit || '—'}
                                </td>
                                <td className="px-6 py-3 text-sm text-slate-500">
                                  {s.lastExitStaff || '—'}
                                </td>
                                <td className="px-6 py-3 text-emerald-600">{s.onTimeCount}</td>
                                <td className="px-6 py-3 text-red-600">{s.lateCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Comparisons */}
                    <div>
                      <h3 className="font-bold text-lg mb-4">المقارنات والنسب</h3>
                      <ComparisonGrid comparisons={comparisons} />
                    </div>
                  </motion.div>
                )}

                {/* Details View */}
                {viewMode === 'details' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
                  >
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                      <h3 className="font-bold text-lg">تفاصيل الكادر</h3>
                      <p className="text-sm text-slate-500">{records.length} سجل</p>
                    </div>
                    <div className="overflow-x-auto max-h-[500px]">
                      <table className="w-full min-w-[700px]">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-right text-sm font-semibold">#</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold">الاسم</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold">وقت الدخول</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold">وقت الخروج</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold">المنطقة</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold">المحافظة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.map((r, idx) => (
                            <tr
                              key={r.id}
                              className={cn(
                                'border-t border-slate-100 dark:border-slate-700',
                                idx % 2 === 0 && 'bg-slate-50/50 dark:bg-slate-800/50'
                              )}
                            >
                              <td className="px-4 py-2 text-sm text-slate-500">{idx + 1}</td>
                              <td className="px-4 py-2 font-medium">{r.staffName}</td>
                              <td className="px-4 py-2 text-emerald-600 dark:text-emerald-400 font-mono">
                                {r.entryTime || '—'}
                              </td>
                              <td className="px-4 py-2 text-red-600 dark:text-red-400 font-mono">
                                {r.exitTime || '—'}
                              </td>
                              <td className="px-4 py-2">{REGION_LABELS[r.region]}</td>
                              <td className="px-4 py-2 text-slate-500">{r.province || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {/* Uploaded Reports */}
                {reports.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
                    <h3 className="font-bold text-lg mb-4">الملفات المرفوعة</h3>
                    <div className="space-y-3">
                      {reports.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4"
                        >
                          <div className="flex items-center gap-3">
                            <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                            <div>
                              <p className="font-medium">{r.fileName}</p>
                              <p className="text-sm text-slate-500">
                                {r.recordCount} سجل • {r.dateRange.from} إلى {r.dateRange.to}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteReport(r.id)}
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50"
              onClick={() => setSettingsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-4 z-50 m-auto max-w-lg max-h-[90vh] overflow-auto rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-xl">إعدادات الأوقات المتوقعة</h3>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6">
                {(['baghdad', 'provinces'] as const).map((region) => (
                  <div key={region} className="space-y-3">
                    <h4 className="font-semibold">{REGION_LABELS[region]}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-500 mb-1">وقت الدخول المتوقع</label>
                        <input
                          type="time"
                          value={expectedTimes[region].entry}
                          onChange={(e) =>
                            setExpectedTimes((prev) => ({
                              ...prev,
                              [region]: { ...prev[region], entry: e.target.value },
                            }))
                          }
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-500 mb-1">وقت الخروج المتوقع</label>
                        <input
                          type="time"
                          value={expectedTimes[region].exit}
                          onChange={(e) =>
                            setExpectedTimes((prev) => ({
                              ...prev,
                              [region]: { ...prev[region], exit: e.target.value },
                            }))
                          }
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 font-medium"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-700"
                >
                  <Save className="h-4 w-4" />
                  حفظ
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </OperationsPageShell>
  );
}
