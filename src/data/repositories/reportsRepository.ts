import type { DepartmentCode } from '../department';
import { getDepartmentClient, getDepartmentTables } from '../supabaseSource';
import type { GateNotificationPayload } from '../contracts/gateNotifications';
import { toGateNotificationInsert } from '../contracts/gateNotifications';

export class ReportsRepository {
  async listReports(department: DepartmentCode): Promise<Record<string, unknown>[]> {
    const client = getDepartmentClient(department);
    const table = getDepartmentTables(department).reports;
    const { data, error } = await client.from(table).select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Record<string, unknown>[];
  }

  async createGateNotification(department: DepartmentCode, payload: Omit<GateNotificationPayload, 'sourceDepartment'>) {
    const client = getDepartmentClient(department);
    const table = getDepartmentTables(department).gateNotifications;
    const { error } = await client.from(table).insert(
      toGateNotificationInsert({
        ...payload,
        sourceDepartment: department,
      })
    );
    if (error) throw error;
  }
}
