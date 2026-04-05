import type { DepartmentCode } from '../data/department';

/**
 * يحوّل role القادم من الجدول إلى نموذج واجهة الحضور/الكادر (driver | assistant).
 *
 * التجهيز: `crew` يُعامل كمساعد (مثل مساعد السائق).
 * التركيب: جدول `installation_staff_members` يستخدم `technician` و`crew` كفئات فنية —
 * كلاهما يُعرض كـ «فني»؛ فقط `assistant` الصريح يُعامل كمساعد.
 */
export function normalizeDepartmentStaffRole(
  rawRole: unknown,
  department: DepartmentCode,
): 'driver' | 'assistant' {
  const r = String(rawRole ?? '').toLowerCase().trim();
  if (department === 'installation') {
    if (r === 'assistant') return 'assistant';
    return 'driver';
  }
  if (r === 'assistant' || r === 'crew') return 'assistant';
  return 'driver';
}
