import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Package,
  Search,
  Truck,
  X,
  type LucideIcon,
  Users,
} from 'lucide-react';
import type { DepartmentCode } from '../../data/department';
import type { ItemAggregateResult, ItemHolderRow, TripleHolderLabels } from '../../data/repositories/inventoryAnalyticsRepository';
import { TRIPLE_NAMED_ALLOCATION_MODE } from '../../lib/toolHolderAllocations';
import { cn } from '../../lib/utils';
import { exportToExcel } from '../../lib/excelExport';
import { exportHtmlToPdf } from '../../lib/pdfExport';
import TripleIntelDriverCell, {
  formatTripleIntelExportCell,
  tripleIntelSearchBlob,
} from './TripleIntelDriverCell';

export type DrillKind =
  | 'required'
  | 'available'
  | 'missing'
  | 'vehicles'
  | 'drivers'
  | 'shortageVehicles';

export interface KpiDrillDownModalProps {
  open: boolean;
  onClose: () => void;
  kind: DrillKind;
  aggregate: ItemAggregateResult;
  staffLabel: string;
  department: DepartmentCode;
  onOpenVehicleLatestReport?: (vehicleId: number) => void;
  onStartVehicleInspection?: (vehicleId: number) => void;
  /** قالب العنصر بتنسيق ١+٢ فقط (تجهيز). */
  tripleTemplateActive?: boolean;
  triplePrintDraftsByVehicleId?: Record<number, TripleHolderLabels>;
  onTriplePrintDraftChange?: (vehicleId: number, next: TripleHolderLabels) => void;
}

interface DriverAggRow {
  driverId: number;
  driverName: string | null;
  driverRole: string | null;
  driverPhone: string | null;
  driverNationalId: string | null;
  vehicleCount: number;
  totalRequired: number;
  totalActual: number;
  totalMissing: number;
  compensationCount: number;
  platesText: string;
}

