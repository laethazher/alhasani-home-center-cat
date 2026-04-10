import { normalizeBubblesDriverLabel } from './bubblesGrouping';

export function bubbleDriverFirstTwoWords(name: string): string {
  const n = normalizeBubblesDriverLabel(name);
  const parts = n.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).join(' ');
}

export type StaffPickRow = { id: string; full_name: string };

/**
 * مطابقة اسم سائق الببلز مع كادر السائقين: تطابق كامل، أول اسمين، أو تشابه بسيط؛
 * مع قائمة للاختيار اليدوي عند الحاجة.
 */
export function getStaffPickOptionsForBubbleDriver(
  staffRows: StaffPickRow[],
  bubblesDriverLabel: string,
): { options: StaffPickRow[]; suggestedId: string | null } {
  const norm = normalizeBubblesDriverLabel(bubblesDriverLabel);
  const two = bubbleDriverFirstTwoWords(bubblesDriverLabel).toLowerCase();

  const scored = staffRows.map((s) => {
    const fn = normalizeBubblesDriverLabel(s.full_name);
    const fnLower = fn.toLowerCase();
    const staffTwo = bubbleDriverFirstTwoWords(s.full_name).toLowerCase();
    let score = 0;
    if (fn === norm) score = 100;
    else if (fnLower === norm.toLowerCase()) score = 95;
    else if (two && staffTwo === two) score = 88;
    else if (two && fnLower.startsWith(two)) score = 78;
    else if (two.length >= 4 && fnLower.includes(two)) score = 55;
    return { id: String(s.id), full_name: s.full_name, score };
  });

  const matches = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  const top = matches[0];
  const suggestedId = top && top.score >= 55 ? top.id : null;

  const seen = new Set<string>();
  const options: StaffPickRow[] = [];
  for (const m of matches.slice(0, 24)) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    options.push({ id: m.id, full_name: m.full_name });
  }

  if (options.length === 0) {
    const sorted = [...staffRows]
      .map((s) => ({ id: String(s.id), full_name: s.full_name }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'));
    return { options: sorted, suggestedId: null };
  }

  return { options, suggestedId };
}
