import type {
  CertificateRecord,
  CourseCategoryRecord,
  CourseRecord,
  LearningPathRecord,
} from "../types";

// ───────────────────────────────────────────────────────────────────────────
// قاعدة محتوى الأكاديمية. أُزيلت بيانات التجربة؛ هذه نقطة بداية نظيفة جاهزة
// لإدخال الدورات والكتب والمواد التعليمية الحقيقية — عبر seed الإنتاج أو
// المزامنة مع نظامك الحالي (راجع docs/CURSOR-INTEGRATION-PROMPT.md).
// التصنيفات أدناه هي هيكلة جاهزة يمكن تعديلها أو استبدالها بتصنيفاتك.
// ───────────────────────────────────────────────────────────────────────────

export const SAMPLE_COURSE_CATEGORIES: CourseCategoryRecord[] = [
  { id: "cat_ops", name: "العمليات والميدان", slug: "operations", icon: "Truck", color: "#17B8A1", coursesCount: 0 },
  { id: "cat_inv", name: "المخزون والمستودعات", slug: "inventory", icon: "PackageSearch", color: "#3E5C76", coursesCount: 0 },
  { id: "cat_safety", name: "السلامة والجودة", slug: "safety", icon: "ShieldCheck", color: "#C46A6A", coursesCount: 0 },
  { id: "cat_sys", name: "الأنظمة والبرمجيات", slug: "systems", icon: "MonitorSmartphone", color: "#5E5275", coursesCount: 0 },
];

export const SAMPLE_LEARNING_PATHS: LearningPathRecord[] = [];

export const SAMPLE_COURSES: CourseRecord[] = [];

export const SAMPLE_CERTIFICATES: CertificateRecord[] = [];