function normalizeArabic(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

function statusBadge(status: ItemHolderRow['recoveryStatus']) {
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

function vehicleStatusLabel(status: string | null): string {
  if (!status) return '—';
  const m: Record<string, string> = {
    available: 'متوفرة',
    maintenance: 'صيانة',
    broken: 'معطلة',
    reserved: 'محجوزة',
    in_use: 'بالخدمة',
  };
  return m[status] ?? status;
}

function drillMeta(kind: DrillKind): {
  title: string;
  subtitle: string;
  slug: string;
  Icon: LucideIcon;
} {
  switch (kind) {
    case 'required':
      return {
        title: 'إجمالي المطلوب',
        subtitle: 'جميع المركبات المكلّفة بالعتاد وحصّة هذا العنصر لكل واحدة والمسؤول عنها.',
        slug: 'المطلوب',
        Icon: Package,
      };
    case 'available':
      return {
        title: 'إجمالي المتوفر',
        subtitle: 'من لديه كمية فعلية أكبر من صفر وفق آخر الجرد أو سجل النواقص.',
        slug: 'المتوفر',
        Icon: CheckCircle2,
      };
    case 'missing':
      return {
        title: 'إجمالي الناقص',
        subtitle: 'الأشخاص والمركبات التي عليها نقص في هذا العنصر مع كامل التفاصيل.',
        slug: 'الناقص',
        Icon: AlertTriangle,
      };
    case 'shortageVehicles':
      return {
        title: 'مركبات بها نقص',
        subtitle: 'قائمة المركبات التي سجّل النظام لديها نقصاً في هذا العنصر.',
        slug: 'مركبات_نقص',
        Icon: AlertTriangle,
      };
    case 'vehicles':
      return {
        title: 'مركبات مكلّفة بالعتاد',
        subtitle: 'كل المركبات التي يُطبَّق عليها قالب الجرد لهذا العنصر.',
        slug: 'المركبات',
        Icon: Truck,
      };
    case 'drivers':
    default:
      return {
        title: 'تجميع حسب الشخص المعيَّن',
        subtitle: 'تلخيص المطلوب والمتوفر والناقص وحركات التعويض للمسؤولين الذين لديهم واحدة أو أكثر من المركبات.',
        slug: 'المجموعات_شخصية',
        Icon: Users,
      };
  }
}

function buildDriverAggs(holders: ItemHolderRow[]): DriverAggRow[] {
  const map = new Map<
    number,
    {
      driverId: number;
      driverName: string | null;
      driverRole: string | null;
      driverPhone: string | null;
      driverNationalId: string | null;
      plates: string[];
      totalRequired: number;
      totalActual: number;
      totalMissing: number;
      compensationCount: number;
    }
  >();

  for (const h of holders) {
    if (h.driverId == null || !Number.isFinite(h.driverId)) continue;
    let g = map.get(h.driverId);
    if (!g) {
      g = {
        driverId: h.driverId,
        driverName: h.driverName ?? null,
        driverRole: h.driverRole ?? null,
        driverPhone: h.driverPhone ?? null,
        driverNationalId: h.driverNationalId ?? null,
        plates: [],
        totalRequired: 0,
        totalActual: 0,
        totalMissing: 0,
        compensationCount: 0,
      };
      map.set(h.driverId, g);
    }
    g.totalRequired += h.requiredQty;
    g.totalActual += h.actualQty;
    g.totalMissing += h.missingQty;
    g.compensationCount += h.compensationCount;
    if (!g.plates.includes(h.plate)) g.plates.push(h.plate);
    if (!g.driverName && h.driverName) g.driverName = h.driverName;
    if (!g.driverRole && h.driverRole) g.driverRole = h.driverRole;
    if (!g.driverPhone && h.driverPhone) g.driverPhone = h.driverPhone;
    if (!g.driverNationalId && h.driverNationalId) g.driverNationalId = h.driverNationalId;
  }

  return Array.from(map.values())
    .map((g) => ({
      driverId: g.driverId,
      driverName: g.driverName,
      driverRole: g.driverRole,
      driverPhone: g.driverPhone,
      driverNationalId: g.driverNationalId,
      vehicleCount: g.plates.length,
      totalRequired: g.totalRequired,
      totalActual: g.totalActual,
      totalMissing: g.totalMissing,
      compensationCount: g.compensationCount,
      platesText: g.plates.join('، '),
    }))
    .sort((a, b) =>
      (a.driverName ?? '—').localeCompare(b.driverName ?? '—', 'ar', { sensitivity: 'base' }),
    );
}

function pickVehicleRows(kind: DrillKind, holders: ItemHolderRow[]): ItemHolderRow[] {
  switch (kind) {
    case 'available':
      return [...holders.filter((h) => h.actualQty > 0)].sort(
        (a, b) => b.actualQty - a.actualQty || a.plate.localeCompare(b.plate, 'ar'),
      );
    case 'missing':
    case 'shortageVehicles':
      return [...holders.filter((h) => h.missingQty > 0)].sort(
        (a, b) => b.missingQty - a.missingQty || a.plate.localeCompare(b.plate, 'ar'),
      );
    case 'required':
    case 'vehicles':
      return [...holders].sort((a, b) => a.plate.localeCompare(b.plate, 'ar'));
    default:
      return [];
  }
}

function holderMatchesSearch(
  h: ItemHolderRow,
  staffLabel: string,
  qNorm: string,
  qRaw: string,
  opts?: {
    tripleActive?: boolean;
    tripleDraft?: TripleHolderLabels;
  },
): boolean {
  if (!qNorm) return true;
  const fields = [
    h.plate,
    h.driverName ?? '',
    h.model ?? '',
    h.vehicleStatus ?? '',
    vehicleStatusLabel(h.vehicleStatus),
    h.driverRole ?? '',
    h.driverPhone ?? '',
    h.driverNationalId ?? '',
    staffLabel,
  ];
  if (opts?.tripleActive) {
    fields.push(tripleIntelSearchBlob(opts.tripleDraft ?? null));
    fields.push(tripleIntelSearchBlob(h.tripleHolderLabels ?? null));
  }
  const raw = `${h.plate} ${h.driverPhone ?? ''}`;
  const hitNorm = fields.some((f) => normalizeArabic(f).includes(qNorm));
  const hitRaw = raw.toLowerCase().includes(qRaw.trim().toLowerCase());
  return hitNorm || hitRaw;
}

function seedTripleModalDraft(h: ItemHolderRow): TripleHolderLabels {
  return h.tripleHolderLabels != null
    ? { ...h.tripleHolderLabels }
    : { driver: (h.driverName ?? '').trim(), assistant1: '', assistant2: '' };
}

function driverAggMatchesSearch(d: DriverAggRow, qNorm: string, qRaw: string): boolean {
  if (!qNorm) return true;
  const fields = [
    d.driverName ?? '',
    d.driverRole ?? '',
    d.driverPhone ?? '',
    d.driverNationalId ?? '',
    d.platesText,
  ];
  const raw = `${d.driverPhone ?? ''}`;
  const hitNorm = fields.some((f) => normalizeArabic(f).includes(qNorm));
  const hitRaw = raw.toLowerCase().includes(qRaw.trim().toLowerCase());
  return hitNorm || hitRaw;
}

function escapeHtml(raw: string): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function deptLabel(department: DepartmentCode): string {
  if (department === 'installation') return 'قسم التركيب';
  if (department === 'operations') return 'قسم العمليات';
  return 'قسم التجهيز';
}

export default function KpiDrillDownModal({
  open,
  onClose,
  kind,
  aggregate,
  staffLabel,
  department,
  onOpenVehicleLatestReport,
  onStartVehicleInspection,
  tripleTemplateActive = false,
  triplePrintDraftsByVehicleId,
  onTriplePrintDraftChange,
}: KpiDrillDownModalProps) {
  const [search, setSearch] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const meta = drillMeta(kind);
  const { Icon: HeaderIcon } = meta;

  const tripleDraftsMap = triplePrintDraftsByVehicleId ?? {};
  const tripleIntelEnabled =
    tripleTemplateActive &&
    aggregate.template.allocationMode === TRIPLE_NAMED_ALLOCATION_MODE &&
    Boolean(onTriplePrintDraftChange);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open, kind]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const root = panelRef.current;
    const getFocusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
        ),
      ).filter((el) => el.offsetParent !== null || root.contains(el));

    window.requestAnimationFrame(() => {
      const list = getFocusables();
      (list[0] ?? root).focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = getFocusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener('keydown', onKeyDown as unknown as EventListener);
    return () => root.removeEventListener('keydown', onKeyDown as unknown as EventListener);
  }, [open]);

  const rawVehicleRows = useMemo(() => pickVehicleRows(kind, aggregate.holders), [kind, aggregate.holders]);
  const driverAggs = useMemo(() => buildDriverAggs(aggregate.holders), [aggregate.holders]);

  const qNorm = normalizeArabic(search);
  const filteredVehicleRows = useMemo(
    () =>
      rawVehicleRows.filter((h) =>
        holderMatchesSearch(h, staffLabel, qNorm, search, {
          tripleActive: tripleIntelEnabled,
          tripleDraft: tripleDraftsMap[h.vehicleId],
        }),
      ),
    [rawVehicleRows, staffLabel, qNorm, search, tripleIntelEnabled, tripleDraftsMap],
  );
  const filteredDriverRows = useMemo(
    () => driverAggs.filter((d) => driverAggMatchesSearch(d, qNorm, search)),
    [driverAggs, qNorm, search],
  );

  const countBadge =
    kind === 'drivers' ? filteredDriverRows.length : filteredVehicleRows.length;

  const safeFileStem = aggregate.template.itemName.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 36) || 'item';

  const handleExcel = useCallback(() => {
    const header = [[`${meta.title} — ${aggregate.template.displayLabel}`], []];
    if (kind === 'drivers') {
      const hdr = ['#', staffLabel, 'الدور', 'الهاتف', 'الهوية', 'عدد المركبات', 'اللوحات', 'إجمالي المطلوب', 'إجمالي المتوفر', 'إجمالي الناقص', 'حركات تعويض'];
      const rows = filteredDriverRows.map((d, i) => [
        i + 1,
        d.driverName ?? '—',
        d.driverRole ?? '—',
        d.driverPhone ?? '—',
        d.driverNationalId ?? '—',
        d.vehicleCount,
        d.platesText,
        d.totalRequired,
        d.totalActual,
        d.totalMissing,
        d.compensationCount,
      ]);
      exportToExcel([...header, hdr, ...rows], `تقرير_${meta.slug}_${safeFileStem}.xlsx`);
      return;
    }

    const showShortCols = kind === 'available';
    const tripleColLabel = 'توزيع (١+٢) للطباعة';
    const tripleCellExcel = (h: ItemHolderRow) =>
      formatTripleIntelExportCell(tripleDraftsMap[h.vehicleId] ?? seedTripleModalDraft(h));

    const commonHdrPrefix = ['#', 'اللوحة', 'الموديل', 'حالة المركبة', staffLabel];
    const commonHdrSuffix = ['الدور', 'الهاتف', 'الهوية'];
    const commonHdr = [...commonHdrPrefix, ...(tripleIntelEnabled ? [tripleColLabel] : []), ...commonHdrSuffix];

    const hdr = showShortCols
      ? [...commonHdr, 'المتوفر', 'آخر جرد']
      : [
          ...commonHdr,
          'المطلوب',
          'المتوفر',
          'الناقص',
          'الحالة',
          'آخر جرد',
          'آخر تحديث',
          'حركات تعويض',
        ];

    const rows = filteredVehicleRows.map((h, i) => {
      const badge = statusBadge(h.recoveryStatus);
      const baseHead = [
        i + 1,
        h.plate,
        h.model ?? '—',
        vehicleStatusLabel(h.vehicleStatus),
        h.driverName ?? '—',
      ];
      const tripleVals = tripleIntelEnabled ? [tripleCellExcel(h)] : [];
      const baseTail = [h.driverRole ?? '—', h.driverPhone ?? '—', h.driverNationalId ?? '—'];
      const base = [...baseHead, ...tripleVals, ...baseTail];
      if (showShortCols) {
        return [...base, h.actualQty, h.lastReportAt ? formatDateTime(h.lastReportAt) : '—'];
      }
      return [
        ...base,
        h.requiredQty,
        h.actualQty,
        h.missingQty,
        badge.label,
        h.lastReportAt ? formatDateTime(h.lastReportAt) : '—',
        formatDateTime(h.lastUpdatedAt),
        h.compensationCount,
      ];
    });
    exportToExcel([...header, hdr, ...rows], `تقرير_${meta.slug}_${safeFileStem}.xlsx`);
  }, [
    aggregate.template.displayLabel,
    filteredDriverRows,
    filteredVehicleRows,
    kind,
    meta.slug,
    meta.title,
    safeFileStem,
    staffLabel,
    tripleIntelEnabled,
    tripleDraftsMap,
  ]);

  const handlePdf = useCallback(async () => {
    const dept = deptLabel(department);
    let rowsHtml = '';
    if (kind === 'drivers') {
      rowsHtml =
        filteredDriverRows
          .map(
            (d, i) => `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${escapeHtml(d.driverName ?? '—')}</td>
        <td>${escapeHtml(d.driverRole ?? '—')}</td>
        <td>${escapeHtml(d.driverPhone ?? '—')}</td>
        <td>${escapeHtml(d.driverNationalId ?? '—')}</td>
        <td style="text-align:center">${d.vehicleCount}</td>
        <td>${escapeHtml(d.platesText)}</td>
        <td style="text-align:center">${d.totalRequired}</td>
        <td style="text-align:center">${d.totalActual}</td>
        <td style="text-align:center;color:${d.totalMissing > 0 ? '#b91c1c' : '#047857'}">${d.totalMissing}</td>
        <td style="text-align:center">${d.compensationCount}</td>
      </tr>`,
          )
          .join('') ||
        `<tr><td colspan="11" style="text-align:center;padding:12px">لا توجد بيانات مطابقة.</td></tr>`;
    } else {
      const showShort = kind === 'available';
      const addTripleCol = tripleIntelEnabled ? 1 : 0;
      const emptyTdColspan = showShort ? String(10 + addTripleCol) : String(15 + addTripleCol);
      rowsHtml =
        filteredVehicleRows
          .map((h, i) => {
            const badge = escapeHtml(statusBadge(h.recoveryStatus).label);
            const triplePdfTd =
              tripleIntelEnabled
                ? `<td>${escapeHtml(
                    formatTripleIntelExportCell(tripleDraftsMap[h.vehicleId] ?? seedTripleModalDraft(h)),
                  )}</td>`
                : '';
            if (showShort) {
              return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${escapeHtml(h.plate)}</td>
        <td>${escapeHtml(h.model ?? '—')}</td>
        <td>${escapeHtml(vehicleStatusLabel(h.vehicleStatus))}</td>
        <td>${escapeHtml(h.driverName ?? '—')}</td>
        ${triplePdfTd}
        <td>${escapeHtml(h.driverRole ?? '—')}</td>
        <td>${escapeHtml(h.driverPhone ?? '—')}</td>
        <td>${escapeHtml(h.driverNationalId ?? '—')}</td>
        <td style="text-align:center">${h.actualQty}</td>
        <td>${escapeHtml(h.lastReportAt ? formatDateTime(h.lastReportAt) : '—')}</td>
      </tr>`;
            }
            return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${escapeHtml(h.plate)}</td>
        <td>${escapeHtml(h.model ?? '—')}</td>
        <td>${escapeHtml(vehicleStatusLabel(h.vehicleStatus))}</td>
        <td>${escapeHtml(h.driverName ?? '—')}</td>
        ${triplePdfTd}
        <td>${escapeHtml(h.driverRole ?? '—')}</td>
        <td>${escapeHtml(h.driverPhone ?? '—')}</td>
        <td>${escapeHtml(h.driverNationalId ?? '—')}</td>
        <td style="text-align:center">${h.requiredQty}</td>
        <td style="text-align:center">${h.actualQty}</td>
        <td style="text-align:center;color:${h.missingQty > 0 ? '#b91c1c' : '#047857'}">${h.missingQty}</td>
        <td style="text-align:center">${badge}</td>
        <td>${escapeHtml(h.lastReportAt ? formatDateTime(h.lastReportAt) : '—')}</td>
        <td>${escapeHtml(formatDateTime(h.lastUpdatedAt))}</td>
        <td style="text-align:center">${h.compensationCount}</td>
      </tr>`;
          })
          .join('') ||
        `<tr><td colspan="${emptyTdColspan}" style="text-align:center;padding:12px">لا توجد بيانات مطابقة.</td></tr>`;
    }

    let thead = '';
    if (kind === 'drivers') {
      thead = `<tr style="background:#ede9fe;font-weight:800">
      <th style="border:1px solid #ddd;padding:6px">#</th>
      <th style="border:1px solid #ddd;padding:6px">${escapeHtml(staffLabel)}</th>
      <th style="border:1px solid #ddd;padding:6px">الدور</th>
      <th style="border:1px solid #ddd;padding:6px">الهاتف</th>
      <th style="border:1px solid #ddd;padding:6px">الهوية</th>
      <th style="border:1px solid #ddd;padding:6px">عدد المركبات</th>
      <th style="border:1px solid #ddd;padding:6px">اللوحات</th>
      <th style="border:1px solid #ddd;padding:6px">المطلوب</th>
      <th style="border:1px solid #ddd;padding:6px">المتوفر</th>
      <th style="border:1px solid #ddd;padding:6px">الناقص</th>
      <th style="border:1px solid #ddd;padding:6px">حركات تعويض</th>
    </tr>`;
    } else if (kind === 'available') {
      const tripleInsertion = tripleIntelEnabled ? `<th style="border:1px solid #ddd;padding:6px">توزيع (١+٢)</th>` : '';
      thead = `<tr style="background:#ede9fe;font-weight:800">
      <th style="border:1px solid #ddd;padding:6px">#</th>
      <th style="border:1px solid #ddd;padding:6px">اللوحة</th>
      <th style="border:1px solid #ddd;padding:6px">الموديل</th>
      <th style="border:1px solid #ddd;padding:6px">حالة المركبة</th>
      <th style="border:1px solid #ddd;padding:6px">${escapeHtml(staffLabel)}</th>
      ${tripleInsertion}
      <th style="border:1px solid #ddd;padding:6px">الدور</th>
      <th style="border:1px solid #ddd;padding:6px">الهاتف</th>
      <th style="border:1px solid #ddd;padding:6px">الهوية</th>
      <th style="border:1px solid #ddd;padding:6px">المتوفر</th>
      <th style="border:1px solid #ddd;padding:6px">آخر جرد</th>
    </tr>`;
    } else {
      const tripleInsertion = tripleIntelEnabled ? `<th style="border:1px solid #ddd;padding:6px">توزيع (١+٢)</th>` : '';
      thead = `<tr style="background:#ede9fe;font-weight:800">
      <th style="border:1px solid #ddd;padding:6px">#</th>
      <th style="border:1px solid #ddd;padding:6px">اللوحة</th>
      <th style="border:1px solid #ddd;padding:6px">الموديل</th>
      <th style="border:1px solid #ddd;padding:6px">حالة المركبة</th>
      <th style="border:1px solid #ddd;padding:6px">${escapeHtml(staffLabel)}</th>
      ${tripleInsertion}
      <th style="border:1px solid #ddd;padding:6px">الدور</th>
      <th style="border:1px solid #ddd;padding:6px">الهاتف</th>
      <th style="border:1px solid #ddd;padding:6px">الهوية</th>
      <th style="border:1px solid #ddd;padding:6px">المطلوب</th>
      <th style="border:1px solid #ddd;padding:6px">المتوفر</th>
      <th style="border:1px solid #ddd;padding:6px">الناقص</th>
      <th style="border:1px solid #ddd;padding:6px">الحالة</th>
      <th style="border:1px solid #ddd;padding:6px">آخر جرد</th>
      <th style="border:1px solid #ddd;padding:6px">آخر تحديث</th>
      <th style="border:1px solid #ddd;padding:6px">حركات تعويض</th>
    </tr>`;
    }

    const html = `<div dir="rtl" style="font-family:'Cairo','Tajawal',sans-serif;color:#1c1917;padding:14px">
  <div style="border-bottom:2px solid #6d28d9;padding-bottom:8px;margin-bottom:12px">
    <h2 style="margin:0;font-size:18px;font-weight:900">${escapeHtml(meta.title)}</h2>
    <p style="margin:4px 0 0;font-size:12px;color:#6b7280">${escapeHtml(aggregate.template.itemName)}
      ${aggregate.template.barcode ? ` · باركود: <span style="font-family:monospace">${escapeHtml(aggregate.template.barcode)}</span>` : ''}
    </p>
    <p style="margin:2px 0 0;font-size:11px;color:#6b7280">${escapeHtml(dept)} · ${escapeHtml(meta.subtitle)}</p>
    <p style="margin:6px 0 0;font-size:11px;color:#374151;font-weight:700">عدد السطور المعروضة: ${kind === 'drivers' ? filteredDriverRows.length : filteredVehicleRows.length}</p>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:10px">${thead}<tbody style="font-weight:500">${rowsHtml}</tbody></table>
  <p style="margin-top:12px;font-size:9px;color:#6b7280;text-align:center">مركز الذكاء · ${new Date().toLocaleString('ar-EG')}</p>
</div>`;

    await exportHtmlToPdf(html, `تقرير_${meta.slug}_${safeFileStem}.pdf`);
  }, [
    aggregate.template.barcode,
    aggregate.template.itemName,
    department,
    filteredDriverRows,
    filteredVehicleRows,
    kind,
    meta.slug,
    meta.subtitle,
    meta.title,
    safeFileStem,
    staffLabel,
    tripleIntelEnabled,
    tripleDraftsMap,
  ]);

  if (!open) return null;

  const emptyDrivers = kind === 'drivers' && filteredDriverRows.length === 0;
  const emptyVehicles =
    kind !== 'drivers' &&
    filteredVehicleRows.length === 0;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 md:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-stone-900/55 backdrop-blur-[2px]"
        aria-hidden
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kpi-drill-title"
        className={cn(
          'relative flex max-h-[min(92vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-2xl dark:border-stone-700 dark:bg-stone-950',
        )}
      >
        <div className="flex-shrink-0 border-b border-stone-200/80 px-4 py-3 md:px-5 dark:border-stone-700/80 bg-gradient-to-l from-violet-500/8 to-transparent">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
              <HeaderIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 id="kpi-drill-title" className="text-sm font-black text-stone-900 dark:text-stone-50">
                {meta.title}
                <span className="mx-1 opacity-60">·</span>
                <span className="text-violet-700 dark:text-violet-300">{aggregate.template.displayLabel}</span>
              </h2>
              <p className="text-[11px] font-bold leading-relaxed text-stone-600 dark:text-stone-400">
                {meta.subtitle}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-black text-violet-800 dark:text-violet-200">
                  {countBadge.toLocaleString('ar-EG')} سطر
                </span>
              </div>
            </div>
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExcel}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[10px] font-black text-white hover:bg-emerald-700"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel
              </button>
              <button
                type="button"
                onClick={() => void handlePdf()}
                className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-2.5 py-1.5 text-[10px] font-black text-white hover:bg-violet-700"
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-stone-300 p-2 text-stone-600 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم، اللوحة، الهاتف…"
              className="w-full rounded-xl border border-stone-200 bg-white py-2 pr-10 pl-3 text-xs font-semibold outline-none ring-violet-500/0 transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500 dark:border-stone-700 dark:bg-stone-900"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-2 pb-4 md:px-4">
          {kind === 'drivers' ? (
            emptyDrivers ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm font-bold text-stone-500">
                لا توجد بيانات لهذا المنظور أو لا يوجد تطابق مع البحث.
              </div>
            ) : (
              <table className="min-w-full text-[11px]">
                <thead className="sticky top-0 z-[1] bg-stone-100/95 text-[10px] font-black text-stone-600 backdrop-blur dark:bg-stone-900/95 dark:text-stone-300">
                  <tr className="border-b border-stone-200 dark:border-stone-700">
                    <th className="px-2 py-2 text-right">#</th>
                    <th className="px-2 py-2 text-right">{staffLabel}</th>
                    <th className="px-2 py-2 text-right">الدور</th>
                    <th className="px-2 py-2 text-right hidden sm:table-cell">الهاتف</th>
                    <th className="px-2 py-2 text-right hidden lg:table-cell">الهوية</th>
                    <th className="px-2 py-2 text-center">المركبات</th>
                    <th className="px-2 py-2 text-center hidden md:table-cell">المطلوب</th>
                    <th className="px-2 py-2 text-center hidden md:table-cell">المتوفر</th>
                    <th className="px-2 py-2 text-center">الناقص</th>
                    <th className="px-2 py-2 text-center">تعويض</th>
                    <th className="px-2 py-2 text-right hidden xl:table-cell">اللوحات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {filteredDriverRows.map((d, i) => (
                    <tr key={d.driverId} className="hover:bg-stone-50/80 dark:hover:bg-stone-900/50">
                      <td className="px-2 py-2 text-stone-500">{i + 1}</td>
                      <td className="px-2 py-2 font-bold">{d.driverName ?? '—'}</td>
                      <td className="px-2 py-2 text-stone-600">{d.driverRole ?? '—'}</td>
                      <td className="px-2 py-2 hidden sm:table-cell font-mono text-[10px]">{d.driverPhone ?? '—'}</td>
                      <td className="px-2 py-2 hidden lg:table-cell font-mono text-[10px]">{d.driverNationalId ?? '—'}</td>
                      <td className="px-2 py-2 text-center font-black">{d.vehicleCount}</td>
                      <td className="px-2 py-2 hidden md:table-cell text-center">{d.totalRequired}</td>
                      <td className="px-2 py-2 hidden md:table-cell text-center">{d.totalActual}</td>
                      <td
                        className={cn(
                          'px-2 py-2 text-center font-black',
                          d.totalMissing > 0 ? 'text-rose-600' : 'text-emerald-600',
                        )}
                      >
                        {d.totalMissing}
                      </td>
                      <td className="px-2 py-2 text-center">{d.compensationCount}</td>
                      <td className="px-2 py-2 hidden xl:table-cell text-stone-500 text-[10px] leading-snug">{d.platesText}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : emptyVehicles ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm font-bold text-stone-500">
              لا توجد بيانات لهذا المنظور أو لا يوجد تطابق مع البحث.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[880px] w-full text-[11px]">
                <thead className="sticky top-0 z-[1] bg-stone-100/95 text-[10px] font-black text-stone-600 backdrop-blur dark:bg-stone-900/95 dark:text-stone-300">
                  <tr className="border-b border-stone-200 dark:border-stone-700">
                    <th className="px-2 py-2 text-right">#</th>
                    <th className="px-2 py-2 text-right">اللوحة</th>
                    <th className="px-2 py-2 text-right hidden sm:table-cell">الموديل</th>
                    <th className="px-2 py-2 text-right hidden md:table-cell">حالة المركبة</th>
                    <th className="px-2 py-2 text-right">{staffLabel}</th>
                    <th className="px-2 py-2 text-right hidden lg:table-cell">الدور</th>
                    <th className="px-2 py-2 hidden lg:table-cell">الهاتف</th>
                    <th className="px-2 py-2 hidden xl:table-cell">الهوية</th>
                    {kind === 'available' ? (
                      <>
                        <th className="px-2 py-2 text-center">المتوفر</th>
                        <th className="px-2 py-2 text-right hidden md:table-cell">آخر جرد</th>
                      </>
                    ) : (
                      <>
                        <th className="px-2 py-2 text-center hidden sm:table-cell">المطلوب</th>
                        <th className="px-2 py-2 text-center">المتوفر</th>
                        <th className="px-2 py-2 text-center">الناقص</th>
                        <th className="px-2 py-2 text-center">الحالة</th>
                        <th className="px-2 py-2 text-right hidden md:table-cell">آخر جرد</th>
                        <th className="px-2 py-2 text-right hidden lg:table-cell">آخر تحديث</th>
                        <th className="px-2 py-2 text-center hidden sm:table-cell">تعويض</th>
                      </>
                    )}
                    {onOpenVehicleLatestReport ? (
                      <th className="px-2 py-2 text-center">إجراء</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {filteredVehicleRows.map((h, idx) => {
                    const badge = statusBadge(h.recoveryStatus);
                    const isMissingRow = h.missingQty > 0;
                    return (
                      <tr
                        key={h.vehicleId}
                        className={cn(
                          'hover:bg-stone-50/80 dark:hover:bg-stone-900/50',
                          kind === 'missing' || kind === 'shortageVehicles'
                            ? 'bg-rose-50/30 dark:bg-rose-950/10'
                            : isMissingRow
                              ? 'bg-rose-50/30 dark:bg-rose-950/10'
                              : '',
                        )}
                      >
                        <td className="px-2 py-2 text-stone-500">{idx + 1}</td>
                        <td className="px-2 py-2 font-mono font-black">{h.plate}</td>
                        <td className="px-2 py-2 hidden sm:table-cell">{h.model ?? '—'}</td>
                        <td className="px-2 py-2 hidden md:table-cell text-stone-600">
                          {vehicleStatusLabel(h.vehicleStatus)}
                        </td>
                        <td className="px-2 py-2 align-top font-bold">
                          {tripleIntelEnabled ? (
                            <TripleIntelDriverCell
                              driverName={h.driverName}
                              staffLabel={staffLabel}
                              tripleIntel={h.tripleHolderLabels}
                              dense
                              printDraftTriple={tripleDraftsMap[h.vehicleId] ?? seedTripleModalDraft(h)}
                              onPrintDraftTripleChange={(next) => onTriplePrintDraftChange!(h.vehicleId, next)}
                              onStartInspection={
                                department === 'tajhiz' && onStartVehicleInspection
                                  ? () => onStartVehicleInspection!(h.vehicleId)
                                  : undefined
                              }
                            />
                          ) : (
                            (h.driverName ?? '—')
                          )}
                        </td>
                        <td className="px-2 py-2 hidden lg:table-cell text-stone-600">{h.driverRole ?? '—'}</td>
                        <td className="px-2 py-2 hidden lg:table-cell font-mono text-[10px]">{h.driverPhone ?? '—'}</td>
                        <td className="px-2 py-2 hidden xl:table-cell font-mono text-[10px]">{h.driverNationalId ?? '—'}</td>
                        {kind === 'available' ? (
                          <>
                            <td className="px-2 py-2 text-center font-black">{h.actualQty}</td>
                            <td className="px-2 py-2 text-stone-500 hidden md:table-cell">
                              {formatDateTime(h.lastReportAt)}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-2 py-2 text-center hidden sm:table-cell">{h.requiredQty}</td>
                            <td className="px-2 py-2 text-center font-bold">{h.actualQty}</td>
                            <td
                              className={cn(
                                'px-2 py-2 text-center font-black',
                                isMissingRow ? 'text-rose-600' : 'text-emerald-600',
                              )}
                            >
                              {h.missingQty}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <span className={cn('inline-block rounded-full border px-2 py-0.5 font-black text-[9px]', badge.cls)}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-stone-500 hidden md:table-cell">
                              {formatDateTime(h.lastReportAt)}
                            </td>
                            <td className="px-2 py-2 text-stone-500 hidden lg:table-cell">
                              {formatDateTime(h.lastUpdatedAt)}
                            </td>
                            <td className="px-2 py-2 text-center hidden sm:table-cell">{h.compensationCount}</td>
                          </>
                        )}
                        {onOpenVehicleLatestReport ? (
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              className="rounded-lg border border-violet-400/60 bg-violet-500/10 px-2 py-1 font-black text-[9px] text-violet-800 hover:bg-violet-500/20 dark:border-violet-600/60 dark:text-violet-100"
                              onClick={() => onOpenVehicleLatestReport(h.vehicleId)}
                            >
                              تقرير
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
