import type { DepartmentCode } from '../department';
import { getDepartmentClient, getDepartmentTables } from '../supabaseSource';
import type { DepartmentAttendanceRecord } from '../types';

export class AttendanceRepository {
  async listByDate(department: DepartmentCode, attendanceDate: string): Promise<DepartmentAttendanceRecord[]> {
    const client = getDepartmentClient(department);
    const tables = getDepartmentTables(department);
    const { data, error } = await client
      .from(tables.attendance)
      .select('*')
      .eq('attendance_date', attendanceDate)
      .order('id');
    if (error) throw error;
    return (data ?? []) as DepartmentAttendanceRecord[];
  }

  async logAction(
    department: DepartmentCode,
    actionType: 'add' | 'edit' | 'archive' | 'export',
    entityType: string,
    metadata: Record<string, unknown>,
    userId: string | null
  ): Promise<void> {
    if (department !== 'installation') return;
    const client = getDepartmentClient('installation');
    const { error } = await client.from('installation_attendance_activity_log').insert({
      action_type: actionType,
      entity_type: entityType,
      metadata,
      user_id: userId,
    });
    if (error) throw error;
  }
}
