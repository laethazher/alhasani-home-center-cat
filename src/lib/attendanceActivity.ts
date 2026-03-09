/**
 * Helper to log attendance-related actions to attendance_activity_log
 */
import { supabase } from './supabaseClient';

export type AttendanceActionType = 'add' | 'edit' | 'archive' | 'export';

export async function logAttendanceActivity(
  actionType: AttendanceActionType,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('attendance_activity_log').insert({
    action_type: actionType,
    entity_type: 'attendance',
    metadata,
    user_id: user?.id ?? null,
  });
}
