import Link from "next/link";
import { ShieldCheck, GraduationCap, ArrowLeft, FileText, ListChecks, Video, Award } from "lucide-react";
import { ORG_NAME } from "@/lib/constants";

export const metadata = { title: "مجموعة الحسني — البوابة" };

export default function Home() {
  // وجهة زر "النظام": رابط نظام إدارة المركبات الخارجي إن ضُبط، وإلا دخول النظام داخل المنصّة.
  const systemUrl = process.env.NEXT_PUBLIC_SYSTEM_URL || "/login";
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#0E1417] px-5 py-10 text-white">
      {/* grid motif */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />
      <div className="pointer-events-none absolute -top-32 start-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-teal/20 blur-3xl" />

      <div className="relative w-full max-w-4xl">
        {/* Brand */}
        <div className="mb-10 flex flex-col items-center text-center">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-teal font-display text-3xl font-extrabold">ح</span>
          <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">منصة الحسني هوم سنتر</h1>
          <p className="mt-2 max-w-xl text-sm text-white/60">
            بوابة موحّدة — اختر وجهتك: منصّة التعلّم والمعرفة، أو نظام إدارة المركبات والمعدات.
          </p>
        </div>

        {/* Two entrances — المنصّة أولاً ثم النظام */}
        <div className="grid gap-5 sm:grid-cols-2">
          {/* منصّة التعلّم */}
          <Link
            href="/academy"
            className="group relative flex flex-col rounded-3xl border border-teal/30 bg-teal/[0.07] p-7 transition hover:border-teal/60 hover:bg-teal/[0.12]"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal text-white">
              <GraduationCap className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-display text-xl font-bold">منصّة التعلّم والمعرفة</h2>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-white/65">
              دورات تدريبية ومسارات تعلّم ومكتبة فيديو وكتب معرفية — متاحة للجميع مع إمكانية إنشاء حساب لمتابعة تقدّمك.
            </p>
            <div className="mt-4 flex items-center gap-3 text-white/50">
              <GraduationCap className="h-4 w-4" /> <Video className="h-4 w-4" /> <Award className="h-4 w-4" />
            </div>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-teal">
              الدخول إلى المنصّة
              <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" />
            </span>
            <span className="absolute end-5 top-5 rounded-full bg-teal/25 px-2.5 py-1 text-2xs text-teal">مفتوحة للجميع</span>
          </Link>

          {/* النظام (إدارة المركبات والمعدات) */}
          <a
            href={systemUrl}
            className="group relative flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-7 transition hover:border-teal/40 hover:bg-white/[0.06]"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-teal transition group-hover:bg-teal group-hover:text-white">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-display text-xl font-bold">النظام</h2>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-white/55">
              نظام إدارة المركبات والمعدات والعمليات اللوجستية — للموظفين والإدارة، بحساباتكم الحالية.
            </p>
            <div className="mt-4 flex items-center gap-3 text-white/40">
              <FileText className="h-4 w-4" /> <ListChecks className="h-4 w-4" /> <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-teal">
              الدخول إلى النظام
              <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" />
            </span>
            <span className="absolute end-5 top-5 rounded-full bg-white/10 px-2.5 py-1 text-2xs text-white/60">يتطلب دخولاً</span>
          </a>
        </div>

        <p className="mt-8 text-center text-2xs text-white/35">
          © {new Date().getFullYear()} {ORG_NAME}. جميع الحقوق محفوظة.
        </p>
      </div>
    </main>
  );
}
