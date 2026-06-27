import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { signSession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { findDemoUserByEmail } from "@/lib/data/users";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";
import type { SessionUser } from "@/lib/types";

const schema = z.object({
  email: z.string().min(1, "البريد الإلكتروني أو الرقم الوظيفي مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

function resolveFleetRole(
  user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> },
  profileRole?: string | null
): string | undefined {
  const appRole = user.app_metadata?.user_role;
  if (typeof appRole === "string" && appRole) return appRole;
  const kmRole = user.user_metadata?.km_role;
  if (typeof kmRole === "string" && kmRole) return kmRole;
  return profileRole ?? undefined;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const emailNorm = email.trim().toLowerCase();

  if (env.authProvider === "supabase") {
    const cookieStore = cookies();
    const supabase = createServerClient(getSupabaseUrl(), getSupabasePublicKey(), {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
          );
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailNorm,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        {
          error:
            error?.message === "Invalid login credentials"
              ? "بيانات الدخول غير صحيحة."
              : (error?.message ?? "بيانات الدخول غير صحيحة."),
        },
        { status: 401 }
      );
    }

    const { mapSupabaseRole, mapSupabaseDept } = await import("@/lib/supabase/roleMap");
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("full_name, role")
      .eq("id", data.user.id)
      .maybeSingle();

    const p = profile as { full_name?: string; role?: string } | null;
    const roleRaw = resolveFleetRole(data.user, p?.role);
    const dept = mapSupabaseDept(roleRaw);
    const su: SessionUser = {
      id: data.user.id,
      employeeNo: (data.user.user_metadata?.employee_no as string) ?? "",
      name: p?.full_name || (data.user.user_metadata?.full_name as string) || data.user.email || "مستخدم",
      email: data.user.email ?? emailNorm,
      role: mapSupabaseRole(roleRaw),
      title: null,
      departmentId: dept?.id ?? null,
      departmentName: dept?.name ?? null,
      avatarColor: "#17B8A1",
    };

    try {
      const { ensureKmUser } = await import("@/lib/kmUser");
      await ensureKmUser(su);
    } catch (e) {
      console.warn("ensureKmUser:", e);
    }

    return NextResponse.json({ user: su });
  }

  let sessionUser: SessionUser | null = null;

  if (env.demoMode) {
    const u = findDemoUserByEmail(email);
    if (u && u.password === password) {
      sessionUser = {
        id: u.id,
        employeeNo: u.employeeNo,
        name: u.name,
        email: u.email,
        role: u.role,
        title: u.title,
        departmentId: `dept_${u.departmentCode.toLowerCase()}`,
        departmentName: u.departmentName,
        avatarColor: u.avatarColor,
      };
    }
  } else {
    const { prisma } = await import("@/lib/prisma");
    const u = await prisma.user.findFirst({
      where: { OR: [{ email: emailNorm }, { employeeNo: email.trim() }], isActive: true },
      include: { department: true },
    });
    if (u && (await verifyPassword(password, u.passwordHash))) {
      await prisma.user.update({ where: { id: u.id }, data: { lastLoginAt: new Date() } });
      sessionUser = {
        id: u.id,
        employeeNo: u.employeeNo,
        name: u.name,
        email: u.email,
        role: u.role as SessionUser["role"],
        title: u.title,
        departmentId: u.departmentId,
        departmentName: u.department?.name ?? null,
        avatarColor: u.avatarColor,
      };
    }
  }

  if (!sessionUser) {
    return NextResponse.json(
      { error: "بيانات الدخول غير صحيحة. تحقق من البريد/الرقم الوظيفي وكلمة المرور." },
      { status: 401 }
    );
  }

  const token = await signSession(sessionUser);
  await setSessionCookie(token);
  return NextResponse.json({ user: sessionUser });
}
