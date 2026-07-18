import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * حذف صفوف Bubbles حسب المعرّفات كما تظهر في الواجهة:
 * - `arc-<archive_id>` → `bubbles_records_archive.archive_id`
 * - غير ذلك → `bubbles_records.id`
 */
export async function deleteBubblesRecordsByUiIds(
  client: SupabaseClient,
  uiIds: readonly string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const liveIds: string[] = [];
  const archiveIds: number[] = [];
  for (const raw of uiIds) {
    const id = String(raw).trim();
    if (!id) continue;
    if (id.startsWith('arc-')) {
      const n = Number(id.slice(4));
      if (Number.isFinite(n) && n > 0) archiveIds.push(n);
    } else {
      liveIds.push(id);
    }
  }
  if (liveIds.length > 0) {
    const { error } = await client.from('bubbles_records').delete().in('id', liveIds);
    if (error) return { ok: false, message: error.message };
  }
  if (archiveIds.length > 0) {
    const { error } = await client.from('bubbles_records_archive').delete().in('archive_id', archiveIds);
    if (error) return { ok: false, message: error.message };
  }
  return { ok: true };
}
