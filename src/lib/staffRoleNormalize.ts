import type { DepartmentCode } from '../data/department';

/**
 * يحوّل role القادم من الجدول إلى نموذج واجهة الحضور/الكادر (driver | assistant).
 *
 * التجهيز: `crew` يُعامل كمساعد (مثل مساعد السائق).
 * التركيب: لا يُعرض دور «مساعد فني» — كل الموظفين يُصنَّفون داخلياً كـ driver (فني)
 * بغض النظر عن technician / crew في الجدول.
 */
export function normalizeDepartmentStaffRole(
  rawRole: unknown,
  department: DepartmentCode,
): 'driver' | 'assistant' {
  if (department === 'installation') {
    return 'driver';
  }
  const r = String(rawRole ?? '').toLowerCase().trim();
  if (r === 'assistant' || r === 'crew') return 'assistant';
  return 'driver';
}

/** قيمة عمود role عند إضافة عضو كادر من الواجهة (التجهيز: driver/assistant، التركيب: technician فقط). */
export function departmentStaffRoleForInsert(
  uiRole: 'driver' | 'assistant',
  department: DepartmentCode,
): string {
  if (department === 'installation') {
    return 'technician';
  }
  return uiRole;
}
