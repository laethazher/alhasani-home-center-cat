import type { ParsedQuery, TimeWindowKind } from '../types';

const AR_STOPWORDS = new Set([
  'في', 'من', 'إلى', 'على', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'و', 'أو',
]);

/** مرادفات للتوسيع عند المطابقة */
const SYNONYM_GROUPS: string[][] = [
  ['متأخر', 'متأخرين', 'late', 'delay', 'تأخير'],
  ['غائب', 'غائبين', 'absent'],
  ['حاضر', 'حاضرين', 'present'],
  ['مخالفة', 'مخالفات', 'violation'],
  ['مركبة', 'مركبات', 'vehicle', 'plate'],
  ['سائق', 'سائقين', 'driver'],
  ['مساعد', 'مساعدين', 'assistant'],
];

function normalizeText(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u0640\u200c\u200f]/g, '');
}

function tokenize(normalized: string): string[] {
  return normalized
    .toLowerCase()
    .split(/[\s،,.;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function expandTokens(tokens: string[]): string[] {
  const out = new Set<string>();
  for (const t of tokens) {
    out.add(t);
    for (const group of SYNONYM_GROUPS) {
      if (group.some((g) => g.toLowerCase() === t || t.includes(g.toLowerCase()) || g.toLowerCase().includes(t))) {
        group.forEach((g) => out.add(g.toLowerCase()));
      }
    }
  }
  return [...out];
}

const TIME_AR: { re: RegExp; kind: TimeWindowKind }[] = [
  { re: /هذا\s*الأسبوع|هذا الاسبوع|this\s*week/i, kind: 'this_week' },
  { re: /الأسبوع\s*الماضي|الاسبوع الماضي|last\s*week/i, kind: 'last_week' },
  { re: /اليوم|today/i, kind: 'today' },
  { re: /أمس|امس|yesterday/i, kind: 'yesterday' },
];

const STATUS_HINTS: { re: RegExp; status: ParsedQuery['statusHints'][number] }[] = [
  { re: /قيد\s*الانتظار|pending/i, status: 'pending' },
  { re: /معتمد|approved/i, status: 'approved' },
  { re: /خرج|خارج|exited/i, status: 'exited' },
  { re: /مرفوض|rejected/i, status: 'rejected' },
  { re: /متأخر|late/i, status: 'late' },
  { re: /غائب|absent/i, status: 'absent' },
  { re: /حاضر|present/i, status: 'present' },
];

/** إصلاح خفيف: كلمات شائعة بخطأ إملائي بسيط */
const TYPo_FIX: Record<string, string> = {
  متاخر: 'متأخر',
  متلخر: 'متأخر',
};

function applyTypoFix(text: string): string {
  let t = text;
  for (const [wrong, right] of Object.entries(TYPo_FIX)) {
    if (t.includes(wrong)) t = t.split(wrong).join(right);
  }
  return t;
}

export function detectTimeWindow(text: string): TimeWindowKind | null {
  const n = text.toLowerCase();
  for (const { re, kind } of TIME_AR) {
    if (re.test(n)) return kind;
  }
  return null;
}

/** YYYY-MM-DD في التقويم المحلي */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getDateRangeForWindow(kind: TimeWindowKind): { from: string; to: string } {
  const now = new Date();
  const to = localDateKey(now);
  if (kind === 'today') return { from: to, to };
  if (kind === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const k = localDateKey(y);
    return { from: k, to: k };
  }
  if (kind === 'this_week') {
    const start = new Date(now);
    const day = start.getDay();
    const diff = (day + 6) % 7;
    start.setDate(start.getDate() - diff);
    return { from: localDateKey(start), to };
  }
  if (kind === 'last_week') {
    const end = new Date(now);
    const day = end.getDay();
    const diffToMonday = (day + 6) % 7;
    end.setDate(end.getDate() - diffToMonday - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return { from: localDateKey(start), to: localDateKey(end) };
  }
  return { from: to, to };
}

export function parseQuery(raw: string): ParsedQuery {
  const fixed = applyTypoFix(normalizeText(raw));
  const normalized = fixed.toLowerCase();
  const tokens = tokenize(fixed);
  const expandedTokens = expandTokens(tokens);
  const timeWindow = detectTimeWindow(fixed);

  const statusHints: ParsedQuery['statusHints'] = [];
  for (const { re, status } of STATUS_HINTS) {
    if (re.test(fixed)) statusHints.push(status);
  }

  const personFragments: string[] = [];
  for (const t of tokens) {
    if (AR_STOPWORDS.has(t)) continue;
    if (TIME_AR.some(({ re }) => re.test(t))) continue;
    if (/^\d+$/.test(t)) continue;
    if (t.length >= 2) personFragments.push(t);
  }

  return {
    raw: fixed,
    normalized,
    tokens,
    expandedTokens,
    timeWindow,
    personFragments,
    statusHints: [...new Set(statusHints)],
  };
}

/** هل النص يطابق أي token موسّع (للفلترة اللينة) */
export function textMatchesExpandedQuery(text: string, parsed: ParsedQuery): boolean {
  if (!parsed.expandedTokens.length) return true;
  const low = text.toLowerCase();
  return parsed.expandedTokens.some((tok) => low.includes(tok));
}
