import type { StructuredSearchFilters } from '../types';
import { parseQuery, detectTimeWindow, getDateRangeForWindow } from './searchParser';
import { quickRangeToDates, type QuickCalendarRange } from './dateUtils';

const ISO_DATE = /(20\d{2})-(\d{2})-(\d{2})/g;

/** تحويل أرقام عربية إلى لاتينية */
function toLatinDigits(s: string): string {
  const ar = '٠١٢٣٤٥٦٧٨٩';
  return s.replace(/[٠-٩]/g, (d) => String(ar.indexOf(d)));
}

function extractDateRange(text: string): { from: string | null; to: string | null } {
  const normalized = toLatinDigits(text);
  const matches = [...normalized.matchAll(new RegExp(ISO_DATE.source, 'g'))];
  if (matches.length >= 2) {
    const a = matches[0][0];
    const b = matches[1][0];
    return a <= b ? { from: a, to: b } : { from: b, to: a };
  }
  const betweenRe =
    /بين\s*(\d{4}-\d{2}-\d{2})\s*و\s*(\d{4}-\d{2}-\d{2})|between\s*(\d{4}-\d{2}-\d{2})\s+and\s+(\d{4}-\d{2}-\d{2})/i;
  const m = normalized.match(betweenRe);
  if (m) {
    const d1 = m[1] || m[3];
    const d2 = m[2] || m[4];
    if (d1 && d2) return d1 <= d2 ? { from: d1, to: d2 } : { from: d2, to: d1 };
  }
  if (matches.length === 1) {
    const d = matches[0][0];
    return { from: d, to: d };
  }
  return { from: null, to: null };
}

function extractDelayMinutes(text: string): { min: number | null; max: number | null } {
  const t = toLatinDigits(text).toLowerCase();
  let min: number | null = null;
  let max: number | null = null;

  const moreThan =
    /(?:أكثر\s*من|أكبر\s*من|>\s*|more\s*than|greater\s*than)\s*(\d+)\s*(?:دقيقة|دقائق|min|minutes)?/i;
  const lessThan =
    /(?:أقل\s*من|أصغر\s*من|<\s*|less\s*than)\s*(\d+)\s*(?:دقيقة|دقائق|min|minutes)?/i;
  const betweenMin =
    /(?:بين|from)\s*(\d+)\s*(?:و|to|-)\s*(\d+)\s*(?:دقيقة|دقائق|min)?/i;

  const m1 = t.match(moreThan);
  if (m1) min = parseInt(m1[1], 10);

  const m2 = t.match(lessThan);
  if (m2) max = parseInt(m2[1], 10);

  const m3 = t.match(betweenMin);
  if (m3) {
    const a = parseInt(m3[1], 10);
    const b = parseInt(m3[2], 10);
    min = Math.min(a, b);
    max = Math.max(a, b);
  }

  return { min: Number.isFinite(min) ? min : null, max: Number.isFinite(max) ? max : null };
}

function extractPlateOrVehicle(text: string): string | null {
  const t = toLatinDigits(text);
  const vehicleWord = /(?:مركبة|لوحة|plate|vehicle)\s*[:\s]?\s*([\d\sأ-يA-Za-z]{2,40})/i;
  const m = t.match(vehicleWord);
  if (m) return m[1].trim().replace(/\s+/g, ' ');
  return null;
}

const ATT_MAP: Record<string, StructuredSearchFilters['attendanceStatuses'][number]> = {
  غائب: 'absent',
  غياب: 'absent',
  absent: 'absent',
  متأخر: 'late',
  late: 'late',
  حاضر: 'present',
  present: 'present',
  'إجازة كاملة': 'full_leave',
  'اجازة كاملة': 'full_leave',
  'إجازة زمنية': 'time_leave',
};

function extractAttendanceStatuses(text: string): StructuredSearchFilters['attendanceStatuses'] {
  const low = toLatinDigits(text).toLowerCase();
  const out = new Set<StructuredSearchFilters['attendanceStatuses'][number]>();
  for (const [key, val] of Object.entries(ATT_MAP)) {
    if (low.includes(key.toLowerCase())) out.add(val);
  }
  const pq = parseQuery(text);
  for (const h of pq.statusHints) {
    if (h === 'late' || h === 'absent' || h === 'present') out.add(h as 'late' | 'absent' | 'present');
  }
  return [...out];
}

/**
 * يحوّل نص بحث طبيعي إلى فلاتر منظمة (لدمجها مع AdvancedFilterPanel).
 */
export function parseSearchQuery(raw: string): StructuredSearchFilters {
  const trimmed = raw.trim();
  if (!trimmed) {
    return emptyFilters();
  }

  const pq = parseQuery(trimmed);
  const { from: drFrom, to: drTo } = extractDateRange(trimmed);
  const { min: delayMin, max: delayMax } = extractDelayMinutes(trimmed);
  const plateHint = extractPlateOrVehicle(trimmed);
  const attendanceStatuses = extractAttendanceStatuses(trimmed);

  let dateFrom = drFrom;
  let dateTo = drTo;
  let quickRange: QuickCalendarRange | null = null;

  const tw = detectTimeWindow(trimmed);
  if (tw && !dateFrom) {
    const r = getDateRangeForWindow(tw);
    dateFrom = r.from;
    dateTo = r.to;
  }

  if (/هذا\s*الشهر|this\s*month|الشهر\s*الحالي/i.test(trimmed)) {
    const r = quickRangeToDates('this_month');
    dateFrom = r.from;
    dateTo = r.to;
    quickRange = 'this_month';
  } else if (/هذا\s*الأسبوع|this\s*week/i.test(trimmed) && !dateFrom) {
    quickRange = 'this_week';
  } else if (/اليوم|today/i.test(trimmed) && !dateFrom) {
    quickRange = 'today';
  }

  if (quickRange && !dateFrom) {
    const r = quickRangeToDates(quickRange);
    dateFrom = r.from;
    dateTo = r.to;
  }

  const nameParts = pq.personFragments.filter((p) => !/^\d+$/.test(p));
  const nameContains = nameParts.length ? nameParts.join(' ') : null;

  const standalonePlate = (() => {
    const norm = toLatinDigits(trimmed);
    const m = norm.match(/(?:^|\s)(\d{4,}|[\d\s]{4,}\d)(?=\s|$)/);
    if (!m) return null;
    return m[1].replace(/\s+/g, '').trim() || null;
  })();
  const plateContains = plateHint ?? standalonePlate;

  return {
    nameContains,
    plateContains,
    vehicleNumberContains: null,
    dateFrom,
    dateTo,
    quickRange,
    delayMinMinutes: delayMin,
    delayMaxMinutes: delayMax,
    attendanceStatuses,
    freeText: trimmed,
  };
}

export function emptyFilters(): StructuredSearchFilters {
  return {
    nameContains: null,
    plateContains: null,
    vehicleNumberContains: null,
    dateFrom: null,
    dateTo: null,
    quickRange: null,
    delayMinMinutes: null,
    delayMaxMinutes: null,
    attendanceStatuses: [],
    freeText: null,
  };
}

export function mergeStructuredFilters(
  base: StructuredSearchFilters,
  patch: Partial<StructuredSearchFilters>
): StructuredSearchFilters {
  return {
    ...base,
    ...patch,
    attendanceStatuses: patch.attendanceStatuses ?? base.attendanceStatuses,
  };
}
