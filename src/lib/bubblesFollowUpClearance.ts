import type { SupabaseClient } from '@supabase/supabase-js';
import type { BubblesRecord } from './supabaseClient';

export function partitionFollowUpBubbleRowIds(rows: Pick<BubblesRecord, 'id'>[]): {
  liveIds: string[];
  archiveIds: number[];
} {
  const liveIds = rows.filter((r) => /^\d+$/.test(String(r.id))).map((r) => String(r.id));
  const archiveIds = rows
    .filter((r) => String(r.id).startsWith('arc-'))
    .map((r) => {
      const raw = String(r.id).replace(/^arc-/, '');
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : null;
    })
    .filter((x): x is number => x != null);
  return { liveIds, archiveIds };
}

/** يزيل السجلات من «يحتاج متابعة»: حي → معلّق، أرشيف مشكلة/متأخر → مكتمل */
export async function applyBubblesFollowUpClearance(
  supabase: SupabaseClient,
  rows: Pick<BubblesRecord, 'id'>[],
): Promise<{ error: { message: string } | null }> {
  const { liveIds, archiveIds } = partitionFollowUpBubbleRowIds(rows);
  if (liveIds.length === 0 && archiveIds.length === 0) {
    return { error: null };
  }
  if (liveIds.length > 0) {
    const { error } = await supabase
      .from('bubbles_records')
      .update({ status: 'pending', reason: null })
      .in('id', liveIds);
    if (error) return { error };
  }
  if (archiveIds.length > 0) {
    const { error } = await supabase
      .from('bubbles_records_archive')
      .update({ status: 'completed', reason: null })
      .in('archive_id', archiveIds);
    if (error) return { error };
  }
  return { error: null };
}
