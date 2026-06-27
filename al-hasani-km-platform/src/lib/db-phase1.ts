import "server-only";
import { prisma } from "./prisma";

/**
 * جسر مُصغّر لمندوبي (delegates) نماذج المرحلة الأولى في Prisma.
 * الأنواع الكاملة تأتي من العميل المُولَّد بعد تنفيذ `prisma generate`؛
 * هذه الواجهة تُبقي كود المسارات قابلاً للفحص (type-check) حتى قبل التوليد،
 * وتعمل كما هي بعده. استُخدمت فقط في مسارات الكتابة الإنتاجية.
 */
interface Phase1Delegates {
  user: { findFirst(args: any): Promise<any>; create(args: any): Promise<any>; upsert(args: any): Promise<any> };
  course: { findMany(args?: any): Promise<any[]>; findUnique(args: any): Promise<any>; create(args: any): Promise<any> };
  enrollment: {
    upsert(args: any): Promise<any>;
    findUnique(args: any): Promise<any>;
    update(args: any): Promise<any>;
  };
  lessonProgress: { upsert(args: any): Promise<any> };
  certificate: { create(args: any): Promise<any>; findMany(args?: any): Promise<any[]> };
  video: { create(args: any): Promise<any>; update(args: any): Promise<any>; findMany(args?: any): Promise<any[]> };
  videoView: { create(args: any): Promise<any> };
  videoCategory: { findMany(args?: any): Promise<any[]> };
  courseCategory: { findMany(args?: any): Promise<any[]> };
}

export const db = prisma as unknown as typeof prisma & Phase1Delegates;
