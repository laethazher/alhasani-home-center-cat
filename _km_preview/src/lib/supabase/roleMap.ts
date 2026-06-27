import type { Role } from "../types";

// خرائط مطابقة أدوار/أقسام نظام Home Center (جدول user_profiles) إلى نموذج المنصّة.
// قيم role في النظام الحالي:
//   admin | driver | manager | warehouse | logistics | gate_guard | maintenance_manager | installation_department
//   (+ learner للمسجّلين ذاتياً على المنصّة)

export function mapSupabaseRole(role?: string | null): Role {
  switch ((role || "").toLowerCase()) {
    case "admin":
      return "ADMIN";
    case "manager":
    case "logistics":
    case "warehouse":
    case "maintenance_manager":
      return "MANAGER";
    case "driver":
    case "gate_guard":
    case "installation_department":
    case "employee":
      return "EMPLOYEE";
    case "learner":
      return "LEARNER";
    default:
      return "LEARNER"; // غير معروف → أقل صلاحية (أمان افتراضي)
  }
}

export function mapSupabaseDept(role?: string | null): { id: string; name: string } | null {
  switch ((role || "").toLowerCase()) {
    case "logistics":
      return { id: "dept_logistics", name: "اللوجستك" };
    case "installation_department":
      return { id: "dept_install", name: "تركيب" };
    case "warehouse":
      return { id: "dept_inventory", name: "إدارة المخزون" };
    case "admin":
    case "manager":
    case "maintenance_manager":
    case "gate_guard":
      return { id: "dept_admin", name: "الإدارة" };
    default:
      return null;
  }
}
