import "server-only";
import type {
  CertificateRecord,
  CourseCategoryRecord,
  CourseRecord,
  LearningPathRecord,
  SessionUser,
} from "../types";
import {
  SAMPLE_CERTIFICATES,
  SAMPLE_COURSES,
  SAMPLE_COURSE_CATEGORIES,
  SAMPLE_LEARNING_PATHS,
} from "./academyData";

type Viewer = SessionUser | null;

// رؤية الدورات: المنشورة متاحة للجميع (بما في ذلك الزوّار)؛ المدير العام يرى الكل؛
// مدير القسم/الموظف يرى المنشور أو دورات قسمه.
function courseVisible(c: CourseRecord, user: Viewer): boolean {
  if (c.status === "PUBLISHED") return true;
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return c.departmentId === user.departmentId;
}

export interface CourseQuery {
  q?: string;
  level?: string;
  categoryId?: string;
  departmentId?: string;
  mine?: boolean;
}

export async function listCourses(user: Viewer, query: CourseQuery = {}): Promise<CourseRecord[]> {
  // PRODUCTION:
  //   return prisma.course.findMany({ where, include: { category, department, _count } })
  let rows = SAMPLE_COURSES.filter((c) => courseVisible(c, user));
  if (query.mine) rows = user ? rows.filter((c) => c.enrollment) : [];
  if (query.level && query.level !== "ALL") rows = rows.filter((c) => c.level === query.level);
  if (query.categoryId && query.categoryId !== "ALL") rows = rows.filter((c) => c.categoryId === query.categoryId);
  if (query.departmentId && query.departmentId !== "ALL") rows = rows.filter((c) => c.departmentId === query.departmentId);
  if (query.q) {
    const s = query.q.trim();
    rows = rows.filter((c) => c.title.includes(s) || (c.description?.includes(s) ?? false));
  }
  return rows.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export async function getCourse(user: Viewer, idOrSlug: string): Promise<CourseRecord | null> {
  const c = SAMPLE_COURSES.find((x) => x.id === idOrSlug || x.slug === idOrSlug);
  if (!c || !courseVisible(c, user)) return null;
  return c;
}

export async function listLearningPaths(_user: Viewer): Promise<LearningPathRecord[]> {
  return SAMPLE_LEARNING_PATHS;
}

export async function listCategories(): Promise<CourseCategoryRecord[]> {
  return SAMPLE_COURSE_CATEGORIES;
}

export async function listMyCertificates(user: Viewer): Promise<CertificateRecord[]> {
  // PRODUCTION: prisma.certificate.findMany({ where: { userId: user.id }, include: { course } })
  if (!user) return [];
  return SAMPLE_CERTIFICATES;
}

export interface AcademyOverview {
  enrolled: CourseRecord[];
  inProgress: number;
  completed: number;
  certificates: number;
  avgProgress: number;
  catalog: CourseRecord[];
  paths: LearningPathRecord[];
  categories: CourseCategoryRecord[];
}

export async function getAcademyOverview(user: Viewer): Promise<AcademyOverview> {
  const all = await listCourses(user);
  const enrolled = user ? all.filter((c) => c.enrollment) : [];
  const completed = enrolled.filter((c) => c.enrollment?.status === "COMPLETED").length;
  const inProgress = enrolled.filter((c) => c.enrollment?.status === "IN_PROGRESS").length;
  const avg = enrolled.length
    ? Math.round(enrolled.reduce((s, c) => s + (c.enrollment?.progressPct ?? 0), 0) / enrolled.length)
    : 0;
  return {
    enrolled,
    inProgress,
    completed,
    certificates: user ? SAMPLE_CERTIFICATES.length : 0,
    avgProgress: avg,
    catalog: all,
    paths: SAMPLE_LEARNING_PATHS,
    categories: SAMPLE_COURSE_CATEGORIES,
  };
}
