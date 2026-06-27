-- =============================================================================
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
('u_admin', '1001', 'حيدر الحسني', 'admin@alhasani.iq', '$2a$10$OJkXXVWwfoy9SE672MuNYuSt/4KlYxhjQ5eHuB/eND.ZbAlkiuY7i', 'ADMIN', 'مدير تقنية المعلومات', '#17B8A1', true, now(), now(), 'dept_admin'),
('u_mgr_prep', '1102', 'سارة عبد الرزاق', 's.prep@alhasani.iq', '$2a$10$Cleb7We79WUcaSkpw/JVUOfsy1EJz2x6h3UBIIYa0Y7DFu9YJTQYS', 'EMPLOYEE', 'مديرة قسم التجهيز', '#3E5C76', true, now(), now(), 'dept_prep'),
('u_mgr_install', '1203', 'مصطفى الجبوري', 'm.install@alhasani.iq', '$2a$10$IdjCzzaWQ6ObLn/1PN3t5OCDlQKSfEkeEGHi/BV7Mu3rSFJlJj6Ha', 'EMPLOYEE', 'مدير قسم التركيب', '#B0862E', true, now(), now(), 'dept_install'),
('u_mgr_inv', '1304', 'نور الدين كاظم', 'n.inventory@alhasani.iq', '$2a$10$0u7rBjo/ecCCJLju0NPMJujyzSUII42vsw86iFxYdLDkxs5xh1Lfu', 'EMPLOYEE', 'مدير إدارة المخزون', '#5E5275', true, now(), now(), 'dept_inventory'),
('u_emp1', '2210', 'أحمد فالح', 'a.faleh@alhasani.iq', '$2a$10$mv9FMYP5GbDf.IlQ.4p0P.iffR8N8f4SvFBwoiJN7RMDihv1vcNUC', 'EMPLOYEE', 'فني تجهيز', '#2E966E', true, now(), now(), 'dept_prep'),
('u_emp2', '2311', 'زينب حسن', 'z.hassan@alhasani.iq', '$2a$10$6MeLDZuXN.gAx9CjBpCJjep./5m4C5J1dAWEyVGyQq5pwKYCgNB.m', 'EMPLOYEE', 'فنية تركيب', '#C46A6A', true, now(), now(), 'dept_install'),
('u_emp3', '2415', 'عمر الطائي', 'o.taie@alhasani.iq', '$2a$10$MgB1ItYrcsIWmO4slez.8.Y4f9W7UFyPwVMw5S5YwL.1ngyrIJX1K', 'EMPLOYEE', 'أمين مخزن', '#3E5C76', true, now(), now(), 'dept_inventory'),
('u_mgr_log', '1405', 'رُسُل عبد الكريم', 'r.logistics@alhasani.iq', '$2a$10$wcUj3ZsNiWwSx5E8rjTgUObMVx4RM52LLdIlA2od/NitWQEj4ThY.', 'EMPLOYEE', 'مديرة اللوجستك', '#2E7D9A', true, now(), now(), 'dept_logistics'),
('u_emp4', '2520', 'كرار ياسين', 'k.yaseen@alhasani.iq', '$2a$10$DQE9lgGDq9fMUvHjudzOROGhCrhC8Y53PIH8v2gLhVwN57dqzBWcu', 'EMPLOYEE', 'منسّق توصيل', '#B0862E', true, now(), now(), 'dept_logistics')
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
