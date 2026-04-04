import type { DepartmentCode } from '../data/department';

function resolveInstallationVehicleType(raw: unknown): 'starex' | 'nissan' | null {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return null;
  if (value.includes('starex') || value.includes('star') || value.includes('ستار')) return 'starex';
  if (value.includes('nissan') || value.includes('نيس')) return 'nissan';
  return null;
}

/**
 * مسار مخطط المركبة في public/ — مع encodeURI لأسماء الملفات العربية واتصال مستقر بالمتصفح والطباعة.
 */
export function getVehicleInspectionMapUrl(department: DepartmentCode, vehicleType?: unknown): string {
  let raw: string;
  if (department !== 'installation') {
    raw = '/truck-collage.jpg?v=1';
  } else {
    const normalized = resolveInstallationVehicleType(vehicleType);
    if (normalized === 'nissan') raw = '/صورة نيسان.png';
    else raw = '/صورة ستاركس.png';
  }
  return encodeURI(raw);
}
