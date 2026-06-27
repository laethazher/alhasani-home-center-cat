// Client-safe domain types (decoupled from @prisma/client so they can be
// imported into client components without bundling the Prisma runtime).

export type Role = "ADMIN" | "EMPLOYEE" | "LEARNER";

export type DocumentType =
  | "ADMIN_BOOK"
  | "CIRCULAR"
  | "NOTICE"
  | "SOP"
  | "POLICY"
  | "INSTRUCTION";

export type DocumentStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "PUBLISHED"
  | "ARCHIVED"
  | "EXPIRED";

export type Confidentiality = "PUBLIC" | "INTERNAL" | "RESTRICTED" | "SECRET";

export type AckStatus = "NOT_VIEWED" | "VIEWED" | "READ" | "ACKNOWLEDGED";

export type RelationType =
  | "REFERENCES"
  | "SUPERSEDES"
  | "SUPPLEMENTS"
  | "IMPLEMENTS";

export type SopSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SessionUser {
  id: string;
  employeeNo: string;
  name: string;
  email: string;
  role: Role;
  title?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  avatarColor?: string | null;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  managerId?: string | null;
  memberCount?: number;
}

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  changeNote?: string | null;
  uploadedByName: string;
  createdAt: string;
}

export interface DocAttachment {
  id: string;
  name: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

export interface RelatedDocRef {
  id: string;
  documentNumber: string;
  title: string;
  type: DocumentType;
  relation: RelationType;
}

export interface DocumentRecord {
  id: string;
  documentNumber: string;
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  confidentiality: Confidentiality;
  summary?: string | null;
  keywords: string[];
  ownerName: string;
  departmentId: string;
  departmentName: string;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  publishedAt?: string | null;
  updatedAt: string;
  pageCount: number;
  versions?: DocumentVersion[];
  attachments?: DocAttachment[];
  related?: RelatedDocRef[];
  // Per-current-user compliance state (when applicable)
  ack?: AckStatus;
  // Reach / compliance rollups (for managers/admin)
  reach?: { total: number; viewed: number; read: number; acknowledged: number };
}

export interface SopStep {
  id: string;
  order: number;
  title: string;
  description: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  warning?: string | null;
  severity: SopSeverity;
}

export interface SopMistake {
  id: string;
  description: string;
  consequence?: string | null;
  severity: SopSeverity;
}

export interface SopRecord {
  id: string;
  code: string;
  title: string;
  summary?: string | null;
  status: DocumentStatus;
  departmentId: string;
  departmentName: string;
  ownerName: string;
  estimatedMinutes?: number | null;
  documentNumber?: string | null;
  updatedAt: string;
  steps: SopStep[];
  commonMistakes: SopMistake[];
  related?: RelatedDocRef[];
}

export interface Citation {
  documentId: string;
  documentNumber: string;
  title: string;
  page: number;
  snippet?: string;
}

export interface SearchHit {
  id: string;
  documentNumber: string;
  title: string;
  type: DocumentType;
  departmentName: string;
  status: DocumentStatus;
  snippet: string;
  score: number;
  page?: number;
  matchedIn: ("title" | "number" | "department" | "keyword" | "content" | "semantic")[];
}

export interface ComplianceRow {
  userId: string;
  name: string;
  departmentName: string;
  assigned: number;
  acknowledged: number;
  quizPassed: number;
  rate: number; // 0..100
}

export interface DeptCompliance {
  departmentId: string;
  departmentName: string;
  rate: number;
  assigned: number;
  acknowledged: number;
}

// ===========================================================================
//  PHASE 1 — Academy & Video types (client-safe)
// ===========================================================================
export type CourseLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type LessonType = "VIDEO" | "ARTICLE" | "DOCUMENT" | "QUIZ";
export type EnrollmentStatus = "ENROLLED" | "IN_PROGRESS" | "COMPLETED";
export type VideoStatus = "PROCESSING" | "READY" | "FAILED" | "ARCHIVED";
export type TranscriptStatus = "NONE" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface LessonRecord {
  id: string;
  title: string;
  type: LessonType;
  order: number;
  durationMinutes: number;
  videoId?: string | null;
  documentId?: string | null;
  // per-current-user state
  completed?: boolean;
}

export interface CourseModuleRecord {
  id: string;
  title: string;
  order: number;
  lessons: LessonRecord[];
}

export interface CourseRecord {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  level: CourseLevel;
  status: CourseStatus;
  coverImage?: string | null;
  durationMinutes?: number;
  categoryId?: string | null;
  categoryName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  learningPathId?: string | null;
  ownerName: string;
  lessonsCount: number;
  enrolledCount: number;
  updatedAt: string;
  modules?: CourseModuleRecord[];
  // per-current-user state
  enrollment?: { status: EnrollmentStatus; progressPct: number } | null;
}

export interface LearningPathRecord {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  level: CourseLevel;
  coverImage?: string | null;
  departmentName?: string | null;
  courseIds: string[];
  coursesCount: number;
}

export interface CourseCategoryRecord {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
  coursesCount: number;
}

export interface CertificateRecord {
  id: string;
  serial: string;
  courseId: string;
  courseTitle: string;
  score?: number | null;
  issuedAt: string;
}

export interface VideoChapter {
  timeSeconds: number;
  title: string;
}

export interface VideoRecord {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  fileUrl: string;
  thumbnailUrl?: string | null;
  durationSeconds: number;
  status: VideoStatus;
  tags: string[];
  views: number;
  categoryId?: string | null;
  categoryName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  uploaderName: string;
  transcriptStatus: TranscriptStatus;
  createdAt: string;
  chapters?: VideoChapter[];
}

export interface VideoCategoryRecord {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
  videosCount: number;
}

export interface VideoSearchHit {
  id: string;
  title: string;
  categoryName?: string | null;
  departmentName?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds: number;
  snippet: string;
  score: number;
  matchedIn: ("title" | "description" | "tag" | "chapter" | "transcript")[];
  timestamp?: { timeSeconds: number; title: string } | null;
}
