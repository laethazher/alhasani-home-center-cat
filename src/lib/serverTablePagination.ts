import type { DepartmentCode } from '../data/department';

/** خيارات موحّدة للجداول التي تستخدم Supabase `.range()` (تجهيز / تركيب). */
export const SERVER_TABLE_PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;
export type ServerTablePageSize = (typeof SERVER_TABLE_PAGE_SIZE_OPTIONS)[number];

/** قيمة خاصة في القائمة المنسدلة: جلب كل الصفوف المطابقة للفلتر (ضمن حدود الخادم). */
export const SERVER_TABLE_PAGE_ALL = 'all' as const;
export type ServerTablePageChoice = ServerTablePageSize | typeof SERVER_TABLE_PAGE_ALL;

export const DEFAULT_SERVER_TABLE_PAGE_SIZE: ServerTablePageSize = 25;

export function isServerTablePageSize(n: number): n is ServerTablePageSize {
  return (SERVER_TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n);
}

export function isServerTablePageChoice(v: unknown): v is ServerTablePageChoice {
  return v === SERVER_TABLE_PAGE_ALL || (typeof v === 'number' && isServerTablePageSize(v));
}

/** تحليل قيمة `<select>` لعدد الصفوف (يشمل «إظهار الكل»). */
export function parsePageChoiceFromSelectValue(value: string): ServerTablePageChoice | null {
  if (value === SERVER_TABLE_PAGE_ALL) return SERVER_TABLE_PAGE_ALL;
  const n = Number.parseInt(value, 10);
  return isServerTablePageSize(n) ? n : null;
}

export function parseStoredServerPageChoice(raw: string | null | undefined): ServerTablePageChoice {
  if (raw == null || raw === '') return DEFAULT_SERVER_TABLE_PAGE_SIZE;
  const t = raw.trim().toLowerCase();
  if (t === SERVER_TABLE_PAGE_ALL) return SERVER_TABLE_PAGE_ALL;
  const n = Number.parseInt(raw, 10);
  return isServerTablePageSize(n) ? n : DEFAULT_SERVER_TABLE_PAGE_SIZE;
}

export function readServerTablePageChoiceFromStorage(key: string): ServerTablePageChoice {
  if (typeof localStorage === 'undefined') return DEFAULT_SERVER_TABLE_PAGE_SIZE;
  try {
    return parseStoredServerPageChoice(localStorage.getItem(key));
  } catch {
    return DEFAULT_SERVER_TABLE_PAGE_SIZE;
  }
}

export function writeServerTablePageChoiceToStorage(key: string, choice: ServerTablePageChoice): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, choice === SERVER_TABLE_PAGE_ALL ? SERVER_TABLE_PAGE_ALL : String(choice));
  } catch {
    /* ignore */
  }
}

/** @deprecated استخدم readServerTablePageChoiceFromStorage */
export function readServerTablePageSizeFromStorage(key: string): ServerTablePageSize {
  const c = readServerTablePageChoiceFromStorage(key);
  return c === SERVER_TABLE_PAGE_ALL ? DEFAULT_SERVER_TABLE_PAGE_SIZE : c;
}

/** @deprecated استخدم writeServerTablePageChoiceToStorage */
export function writeServerTablePageSizeToStorage(key: string, size: ServerTablePageSize): void {
  writeServerTablePageChoiceToStorage(key, size);
}

/** مفتاح تخزين لكل صفحة وقسم حتى لا تختلط التفضيلات. */
export function serverTablePageSizeStorageKey(pageId: string, department: DepartmentCode): string {
  return `serverTable.pageSize.${pageId}.${department}`;
}

/** عند اختيار «الكل»: صفحة واحدة فقط للواجهة. */
export function serverTableTotalPages(totalCount: number, choice: ServerTablePageChoice): number {
  if (choice === SERVER_TABLE_PAGE_ALL) return 1;
  return Math.max(1, Math.ceil(totalCount / choice) || 1);
}
