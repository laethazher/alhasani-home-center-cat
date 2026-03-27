/** Workday reference times for driver loading metrics (Asia/Baghdad). */

export const WORK_TIMEZONE = 'Asia/Baghdad';

/** بداية الدوام الرسمي للتحذير والمعاينة (نفس اليوم المحلي) */
const SHIFT_START_MINUTES = 7 * 60; // 07:00
/** نهاية الدوام الرسمي (5:00 م) — بعدها يُعتبر الطلب خارج وقت الدوام */
const OFFICE_END_MINUTES = 17 * 60; // 17:00
/** نهاية مهلة «تأخير التحميل» الصباحية (بعدها تُحسب دقائق التأخير) */
const GRACE_END_MINUTES = 8 * 60 + 15; // 08:15

function getBaghdadMinutesSinceMidnight(iso: string | Date): { minutes: number; dateKey: string } {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: WORK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  const y = get('year');
  const m = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const dateKey = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { minutes: hour * 60 + minute, dateKey };
}

export interface DriverLoadingComputed {
  minutesFromShiftStart: number;
  delayMinutes: number;
  isDelay: boolean;
  localDateKey: string;
  /** true إذا كان الوقت المحلي قبل 7:00 أو بعد 5:00 م (خارج الدوام الرسمي 7–17) */
  outsideOfficialOfficeHours: boolean;
}

/** Based on request creation time (official per product rules). */
export function computeDriverLoadingFromCreatedAt(createdAtIso: string | Date): DriverLoadingComputed {
  const { minutes: T, dateKey } = getBaghdadMinutesSinceMidnight(createdAtIso);
  const outsideOfficialOfficeHours = T < SHIFT_START_MINUTES || T > OFFICE_END_MINUTES;
  const minutesFromShiftStart = Math.max(0, T - SHIFT_START_MINUTES);
  const isDelay = T > GRACE_END_MINUTES;
  const delayMinutes = isDelay ? T - GRACE_END_MINUTES : 0;
  return {
    minutesFromShiftStart,
    delayMinutes,
    isDelay,
    localDateKey: dateKey,
    outsideOfficialOfficeHours,
  };
}

/** للعرض في الواجهات */
export function getOfficialOfficeHoursLabelAr(): string {
  return '7:00 صباحاً — 5:00 مساءً';
}

export function isOutsideOfficialWorkingHours(iso: string | Date): boolean {
  return computeDriverLoadingFromCreatedAt(iso).outsideOfficialOfficeHours;
}

/** Live preview using “now” (same rules as creation). */
export function computeDriverLoadingPreview(now: Date = new Date()): DriverLoadingComputed {
  return computeDriverLoadingFromCreatedAt(now);
}

export function getBaghdadDateKey(iso: string | Date): string {
  return getBaghdadMinutesSinceMidnight(iso).dateKey;
}
