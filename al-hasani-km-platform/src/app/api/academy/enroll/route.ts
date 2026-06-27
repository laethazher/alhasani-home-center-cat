import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth";

const schema = z.object({
  courseId: z.string(),
  action: z.enum(["ENROLL", "PROGRESS"]),
  lessonId: z.string().optional(),
  completed: z.boolean().optional(),
  progressPct: z.number().min(0).max(100).optional(),
});

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  const { courseId, action, lessonId, completed, progressPct } = parsed.data;
  const now = new Date();

  if (!env.demoMode) {
    const { db } = await import("@/lib/db-phase1");
    const { ensureKmUser } = await import("@/lib/kmUser");
    await ensureKmUser(user);
    const status = (progressPct ?? 0) >= 100 ? "COMPLETED" : "IN_PROGRESS";
    const enrollment = await db.enrollment.upsert({
      where: { userId_courseId: { userId: user.id, courseId } },
      create: { userId: user.id, courseId, status: action === "ENROLL" ? "ENROLLED" : status, progressPct: progressPct ?? 0, lastAccessedAt: now },
      update: { status, progressPct: progressPct ?? undefined, lastAccessedAt: now, ...(status === "COMPLETED" ? { completedAt: now } : {}) },
    });
    if (action === "PROGRESS" && lessonId) {
      await db.lessonProgress.upsert({
        where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
        create: { enrollmentId: enrollment.id, lessonId, completed: !!completed, completedAt: completed ? now : null },
        update: { completed: !!completed, completedAt: completed ? now : null },
      });
    }
    // إصدار شهادة عند اكتمال الدورة (مرّة واحدة).
    if (status === "COMPLETED") {
      const serial = `AH-CERT-${now.getFullYear()}-${String(Date.now()).slice(-4)}`;
      await db.certificate.create({ data: { serial, userId: user.id, courseId } }).catch(() => null);
    }
  }

  return NextResponse.json({ ok: true, action, at: now.toISOString() });
}
