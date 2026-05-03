import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ClipboardList,
  Download,
  FileSpreadsheet,
  History as HistoryIcon,
  Loader2,
  Package,
  Play,
  RefreshCw,
  Truck,
} from 'lucide-react';
import type { UserProfile } from '../lib/supabaseClient';
import type { DepartmentCode } from '../data/department';
import {
  VehiclesRepository,
  type VehicleLatestReportView,
  type VehicleRecoveryItemState,
} from '../data/repositories/vehiclesRepository';
import { cn } from '../lib/utils';
import { exportToExcel } from '../lib/excelExport';
import { exportHtmlToPdf } from '../lib/pdfExport';
import { inventoryTemplatesBus } from '../lib/inventoryTemplatesBus';
import { useFleetInventoryRealtimeSync } from '../hooks/useFleetInventoryRealtimeSync';

interface VehicleLatestReportProps {
  profile: UserProfile;
  department?: DepartmentCode;
  vehicleId: string | null;
  onBack: () => void;
  onStartInspection: (vehicleId: string) => void;
}

/* ══════════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════════ */

function formatDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  try {
    return new Date(raw).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(raw);
  }
}

function statusLabel(status: 'pending' | 'scheduled' | 'resolved'): { text: string; cls: string } {
  if (status === 'resolved') return { text: 'مُعوَّض', cls: 'bg-emerald-500/15 text-emerald-800 border-emerald-500/40' };
  if (status === 'scheduled') return { text: 'مجدول', cls: 'bg-sky-500/15 text-sky-800 border-sky-500/40' };
  return { text: 'ناقص', cls: 'bg-rose-500/15 text-rose-800 border-rose-500/40' };
}

function escapeHtml(raw: string): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════ */

