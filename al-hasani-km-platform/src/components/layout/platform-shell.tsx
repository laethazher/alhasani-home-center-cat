"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GraduationCap, Video, BookOpen, LogOut, ShieldCheck, LogIn, UserPlus } from "lucide-react";
import type { SessionUser } from "@/lib/types";
import { ThemeToggle } from "./theme-toggle";
import { ORG_NAME } from "@/lib/constants";
import { getFleetSystemUrl, isFleetSystemExternal } from "@/lib/system-url";
import { cn, initials } from "@/lib/utils";

const NAV = [
  { href: "/academy", label: "الأكاديمية", icon: GraduationCap },
  { href: "/videos", label: "مكتبة الفيديو", icon: Video },
];

export function PlatformShell({ user, children }: { user: SessionUser | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const items = user ? [...NAV, { href: "/academy/my-learning", label: "تعلّمي", icon: BookOpen }] : NAV;
  const fleetUrl = getFleetSystemUrl();

  return (
    <div className="flex min-h-screen flex-col bg-surface-2/40">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          {/* Brand */}
          <Link href="/academy" className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal font-display text-lg font-extrabold text-white">ح</span>
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="font-display text-sm font-extrabold text-ink">منصة الحسني هوم سنتر</span>
              <span className="text-2xs text-muted">التعلّم والمعرفة</span>
            </span>
          </Link>

          {/* Nav */}
          <nav className="flex flex-1 items-center justify-center gap-1">
            {items.map((it) => {
              const active = pathname === it.href || pathname.startsWith(it.href + "/");
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition",
                    active ? "bg-teal-soft text-teal-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
                  )}
                >
                  <it.icon className="h-4 w-4" />
                  <span className="hidden md:inline">{it.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Auth area */}
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            {user ? (
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-2 sm:flex">
                  <span className="grid h-9 w-9 place-items-center rounded-full text-2xs font-bold text-white" style={{ backgroundColor: user.avatarColor ?? "#17B8A1" }}>
                    {initials(user.name)}
                  </span>
                  <span className="text-xs font-semibold text-ink">{user.name}</span>
                </span>
                <button onClick={logout} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-danger" aria-label="تسجيل الخروج">
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <>
                <Link href="/login" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-ink">
                  <LogIn className="h-4 w-4" /> <span className="hidden sm:inline">دخول</span>
                </Link>
                <Link href="/register" className="inline-flex items-center gap-1.5 rounded-xl bg-teal px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105">
                  <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">إنشاء حساب</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-5 text-2xs text-muted sm:flex-row">
          <span>© {new Date().getFullYear()} {ORG_NAME} — منصّة التعلّم</span>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/login" className="inline-flex items-center gap-1 transition hover:text-ink">
              <ShieldCheck className="h-3.5 w-3.5" /> إدارة المعرفة
            </Link>
            <a
              href={fleetUrl}
              {...(isFleetSystemExternal(fleetUrl)
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="inline-flex items-center gap-1 transition hover:text-ink"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> نظام المركبات
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
