import type { Role } from "../types";

// خرائط مطابقة أدوار نظام Home Center (user_profiles) → أدوار المنصّة (مستقلة).
// نظام (ب): admin | driver | manager | warehouse | logistics | gate_guard |
//           maintenance_manager | installation_department
// منصّة (أ): ADMIN | EMPLOYEE | LEARNER فقط

export function mapSupabaseRole(role?: string | null): Role {
  switch ((role || "").toLowerCase()) {
    case "admin":
      return "ADMIN";
    case "learner":
      return "LEARNER";
    case "manager":
    case "driver":
    case "logistics":
    case "warehouse":
    case "maintenance_manager":
    case "gate_guard":
    case "installation_department":
    case "employee":
      return "EMPLOYEE";
    default:
      return "EMPLOYEE";
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
