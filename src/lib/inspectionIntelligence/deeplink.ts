import type { DepartmentCode } from '../../data/department';

/** مفتاح موحّد لحفظ معاملات الرابط العميق بين تسجيل الدخول واختيار القسم. */
export const INSPECTION_DEEPLINK_STORAGE_KEY = 'inspection_deeplink';

/**
 * رابط يفتح التطبيق على جرد مركبة (يُعالج في App / InstallationWorkspace).
 * المحتوى ثابت لكل مركبة وقسم (`dept` + `vehicleId`) — مناسب للطباعة على المركبة
 * عند استخدام نطاق إنتاج ثابت. اختياري: `VITE_INSPECTION_QR_BASE_URL` (مثلاً https://app.example.com)
 * حتى لا يعتمد الملصق على نطاق التطوير أو مسار الصفحة الحالي.
 */
export function buildInspectionDeepLink(department: DepartmentCode, vehicleId: number): string {
  if (typeof window === 'undefined') {
    return `?inspect=1&dept=${department}&vehicleId=${vehicleId}`;
  }
  const envRaw = import.meta.env.VITE_INSPECTION_QR_BASE_URL as string | undefined;
  const fromEnv = typeof envRaw === 'string' && envRaw.trim() ? envRaw.trim().replace(/\/$/, '') : '';
  const fromWindow = `${window.location.origin}${window.location.pathname}`.replace(/\/$/, '');
  const base = fromEnv || fromWindow || window.location.origin;
  const url = new URL(base.includes('://') ? base : `${window.location.protocol}//${base}`);
  url.searchParams.set('inspect', '1');
  url.searchParams.set('dept', department);
  url.searchParams.set('vehicleId', String(vehicleId));
  return url.toString();
}

export function parseInspectionDeepLink(search: string): {
  inspect: boolean;
  department: DepartmentCode | null;
  vehicleId: string | null;
} {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const inspect = params.get('inspect') === '1';
  const deptRaw = params.get('dept');
  const vehicleId = params.get('vehicleId');
  const department =
    deptRaw === 'installation' || deptRaw === 'tajhiz' || deptRaw === 'operations'
      ? (deptRaw as DepartmentCode)
      : null;
  return { inspect, department, vehicleId };
}
