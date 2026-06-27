import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { env, SESSION_COOKIE } from "./env";
import type { SessionUser } from "./types";
import { mapSupabaseRole, mapSupabaseDept } from "./supabase/roleMap";

const secret = new TextEncoder().encode(env.jwtSecret);

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(env.jwtIssuer)
    .setExpirationTime(`${env.sessionTtlHours}h`)
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: env.jwtIssuer });
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

/** قراءة جلسة Supabase (الوضع الموحّد) وبناء SessionUser من user_profiles. */
async function getSupabaseSession(): Promise<SessionUser | null> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  const { createSupabaseServerClient } = await import("./supabase/server");
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();
  const p = profile as { full_name?: string; role?: string } | null;
  const kmRole = user.user_metadata?.km_role as string | undefined;
  const appRole = user.app_metadata?.user_role as string | undefined;
  const roleRaw = kmRole ?? appRole ?? p?.role;
  const dept = mapSupabaseDept(roleRaw);
  return {
    id: user.id,
    employeeNo: (user.user_metadata?.employee_no as string) ?? "",
    name: p?.full_name ?? (user.user_metadata?.full_name as string) ?? user.email ?? "مستخدم",
    email: user.email ?? "",
    role: mapSupabaseRole(roleRaw),
    title: null,
    departmentId: dept?.id ?? null,
    departmentName: dept?.name ?? null,
    avatarColor: "#17B8A1",
  };
}

/** Read & verify the current session inside server components / route handlers. */
export async function getSession(): Promise<SessionUser | null> {
  if (env.authProvider === "supabase") return getSupabaseSession();
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function setSessionCookie(token: string) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: env.sessionTtlHours * 3600,
  });
}

export async function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
