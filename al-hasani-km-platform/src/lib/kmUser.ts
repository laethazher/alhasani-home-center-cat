import "server-only";
import type { SessionUser } from "./types";
import { db } from "./db-phase1";

/**
 * يضمن وجود صفّ مطابق للمستخدم في جدول User الخاص بالمنصّة عند الهوية الموحّدة
 * (Supabase). نماذج المحتوى (Video/Course/Document) ترتبط بـ User عبر مفاتيح
 * أجنبية؛ هذا يحلّ تلك الارتباطات بأمان في وضع الإنتاج الموحّد.
 */
export async function ensureKmUser(u: SessionUser): Promise<void> {
  await db.user.upsert({
    where: { id: u.id },
    update: { name: u.name, email: u.email || `${u.id}@local`, role: u.role, departmentId: u.departmentId ?? null },
    create: {
      id: u.id,
      employeeNo: u.employeeNo || `U-${u.id.slice(0, 8)}`,
      name: u.name,
      email: u.email || `${u.id}@local`,
      passwordHash: "",
      role: u.role,
      departmentId: u.departmentId ?? null,
      isActive: true,
    },
  });
}
