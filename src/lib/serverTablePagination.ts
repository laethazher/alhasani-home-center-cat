import type { DepartmentCode } from '../data/department';

/** خيارات موحّدة للجداول التي تستخدم Supabase `.range()` (تجهيز / تركيب). */
export const SERVER_TABLE_PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;
export type ServerTablePageSize = (typeof SERVER_TABLE_PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_SERVER_TABLE_PAGE_SIZE: ServerTablePageSize = 25;

export function isServerTablePageSize(n: number): n is ServerTablePageSize {
  return (SERVER_TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n);
}

export function parseStoredServerPageSize(raw: string | null | undefined): ServerTablePageSize {
  if (raw == null || raw === '') return DEFAULT_SERVER_TABLE_PAGE_SIZE;
  const n = Number.parseInt(raw, 10);
  return isServerTablePageSize(n) ? n : DEFAULT_SERVER_TABLE_PAGE_SIZE;
}

export function readServerTablePageSizeFromStorage(key: string): ServerTablePageSize {
  if (typeof localStorage === 'undefined') return DEFAULT_SERVER_TABLE_PAGE_SIZE;
  try {
    return parseStoredServerPageSize(localStorage.getItem(key));
  } catch {
    return DEFAULT_SERVER_TABLE_PAGE_SIZE;
  }
}

export function writeServerTablePageSizeToStorage(key: string, size: ServerTablePageSize): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, String(size));
  } catch {
    /* ignore */
  }
}

/** مفتاح تخزين لكل صفحة وقسم حتى لا تختلط التفضيلات. */
export function serverTablePageSizeStorageKey(pageId: string, department: DepartmentCode): string {
  return `serverTable.pageSize.${pageId}.${department}`;
}
