import type { SupabaseClient } from '@supabase/supabase-js';
import type { DepartmentTables } from '../../data/supabaseSource';
import type { DepartmentCode } from '../../data/department';
import { normalizeDepartmentVehicleRow } from '../../data/supabaseSource';
import type { ReportRowForIntelligence, VehicleRowForIntelligence } from './types';

/**
 * جلب مركبات القسم للتحليل — نفس ترتيب Reports تقريباً.
 */
export async function fetchVehiclesForIntelligence(
  client: SupabaseClient,
  tables: DepartmentTables,
  department: DepartmentCode,
): Promise<VehicleRowForIntelligence[]> {
  const orderColumn = department === 'installation' ? 'vehicle_number' : 'plate_number';
  const { data, error } = await client.from(tables.vehicles).select('*').order(orderColumn);
  if (error) {
    console.error('[inspectionIntelligence] vehicles:', error);
    return [];
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return rows.map((row) => {
    const v = normalizeDepartmentVehicleRow(row);
    return {
      id: v.id,
      plate_number: v.plate_number,
      assigned_driver_id: v.assigned_driver_id,
    };
  });
}

/**
 * جلب تقارير الجرد للتحليل — أعمدة دنيا فقط.
 */
export async function fetchReportsForIntelligence(
  client: SupabaseClient,
  tables: DepartmentTables,
  isInstallation: boolean,
): Promise<ReportRowForIntelligence[]> {
  const selectCols = isInstallation ? 'id, vehicle_id, created_at, payload' : 'id, vehicle_id, created_at';
  const { data, error } = await client.from(tables.reports).select(selectCols).order('created_at', { ascending: false });
  if (error) {
    console.error('[inspectionIntelligence] reports:', error);
    return [];
  }
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  return rows.map((row) => {
    let vehicleId: number | null = row.vehicle_id == null ? null : Number(row.vehicle_id);
    if (isInstallation && vehicleId == null && row.payload && typeof row.payload === 'object') {
      const p = row.payload as Record<string, unknown>;
      const fromPayload = p.vehicle_id;
      if (fromPayload != null) vehicleId = Number(fromPayload);
    }
    return {
      id: Number(row.id),
      vehicle_id: Number.isFinite(vehicleId as number) ? vehicleId : null,
      created_at: String(row.created_at ?? ''),
    };
  });
}

/**
 * أسماء السائقين/الفنيين — نفس منطق Reports (سائق فقط للتجهيز).
 */
export async function fetchStaffNamesForIntelligence(
  client: SupabaseClient,
  tables: DepartmentTables,
  department: DepartmentCode,
): Promise<Map<string, string>> {
  let query = client.from(tables.staffMembers).select('id, full_name').eq('is_active', true);
  if (department !== 'installation') {
    query = query.eq('role', 'driver');
  }
  const { data, error } = await query;
  if (error) {
    console.error('[inspectionIntelligence] staff:', error);
    return new Map();
  }
  const map = new Map<string, string>();
  for (const row of (data ?? []) as Array<{ id: unknown; full_name: unknown }>) {
    map.set(String(row.id), String(row.full_name ?? ''));
  }
  return map;
}
