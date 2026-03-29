import type { StructuredSearchFilters, AttendanceFilterStatus } from '../types';

export interface RowFieldAdapters<T> {
  getName?: (row: T) => string;
  getPlate?: (row: T) => string;
  getNotes?: (row: T) => string;
  getDateKey?: (row: T) => string;
  /** دقائق تأخير لصف واحد (إن وُجدت) */
  getDelayMinutes?: (row: T) => number | null;
  getAttendanceStatus?: (row: T) => AttendanceFilterStatus | string | null;
  /** نص مجمّع للبحث الجزئي العام */
  getSearchBlob?: (row: T) => string;
}

function includesInsensitive(hay: string, needle: string | null | undefined): boolean {
  if (!needle || !needle.trim()) return true;
  return hay.toLowerCase().includes(needle.trim().toLowerCase());
}

function inDateRange(
  key: string | null | undefined,
  from: string | null,
  to: string | null
): boolean {
  if (!from && !to) return true;
  if (!key) return false;
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

/**
 * تطبيق StructuredSearchFilters على مصفوفة باستخدام محولات حقول اختيارية.
 */
export function applyStructuredFilters<T>(
  rows: T[],
  f: StructuredSearchFilters,
  adapters: RowFieldAdapters<T>
): T[] {
  const hasStructured =
    f.nameContains ||
    f.plateContains ||
    f.vehicleNumberContains ||
    f.dateFrom ||
    f.dateTo ||
    f.delayMinMinutes != null ||
    f.delayMaxMinutes != null ||
    f.attendanceStatuses.length > 0;

  if (!hasStructured && f.freeText && adapters.getSearchBlob) {
    const q = f.freeText.trim().toLowerCase();
    return rows.filter((r) => adapters.getSearchBlob!(r).toLowerCase().includes(q));
  }

  if (!hasStructured) return rows;

  return rows.filter((row) => {
    if (adapters.getName && f.nameContains && !includesInsensitive(adapters.getName(row), f.nameContains)) {
      return false;
    }
    const plate = f.plateContains || f.vehicleNumberContains;
    if (adapters.getPlate && plate && !includesInsensitive(adapters.getPlate(row), plate)) {
      return false;
    }
    if (adapters.getDateKey && !inDateRange(adapters.getDateKey(row), f.dateFrom, f.dateTo)) {
      return false;
    }
    const dm = adapters.getDelayMinutes?.(row);
    if (f.delayMinMinutes != null && (dm == null || dm < f.delayMinMinutes)) return false;
    if (f.delayMaxMinutes != null && (dm == null || dm > f.delayMaxMinutes)) return false;
    if (f.attendanceStatuses.length > 0 && adapters.getAttendanceStatus) {
      const st = adapters.getAttendanceStatus(row);
      if (!st || !f.attendanceStatuses.includes(st as AttendanceFilterStatus)) return false;
    }
    if (f.freeText && adapters.getSearchBlob) {
      const q = f.freeText.trim().toLowerCase();
      if (q && !adapters.getSearchBlob(row).toLowerCase().includes(q)) return false;
    }
    return true;
  });
}
