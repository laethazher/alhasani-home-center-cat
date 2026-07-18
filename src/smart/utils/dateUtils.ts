import { localDateKey } from './searchParser';

export type QuickCalendarRange = 'today' | 'this_week' | 'this_month';

/** أول يوم من الأسبوع (الإثنين) إلى اليوم — محلي */
export function getThisWeekRangeLocal(): { from: string; to: string } {
  const now = new Date();
  const to = localDateKey(now);
  const start = new Date(now);
  const day = start.getDay();
  const diff = (day + 6) % 7;
  start.setDate(start.getDate() - diff);
  return { from: localDateKey(start), to };
}

export function getThisMonthRangeLocal(): { from: string; to: string } {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const to = localDateKey(now);
  return { from, to };
}

export function getTodayRangeLocal(): { from: string; to: string } {
  const t = localDateKey(new Date());
  return { from: t, to: t };
}

export function quickRangeToDates(kind: QuickCalendarRange): { from: string; to: string } {
  if (kind === 'today') return getTodayRangeLocal();
  if (kind === 'this_week') return getThisWeekRangeLocal();
  return getThisMonthRangeLocal();
}

export { localDateKey };
