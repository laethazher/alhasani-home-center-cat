/**
 * بذور المرحلة الأولى (الأكاديمية + مكتبة الفيديو).
 * ملاحظة: تُستخدم أنواع فضفاضة لأن نماذج المرحلة الأولى تتوفّر على عميل Prisma
 * بعد تنفيذ `prisma generate`. شغّل التوليد قبل البذر:
 *   npm run prisma:generate && npm run db:seed
 */
import {
  SAMPLE_COURSES,
  SAMPLE_COURSE_CATEGORIES,
  SAMPLE_LEARNING_PATHS,
} from "../src/lib/data/academyData";
import { SAMPLE_VIDEOS, SAMPLE_VIDEO_CATEGORIES } from "../src/lib/data/videoData";
import { DEMO_USERS } from "../src/lib/data/users";

export async function seedPhase1(prismaClient: unknown) {
  // العميل المُولَّد يحوي نماذج المرحلة الأولى بعد prisma generate.
  const db = prismaClient as any;
  const userIdByName = (name: string) =>
    DEMO_USERS.find((u) => u.name === name)?.id ??
    DEMO_USERS.find((u) => u.role === "ADMIN")?.id;

  // 1) تصنيفات الدورات
  for (const c of SAMPLE_COURSE_CATEGORIES) {
    await db.courseCategory.upsert({
      where: { slug: c.slug },
      update: { name: c.name, icon: c.icon, color: c.color },
      create: { id: c.id, name: c.name, slug: c.slug, icon: c.icon, color: c.color },
    });
  }

  // 2) مسارات التعلّم
  for (const p of SAMPLE_LEARNING_PATHS) {
    await db.learningPath.upsert({
      where: { slug: p.slug },
      update: { title: p.title, description: p.description, level: p.level, coverImage: p.coverImage },
      create: {
        id: p.id,
        slug: p.slug,
        title: p.title,
        description: p.description,
        level: p.level,
        coverImage: p.coverImage,
      },
    });
  }

  // 3) الدورات (مع الوحدات والدروس)
  for (const course of SAMPLE_COURSES) {
    await db.course.upsert({
      where: { slug: course.slug },
      update: { title: course.title, status: course.status, description: course.description },
      create: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        description: course.description,
        level: course.level,
        status: course.status,
        coverImage: course.coverImage,
        categoryId: course.categoryId ?? null,
        departmentId: course.departmentId ?? null,
        learningPathId: course.learningPathId ?? null,
        ownerId: userIdByName(course.ownerName),
        modules: {
          create: (course.modules ?? []).map((m) => ({
            id: m.id,
            title: m.title,
            order: m.order,
            lessons: {
              create: m.lessons.map((l) => ({
                id: l.id,
                title: l.title,
                type: l.type,
                order: l.order,
                durationMinutes: l.durationMinutes,
                videoId: l.videoId ?? null,
                documentId: l.documentId ?? null,
              })),
            },
          })),
        },
      },
    });
  }

  // 4) تصنيفات الفيديو
  for (const c of SAMPLE_VIDEO_CATEGORIES) {
    await db.videoCategory.upsert({
      where: { slug: c.slug },
      update: { name: c.name, icon: c.icon, color: c.color },
      create: { id: c.id, name: c.name, slug: c.slug, icon: c.icon, color: c.color },
    });
  }

  // 5) الفيديوهات
  for (const v of SAMPLE_VIDEOS) {
    await db.video.upsert({
      where: { slug: v.slug },
      update: { title: v.title, description: v.description, status: v.status },
      create: {
        id: v.id,
        slug: v.slug,
        title: v.title,
        description: v.description,
        fileUrl: v.fileUrl,
        thumbnailUrl: v.thumbnailUrl,
        durationSeconds: v.durationSeconds,
        status: v.status,
        tags: v.tags,
        views: v.views,
        categoryId: v.categoryId ?? null,
        departmentId: v.departmentId ?? null,
        uploaderId: userIdByName(v.uploaderName),
        transcriptStatus: v.transcriptStatus,
        language: "ar",
      },
    });
  }

  console.log("✅ Phase 1 seed complete (academy + videos).");
}
