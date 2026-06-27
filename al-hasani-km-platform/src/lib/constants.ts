import type {
  AckStatus,
  Confidentiality,
  DocumentStatus,
  DocumentType,
  RelationType,
  Role,
  SopSeverity,
} from "./types";

export const APP_NAME = "منصة الحسني هوم سنتر";
export const ORG_NAME = "مجموعة الحسني";

// ----------------------------- Enum → Arabic ------------------------------
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "مدير نظام المنصّة",
  EMPLOYEE: "موظف",
  LEARNER: "متعلّم",
};

export const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  ADMIN_BOOK: "كتاب إداري",
  CIRCULAR: "تعميم",
  NOTICE: "تبليغ",
  SOP: "إجراء عمل",
  POLICY: "سياسة",
  INSTRUCTION: "تعليمات",
};

export const DOC_STATUS_LABEL: Record<DocumentStatus, string> = {
  DRAFT: "مسودة",
  IN_REVIEW: "قيد المراجعة",
  PUBLISHED: "منشور",
  ARCHIVED: "مؤرشف",
  EXPIRED: "منتهٍ",
};

export const CONFIDENTIALITY_LABEL: Record<Confidentiality, string> = {
  PUBLIC: "عام",
  INTERNAL: "داخلي",
  RESTRICTED: "مقيّد",
  SECRET: "سري",
};

export const ACK_LABEL: Record<AckStatus, string> = {
  NOT_VIEWED: "لم يُطّلع",
  VIEWED: "اطُّلع",
  READ: "قُرئ",
  ACKNOWLEDGED: "أُقِرّ",
};

export const RELATION_LABEL: Record<RelationType, string> = {
  REFERENCES: "يشير إلى",
  SUPERSEDES: "يحل محل",
  SUPPLEMENTS: "يكمّل",
  IMPLEMENTS: "ينفّذ",
};

export const SEVERITY_LABEL: Record<SopSeverity, string> = {
  LOW: "منخفضة",
  MEDIUM: "متوسطة",
  HIGH: "عالية",
  CRITICAL: "حرجة",
};

// Token colors for badges (Tailwind classes). Kept declarative for reuse.
export const DOC_TYPE_TONE: Record<DocumentType, string> = {
  ADMIN_BOOK: "teal",
  CIRCULAR: "info",
  NOTICE: "gold",
  SOP: "teal",
  POLICY: "plum",
  INSTRUCTION: "muted",
};

// ----------------------------- Departments -------------------------------
export const DEPARTMENTS = [
  { code: "PREP", name: "تجهيز" },
  { code: "INSTALL", name: "تركيب" },
  { code: "INVENTORY", name: "إدارة المخزون" },
  { code: "LOGISTICS", name: "اللوجستك" },
  { code: "ADMIN", name: "الإدارة" },
] as const;

// ----------------------------- Navigation --------------------------------
export interface NavItem {
  href: string;
  label: string;
  icon: string; // lucide icon name
  roles?: Role[]; // visible to these roles (omit = all)
  badge?: "compliance";
}

export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "العمل اليومي",
    items: [
      { href: "/dashboard", label: "لوحة المعلومات", icon: "LayoutDashboard" },
      { href: "/documents", label: "مكتبة الوثائق", icon: "Files" },
      { href: "/search", label: "البحث الذكي", icon: "Search" },
      { href: "/assistant", label: "المساعد المعرفي", icon: "Sparkles" },
      { href: "/sops", label: "إجراءات العمل", icon: "ListChecks" },
    ],
  },
  {
    section: "التعلّم والمعرفة",
    items: [
      { href: "/academy", label: "الأكاديمية", icon: "GraduationCap" },
      { href: "/videos", label: "مكتبة الفيديو", icon: "Video" },
    ],
  },
  {
    section: "الامتثال",
    items: [
      {
        href: "/compliance",
        label: "مراقبة الامتثال",
        icon: "ShieldCheck",
        roles: ["ADMIN"],
      },
    ],
  },
  {
    section: "الإدارة",
    items: [
      {
        href: "/admin",
        label: "إدارة النظام",
        icon: "Settings",
        roles: ["ADMIN"],
      },
    ],
  },
];

// ----------------------------- RBAC ---------------------------------------
export type Permission =
  | "document:create"
  | "document:edit"
  | "document:publish"
  | "document:delete"
  | "document:read"
  | "sop:manage"
  | "compliance:view"
  | "compliance:viewAll"
  | "quiz:manage"
  | "user:manage"
  | "department:manage"
  | "audit:view"
  | "course:manage"
  | "video:manage"
  | "video:upload";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "document:create",
    "document:edit",
    "document:publish",
    "document:delete",
    "document:read",
    "sop:manage",
    "compliance:view",
    "compliance:viewAll",
    "quiz:manage",
    "user:manage",
    "department:manage",
    "audit:view",
    "course:manage",
    "video:manage",
    "video:upload",
  ],
  EMPLOYEE: ["document:read"],
  LEARNER: [],
};

// ----------------------- Phase 1 — Academy & Video -----------------------
import type {
  CourseLevel,
  CourseStatus,
  EnrollmentStatus,
  LessonType,
  VideoStatus,
} from "./types";

export const LEVEL_LABEL: Record<CourseLevel, string> = {
  BEGINNER: "مبتدئ",
  INTERMEDIATE: "متوسط",
  ADVANCED: "متقدّم",
};

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  DRAFT: "مسودة",
  PUBLISHED: "منشور",
  ARCHIVED: "مؤرشف",
};

export const LESSON_TYPE_LABEL: Record<LessonType, string> = {
  VIDEO: "فيديو",
  ARTICLE: "مقال",
  DOCUMENT: "وثيقة",
  QUIZ: "اختبار قصير",
};

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  ENROLLED: "مُسجَّل",
  IN_PROGRESS: "قيد التقدّم",
  COMPLETED: "مكتمل",
};

export const VIDEO_STATUS_LABEL: Record<VideoStatus, string> = {
  PROCESSING: "قيد المعالجة",
  READY: "جاهز",
  FAILED: "فشل",
  ARCHIVED: "مؤرشف",
};

export const LEVEL_TONE: Record<CourseLevel, "ok" | "gold" | "danger"> = {
  BEGINNER: "ok",
  INTERMEDIATE: "gold",
  ADVANCED: "danger",
};
