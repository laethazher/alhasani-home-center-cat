/**
 * Helper to log attendance-related actions to attendance_activity_log
 */
import { getDepartmentClient, getDepartmentTables } from '../data/supabaseSource';
import type { DepartmentCode } from '../data/department';

export type AttendanceActionType = 'add' | 'edit' | 'archive' | 'export';

export async function logAttendanceActivity(
  actionType: AttendanceActionType,
  metadata: Record<string, unknown> = {},
  department: DepartmentCode = 'tajhiz'
): Promise<void> {
  const supabase = getDepartmentClient(department);
  const tables = getDepartmentTables(department);
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from(department === 'installation' ? 'installation_attendance_activity_log' : tables.attendance + '_activity_log').insert({
    action_type: actionType,
    entity_type: 'attendance',
    metadata,
    user_id: user?.id ?? null,
  });
}
