import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Loader2, ArrowRight, Printer, Package } from 'lucide-react';
import { getDepartmentClient, getDepartmentTables } from '../data/supabaseSource';
import type { DepartmentCode } from '../data/department';
import { WEEKLY_INSPECTION_ITEMS, TOOL_INVENTORY_ITEMS } from '../constants';
import { exportHtmlToPdf, wrapReportHtmlForPdf } from '../lib/pdfExport';
import { mapDbRowToSavedReportView, type SavedReportView } from '../lib/savedReportFromRow';
import { getVehicleInspectionMapUrl } from '../lib/vehicleInspectionMapUrl';

interface InventoryItemView {
  id: number;
  name: string;
  quantity: number;
  sortOrder: number;
}

interface SavedReportDetailModalProps {
  department: DepartmentCode;
  reportId: number | null;
  onClose: () => void;
}

export default function SavedReportDetailModal({ department, reportId, onClose }: SavedReportDetailModalProps) {
  const supabase = getDepartmentClient(department);
  const tables = getDepartmentTables(department);
  const isInstallation = department === 'installation';
  const staffLabel = isInstallation ? 'الفني' : 'السائق';
  const departmentManagerText = isInstallation ? 'مسؤول قسم التركيب' : 'مسؤول قسم التجهيز';
  const toolsSectionTitle = isInstallation ? 'جرد عدة كادر التركيب' : 'جرد العدة والمواد';

  const [viewingReport, setViewingReport] = useState<SavedReportView | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemView[]>([]);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reportId == null) {
      setViewingReport(null);
      setLoadState('idle');
      return;
    }

    let cancelled = false;
    setLoadState('loading');
    setViewingReport(null);

    (async () => {
      const [repRes, invRes] = await Promise.all([
        supabase.from(tables.reports).select('*').eq('id', reportId).maybeSingle(),
        supabase
          .from(tables.inventoryTemplates)
          .select('*')
          .eq('department_code', department)
          .eq('category', 'tools')
          .eq('is_active', true)
          .order('sort_order'),
      ]);

      if (cancelled) return;

      if (repRes.error) {
        console.error('[SavedReportDetailModal] report fetch:', repRes.error);
        setLoadState('error');
        return;
      }
      if (!repRes.data) {
        setLoadState('error');
        return;
      }

      const mapped = mapDbRowToSavedReportView(repRes.data as Record<string, unknown>, isInstallation);
      setViewingReport(mapped);

      const rows = (invRes.data ?? []) as Array<Record<string, unknown>>;
      if (rows.length === 0) {
        setInventoryItems(
          TOOL_INVENTORY_ITEMS.map((item, index) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            sortOrder: index + 1,
          })),
        );
      } else {
        setInventoryItems(
          rows.map((row) => ({
            id: Number(row.id),
            name: String(row.item_name ?? ''),
            quantity: Number(row.required_quantity ?? 0),
            sortOrder: Number(row.sort_order ?? 0),
          })),
        );
      }
      setLoadState('idle');
    })();

    return () => {
      cancelled = true;
    };
  }, [reportId, department, supabase, tables.reports, tables.inventoryTemplates, isInstallation]);

  const exportPDF = useCallback(async () => {
    if (!reportRef.current || !viewingReport) return;
    setIsExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const raw = reportRef.current.innerHTML;
      const html = wrapReportHtmlForPdf(raw, window.location.origin);
      const truck = String(viewingReport.truckNumber || 'truck').replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '-');
      const dt = String(viewingReport.date || new Date().toISOString().slice(0, 10));
      await exportHtmlToPdf(html, `report-${truck}-${dt}.pdf`, { reportInspectionLayout: true });
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  }, [viewingReport]);

  const open = reportId != null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-[rgba(0,0,0,0.6)] backdrop-blur-sm flex items-center justify-center p-4"
          onClick={loadState !== 'loading' ? onClose : undefined}
        >
          <motion.div
            initial={{ scale: 0.95, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 16 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-stone-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl relative"
            dir="rtl"
          >
            <div className="sticky top-0 bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 p-4 flex justify-between items-center z-10 gap-2 flex-wrap">
              <div className="flex gap-2 flex-wrap">
                {viewingReport && (
                  <>
                    <button
                      type="button"
                      onClick={exportPDF}
                      disabled={isExporting}
                      className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-xl font-bold text-sm hover:bg-red-800 transition-colors disabled:opacity-50"
                    >
                      {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {isExporting ? 'جاري التحميل...' : 'تحميل PDF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl font-bold text-sm hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                      طباعة
                    </button>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-full transition-colors shrink-0"
                aria-label="إغلاق"
              >
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>

            {loadState === 'loading' && (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-rose-600" />
                <p className="text-sm text-stone-500">جاري تحميل التقرير...</p>
              </div>
            )}

            {loadState === 'error' && (
              <div className="p-8 text-center space-y-3">
                <p className="text-stone-600 dark:text-stone-300 font-medium">تعذّر تحميل التقرير أو غير موجود.</p>
                <button type="button" onClick={onClose} className="text-sm text-rose-600 font-bold hover:underline">
                  إغلاق
                </button>
              </div>
            )}

            {loadState === 'idle' && viewingReport && (
              <div ref={reportRef} id="print-section" className="p-12 space-y-12 bg-white dark:bg-stone-900">
                <div className="flex justify-between items-start border-b-4 border-rose-400 pb-8" style={{ pageBreakInside: 'avoid' }}>
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 flex items-center justify-center bg-rose-50 rounded-2xl">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-12 h-12 text-rose-500"
                      >
                        <path d="M3 14l9-9 9 9" />
                      </svg>
                    </div>
                    <div className="border-r-4 border-stone-200 pr-6">
                      <h1 className="text-4xl font-black text-stone-900 leading-tight">الحسني هوم سنتر</h1>
                      <h2 className="text-2xl font-bold text-stone-800 leading-tight">ALHASANI HOME CENTER</h2>
                    </div>
                  </div>
                  <div className="text-left">
                    <h2 className="text-3xl font-bold text-rose-500">تقرير فحص المركبة</h2>
                    <p className="text-stone-500 font-mono text-lg">#{viewingReport.id.toString().padStart(5, '0')}</p>
                    <div className="mt-6 text-right">
                      <h3 className="text-xl font-black text-stone-900">الحسني هوم سنتر</h3>
                      <p className="text-xs font-bold text-stone-500">ALHASANI HOME CENTER</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-8 bg-stone-50 p-6 rounded-2xl" style={{ pageBreakInside: 'avoid' }}>
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">{staffLabel}</span>
                    <p className="font-bold text-lg">{viewingReport.driverName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">رقم المركبة</span>
                    <p className="font-bold text-lg">{viewingReport.truckNumber}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">التاريخ</span>
                    <p className="font-bold text-lg">{viewingReport.date}</p>
                  </div>
                </div>

                <div className="pdf-damage-stack">
                  <div className="space-y-4 pdf-section">
                    <h3 className="text-xl font-bold border-r-4 border-rose-400 pr-4">مخطط أضرار المركبة</h3>
                    <div className="pdf-vehicle-map relative rounded-2xl overflow-hidden border-2 border-stone-100">
                      <img
                        src={getVehicleInspectionMapUrl(department, viewingReport.vehicleType)}
                        alt="مخطط المركبة"
                        className="w-full h-auto object-contain"
                      />
                      {(viewingReport.damagePoints as Array<{ x: number; y: number; severity?: string }>).map((point, idx) => (
                        <div
                          key={idx}
                          className="absolute w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                          style={{
                            left: `${point.x}%`,
                            top: `${point.y}%`,
                            transform: 'translate(-50%, -50%)',
                            backgroundColor:
                              point.severity === 'high' ? '#dc2626' : point.severity === 'medium' ? '#f97316' : '#facc15',
                          }}
                        >
                          <span className="text-[10px] font-bold text-white">{idx + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pdf-section">
                    <h3 className="text-xl font-bold border-r-4 border-red-700 pr-4">أضرار المركبة الموثقة</h3>
                  {viewingReport.damagePoints.length === 0 ? (
                    <p className="text-stone-400 dark:text-stone-500 italic">لا توجد أضرار مسجلة</p>
                  ) : (
                    <div className="space-y-4">
                      {(viewingReport.damagePoints as Array<{ severity?: string; description?: string; images?: string[] }>).map(
                        (p, idx) => (
                          <div
                            key={idx}
                            className="pdf-damage-card border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden"
                          >
                            <div className="flex items-center gap-4 p-3 bg-white dark:bg-stone-800 border-b border-stone-100 dark:border-stone-700">
                              <span className="font-mono font-bold text-stone-300 dark:text-stone-500">#{idx + 1}</span>
                              <span
                                className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap ${
                                  p.severity === 'high'
                                    ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
                                    : 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200'
                                }`}
                              >
                                {p.severity === 'high' ? 'كبير' : 'متوسط'}
                              </span>
                              <p className="flex-1 font-medium">{p.description}</p>
                            </div>
                            {p.images && p.images.length > 0 && (
                              <div className="p-4 bg-stone-50 dark:bg-stone-700 border-t border-stone-100 dark:border-stone-700">
                                <p className="text-xs font-bold text-stone-600 dark:text-stone-300 mb-4">
                                  صور الضرر ({p.images.length}):
                                </p>
                                <div className="space-y-4">
                                  {p.images.map((image: string, imgIdx: number) => (
                                    <div
                                      key={imgIdx}
                                      className="bg-white dark:bg-stone-800 rounded border border-stone-200 dark:border-stone-700 flex flex-col w-full h-auto"
                                    >
                                      <img
                                        src={image}
                                        alt={`صورة الضرر ${imgIdx + 1}`}
                                        className="report-embed-photo"
                                        style={{
                                          width: '100%',
                                          height: 'auto',
                                          display: 'block',
                                          maxHeight: '600px',
                                          objectFit: 'contain',
                                          backgroundColor: '#ffffff',
                                        }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
                </div>

                <div className="space-y-4 pdf-section">
                  <h3 className="text-xl font-bold border-r-4 border-rose-400 pr-4">نتائج الفحص الأسبوعي</h3>
                  <div className="space-y-2">
                    {WEEKLY_INSPECTION_ITEMS.map((item) => (
                      <div
                        key={item.id}
                        className="pdf-print-flow-row flex items-center justify-between p-3 border-b border-stone-100 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-lg text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-stone-400 dark:text-stone-500 font-mono text-xs">{item.id.toString().padStart(2, '0')}</span>
                          <span className="font-medium">{item.label}</span>
                        </div>
                        <span
                          className={`font-bold px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${
                            viewingReport.inspectionValues[item.id]
                              ? 'bg-green-50 dark:bg-green-900 text-green-600 dark:text-green-200'
                              : 'bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200'
                          }`}
                        >
                          {viewingReport.inspectionValues[item.id] ? '✓ سليم' : '✗ غير سليم'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pdf-section">
                  <h3 className="text-xl font-bold border-r-4 border-rose-400 pr-4">{toolsSectionTitle}</h3>
                  <div className="space-y-4">
                    {inventoryItems.map((item) => (
                      <div key={item.id} className="pdf-print-flow-row border border-stone-200 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between p-3 bg-white dark:bg-stone-800 border-b border-stone-100 dark:border-stone-700">
                          <div className="flex items-center gap-3">
                            <Package className="w-4 h-4 text-stone-400 dark:text-stone-500" />
                            <span className="font-medium">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-6">
                            <span className="text-xs text-stone-400 dark:text-stone-500 whitespace-nowrap">المطلوب: {item.quantity}</span>
                            <span
                              className={`font-bold px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${
                                (viewingReport.toolValues[item.id] || 0) < item.quantity
                                  ? 'bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200'
                                  : 'bg-green-50 dark:bg-green-900 text-green-600 dark:text-green-200'
                              }`}
                            >
                              المتوفر: {viewingReport.toolValues[item.id] || 0}
                            </span>
                          </div>
                        </div>
                        {viewingReport.toolImages?.[item.id] && viewingReport.toolImages[item.id].length > 0 && (
                          <div className="p-4 bg-stone-50 dark:bg-stone-700 border-t border-stone-100 dark:border-stone-700">
                            <p className="text-xs font-bold text-stone-600 dark:text-stone-300 mb-4">
                              الصور المرتبطة ({viewingReport.toolImages[item.id].length}):
                            </p>
                            <div className="space-y-4">
                              {viewingReport.toolImages[item.id].map((image: string, imgIdx: number) => (
                                <div
                                  key={imgIdx}
                                  className="bg-white dark:bg-stone-800 rounded border border-stone-200 dark:border-stone-700 flex flex-col w-full h-auto"
                                >
                                  <img
                                    src={image}
                                    alt={`${item.name} - الصورة ${imgIdx + 1}`}
                                    className="report-embed-photo"
                                    style={{
                                      width: '100%',
                                      height: 'auto',
                                      display: 'block',
                                      maxHeight: '600px',
                                      objectFit: 'contain',
                                      backgroundColor: '#ffffff',
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pdf-section pdf-section-signatures flex flex-wrap gap-x-8 gap-y-12 pt-12 border-t border-stone-100 dark:border-stone-700">
                  <div className="text-center space-y-4 flex-1 min-w-[200px]">
                    <p className="text-sm font-bold text-stone-500 dark:text-stone-400">{`اسم وتوقيع ${staffLabel}`}</p>
                    <div className="h-24 border-b border-stone-200 dark:border-stone-700 flex items-center justify-center bg-white dark:bg-stone-800">
                      {viewingReport.driverSignature && <img src={viewingReport.driverSignature} className="max-h-full" alt="" />}
                    </div>
                    <p className="text-xs font-bold text-stone-400 dark:text-stone-500">{viewingReport.driverName}</p>
                  </div>
                  <div className="text-center space-y-4 flex-1 min-w-[200px]">
                    <p className="text-sm font-bold text-stone-500 dark:text-stone-400">{departmentManagerText}</p>
                    <div className="h-24 border-b border-stone-200 dark:border-stone-700 flex items-center justify-center bg-white dark:bg-stone-800">
                      {viewingReport.equipmentManagerSignature && (
                        <img src={viewingReport.equipmentManagerSignature} className="max-h-full" alt="" />
                      )}
                    </div>
                  </div>
                  <div className="text-center space-y-4 flex-1 min-w-[200px]">
                    <p className="text-sm font-bold text-stone-500">مدير قسم اللوجستك</p>
                    <div className="h-24 border-b border-stone-200 flex items-center justify-center">
                      {viewingReport.logisticsManagerSignature && (
                        <img src={viewingReport.logisticsManagerSignature} className="max-h-full" alt="" />
                      )}
                    </div>
                  </div>
                  <div className="text-center space-y-4 flex-1 min-w-[200px]">
                    <p className="text-sm font-bold text-stone-500">مدير المخازن</p>
                    <div className="h-24 border-b border-stone-200 flex items-center justify-center">
                      {viewingReport.warehouseManagerSignature && (
                        <img src={viewingReport.warehouseManagerSignature} className="max-h-full" alt="" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-12 border-t border-stone-100 flex justify-between items-center text-[10px] text-stone-400 font-bold">
                  <p>تم إنشاء هذا التقرير إلكترونياً عبر نظام الحسني هوم سنتر</p>
                  <p>{new Date(viewingReport.createdAt).toLocaleString('ar-EG')}</p>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
