import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Brain, History, Loader2, Play, QrCode, RefreshCw, Sparkles, X } from 'lucide-react';
import QRCode from 'react-qr-code';
import type { DepartmentCode } from '../../data/department';
import { getDepartmentClient, getDepartmentTables } from '../../data/supabaseSource';
import { useInspectionIntelligence } from '../../hooks/useInspectionIntelligence';
import { buildInspectionDeepLink, type IntelligenceFilterKey } from '../../lib/inspectionIntelligence';
import { cn } from '../../lib/utils';

const WEEKDAY_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function statusStyle(status: 'healthy' | 'warning' | 'critical') {
  if (status === 'critical') return 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40';
  if (status === 'warning') return 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/40';
  return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/40';
}

function statusLabel(status: 'healthy' | 'warning' | 'critical') {
  if (status === 'critical') return 'حرج';
  if (status === 'warning') return 'تنبيه';
  return 'سليم';
}

export interface InspectionIntelligenceDrawerProps {
  open: boolean;
  onClose: () => void;
  /** قسم الصفحة الحالي — يُستخدم كقيمة افتراضية لمبدّل الذكاء */
  pageDepartment: DepartmentCode;
  onStartInspection: (vehicleId: number) => void;
  onOpenHistory: (vehicleId: number) => void;
}

