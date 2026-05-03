import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
} from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  FileSpreadsheet,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react';
import type { DepartmentCode } from '../../data/department';
import {
  InventoryAnalyticsRepository,
  type ItemAggregateResult,
  type ItemCatalogEntry,
} from '../../data/repositories/inventoryAnalyticsRepository';
import { cn } from '../../lib/utils';
import { exportToExcel } from '../../lib/excelExport';
import { exportHtmlToPdf } from '../../lib/pdfExport';
import { inventoryTemplatesBus } from '../../lib/inventoryTemplatesBus';
import { useFleetInventoryRealtimeSync } from '../../hooks/useFleetInventoryRealtimeSync';
import KpiDrillDownModal from './KpiDrillDownModal';
import type { DrillKind } from './KpiDrillDownModal';

interface ItemAggregateViewProps {
  department: DepartmentCode;
  /** فتح صفحة «التقرير الأخير» لمركبة من نافذة التفاصيل. */
  onOpenVehicleLatestReport?: (vehicleId: number) => void;
}

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════ */

function normalizeArabic(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '') // diacritics
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

function statusBadge(status: 'pending' | 'scheduled' | 'resolved' | null) {
  if (status === 'resolved')
    return {
      label: 'مُعوَّض',
      cls: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/40',
    };
  if (status === 'scheduled')
    return {
      label: 'مجدول',
      cls: 'bg-sky-500/15 text-sky-800 dark:text-sky-200 border-sky-500/40',
    };
  if (status === 'pending')
    return {
      label: 'ناقص',
      cls: 'bg-rose-500/15 text-rose-800 dark:text-rose-200 border-rose-500/40',
    };
  return {
    label: 'مكتمل',
    cls: 'bg-stone-500/10 text-stone-700 dark:text-stone-300 border-stone-500/30',
  };
}

