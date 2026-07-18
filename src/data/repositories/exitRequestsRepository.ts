import type { DepartmentCode } from '../department';
import { getDepartmentClient, getDepartmentTables } from '../supabaseSource';
import type { DepartmentExitRequest } from '../types';

export class ExitRequestsRepository {
  async list(department: DepartmentCode): Promise<DepartmentExitRequest[]> {
    const client = getDepartmentClient(department);
    const tables = getDepartmentTables(department);
    const { data, error } = await client
      .from(tables.exitRequests)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as DepartmentExitRequest[];
  }

  async createInstallationRequest(input: {
    vehicleId: number | null;
    vehicleNumber: string | null;
    vehicleType: 'starex' | 'nissan' | null;
    locationSnapshot: string | null;
    technicianIds: number[];
    technicianNames: string[];
    responsibleStaffId: number | null;
    createdBy: string | null;
    notes?: string | null;
    exitReason?: string | null;
  }): Promise<void> {
    const client = getDepartmentClient('installation');
    const tables = getDepartmentTables('installation');
    const { error } = await client.from(tables.exitRequests).insert({
      vehicle_id: input.vehicleId,
      vehicle_number: input.vehicleNumber,
      vehicle_type: input.vehicleType,
      location_snapshot: input.locationSnapshot,
      technician_ids: input.technicianIds,
      technician_names: input.technicianNames,
      responsible_staff_id: input.responsibleStaffId,
      created_by: input.createdBy,
      notes: input.notes ?? null,
      exit_reason: input.exitReason ?? null,
      status: 'pending',
    });
    if (error) throw error;
  }
}
