"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Files,
  Search,
  Sparkles,
  ListChecks,
  ShieldCheck,
  Settings,
  GraduationCap,
  Video,
  type LucideIcon,
  X,
} from "lucide-react";
import { NAV } from "@/lib/constants";
import { APP_NAME, ORG_NAME } from "@/lib/constants";
import type { SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Files,
  Search,
  Sparkles,
  ListChecks,
  ShieldCheck,
  Settings,
  GraduationCap,
  Video,
};

export function Sidebar({
  user,
  open,
  onClose,
}: {
  user: SessionUser;
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile scrim */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-72 flex-col border-l border-line bg-surface transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand */}
        <div className="relative flex items-center gap-3 px-5 py-5">
          <div className="gable relative grid h-11 w-11 place-items-center rounded-2xl bg-ink text-white">
            <span className="font-display text-lg font-extrabold">ح</span>
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-sm font-bold text-ink">{ORG_NAME}</p>
            <p className="truncate text-2xs text-muted">{APP_NAME}</p>
          </div>
          <button onClick={onClose} className="me-auto text-muted lg:hidden" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-3">
          {NAV.map((group) => {
            const items = group.items.filter((i) => !i.roles || i.roles.includes(user.role));
            if (!items.length) return null;
            return (
              <div key={group.section}>
                <p className="px-3 pb-2 text-2xs font-semibold uppercase tracking-wider text-faint">
                  {group.section}
                </p>
                <ul className="space-y-1">
                  {items.map((item) => {
                    const Icon = ICONS[item.icon] ?? Files;
                    const active = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                            active
                              ? "bg-teal-soft text-teal-ink"
                              : "text-muted hover:bg-surface-2 hover:text-ink"
                          )}
                        >
                          {active && (
                            <span className="absolute inset-y-2 right-0 w-1 rounded-full bg-teal" />
                          )}
                          <Icon className={cn("h-[18px] w-[18px]", active ? "text-teal" : "text-faint group-hover:text-muted")} />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Footer mark */}
        <div className="border-t border-line px-5 py-4 text-2xs text-faint">
          النسخة ١٫٠ · بيئة داخلية
        </div>
      </aside>
    </>
  );
}
