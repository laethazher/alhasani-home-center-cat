import type { DepartmentCode } from '../department';
import { getDepartmentClient, getDepartmentTables } from '../supabaseSource';
import type { DepartmentMaintenanceRequest } from '../types';

export class MaintenanceRepository {
  async listRequests(department: DepartmentCode): Promise<DepartmentMaintenanceRequest[]> {
    const client = getDepartmentClient(department);
    const tables = getDepartmentTables(department);
    const { data, error } = await client
      .from(tables.maintenanceRequests)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as DepartmentMaintenanceRequest[];
  }

  async createInstallationNotification(input: {
    vehicleId: number | null;
    requestId: number | null;
    title: string;
    message: string | null;
    createdBy: string | null;
    targetRole: string | null;
  }): Promise<void> {
    const client = getDepartmentClient('installation');
    const { error } = await client.from('installation_maintenance_notifications').insert({
      vehicle_id: input.vehicleId,
      request_id: input.requestId,
      notification_type: 'maintenance_request_created',
      title: input.title,
      message: input.message,
      source_department: 'installation',
      created_by: input.createdBy,
      target_role: input.targetRole,
    });
    if (error) throw error;
  }
}
