import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { slugify } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  departmentId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  fileName: z.string().nullable().optional(),
  sizeBytes: z.number().default(0),
});

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  if (!can(user, "video:upload")) return NextResponse.json({ error: "ممنوع" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  const data = parsed.data;

  // التخزين الموحّد عبر Supabase Storage: نُرجع رابط رفع موقّعاً، وننشئ سجل الفيديو.
  if (env.supabaseUrl && env.supabaseServiceKey) {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const { db } = await import("@/lib/db-phase1");
    const { ensureKmUser } = await import("@/lib/kmUser");
    await ensureKmUser(user);
    const admin = createSupabaseAdminClient();
    const safeName = (data.fileName ?? "video.mp4").replace(/[^\w.\-]+/g, "_");
    const path = `${user.id}/${Date.now()}-${safeName}`;
    const { data: signed, error } = await admin.storage.from(env.videoBucket).createSignedUploadUrl(path);
    if (error || !signed) return NextResponse.json({ error: "تعذّر تجهيز رابط الرفع" }, { status: 500 });
    const video = await db.video.create({
      data: {
        title: data.title,
        slug: `${slugify(data.title)}-${Date.now().toString(36)}`,
        description: data.description ?? null,
        fileUrl: path,
        sizeBytes: data.sizeBytes,
        status: "PROCESSING",
        tags: data.tags,
        categoryId: data.categoryId ?? null,
        departmentId: data.departmentId ?? null,
        uploaderId: user.id,
        transcriptStatus: "PENDING",
      },
    });
    return NextResponse.json({
      ok: true,
      videoId: video.id,
      upload: { signedUrl: signed.signedUrl, path, token: signed.token, bucket: env.videoBucket },
    });
  }

  if (!env.demoMode) {
    // الإنتاج: 1) توليد رابط رفع موقّع من MinIO وإعادته للعميل ليرفع الملف مباشرة،
    //          2) إنشاء سجل الفيديو بحالة PROCESSING،
    //          3) إدراج مهمة النسخ النصي في الطابور (المرحلة الثانية).
    const { db } = await import("@/lib/db-phase1");
    const video = await db.video.create({
      data: {
        title: data.title,
        slug: `${slugify(data.title)}-${Date.now().toString(36)}`,
        description: data.description ?? null,
        fileUrl: data.fileName ? `videos/${user.id}/${data.fileName}` : "#",
        sizeBytes: data.sizeBytes,
        status: "PROCESSING",
        tags: data.tags,
        categoryId: data.categoryId ?? null,
        departmentId: data.departmentId ?? null,
        uploaderId: user.id,
        transcriptStatus: "PENDING",
      },
    });
    return NextResponse.json({ ok: true, videoId: video.id, status: "PROCESSING" });
  }

  return NextResponse.json({ ok: true, status: "PROCESSING", demo: true });
}