function formatDateTime(raw: string | null | undefined): string {
  if (!raw) return '—';
  try {
    return new Date(raw).toLocaleString('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(raw);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════ */

export default function ItemAggregateView({
  department,
  onOpenVehicleLatestReport,
}: ItemAggregateViewProps) {
  const repository = useMemo(() => new InventoryAnalyticsRepository(), []);
  const [catalog, setCatalog] = useState<ItemCatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  const [aggregate, setAggregate] = useState<ItemAggregateResult | null>(null);
  const [aggregateLoading, setAggregateLoading] = useState(false);
  const [aggregateError, setAggregateError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] =
    useState<'all' | 'pending' | 'scheduled' | 'resolved' | 'complete'>('all');
  const [drillKind, setDrillKind] = useState<DrillKind | null>(null);

  const staffLabel = department === 'installation' ? 'فني' : 'سائق';
  const selectedTemplateIdRef = useRef<number | null>(selectedTemplateId);
  selectedTemplateIdRef.current = selectedTemplateId;

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const rows = await repository.getItemCatalog(department);
      setCatalog(rows);
    } catch (e) {
      console.error('getItemCatalog failed', e);
      setCatalogError('تعذر تحميل قائمة العناصر حالياً.');
      setCatalog([]);
    } finally {
      setCatalogLoading(false);
    }
  }, [repository, department]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const loadAggregate = useCallback(
    async (templateId: number) => {
      setAggregateLoading(true);
      setAggregateError(null);
      try {
        const result = await repository.getItemAggregate(department, templateId);
        setAggregate(result);
      } catch (e) {
        console.error('getItemAggregate failed', e);
        setAggregateError(
          e instanceof Error ? e.message : 'تعذر تحميل التحليل التجميعي لهذا العنصر.',
        );
        setAggregate(null);
      } finally {
        setAggregateLoading(false);
      }
    },
    [repository, department],
  );

  useEffect(() => {
    if (selectedTemplateId != null) void loadAggregate(selectedTemplateId);
  }, [selectedTemplateId, loadAggregate]);

  // تحديث الفهرس والتحليل عند أي تغيير للقوالب في أي صفحة أخرى.
  useEffect(() => {
    const unsubscribe = inventoryTemplatesBus.subscribe(department, () => {
      void loadCatalog();
      if (selectedTemplateId != null) void loadAggregate(selectedTemplateId);
    });
    return () => {
      unsubscribe();
    };
  }, [department, loadCatalog, loadAggregate, selectedTemplateId]);

  /** تحديث تلقائي عند أي جرد / نواقص / تعويض / مركبة من Realtime — يكمِّل إعلان القوالب داخل التطبيق. */
  const loadAggregateRef = useRef(loadAggregate);
  const loadCatalogRef = useRef(loadCatalog);
  useLayoutEffect(() => {
    loadAggregateRef.current = loadAggregate;
    loadCatalogRef.current = loadCatalog;
  }, [loadAggregate, loadCatalog]);

  const realtimeRefetch = useCallback(() => {
    void loadCatalogRef.current();
    const tid = selectedTemplateIdRef.current;
    if (tid != null) void loadAggregateRef.current(tid);
  }, []);

  useFleetInventoryRealtimeSync(department, {
    enabled: true,
    channelSuffix: 'item-aggregate-intel',
    onSync: realtimeRefetch,
  });

  const filteredCatalog = useMemo(() => {
    const q = normalizeArabic(query);
    if (!q) return catalog;
    return catalog.filter((entry) => {
      const inName = normalizeArabic(entry.itemName).includes(q);
      const inBarcode =
        entry.barcode != null && entry.barcode.toLowerCase().includes(query.trim().toLowerCase());
      const inLabel = normalizeArabic(entry.displayLabel).includes(q);
      return inName || inBarcode || inLabel;
    });
  }, [catalog, query]);

  const filteredHolders = useMemo(() => {
    if (!aggregate) return [];
    if (filterStatus === 'all') return aggregate.holders;
    if (filterStatus === 'complete') return aggregate.holders.filter((h) => h.missingQty === 0);
    return aggregate.holders.filter((h) => h.recoveryStatus === filterStatus);
  }, [aggregate, filterStatus]);

  /* ═══ Exports ═══ */

  const handleExportExcel = useCallback(() => {
    if (!aggregate) return;
    const header = [
      `تقرير العنصر: ${aggregate.template.displayLabel}`,
    ];
    const totalsSheet: unknown[][] = [
      ['العنصر', aggregate.template.itemName],
      ['الباركود', aggregate.template.barcode ?? '—'],
      ['المطلوب لكل مركبة', aggregate.template.requiredQuantityPerVehicle],
      ['إجمالي المطلوب', aggregate.totals.totalRequired],
      ['إجمالي المتوفر', aggregate.totals.totalActual],
      ['إجمالي الناقص', aggregate.totals.totalMissing],
      ['عدد المركبات', aggregate.totals.vehiclesCount],
      [`عدد ال${staffLabel}ين`, aggregate.totals.driversCount],
      ['مركبات بها نقص', aggregate.totals.vehiclesWithShortage],
    ];
    const holdersHeader = [
      '#',
      'اللوحة',
      'الموديل',
      'حالة المركبة',
      staffLabel,
      'الدور',
      'الهاتف',
      'الهوية',
      'المطلوب',
      'المتوفر',
      'الناقص',
      'الحالة',
      'آخر جرد',
      'آخر تحديث',
      'حركات تعويض',
    ];
    const holdersRows = aggregate.holders.map((h, i) => [
      i + 1,
      h.plate,
      h.model ?? '—',
      h.vehicleStatus ?? '—',
      h.driverName ?? '—',
      h.driverRole ?? '—',
      h.driverPhone ?? '—',
      h.driverNationalId ?? '—',
      h.requiredQty,
      h.actualQty,
      h.missingQty,
      statusBadge(h.recoveryStatus).label,
      h.lastReportAt ? formatDateTime(h.lastReportAt) : '—',
      h.lastUpdatedAt ? formatDateTime(h.lastUpdatedAt) : '—',
      h.compensationCount,
    ]);
    const sheet: unknown[][] = [
      header,
      [],
      ...totalsSheet,
      [],
      holdersHeader,
      ...holdersRows,
    ];
    const name = aggregate.template.itemName.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40) || 'item';
    exportToExcel(sheet, `تقرير_العنصر_${name}.xlsx`);
  }, [aggregate, staffLabel]);

  const handleExportPdf = useCallback(async () => {
    if (!aggregate) return;
    const html = buildAggregateReportHtml(aggregate, department, staffLabel);
    const name = aggregate.template.itemName.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40) || 'item';
    await exportHtmlToPdf(html, `تقرير_العنصر_${name}.pdf`);
  }, [aggregate, department, staffLabel]);

  /* ═══ Render ═══ */

  return (
    <div className="space-y-4">
      {/* بحث ذكي + قائمة العناصر */}
      <div className="rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-white/90 dark:bg-stone-950/95 backdrop-blur-xl p-4 md:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black text-stone-900 dark:text-stone-50">البحث الذكي للعناصر</h3>
            <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400">
              اختر عنصراً لعرض إجمالي الكمية، من يحمله، المطلوب، المتوفر، والناقص عبر الأسطول.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void loadCatalog();
              if (selectedTemplateId != null) void loadAggregate(selectedTemplateId);
            }}
            className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300"
            title="تحديث"
          >
            <RefreshCw className={cn('h-4 w-4', (catalogLoading || aggregateLoading) && 'animate-spin')} />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بالاسم أو الباركود (مثال: دريل، مفتاح، 1234)…"
            className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 pr-10 pl-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-shadow"
          />
        </div>

        {catalogError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] font-bold text-rose-700 dark:text-rose-300">
            {catalogError}
          </div>
        )}

        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
          {catalogLoading && catalog.length === 0 ? (
            <div className="w-full flex items-center gap-2 py-3 text-stone-500 text-xs font-bold">
              <Loader2 className="h-4 w-4 animate-spin text-violet-500" /> جاري تحميل القوالب…
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="w-full text-center py-3 text-stone-500 text-xs font-bold">
              لا توجد نتائج مطابقة.
            </div>
          ) : (
            filteredCatalog.map((entry) => {
              const isSelected = entry.templateId === selectedTemplateId;
              return (
                <button
                  key={entry.templateId}
                  type="button"
                  onClick={() => setSelectedTemplateId(entry.templateId)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-[11px] font-black border transition-colors',
                    isSelected
                      ? 'bg-violet-600 text-white border-violet-600 shadow'
                      : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800',
                  )}
                >
                  <span>{entry.itemName}</span>
                  {entry.barcode && (
                    <span className="mx-1 opacity-70 font-mono">[{entry.barcode}]</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* تفاصيل العنصر المختار */}
      {selectedTemplateId == null ? (
        <div className="rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 p-8 text-center text-xs font-bold text-stone-500">
          اختر عنصراً من القائمة لعرض التقرير التجميعي.
        </div>
      ) : aggregateLoading && !aggregate ? (
        <div className="rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-white/90 dark:bg-stone-950/95 p-8 flex flex-col items-center gap-3 text-stone-500">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          <p className="text-xs font-bold">جاري تجميع البيانات عبر الأسطول…</p>
        </div>
      ) : aggregateError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-bold text-rose-700 dark:text-rose-300">
          {aggregateError}
        </div>
      ) : aggregate ? (
        <>

          {/* رأسية + KPI */}
          <div className="rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-white/90 dark:bg-stone-950/95 backdrop-blur-xl p-4 md:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow">
                  <Package className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-stone-900 dark:text-stone-50 truncate">
                    {aggregate.template.itemName}
                  </h3>
                  <p className="text-[11px] font-bold text-stone-500 dark:text-stone-400">
                    {aggregate.template.barcode ? (
                      <>
                        الباركود: <span className="font-mono">{aggregate.template.barcode}</span>
                        {' · '}
                      </>
                    ) : null}
                    المطلوب/مركبة: <strong>{aggregate.template.requiredQuantityPerVehicle}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => void handleExportExcel()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  تصدير Excel
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportPdf()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" />
                  تصدير PDF
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <KpiTile
                label="إجمالي المطلوب"
                value={aggregate.totals.totalRequired}
                icon={Package}
                tone="neutral"
                onClick={() => setDrillKind('required')}
              />
              <KpiTile
                label="إجمالي المتوفر"
                value={aggregate.totals.totalActual}
                icon={Check}
                tone="emerald"
                onClick={() => setDrillKind('available')}
              />
              <KpiTile
                label="إجمالي الناقص"
                value={aggregate.totals.totalMissing}
                icon={AlertTriangle}
                tone="rose"
                onClick={() => setDrillKind('missing')}
              />
              <KpiTile
                label="عدد المركبات"
                value={aggregate.totals.vehiclesCount}
                icon={Truck}
                tone="violet"
                onClick={() => setDrillKind('vehicles')}
              />
              <KpiTile
                label={`عدد ال${staffLabel}ين`}
                value={aggregate.totals.driversCount}
                icon={Users}
                tone="sky"
                onClick={() => setDrillKind('drivers')}
              />
              <KpiTile
                label="مركبات بها نقص"
                value={aggregate.totals.vehiclesWithShortage}
                icon={AlertTriangle}
                tone="amber"
                onClick={() => setDrillKind('shortageVehicles')}
              />
            </div>
          </div>

          {/* فلترة + جدول الحاملين */}
          <div className="rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-white/90 dark:bg-stone-950/95 backdrop-blur-xl p-4 md:p-5 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h4 className="text-sm font-black text-stone-900 dark:text-stone-50">
                قائمة الحاملين ({filteredHolders.length} من {aggregate.holders.length})
              </h4>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-stone-800 text-[10px] font-black">
                {(
                  [
                    { id: 'all', label: 'الكل' },
                    { id: 'pending', label: 'ناقص' },
                    { id: 'scheduled', label: 'مجدول' },
                    { id: 'resolved', label: 'معوَّض' },
                    { id: 'complete', label: 'مكتمل' },
                  ] as Array<{ id: typeof filterStatus; label: string }>
                ).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setFilterStatus(o.id)}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg',
                      filterStatus === o.id
                        ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-50 shadow-sm'
                        : 'text-stone-500 dark:text-stone-300',
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 md:mx-0">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-[10px] font-black uppercase text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-700">
                    <th className="text-right py-2 px-2">#</th>
                    <th className="text-right py-2 px-2">اللوحة</th>
                    <th className="text-right py-2 px-2 hidden md:table-cell">الموديل</th>
                    <th className="text-right py-2 px-2">{staffLabel}</th>
                    <th className="text-center py-2 px-2">المطلوب</th>
                    <th className="text-center py-2 px-2">المتوفر</th>
                    <th className="text-center py-2 px-2">الناقص</th>
                    <th className="text-center py-2 px-2">الحالة</th>
                    <th className="text-right py-2 px-2 hidden md:table-cell">آخر تحديث</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHolders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-stone-500 text-[11px] font-bold">
                        لا توجد نتائج مطابقة للفلترة الحالية.
                      </td>
                    </tr>
                  ) : (
                    filteredHolders.map((h, idx) => {
                      const badge = statusBadge(h.recoveryStatus);
                      const isMissing = h.missingQty > 0;
                      return (
                        <tr
                          key={h.vehicleId}
                          className={cn(
                            'border-b border-stone-100 dark:border-stone-800 transition-colors',
                            isMissing ? 'bg-rose-50/40 dark:bg-rose-950/10' : '',
                          )}
                        >
                          <td className="py-2 px-2 text-stone-500">{idx + 1}</td>
                          <td className="py-2 px-2 font-mono font-bold">{h.plate}</td>
                          <td className="py-2 px-2 hidden md:table-cell text-stone-600">{h.model ?? '—'}</td>
                          <td className="py-2 px-2">{h.driverName ?? '—'}</td>
                          <td className="py-2 px-2 text-center font-bold">{h.requiredQty}</td>
                          <td className="py-2 px-2 text-center font-bold">{h.actualQty}</td>
                          <td
                            className={cn(
                              'py-2 px-2 text-center font-black',
                              isMissing ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300',
                            )}
                          >
                            {h.missingQty}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className={cn('inline-block px-2 py-0.5 rounded-full border font-black text-[10px]', badge.cls)}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-stone-500 hidden md:table-cell">
                            {formatDateTime(h.lastUpdatedAt)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* آخر حركات التعويض */}
          {aggregate.recentActions.length > 0 && (
            <div className="rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-white/90 dark:bg-stone-950/95 backdrop-blur-xl p-4 md:p-5 space-y-3">
              <h4 className="text-sm font-black text-stone-900 dark:text-stone-50">آخر حركات التعويض</h4>
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {aggregate.recentActions.map((a) => {
                  const nextBadge = statusBadge(a.nextStatus);
                  return (
                    <div
                      key={a.id}
                      className="rounded-xl border border-stone-200/70 dark:border-stone-700/70 p-3 text-[11px] leading-relaxed"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{a.plate}</span>
                          {a.driverName && (
                            <>
                              <span className="opacity-50">·</span>
                              <span>{a.driverName}</span>
                            </>
                          )}
                        </div>
                        <span className={cn('px-2 py-0.5 rounded-full border font-black text-[10px]', nextBadge.cls)}>
                          {nextBadge.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-stone-600 dark:text-stone-300">
                        <span>{formatDateTime(a.actedAt)}</span>
                        {a.compensatedQty != null && a.compensatedQty > 0 && (
                          <>
                            <span className="opacity-50">·</span>
                            <span>
                              كمية التعويض: <strong>{a.compensatedQty}</strong>
                            </span>
                          </>
                        )}
                        <span className="opacity-50">·</span>
                        <span>{a.actionType === 'auto' ? 'آلي' : 'يدوي'}</span>
                      </div>
                      {a.reason && (
                        <p className="mt-1 text-stone-500 dark:text-stone-400 whitespace-pre-wrap">{a.reason}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {drillKind && aggregate ? (
            <KpiDrillDownModal
              open
              kind={drillKind}
              aggregate={aggregate}
              staffLabel={staffLabel}
              department={department}
              onClose={() => setDrillKind(null)}
              onOpenVehicleLatestReport={
                onOpenVehicleLatestReport
                  ? (vehicleId) => {
                      setDrillKind(null);
                      onOpenVehicleLatestReport(vehicleId);
                    }
                  : undefined
              }
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   KPI tile
   ═══════════════════════════════════════════════════════════════════════ */

interface KpiTileProps {
  label: string;
  value: number;
  icon: ElementType;
  tone: 'neutral' | 'emerald' | 'rose' | 'violet' | 'sky' | 'amber';
  onClick?: () => void;
}

function KpiTile({ label, value, icon: Icon, tone, onClick }: KpiTileProps) {
  const toneClass: Record<KpiTileProps['tone'], string> = {
    neutral: 'from-stone-400/10 to-stone-400/5 text-stone-900 dark:text-stone-100',
    emerald: 'from-emerald-500/15 to-emerald-500/5 text-emerald-900 dark:text-emerald-100',
    rose: 'from-rose-500/15 to-rose-500/5 text-rose-900 dark:text-rose-100',
    violet: 'from-violet-500/15 to-violet-500/5 text-violet-900 dark:text-violet-100',
    sky: 'from-sky-500/15 to-sky-500/5 text-sky-900 dark:text-sky-100',
    amber: 'from-amber-500/15 to-amber-500/5 text-amber-900 dark:text-amber-100',
  };
  const iconTone: Record<KpiTileProps['tone'], string> = {
    neutral: 'text-stone-500',
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
    violet: 'text-violet-600',
    sky: 'text-sky-600',
    amber: 'text-amber-600',
  };

  const body = (
    <>
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconTone[tone])} />
        <p className="text-[10px] font-bold opacity-80">{label}</p>
      </div>
      <p className="mt-1 text-2xl font-black">{value.toLocaleString('ar-EG')}</p>
    </>
  );

  const innerClasses = cn(
    'rounded-2xl border border-stone-200/80 dark:border-stone-700/80 p-3 bg-gradient-to-br text-right w-full',
    toneClass[tone],
    onClick != null &&
      'cursor-pointer transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900',
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={innerClasses}
        aria-label={`عرض تفاصيل ${label}`}
      >
        {body}
      </button>
    );
  }

  return <div className={innerClasses}>{body}</div>;
}

/* ═══════════════════════════════════════════════════════════════════════
   PDF helper
   ═══════════════════════════════════════════════════════════════════════ */

function escapeHtml(raw: string): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildAggregateReportHtml(
  aggregate: ItemAggregateResult,
  department: DepartmentCode,
  staffLabel: string,
): string {
  const tpl = aggregate.template;
  const totals = aggregate.totals;
  const rowsHtml = aggregate.holders
    .map((h, i) => {
      const badge = statusBadge(h.recoveryStatus).label;
      const lastRd = h.lastReportAt ? formatDateTime(h.lastReportAt) : '—';
      const lastUp = h.lastUpdatedAt ? formatDateTime(h.lastUpdatedAt) : '—';
      return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${escapeHtml(h.plate)}</td>
        <td>${escapeHtml(h.model ?? '—')}</td>
        <td>${escapeHtml(h.vehicleStatus ?? '—')}</td>
        <td>${escapeHtml(h.driverName ?? '—')}</td>
        <td>${escapeHtml(h.driverRole ?? '—')}</td>
        <td>${escapeHtml(h.driverPhone ?? '—')}</td>
        <td>${escapeHtml(h.driverNationalId ?? '—')}</td>
        <td style="text-align:center">${h.requiredQty}</td>
        <td style="text-align:center">${h.actualQty}</td>
        <td style="text-align:center;color:${h.missingQty > 0 ? '#b91c1c' : '#047857'};font-weight:800">${h.missingQty}</td>
        <td style="text-align:center">${escapeHtml(badge)}</td>
        <td>${escapeHtml(lastRd)}</td>
        <td>${escapeHtml(lastUp)}</td>
        <td style="text-align:center">${h.compensationCount}</td>
      </tr>`;
    })
    .join('');

  const deptLabel =
    department === 'installation' ? 'قسم التركيب' : department === 'operations' ? 'قسم العمليات' : 'قسم التجهيز';

  return `<div dir="rtl" style="font-family:'Cairo','Tajawal',sans-serif;color:#1c1917;padding:14px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #6d28d9;padding-bottom:8px;margin-bottom:10px">
      <div>
        <h2 style="margin:0;font-size:18px;font-weight:900">تقرير العنصر: ${escapeHtml(tpl.itemName)}</h2>
        <p style="margin:2px 0 0;font-size:11px;color:#6b7280">${escapeHtml(deptLabel)} · مركز الذكاء</p>
      </div>
      <div style="text-align:left;font-size:11px;color:#374151">
        ${tpl.barcode ? `باركود: <span style="font-family:monospace">${escapeHtml(tpl.barcode)}</span><br/>` : ''}
        المطلوب/مركبة: <strong>${tpl.requiredQuantityPerVehicle}</strong>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px"><p style="font-size:10px;color:#6b7280;margin:0">إجمالي المطلوب</p><p style="font-size:18px;font-weight:900;margin:0">${totals.totalRequired}</p></div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px"><p style="font-size:10px;color:#6b7280;margin:0">إجمالي المتوفر</p><p style="font-size:18px;font-weight:900;margin:0;color:#047857">${totals.totalActual}</p></div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px"><p style="font-size:10px;color:#6b7280;margin:0">إجمالي الناقص</p><p style="font-size:18px;font-weight:900;margin:0;color:#b91c1c">${totals.totalMissing}</p></div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px"><p style="font-size:10px;color:#6b7280;margin:0">عدد المركبات</p><p style="font-size:18px;font-weight:900;margin:0">${totals.vehiclesCount}</p></div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px"><p style="font-size:10px;color:#6b7280;margin:0">عدد ال${escapeHtml(staffLabel)}ين</p><p style="font-size:18px;font-weight:900;margin:0">${totals.driversCount}</p></div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px"><p style="font-size:10px;color:#6b7280;margin:0">مركبات بها نقص</p><p style="font-size:18px;font-weight:900;margin:0;color:#b91c1c">${totals.vehiclesWithShortage}</p></div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>
        <tr style="background:#f3e8ff;font-weight:900">
          <th style="border:1px solid #ddd;padding:6px">#</th>
          <th style="border:1px solid #ddd;padding:6px">اللوحة</th>
          <th style="border:1px solid #ddd;padding:6px">الموديل</th>
          <th style="border:1px solid #ddd;padding:6px">حالة المركبة</th>
          <th style="border:1px solid #ddd;padding:6px">${escapeHtml(staffLabel)}</th>
          <th style="border:1px solid #ddd;padding:6px">الدور</th>
          <th style="border:1px solid #ddd;padding:6px">الهاتف</th>
          <th style="border:1px solid #ddd;padding:6px">الهوية</th>
          <th style="border:1px solid #ddd;padding:6px">المطلوب</th>
          <th style="border:1px solid #ddd;padding:6px">المتوفر</th>
          <th style="border:1px solid #ddd;padding:6px">الناقص</th>
          <th style="border:1px solid #ddd;padding:6px">الحالة</th>
          <th style="border:1px solid #ddd;padding:6px">آخر جرد</th>
          <th style="border:1px solid #ddd;padding:6px">آخر تحديث</th>
          <th style="border:1px solid #ddd;padding:6px">تعويض</th>
        </tr>
      </thead>
      <tbody style="font-weight:500">
        ${rowsHtml || `<tr><td colspan="15" style="text-align:center;padding:12px">لا توجد بيانات.</td></tr>`}
      </tbody>
    </table>
    <p style="margin-top:12px;font-size:9px;color:#6b7280;text-align:center">
      تم إنشاء التقرير إلكترونياً عبر مركز الذكاء · ${new Date().toLocaleString('ar-EG')}
    </p>
  </div>`;
}
