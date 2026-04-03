import type { Report } from './supabaseClient';

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
  driverSignature: string;
  equipmentManagerSignature: string;
  logisticsManagerSignature: string;
  warehouseManagerSignature: string;
  createdAt: string;
}

/** يستخرج معرف التقرير من حقل new_value في vehicle_events (مثل report:7) */
export function parseReportIdFromVehicleEventNewValue(newValue: string | null | undefined): number | null {
  if (newValue == null || newValue === '') return null;
  const m = String(newValue).trim().match(/^report:(\d+)$/i);
  return m ? Number(m[1]) : null;
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
      driverSignature: r.driver_signature || '',
      equipmentManagerSignature: r.equipment_manager || '',
      logisticsManagerSignature: r.logistics_manager || '',
      warehouseManagerSignature: r.warehouse_manager || '',
      createdAt: r.created_at,
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
    driverSignature: String(row.driver_signature ?? payload.driver_signature ?? ''),
    equipmentManagerSignature: String(row.equipment_manager ?? payload.equipment_manager ?? ''),
    logisticsManagerSignature: String(row.logistics_manager ?? payload.logistics_manager ?? ''),
    warehouseManagerSignature: String(row.warehouse_manager ?? payload.warehouse_manager ?? ''),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}
