import type { Report } from './supabaseClient';
import { parseToolHolderAllocationsFromUnknown, type ToolHolderAllocationsByTemplateId } from './toolHolderAllocations';

/** نموذج عرض التقرير المحفوظ (تجهيز + تركيب) — يُستخدم في صفحة التقارير ومودال السجل */
export interface SavedReportView {
  id: number;
  vehicleId: number | null;
  driverName: string;
  truckNumber: string;
  vehicleType?: string;
  date: string;
  damagePoints: unknown[];
  inspectionValues: Record<number, boolean>;
  toolValues: Record<number, number>;
  toolImages: Record<number, string[]>;
  /** مخزَّن تقرير التجهيز — {} خارج التفعيل أو التقارير القديمة */
  toolHolderAllocations: ToolHolderAllocationsByTemplateId;
  driverSignature: string;
  equipmentManagerSignature: string;
  logisticsManagerSignature: string;
  warehouseManagerSignature: string;
  createdAt: string;
  /**
   * رقم الجرد المعروض: 1 = أقدم تقرير في السجل (حسب created_at)، N = الأحدث.
   * يُعاد احتسابه عند كل تحميل للقائمة؛ لا يعتمد على id قاعدة البيانات.
   */
  displaySequence: number;
}

/** يستخرج معرف التقرير من حقل new_value في vehicle_events (مثل report:7) */
export function parseReportIdFromVehicleEventNewValue(newValue: string | null | undefined): number | null {
  if (newValue == null || newValue === '') return null;
  const m = String(newValue).trim().match(/^report:(\d+)$/i);
  return m ? Number(m[1]) : null;
}

/** تنسيق رقم الجرد للعرض (مثل #00007) — يعتمد على displaySequence بعد assignReportDisplaySequences */
export function formatReportInventoryNo(report: Pick<SavedReportView, 'id' | 'displaySequence'>): string {
  // توحيد المرجع مع سجل المركبة (vehicle_events new_value = report:<id>)
  // حتى يكون رقم التقرير ثابتاً ومتطابقاً في كل الواجهات.
  return String(report.id).padStart(5, '0');
}

/**
 * يملأ displaySequence لكل تقرير: الأقدم created_at = 1، الأحدث = طول القائمة.
 * ترتيب القائمة الناتجة يبقى كما هو (لا يُعاد ترتيبها).
 */
/** يحسب رقم الجرد من قائمة id + created_at (نفس منطق assignReportDisplaySequences) */
export function computeReportDisplaySequence(
  reportId: number,
  rows: Array<{ id: unknown; created_at?: unknown }>,
): number {
  const normalized = rows
    .map((row) => ({
      id: Number(row.id),
      createdAt: String(row.created_at ?? ''),
    }))
    .filter((r) => Number.isFinite(r.id));
  normalized.sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
    return a.id - b.id;
  });
  const idx = normalized.findIndex((r) => r.id === reportId);
  return idx >= 0 ? idx + 1 : 1;
}

export function assignReportDisplaySequences(reports: SavedReportView[]): SavedReportView[] {
  if (reports.length === 0) return [];
  const withIndex = reports.map((r, listIndex) => ({ r, listIndex }));
  withIndex.sort((a, b) => {
    const ta = new Date(a.r.createdAt).getTime();
    const tb = new Date(b.r.createdAt).getTime();
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
    return a.r.id - b.r.id;
  });
  const idToSeq = new Map<number, number>();
  withIndex.forEach((item, order) => {
    idToSeq.set(item.r.id, order + 1);
  });
  return reports.map((r) => ({
    ...r,
    displaySequence: idToSeq.get(r.id) ?? 1,
  }));
}

/** يبني خريطة تسلسل التقارير عالمياً: الأقدم = 1، الأحدث = N */
export function buildReportSequenceMap(
  rows: Array<{ id: unknown; created_at?: unknown }>,
): Map<number, number> {
  const normalized = rows
    .map((row) => ({
      id: Number(row.id),
      createdAt: String(row.created_at ?? ''),
    }))
    .filter((r) => Number.isFinite(r.id));

  normalized.sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
    return a.id - b.id;
  });

  const seqById = new Map<number, number>();
  normalized.forEach((row, idx) => {
    seqById.set(row.id, idx + 1);
  });
  return seqById;
}

export function mapDbRowToSavedReportView(row: Record<string, unknown>, isInstallation: boolean): SavedReportView {
  if (!isInstallation) {
    const r = row as unknown as Report;
    return {
      id: r.id,
      vehicleId: r.vehicle_id,
      driverName: r.driver_name || '',
      truckNumber: r.truck_number || '',
      vehicleType: '',
      date: r.date || '',
      damagePoints: Array.isArray(r.damage_points) ? r.damage_points : [],
      inspectionValues: (r.inspection_values as Record<number, boolean>) || {},
      toolValues: (r.tool_values as Record<number, number>) || {},
      toolImages: (r.tool_images as Record<number, string[]>) || {},
      toolHolderAllocations: parseToolHolderAllocationsFromUnknown(r.tool_holder_allocations ?? {}),
      driverSignature: r.driver_signature || '',
      equipmentManagerSignature: r.equipment_manager || '',
      logisticsManagerSignature: r.logistics_manager || '',
      warehouseManagerSignature: r.warehouse_manager || '',
      createdAt: r.created_at,
      displaySequence: 0,
    };
  }
  const payload = (row.payload && typeof row.payload === 'object'
    ? (row.payload as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  return {
    id: Number(row.id),
    vehicleId: row.vehicle_id == null ? null : Number(row.vehicle_id),
    driverName: String(row.driver_name ?? payload.driver_name ?? ''),
    truckNumber: String(row.truck_number ?? row.vehicle_number ?? payload.truck_number ?? ''),
    vehicleType: String(row.vehicle_type ?? payload.vehicle_type ?? ''),
    date: String(row.date ?? payload.date ?? ''),
    damagePoints: Array.isArray(row.damage_points)
      ? (row.damage_points as unknown[])
      : Array.isArray(payload.damage_points)
        ? (payload.damage_points as unknown[])
        : [],
    inspectionValues:
      (row.inspection_values as Record<number, boolean>) || (payload.inspection_values as Record<number, boolean>) || {},
    toolValues: (row.tool_values as Record<number, number>) || (payload.tool_values as Record<number, number>) || {},
    toolImages:
      (row.tool_images as Record<number, string[]>) || (payload.tool_images as Record<number, string[]>) || {},
    toolHolderAllocations: parseToolHolderAllocationsFromUnknown(
      row.tool_holder_allocations ?? payload.tool_holder_allocations ?? {},
    ),
    driverSignature: String(row.driver_signature ?? payload.driver_signature ?? ''),
    equipmentManagerSignature: String(row.equipment_manager ?? payload.equipment_manager ?? ''),
    logisticsManagerSignature: String(row.logistics_manager ?? payload.logistics_manager ?? ''),
    warehouseManagerSignature: String(row.warehouse_manager ?? payload.warehouse_manager ?? ''),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    displaySequence: 0,
  };
}
