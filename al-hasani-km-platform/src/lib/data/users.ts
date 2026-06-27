import type { Role } from "../types";

export interface DemoUser {
  id: string;
  employeeNo: string;
  name: string;
  email: string;
  password: string; // demo only — hashed by prisma/seed.ts for the DB
  role: Role;
  title: string;
  departmentCode: string;
  departmentName: string;
  avatarColor: string;
}

// Departments — fixed per the brief
export const DEMO_DEPARTMENTS = [
  { id: "dept_prep", code: "PREP", name: "تجهيز", managerEmpNo: "1102" },
  { id: "dept_install", code: "INSTALL", name: "تركيب", managerEmpNo: "1203" },
  { id: "dept_inventory", code: "INVENTORY", name: "إدارة المخزون", managerEmpNo: "1304" },
  { id: "dept_logistics", code: "LOGISTICS", name: "اللوجستك", managerEmpNo: "1405" },
  { id: "dept_admin", code: "ADMIN", name: "الإدارة", managerEmpNo: "1001" },
];

export const DEMO_USERS: DemoUser[] = [
  {
    id: "u_admin",
    employeeNo: "1001",
    name: "حيدر الحسني",
    email: "admin@alhasani.iq",
    password: "Admin@2026",
    role: "ADMIN",
    title: "مدير تقنية المعلومات",
    departmentCode: "ADMIN",
    departmentName: "الإدارة",
    avatarColor: "#17B8A1",
  },
  {
    id: "u_mgr_prep",
    employeeNo: "1102",
    name: "سارة عبد الرزاق",
    email: "s.prep@alhasani.iq",
    password: "Manager@2026",
    role: "EMPLOYEE",
    title: "مديرة قسم التجهيز",
    departmentCode: "PREP",
    departmentName: "تجهيز",
    avatarColor: "#3E5C76",
  },
  {
    id: "u_mgr_install",
    employeeNo: "1203",
    name: "مصطفى الجبوري",
    email: "m.install@alhasani.iq",
    password: "Manager@2026",
    role: "EMPLOYEE",
    title: "مدير قسم التركيب",
    departmentCode: "INSTALL",
    departmentName: "تركيب",
    avatarColor: "#B0862E",
  },
  {
    id: "u_mgr_inv",
    employeeNo: "1304",
    name: "نور الدين كاظم",
    email: "n.inventory@alhasani.iq",
    password: "Manager@2026",
    role: "EMPLOYEE",
    title: "مدير إدارة المخزون",
    departmentCode: "INVENTORY",
    departmentName: "إدارة المخزون",
    avatarColor: "#5E5275",
  },
  {
    id: "u_emp1",
    employeeNo: "2210",
    name: "أحمد فالح",
    email: "a.faleh@alhasani.iq",
    password: "Employee@2026",
    role: "EMPLOYEE",
    title: "فني تجهيز",
    departmentCode: "PREP",
    departmentName: "تجهيز",
    avatarColor: "#2E966E",
  },
  {
    id: "u_emp2",
    employeeNo: "2311",
    name: "زينب حسن",
    email: "z.hassan@alhasani.iq",
    password: "Employee@2026",
    role: "EMPLOYEE",
    title: "فنية تركيب",
    departmentCode: "INSTALL",
    departmentName: "تركيب",
    avatarColor: "#C46A6A",
  },
  {
    id: "u_emp3",
    employeeNo: "2415",
    name: "عمر الطائي",
    email: "o.taie@alhasani.iq",
    password: "Employee@2026",
    role: "EMPLOYEE",
    title: "أمين مخزن",
    departmentCode: "INVENTORY",
    departmentName: "إدارة المخزون",
    avatarColor: "#3E5C76",
  },
  {
    id: "u_mgr_log",
    employeeNo: "1405",
    name: "رُسُل عبد الكريم",
    email: "r.logistics@alhasani.iq",
    password: "Manager@2026",
    role: "EMPLOYEE",
    title: "مديرة اللوجستك",
    departmentCode: "LOGISTICS",
    departmentName: "اللوجستك",
    avatarColor: "#2E7D9A",
  },
  {
    id: "u_emp4",
    employeeNo: "2520",
    name: "كرار ياسين",
    email: "k.yaseen@alhasani.iq",
    password: "Employee@2026",
    role: "EMPLOYEE",
    title: "منسّق توصيل",
    departmentCode: "LOGISTICS",
    departmentName: "اللوجستك",
    avatarColor: "#B0862E",
  },
];

export function findDemoUserByEmail(email: string) {
  const e = email.trim().toLowerCase();
  return DEMO_USERS.find(
    (u) => u.email.toLowerCase() === e || u.employeeNo === email.trim()
  );
}
