export interface RankOptions<T> {
  getSearchableText: (item: T) => string;
  getDate?: (item: T) => Date | null;
  /** وزن أعلى = أهمية أكبر في التطابق */
  primaryBoost?: (item: T) => number;
}

function scoreMatch(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  const idx = t.indexOf(q);
  if (idx === 0) return 80;
  if (idx > 0) return 60 - Math.min(idx, 20);
  const parts = q.split(/\s+/).filter(Boolean);
  let s = 0;
  for (const p of parts) {
    if (t.includes(p)) s += 25;
  }
  return s;
}

function recencyScore(date: Date | null | undefined): number {
  if (!date || Number.isNaN(date.getTime())) return 0;
  const days = (Date.now() - date.getTime()) / (86400 * 1000);
  return Math.max(0, 30 - Math.min(days, 30));
}

/**
 * يرتب العناصر حسب صلة الاستعلام (بدون تعديل المصفوفة الأصلية).
 */
export function rankItems<T>(items: T[], query: string, opts: RankOptions<T>): T[] {
  const q = query.trim();
  if (!q) return [...items];

  const scored = items.map((item) => {
    const text = opts.getSearchableText(item);
    const match = scoreMatch(text, q);
    const date = opts.getDate?.(item) ?? null;
    const rec = recencyScore(date);
    const boost = opts.primaryBoost?.(item) ?? 0;
    const total = match * 2 + rec + boost;
    return { item, total };
  });

  scored.sort((a, b) => b.total - a.total);
  return scored.map((s) => s.item);
}
