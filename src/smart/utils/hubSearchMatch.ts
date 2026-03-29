/** مطابقة بحث مرن لمركز التقارير: أرقام عربية، كلمات متعددة، ومطابقة جزئية */

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function toLatinDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

export function normalizeForHubSearch(s: string): string {
  return toLatinDigits(s).toLowerCase().trim();
}

/**
 * يطابق إذا كان النص الكامل موجوداً كسلسلة، أو إذا وُجدت كل الكلمات (مفصولة بمسافة) في أي مكان داخل النص.
 */
export function rowMatchesHubQuery(haystack: string, query: string): boolean {
  const raw = query.trim();
  if (!raw) return true;
  const blob = normalizeForHubSearch(haystack);
  const norm = normalizeForHubSearch(raw);
  if (!norm) return true;
  if (blob.includes(norm)) return true;
  const tokens = norm.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return true;
  return tokens.every((t) => blob.includes(t));
}
