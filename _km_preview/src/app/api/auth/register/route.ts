import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { signSession, setSessionCookie, hashPassword } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";

const schema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف فأكثر"),
});

// تسجيل ذاتي لحساب متعلّم (LEARNER) على المنصّة — منفصل تماماً عن مستخدمي النظام
// الإداري وصلاحياتهم. لا يمنح أي وصول إلى وحدات النظام الداخلية.
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  const { name, email, password } = parsed.data;
  const emailLc = email.toLowerCase();

  // المسار الموحّد عبر Supabase Auth — ينشئ مستخدم Supabase بدور متعلّم.
  // ملاحظة عزل: لا نكتب إطلاقاً في جدول user_profiles التشغيلي. دور المتعلّم يُحفظ في
  // user_metadata.km_role، ويُطابَق المستخدم في جدول User الخاص بالمنصّة عند أول كتابة.
  if (env.authProvider === "supabase") {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: emailLc,
      password,
      options: { data: { full_name: name, km_role: "LEARNER" } },
    });
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? "تعذّر إنشاء الحساب" }, { status: 400 });
    }
    const su: SessionUser = {
      id: data.user.id,
      employeeNo: "",
      name,
      email: emailLc,
      role: "LEARNER",
      title: "متعلّم",
      departmentId: null,
      departmentName: null,
      avatarColor: "#17B8A1",
    };
    return NextResponse.json({ user: su, needsConfirmation: !data.session });
  }

  let sessionUser: SessionUser;

  if (env.demoMode) {
    // وضع العرض: حساب متعلّم مؤقّت بالجلسة (بلا قاعدة بيانات).
    sessionUser = {
      id: `learner_${Math.random().toString(36).slice(2, 10)}`,
      employeeNo: "",
      name,
      email: emailLc,
      role: "LEARNER",
      title: "متعلّم",
      departmentId: null,
      departmentName: null,
      avatarColor: "#17B8A1",
    };
  } else {
    const { db } = await import("@/lib/db-phase1");
    const exists = await db.user.findFirst({ where: { email: emailLc } });
    if (exists) return NextResponse.json({ error: "هذا البريد مسجّل بالفعل. سجّل الدخول بدلاً من ذلك." }, { status: 409 });
    const created = await db.user.create({
      data: {
        employeeNo: `L-${Date.now()}`,
        name,
        email: emailLc,
        role: "LEARNER",
        title: "متعلّم",
        passwordHash: await hashPassword(password),
        isActive: true,
      },
    });
    sessionUser = {
      id: created.id,
      employeeNo: created.employeeNo,
      name: created.name,
      email: created.email,
      role: "LEARNER",
      title: created.title,
      departmentId: created.departmentId,
      departmentName: null,
      avatarColor: created.avatarColor,
    };
  }

  const token = await signSession(sessionUser);
  await setSessionCookie(token);
  return NextResponse.json({ user: sessionUser });
}
