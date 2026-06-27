import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const esc = (s) => s.replace(/'/g, "''");

const users = [
  ["u_admin", "1001", "حيدر الحسني", "admin@alhasani.iq", "Admin@2026", "ADMIN", "مدير تقنية المعلومات", "#17B8A1", "dept_admin"],
  ["u_mgr_prep", "1102", "سارة عبد الرزاق", "s.prep@alhasani.iq", "Manager@2026", "EMPLOYEE", "مديرة قسم التجهيز", "#3E5C76", "dept_prep"],
  ["u_mgr_install", "1203", "مصطفى الجبوري", "m.install@alhasani.iq", "Manager@2026", "EMPLOYEE", "مدير قسم التركيب", "#B0862E", "dept_install"],
  ["u_mgr_inv", "1304", "نور الدين كاظم", "n.inventory@alhasani.iq", "Manager@2026", "EMPLOYEE", "مدير إدارة المخزون", "#5E5275", "dept_inventory"],
  ["u_emp1", "2210", "أحمد فالح", "a.faleh@alhasani.iq", "Employee@2026", "EMPLOYEE", "فني تجهيز", "#2E966E", "dept_prep"],
  ["u_emp2", "2311", "زينب حسن", "z.hassan@alhasani.iq", "Employee@2026", "EMPLOYEE", "فنية تركيب", "#C46A6A", "dept_install"],
  ["u_emp3", "2415", "عمر الطائي", "o.taie@alhasani.iq", "Employee@2026", "EMPLOYEE", "أمين مخزن", "#3E5C76", "dept_inventory"],
  ["u_mgr_log", "1405", "رُسُل عبد الكريم", "r.logistics@alhasani.iq", "Manager@2026", "EMPLOYEE", "مديرة اللوجستك", "#2E7D9A", "dept_logistics"],
  ["u_emp4", "2520", "كرار ياسين", "k.yaseen@alhasani.iq", "Employee@2026", "EMPLOYEE", "منسّق توصيل", "#B0862E", "dept_logistics"],
];

const userRows = [];
for (const [id, emp, name, email, pw, role, title, color, dept] of users) {
  const hash = await bcrypt.hash(pw, 10);
  userRows.push(
    `('${id}', '${emp}', '${esc(name)}', '${email}', '${hash}', '${role}', '${esc(title)}', '${color}', true, now(), now(), '${dept}')`
  );
}

const sql = `-- =============================================================================
-- بذور km — شغّله في Supabase SQL Editor (بعد bootstrap + migration)
-- =============================================================================

-- الأقسام
INSERT INTO km."Department" (id, name, code, "createdAt") VALUES
('dept_prep', 'تجهيز', 'PREP', now()),
('dept_install', 'تركيب', 'INSTALL', now()),
('dept_inventory', 'إدارة المخزون', 'INVENTORY', now()),
('dept_logistics', 'اللوجستك', 'LOGISTICS', now()),
('dept_admin', 'الإدارة', 'ADMIN', now())
ON CONFLICT (code) DO NOTHING;

-- المستخدمون التجريبيون (الإنتاج: Supabase Auth)
INSERT INTO km."User" (id, "employeeNo", name, email, "passwordHash", role, title, "avatarColor", "isActive", "createdAt", "updatedAt", "departmentId") VALUES
${userRows.join(",\n")}
ON CONFLICT (email) DO NOTHING;

-- مديرو الأقسام
UPDATE km."Department" SET "managerId" = 'u_admin' WHERE code = 'ADMIN';
UPDATE km."Department" SET "managerId" = 'u_mgr_prep' WHERE code = 'PREP';
UPDATE km."Department" SET "managerId" = 'u_mgr_install' WHERE code = 'INSTALL';
UPDATE km."Department" SET "managerId" = 'u_mgr_inv' WHERE code = 'INVENTORY';
UPDATE km."Department" SET "managerId" = 'u_mgr_log' WHERE code = 'LOGISTICS';

-- تصنيفات أكاديمية
INSERT INTO km."CourseCategory" (id, name, slug, icon, color, "order", "createdAt") VALUES
('cc_onboard', 'التأهيل', 'onboarding', 'GraduationCap', '#17B8A1', 1, now()),
('cc_safety', 'السلامة', 'safety', 'ShieldCheck', '#C46A6A', 2, now()),
('cc_ops', 'العمليات', 'operations', 'Settings', '#3E5C76', 3, now())
ON CONFLICT (slug) DO NOTHING;

-- تصنيفات فيديو
INSERT INTO km."VideoCategory" (id, name, slug, icon, color, "order", "createdAt") VALUES
('vc_train', 'تدريب', 'training', 'Video', '#17B8A1', 1, now()),
('vc_sop', 'إجراءات', 'sops', 'ListChecks', '#3E5C76', 2, now())
ON CONFLICT (slug) DO NOTHING;
`;

const out = path.join(root, "scripts", "RUN_IN_SQL_EDITOR_seed.sql");
fs.writeFileSync(out, sql, "utf8");
console.log("Written:", out);
