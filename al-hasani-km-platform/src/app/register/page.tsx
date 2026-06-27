"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, AtSign, KeyRound, User2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";
import { ORG_NAME } from "@/lib/constants";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "تعذّر إنشاء الحساب");
      return;
    }
    router.push("/academy");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen place-items-center bg-surface-2/40 px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal font-display text-2xl font-extrabold text-white">ح</span>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-ink">إنشاء حساب متعلّم</h1>
          <p className="mt-1 text-sm text-muted">انضمّ إلى منصّة التعلّم في {ORG_NAME} وتابع تقدّمك واحصل على الشهادات.</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          {error && (
            <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger">{error}</div>
          )}

          <label className="block">
            <span className="mb-1 block text-2xs font-semibold text-muted">الاسم الكامل</span>
            <div className="relative">
              <User2 className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-faint" />
              <input value={name} onChange={(e) => setName(e.target.value)} required className="inp ps-9" placeholder="الاسم الكامل" />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-2xs font-semibold text-muted">البريد الإلكتروني</span>
            <div className="relative">
              <AtSign className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-faint" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="inp ps-9" placeholder="you@example.com" dir="ltr" />
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-2xs font-semibold text-muted">كلمة المرور</span>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-faint" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="inp ps-9" placeholder="••••••" />
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-2xs font-semibold text-muted">تأكيد كلمة المرور</span>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-faint" />
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="inp ps-9" placeholder="••••••" />
              </div>
            </label>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><GraduationCap className="h-5 w-5" /> إنشاء الحساب والبدء</>}
          </Button>

          <p className="text-center text-xs text-muted">
            لديك حساب؟{" "}
            <Link href="/login" className="font-semibold text-teal-ink hover:underline">تسجيل الدخول</Link>
          </p>
        </form>

        <div className="mt-4 flex items-center justify-center gap-4 text-2xs text-faint">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-ink">الصفحة الرئيسية</Link>
          <span>·</span>
          <Link href="/academy" className="inline-flex items-center gap-1 hover:text-ink">تصفّح المنصّة دون حساب <ArrowRight className="h-3 w-3" /></Link>
        </div>
      </div>
    </div>
  );
}