export default function VehicleLatestReport({
  profile: _profile,
  department = 'tajhiz',
  vehicleId,
  onBack,
  onStartInspection,
}: VehicleLatestReportProps) {
  const repository = useMemo(() => new VehiclesRepository(), []);
  const [data, setData] = useState<VehicleLatestReportView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vehicleId) return;
    const idNum = Number(vehicleId);
    if (!Number.isFinite(idNum)) {
      setError('معرّف مركبة غير صالح.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await repository.getLatestVehicleReport(department, idNum);
      setData(result);
    } catch (e) {
      console.error('getLatestVehicleReport failed', e);
      setError(e instanceof Error ? e.message : 'تعذر تحميل التقرير الأخير للمركبة.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [repository, department, vehicleId]);

  const loadRef = useRef(load);
  useLayoutEffect(() => {
    loadRef.current = load;
  }, [load]);

  /** تحديث «آخر جرد» وحالة النواقص من Realtime بمجرد الإدخال في التقارير أو التعويض. */
  const realtimeEnabled =
    Boolean(vehicleId && String(vehicleId).trim() !== '') && Number.isFinite(Number(vehicleId));
  useFleetInventoryRealtimeSync(department, {
    enabled: realtimeEnabled,
    channelSuffix: `vehicle-latest:${vehicleId ?? 'none'}`,
    onSync: () => void loadRef.current(),
  });

  useEffect(() => {
    void load();
  }, [load]);

  // إعادة الجلب تلقائياً عند تحديث قوالب الجرد من أي صفحة.
  useEffect(() => {
    const unsubscribe = inventoryTemplatesBus.subscribe(department, () => {
      void load();
    });
    return () => {
      unsubscribe();
    };
  }, [department, load]);

  /* ═══ Export handlers ═══ */

  const handleExportExcel = useCallback(() => {
    if (!data) return;
    const rows: unknown[][] = [
      [`التقرير الأخير للمركبة ${data.vehicle.plate}`],
      [data.vehicle.departmentLabel],
      [],
      ['السائق/الفني', data.vehicle.driverName ?? '—'],
      ['الموديل', data.vehicle.model ?? '—'],
      ['آخر جرد', data.lastInspection ? formatDate(data.lastInspection.createdAt) : '—'],
      ['آخر تعويض', data.lastCompensation ? formatDate(data.lastCompensation.actedAt) : '—'],
      [],
      ['ملخّص النواقص'],
      ['إجمالي المطلوب', data.recoveryState.totalRequired],
      ['إجمالي المتوفر', data.recoveryState.totalActual],
      ['إجمالي الناقص', data.recoveryState.totalMissing],
      ['عدد العناصر الناقصة', data.recoveryState.pendingCount],
      ['عدد العناصر المُعوَّضة', data.recoveryState.resolvedCount],
      [],
      ['#', 'الاسم وقت التقرير', 'الاسم الحالي', 'الباركود', 'المطلوب', 'المتوفر', 'الناقص', 'الحالة', 'آخر تحديث'],
      ...data.recoveryState.items.map((it, i) => [
        i + 1,
        it.itemNameSnapshot,
        it.itemNameLive,
        it.itemBarcodeLive ?? it.itemBarcodeSnapshot ?? '—',
        it.requiredQty,
        it.actualQty,
        it.missingQty,
        statusLabel(it.status).text,
        formatDate(it.createdAt),
      ]),
    ];
    exportToExcel(rows, `تقرير_المركبة_${data.vehicle.plate}.xlsx`);
  }, [data]);

  const handleExportPdf = useCallback(async () => {
    if (!data) return;
    const html = buildLatestReportHtml(data);
    await exportHtmlToPdf(html, `تقرير_المركبة_${data.vehicle.plate}.pdf`);
  }, [data]);

  /* ═══ Render guards ═══ */

  if (!vehicleId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-stone-500" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        <p className="text-sm font-bold">لم يتم تحديد مركبة — الرجاء الرجوع لاختيار مركبة.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-black hover:bg-violet-700"
        >
          عودة إلى المركبات
        </button>
      </div>
    );
  }

  return (
    <div className="pb-12 space-y-4" dir="rtl">
      {/* Breadcrumb + header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            المركبات
          </button>
          <span className="text-stone-400">/</span>
          <span className="text-xs font-bold text-stone-600 dark:text-stone-300">التقرير الأخير</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void load()}
            className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300"
            title="تحديث"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <button
            type="button"
            onClick={() => void handleExportExcel()}
            disabled={!data}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            تصدير Excel
          </button>
          <button
            type="button"
            onClick={() => void handleExportPdf()}
            disabled={!data}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            تصدير PDF
          </button>
          {data && (
            <button
              type="button"
              onClick={() => onStartInspection(String(data.vehicle.id))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <Play className="h-3.5 w-3.5" />
              بدء جرد جديد
            </button>
          )}
        </div>
      </div>

      {/* Loading / error / content */}
      {loading && !data ? (
        <div className="rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-white/90 dark:bg-stone-950/95 p-10 flex flex-col items-center gap-3 text-stone-500">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          <p className="text-xs font-bold">جاري تحميل آخر حالة للمركبة…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-bold text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : !data ? null : (
        <>
          {/* Vehicle header card */}
          <div className="rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-white/90 dark:bg-stone-950/95 backdrop-blur-xl p-5 flex flex-wrap items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow">
              <Truck className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-black text-stone-900 dark:text-stone-50">
                المركبة {data.vehicle.plate}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold text-stone-500 dark:text-stone-400">
                <span>{data.vehicle.departmentLabel}</span>
                {data.vehicle.model && (
                  <>
                    <span className="opacity-40">·</span>
                    <span>{data.vehicle.model}</span>
                  </>
                )}
                <span className="opacity-40">·</span>
                <span>{data.vehicle.driverName ?? 'غير معيّن'}</span>
                {!data.vehicle.hasToolkit && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800 border border-amber-500/30">
                      بدون عدّة
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 3 summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SummaryCard
              icon={ClipboardList}
              title="آخر جرد"
              value={data.lastInspection ? formatDate(data.lastInspection.createdAt) : '—'}
              sub={data.lastInspection?.inspectorName ?? (data.lastInspection ? 'بدون اسم مفتّش' : 'لم يُسجَّل جرد')}
              tone="indigo"
            />
            <SummaryCard
              icon={HistoryIcon}
              title="آخر تعويض"
              value={data.lastCompensation ? formatDate(data.lastCompensation.actedAt) : 'لا توجد حركات'}
              sub={
                data.lastCompensation
                  ? `${data.lastCompensation.itemName} · ${
                      data.lastCompensation.nextStatus === 'resolved'
                        ? 'مُعوَّض'
                        : data.lastCompensation.nextStatus === 'scheduled'
                          ? 'مجدول'
                          : 'ناقص'
                    }`
                  : 'لم تُسجَّل حركات'
              }
              tone="violet"
            />
            <SummaryCard
              icon={AlertTriangle}
              title="حالة النواقص"
              value={`${data.recoveryState.pendingCount} ناقص / ${data.recoveryState.resolvedCount} مُعوَّض`}
              sub={`إجمالي الناقص: ${data.recoveryState.totalMissing}`}
              tone={data.recoveryState.pendingCount > 0 ? 'rose' : 'emerald'}
            />
          </div>

          {/* Missing items table — Snapshot + Live */}
          <div className="rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-white/90 dark:bg-stone-950/95 backdrop-blur-xl p-4 md:p-5 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-sm font-black text-stone-900 dark:text-stone-50 flex items-center gap-2">
                <Package className="h-4 w-4" />
                العناصر الناقصة للمركبة ({data.recoveryState.items.length})
              </h3>
              <div className="flex items-center gap-2 text-[11px] font-bold text-stone-500 dark:text-stone-400">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                يظهر الاسم وقت التقرير مع الاسم الحالي إن اختلف
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 md:mx-0">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-[10px] font-black uppercase text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-700">
                    <th className="text-right py-2 px-2">#</th>
                    <th className="text-right py-2 px-2">الاسم وقت التقرير</th>
                    <th className="text-right py-2 px-2">الباركود</th>
                    <th className="text-center py-2 px-2">المطلوب</th>
                    <th className="text-center py-2 px-2">المتوفر</th>
                    <th className="text-center py-2 px-2">الناقص</th>
                    <th className="text-center py-2 px-2">الحالة</th>
                    <th className="text-right py-2 px-2 hidden md:table-cell">آخر تحديث</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recoveryState.items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-stone-500 text-[11px] font-bold">
                        لا توجد نواقص مسجّلة للمركبة.
                      </td>
                    </tr>
                  ) : (
                    data.recoveryState.items.map((it, idx) => (
                      <ItemRow key={it.recoveryId} row={it} index={idx + 1} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Timeline */}
          {data.timeline.length > 0 && (
            <div className="rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-white/90 dark:bg-stone-950/95 backdrop-blur-xl p-4 md:p-5 space-y-3">
              <h3 className="text-sm font-black text-stone-900 dark:text-stone-50">الخط الزمني الأخير</h3>
              <ol className="relative border-r-2 border-stone-200 dark:border-stone-700 pr-4 space-y-3">
                {data.timeline.slice(0, 10).map((t) => (
                  <li key={t.id} className="relative">
                    <span className="absolute -right-[10px] top-1.5 h-3 w-3 rounded-full bg-violet-500 ring-4 ring-white dark:ring-stone-950" />
                    <p className="text-[11px] font-black text-stone-800 dark:text-stone-100">{t.summary}</p>
                    <p className="text-[10px] font-bold text-stone-500">{formatDate(t.at)}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════════════ */

interface SummaryCardProps {
  icon: React.ElementType;
  title: string;
  value: string;
  sub?: string;
  tone: 'indigo' | 'violet' | 'rose' | 'emerald';
}

function SummaryCard({ icon: Icon, title, value, sub, tone }: SummaryCardProps) {
  const map: Record<SummaryCardProps['tone'], string> = {
    indigo: 'from-indigo-500/15 to-indigo-500/5 text-indigo-600',
    violet: 'from-violet-500/15 to-violet-500/5 text-violet-600',
    rose: 'from-rose-500/15 to-rose-500/5 text-rose-600',
    emerald: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600',
  };
  return (
    <div
      className={cn(
        'rounded-2xl border border-stone-200/80 dark:border-stone-700/80 p-4 bg-gradient-to-br',
        map[tone],
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <p className="text-[11px] font-bold text-stone-600 dark:text-stone-300">{title}</p>
      </div>
      <p className="mt-1 text-base font-black text-stone-900 dark:text-stone-50">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">{sub}</p>}
    </div>
  );
}

function ItemRow({ row, index }: { row: VehicleRecoveryItemState; index: number }) {
  const badge = statusLabel(row.status);
  const nameChanged =
    row.itemNameLive && row.itemNameSnapshot && row.itemNameLive !== row.itemNameSnapshot;
  const barcodeSnap = row.itemBarcodeSnapshot ?? null;
  const barcodeLive = row.itemBarcodeLive ?? null;
  const barcodeChanged = barcodeSnap !== barcodeLive;
  return (
    <tr
      className={cn(
        'border-b border-stone-100 dark:border-stone-800 align-top',
        row.status !== 'resolved' && 'bg-rose-50/40 dark:bg-rose-950/10',
      )}
    >
      <td className="py-2 px-2 text-stone-500">{index}</td>
      <td className="py-2 px-2">
        <div className="font-bold text-stone-900 dark:text-stone-100">{row.itemNameSnapshot}</div>
        {nameChanged && (
          <div className="mt-0.5 text-[10px] font-black text-sky-700 dark:text-sky-300">
            الآن: {row.itemNameLive}
          </div>
        )}
      </td>
      <td className="py-2 px-2 font-mono">
        <div>{barcodeSnap ?? '—'}</div>
        {barcodeChanged && barcodeLive != null && (
          <div className="mt-0.5 text-[10px] font-black text-sky-700 dark:text-sky-300">
            الآن: {barcodeLive}
          </div>
        )}
      </td>
      <td className="py-2 px-2 text-center font-bold">{row.requiredQty}</td>
      <td className="py-2 px-2 text-center font-bold">{row.actualQty}</td>
      <td
        className={cn(
          'py-2 px-2 text-center font-black',
          row.missingQty > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300',
        )}
      >
        {row.missingQty}
      </td>
      <td className="py-2 px-2 text-center">
        <span className={cn('inline-block px-2 py-0.5 rounded-full border font-black text-[10px]', badge.cls)}>
          {badge.text}
        </span>
      </td>
      <td className="py-2 px-2 text-stone-500 hidden md:table-cell">{formatDate(row.createdAt)}</td>
    </tr>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PDF html
   ══════════════════════════════════════════════════════════════════ */

function buildLatestReportHtml(data: VehicleLatestReportView): string {
  const itemsHtml = data.recoveryState.items
    .map((it, i) => {
      const badge = statusLabel(it.status).text;
      const nameChanged =
        it.itemNameLive && it.itemNameSnapshot && it.itemNameLive !== it.itemNameSnapshot;
      return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td>
          <div style="font-weight:700">${escapeHtml(it.itemNameSnapshot)}</div>
          ${
            nameChanged
              ? `<div style="font-size:10px;color:#0369a1;font-weight:700;margin-top:2px">الآن: ${escapeHtml(
                  it.itemNameLive,
                )}</div>`
              : ''
          }
        </td>
        <td style="font-family:monospace">${escapeHtml(it.itemBarcodeSnapshot ?? '—')}</td>
        <td style="text-align:center">${it.requiredQty}</td>
        <td style="text-align:center">${it.actualQty}</td>
        <td style="text-align:center;color:${it.missingQty > 0 ? '#b91c1c' : '#047857'};font-weight:800">${it.missingQty}</td>
        <td style="text-align:center">${escapeHtml(badge)}</td>
      </tr>`;
    })
    .join('');

  return `<div dir="rtl" style="font-family:'Cairo','Tajawal',sans-serif;color:#1c1917;padding:14px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #4f46e5;padding-bottom:8px;margin-bottom:10px">
      <div>
        <h2 style="margin:0;font-size:18px;font-weight:900">التقرير الأخير للمركبة ${escapeHtml(data.vehicle.plate)}</h2>
        <p style="margin:2px 0 0;font-size:11px;color:#6b7280">${escapeHtml(data.vehicle.departmentLabel)} · ${escapeHtml(
          data.vehicle.driverName ?? 'غير معيّن',
        )}</p>
      </div>
      <div style="text-align:left;font-size:10px;color:#374151">
        <div>آخر جرد: ${escapeHtml(data.lastInspection ? formatDate(data.lastInspection.createdAt) : '—')}</div>
        <div>آخر تعويض: ${escapeHtml(data.lastCompensation ? formatDate(data.lastCompensation.actedAt) : '—')}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px"><p style="font-size:10px;color:#6b7280;margin:0">إجمالي المطلوب</p><p style="font-size:16px;font-weight:900;margin:0">${data.recoveryState.totalRequired}</p></div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px"><p style="font-size:10px;color:#6b7280;margin:0">إجمالي المتوفر</p><p style="font-size:16px;font-weight:900;margin:0;color:#047857">${data.recoveryState.totalActual}</p></div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px"><p style="font-size:10px;color:#6b7280;margin:0">إجمالي الناقص</p><p style="font-size:16px;font-weight:900;margin:0;color:#b91c1c">${data.recoveryState.totalMissing}</p></div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>
        <tr style="background:#eef2ff;font-weight:900">
          <th style="border:1px solid #ddd;padding:6px">#</th>
          <th style="border:1px solid #ddd;padding:6px">العنصر</th>
          <th style="border:1px solid #ddd;padding:6px">الباركود</th>
          <th style="border:1px solid #ddd;padding:6px">المطلوب</th>
          <th style="border:1px solid #ddd;padding:6px">المتوفر</th>
          <th style="border:1px solid #ddd;padding:6px">الناقص</th>
          <th style="border:1px solid #ddd;padding:6px">الحالة</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml || `<tr><td colspan="7" style="text-align:center;padding:12px">لا توجد نواقص مسجّلة.</td></tr>`}
      </tbody>
    </table>
    <p style="margin-top:12px;font-size:9px;color:#6b7280;text-align:center">
      تم إنشاء التقرير إلكترونياً · ${new Date().toLocaleString('ar-EG')}
    </p>
  </div>`;
}
