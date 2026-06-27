import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE, env } from "@/lib/env";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-insecure-secret-change-me-please-32+chars"
);
const ISSUER = process.env.JWT_ISSUER || "al-hasani-km";

// مسارات/صفحات عامة لا تتطلّب جلسة
const PUBLIC_EXACT = ["/", "/login", "/register"];
const PUBLIC_PREFIX = ["/academy", "/videos", "/api/academy", "/api/videos", "/api/auth"];
const INTERNAL_PREFIX = ["/dashboard", "/documents", "/search", "/assistant", "/sops", "/compliance", "/admin"];

function matchPrefix(pathname: string, list: string[]) {
  return list.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

async function localAuth(req: NextRequest): Promise<{ authed: boolean; role?: string }> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return { authed: false };
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER });
    return { authed: true, role: (payload as { role?: string }).role };
  } catch {
    return { authed: false };
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // تحديد المصادقة حسب المزوّد
  let authed = false;
  let role: string | undefined;
  let res = NextResponse.next();

  if (env.authProvider === "supabase") {
    const { createServerClient } = await import("@supabase/ssr");
    res = NextResponse.next({ request: req });
    const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(list: { name: string; value: string; options?: Record<string, unknown> }[]) {
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options as any));
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authed = !!user;
    // الدور الكامل يُفرض في تخطيط (app)؛ هنا قيمة مبدئية إن وُجدت في الـ metadata.
    role = user?.user_metadata?.km_role as string | undefined;
  } else {
    const a = await localAuth(req);
    authed = a.authed;
    role = a.role;
  }

  // صفحات الدخول/التسجيل: وجّه المستخدم المُسجَّل إلى وجهته
  if (pathname === "/login" || pathname === "/register") {
    if (authed) return NextResponse.redirect(new URL(role === "LEARNER" ? "/academy" : "/dashboard", req.url));
    return res;
  }

  const isPublic = PUBLIC_EXACT.includes(pathname) || matchPrefix(pathname, PUBLIC_PREFIX);
  if (isPublic) return res;

  // ما تبقّى محميّ (وحدات النظام الإداري + واجهاته)
  if (!authed) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
    const url = new URL("/login", req.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // فصل الصلاحيات: المتعلّم ممنوع من النظام الإداري (يُفرض أيضاً في تخطيط (app))
  if (role === "LEARNER") {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "ممنوع" }, { status: 403 });
    if (matchPrefix(pathname, INTERNAL_PREFIX)) return NextResponse.redirect(new URL("/academy", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