export default function InspectionIntelligenceDrawer({
  open,
  onClose,
  pageDepartment,
  onStartInspection,
  onOpenHistory,
}: InspectionIntelligenceDrawerProps) {
  const [qrVehicleId, setQrVehicleId] = useState<number | null>(null);
  /** مرتبط بمساحة العمل الحالية فقط — لا تبديل إلى القسم الآخر (عزل تجهيز / تركيب). */
  const department = pageDepartment;

  useEffect(() => {
    if (open) setQrVehicleId(null);
  }, [open, pageDepartment]);

  const client = useMemo(() => getDepartmentClient(department), [department]);
  const tables = useMemo(() => getDepartmentTables(department), [department]);

  const {
    loading,
    error,
    analytics,
    refetch,
    filteredInsights,
    setFilter,
    filter,
    responsibleQuery,
    setResponsibleQuery,
  } = useInspectionIntelligence({
    client,
    tables,
    department,
    enabled: open,
  });

  const staffLabel = department === 'installation' ? 'فني' : 'سائق';

  const heatMax = useMemo(() => {
    if (!analytics) return 1;
    return Math.max(1, ...Object.values(analytics.heatmap));
  }, [analytics]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="إغلاق"
            className="fixed inset-0 z-[140] bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspection-intel-title"
            className={cn(
              'fixed top-0 right-0 z-[141] h-full w-full max-w-xl shadow-2xl',
              'border-l border-stone-200/80 dark:border-stone-700/80',
              'bg-white/90 dark:bg-stone-950/95 backdrop-blur-xl',
              'flex flex-col overflow-hidden',
            )}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-stone-200/80 dark:border-stone-700/80">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg">
                  <Brain className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 id="inspection-intel-title" className="text-sm font-black text-stone-900 dark:text-stone-100 truncate">
                    Inspection Intelligence
                  </h2>
                  <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400 truncate">
                    مركز تحليل الجرد الذكي
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300"
                  title="تحديث"
                >
                  <RefreshCw className={cn('h-5 w-5', loading && 'animate-spin')} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="shrink-0 px-4 py-2 border-b border-stone-200/60 dark:border-stone-800">
              <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400 mb-1.5">القسم (مساحة العمل الحالية)</p>
              <div
                className={cn(
                  'flex items-center justify-center rounded-xl px-3 py-2.5 text-xs font-black border',
                  department === 'installation'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                    : 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-200',
                )}
              >
                {department === 'installation' ? 'تركيب — بيانات معزولة' : 'تجهيز — بيانات معزولة'}
              </div>
              <p className="text-[9px] text-stone-400 dark:text-stone-500 mt-1.5 leading-relaxed">
                لا يمكن عرض أو جلب بيانات القسم الآخر من هذه الصفحة؛ يُفتح الذكاء حسب القسم الذي تعمل منه.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {loading && !analytics && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-stone-500">
                  <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
                  <p className="text-sm font-bold">جاري تحليل البيانات…</p>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-800 dark:text-red-200">
                  {error}
                </div>
              )}

              {analytics && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-stone-50/80 dark:bg-stone-900/50 p-3">
                      <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400">التزام</p>
                      <p className="text-2xl font-black text-stone-900 dark:text-stone-50">{analytics.summary.complianceRate}%</p>
                    </div>
                    <div className="rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-stone-50/80 dark:bg-stone-900/50 p-3">
                      <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400">متوسط التأخير</p>
                      <p className="text-2xl font-black text-stone-900 dark:text-stone-50">
                        {analytics.summary.averageDelayDays != null ? analytics.summary.averageDelayDays : '—'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-stone-50/80 dark:bg-stone-900/50 p-3">
                      <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400">جرد بالدورة</p>
                      <p className="text-lg font-black text-stone-900 dark:text-stone-50">
                        {analytics.summary.completedInCycleEstimate}/{analytics.summary.expectedInCycleEstimate}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-stone-50/80 dark:bg-stone-900/50 p-3">
                      <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400">استحق اليوم</p>
                      <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{analytics.summary.dueTodayCount}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black border',
                        statusStyle('critical'),
                      )}
                    >
                      حرج {analytics.summary.criticalCount}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black border',
                        statusStyle('warning'),
                      )}
                    >
                      تنبيه {analytics.summary.warningCount}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black border',
                        statusStyle('healthy'),
                      )}
                    >
                      سليم {analytics.summary.healthyCount}
                    </span>
                  </div>

                  {(analytics.summary.criticalCount > 0 || analytics.summary.dueTodayCount > 0) && (
                    <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 dark:bg-amber-950/30 px-3 py-2.5 space-y-1">
                      <p className="text-xs font-black text-amber-900 dark:text-amber-100 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        تنبيهات ذكية
                      </p>
                      <ul className="text-[11px] font-semibold text-amber-900/90 dark:text-amber-100/90 space-y-0.5 list-disc list-inside">
                        {analytics.summary.dueTodayCount > 0 && (
                          <li>{analytics.summary.dueTodayCount} مركبة يُنصح بجردها اليوم</li>
                        )}
                        {analytics.summary.criticalCount > 0 && (
                          <li>{analytics.summary.criticalCount} مركبة متأخرة عن دورة الجرد</li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] font-black text-stone-500 dark:text-stone-400 mb-2">توزيع التأخير (أيام الأسبوع)</p>
                    <div className="flex items-end justify-between gap-1 h-28 px-1">
                      {WEEKDAY_AR.map((label, idx) => {
                        const v = analytics.heatmap[idx] ?? 0;
                        const px = Math.round(Math.max(6, (v / heatMax) * 72));
                        return (
                          <div key={label} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0 h-full">
                            <div
                              className="w-full max-w-[28px] mx-auto rounded-t-md bg-gradient-to-t from-violet-600/80 to-fuchsia-500/70 dark:from-violet-500/60 dark:to-fuchsia-400/50"
                              style={{ height: `${px}px` }}
                              title={`${label}: ${v}`}
                            />
                            <span className="text-[8px] font-bold text-stone-500 dark:text-stone-400 truncate w-full text-center">
                              {label.slice(0, 3)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-stone-500 dark:text-stone-400">فلترة</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          ['all', 'الكل'],
                          ['overdue', 'متأخر'],
                          ['today', 'اليوم'],
                          ['this_week', 'هذا الأسبوع'],
                          ['by_responsible', 'بحث مسؤول'],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setFilter(key as IntelligenceFilterKey)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[10px] font-black transition-all border',
                            filter === key
                              ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-transparent'
                              : 'bg-stone-100/80 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 border-stone-200/80 dark:border-stone-700',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="search"
                      placeholder={`بحث لوحة / ${staffLabel}…`}
                      value={responsibleQuery}
                      onChange={(e) => setResponsibleQuery(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white/80 dark:bg-stone-900/60 px-3 py-2 text-sm font-semibold text-stone-900 dark:text-stone-100"
                    />
                  </div>

                  <div className="space-y-3 pb-8">
                    {filteredInsights.map((row) => (
                      <div
                        key={row.vehicleId}
                        className={cn(
                          'rounded-2xl border p-3 space-y-2 shadow-sm',
                          statusStyle(row.status),
                          row.delayPatternHint && 'ring-2 ring-orange-400/60',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-stone-900 dark:text-stone-50 truncate">{row.plateNumber}</p>
                            <p className="text-[10px] font-bold text-stone-600 dark:text-stone-300">
                              {staffLabel}: {row.responsibleName}
                            </p>
                            <p className="text-[10px] font-mono text-stone-500 dark:text-stone-400 mt-0.5">
                              {statusLabel(row.status)} · درجة {row.grade} · {row.score}/100
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] font-black px-2 py-0.5 rounded-md bg-white/50 dark:bg-black/20">
                            #{row.vehicleId}
                          </span>
                        </div>
                        {row.delayPatternHint && (
                          <p className="text-[10px] font-bold text-orange-800 dark:text-orange-200 flex items-start gap-1">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            نمط تأخير متكرر في آخر التقارير ({row.recentDelayedReportCount})
                          </p>
                        )}
                        <p className="text-[10px] font-semibold text-stone-600 dark:text-stone-300 leading-relaxed">
                          آخر جرد: {row.lastInspectionDate ?? '—'} · التالي: {row.nextInspectionDate ?? '—'}
                          {row.daysLeft != null && ` · متبقي ${row.daysLeft} يوم`}
                          {row.delayDays != null && ` · تأخير ${row.delayDays} يوم`}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              onStartInspection(row.vehicleId);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-[10px] font-black"
                          >
                            <Play className="h-3.5 w-3.5" />
                            ابدأ الجرد
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onOpenHistory(row.vehicleId);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-stone-300 dark:border-stone-600 bg-white/60 dark:bg-stone-900/40 px-3 py-1.5 text-[10px] font-black text-stone-800 dark:text-stone-100"
                          >
                            <History className="h-3.5 w-3.5" />
                            السجل
                          </button>
                          <button
                            type="button"
                            onClick={() => setQrVehicleId(qrVehicleId === row.vehicleId ? null : row.vehicleId)}
                            className="inline-flex items-center gap-1 rounded-xl border border-stone-300 dark:border-stone-600 bg-white/60 dark:bg-stone-900/40 px-3 py-1.5 text-[10px] font-black text-stone-800 dark:text-stone-100"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            QR
                          </button>
                        </div>
                        {qrVehicleId === row.vehicleId && (
                          <div className="flex flex-col items-center gap-2 pt-2 bg-white/70 dark:bg-black/20 rounded-xl p-3">
                            <QRCode
                              value={buildInspectionDeepLink(department, row.vehicleId)}
                              size={140}
                              level="M"
                              className="rounded-lg"
                            />
                            <p className="text-[9px] font-bold text-stone-500 dark:text-stone-400 text-center max-w-[220px] leading-snug">
                              الرابط ثابت لهذه المركبة والقسم؛ يصلح للطباعة على المركبة عند استخدام نطاق إنتاج ثابت
                              {import.meta.env.VITE_INSPECTION_QR_BASE_URL ? ' (مفعّل VITE_INSPECTION_QR_BASE_URL).' : '.'}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                    {filteredInsights.length === 0 && (
                      <p className="text-center text-sm font-bold text-stone-400 py-8">لا توجد نتائج للفلتر الحالي</p>
                    )}
                  </div>
                </>
              )}
            </div>

            <footer className="shrink-0 border-t border-stone-200/80 dark:border-stone-700/80 px-4 py-2 text-[9px] font-bold text-stone-400 text-center">
              دورة الجرد الافتراضية: 7 أيام · تحليل محلي بدون AI خارجي
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
