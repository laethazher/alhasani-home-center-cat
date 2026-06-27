"use client";
import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Loader2, KeyRound, AtSign } from "lucide-react";
import { Button } from "@/components/ui";
import { APP_NAME, ORG_NAME } from "@/lib/constants";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const USE_SUPABASE = process.env.NEXT_PUBLIC_AUTH_PROVIDER === "supabase";
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

const DEMO = [
  { role: "مدير النظام", email: "admin@alhasani.iq", pass: "Admin@2026" },
  { role: "موظف (مدير قسم)", email: "n.inventory@alhasani.iq", pass: "Manager@2026" },
  { role: "موظف", email: "a.faleh@alhasani.iq", pass: "Employee@2026" },
];

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-muted">جاري التحميل…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const emailNorm = email.trim().toLowerCase();

    try {
      if (USE_SUPABASE) {
        const supabase = createSupabaseBrowserClient();
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: emailNorm,
          password,
        });
        if (signErr) {
          setError(
            signErr.message === "Invalid login credentials"
              ? "بيانات الدخول غير صحيحة."
              : signErr.message
          );
          return;
        }
        const sync = await fetch("/api/auth/sync", { method: "POST", credentials: "same-origin" });
        const data = await sync.json();
        if (!sync.ok) {
          setError(data.error ?? "تعذّر إكمال تسجيل الدخول");
          return;
        }
        router.push(data.user?.role === "LEARNER" ? "/academy" : params.get("from") || "/dashboard");
        router.refresh();
        return;
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "تعذّر تسجيل الدخول");
        return;
      }
      router.push(data.user?.role === "LEARNER" ? "/academy" : params.get("from") || "/dashboard");
      router.refresh();
    } catch {
      setError("تعذّر الاتصال بالخادم. تأكد أن التطبيق يعمل ثم أعد المحاولة.");
    } finally {
      setLoading(false);
    }
  }

  function fill(d: (typeof DEMO)[number]) {
    setEmail(d.email);
    setPassword(d.pass);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal font-display text-xl font-extrabold">
            ح
          </div>
          <div>
            <p className="font-display text-base font-bold">{ORG_NAME}</p>
            <p className="text-xs text-white/60">الأنظمة الداخلية</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <p className="eyebrow !text-teal">إدارة المعرفة والامتثال</p>
          <h1 className="mt-3 font-display text-3xl font-extrabold leading-snug">
            مرجع الوثائق والإجراءات المعتمدة في مكان واحد.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            ابحث داخل التعاميم والسياسات وإجراءات العمل، وتتبّع الاطّلاع والإقرار،
            واسأل المساعد المعرفي الذي يجيب من وثائق المجموعة الرسمية حصراً.
          </p>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-white/60">
          <ShieldCheck className="h-4 w-4 text-teal" />
          وصول داخلي مخصّص لموظفي المجموعة فقط
        </div>
      </div>

      <div className="flex items-center justify-center bg-bg px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-ink font-display text-xl font-extrabold text-white">
              ح
            </div>
          </div>
          <h2 className="font-display text-2xl font-bold text-ink">تسجيل الدخول</h2>
          <p className="mt-1 text-sm text-muted">{APP_NAME}</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink">
                البريد الإلكتروني أو الرقم الوظيفي
              </label>
              <div className="relative">
                <AtSign className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  className="h-11 w-full rounded-xl border border-line bg-surface pe-10 ps-4 text-sm text-ink placeholder:text-faint focus:border-teal"
                  placeholder="name@alhasani.iq"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink">كلمة المرور</label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-11 w-full rounded-xl border border-line bg-surface pe-10 ps-4 text-sm text-ink placeholder:text-faint focus:border-teal"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "دخول"}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-muted">
            تريد التعلّم فقط؟{" "}
            <Link href="/register" className="font-semibold text-teal-ink hover:underline">أنشئ حساب منصّة</Link>
            <span className="mx-2 text-faint">·</span>
            <Link href="/" className="font-semibold text-teal-ink hover:underline">الرئيسية</Link>
          </p>

          {USE_SUPABASE ? (
            <div className="mt-6 rounded-2xl border border-teal/30 bg-teal-soft/40 p-4">
              <p className="text-xs leading-relaxed text-ink">
                استخدم <strong>نفس حساب Supabase</strong> من نظام المركبات (البريد وكلمة المرور).
              </p>
            </div>
          ) : DEMO_MODE ? (
            <div className="mt-6 rounded-2xl border border-line bg-surface-2 p-4">
              <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-faint">
                حسابات تجريبية — اضغط للتعبئة
              </p>
              <div className="space-y-1.5">
                {DEMO.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => fill(d)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-start text-xs transition hover:bg-surface"
                  >
                    <span className="font-semibold text-ink">{d.role}</span>
                    <span className="font-mono text-2xs text-muted" dir="ltr">{d.email}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
