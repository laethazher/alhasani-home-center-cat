"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Menu, Search, Bell } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import type { SessionUser } from "@/lib/types";

export function Topbar({ user, onMenu }: { user: SessionUser; onMenu: () => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur-md lg:px-6">
      <button onClick={onMenu} className="text-muted lg:hidden" aria-label="القائمة">
        <Menu className="h-6 w-6" />
      </button>

      <form onSubmit={submit} className="relative hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث في الوثائق، أرقام الكتب، الكلمات المفتاحية…"
          className="h-10 w-full rounded-xl border border-line bg-surface pe-10 ps-4 text-sm text-ink placeholder:text-faint focus:border-teal"
        />
      </form>

      <div className="me-auto flex items-center gap-1">
        <button className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-ink" aria-label="الإشعارات">
          <Bell className="h-5 w-5" />
          <span className="absolute end-2.5 top-2.5 h-2 w-2 rounded-full bg-teal ring-2 ring-bg" />
        </button>
        <ThemeToggle />
        <div className="mx-1 h-6 w-px bg-line" />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
