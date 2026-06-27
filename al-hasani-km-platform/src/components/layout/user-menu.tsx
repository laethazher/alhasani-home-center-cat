"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/constants";
import type { SessionUser } from "@/lib/types";

export function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-xl py-1.5 pe-2 ps-1 transition hover:bg-surface-2"
      >
        <Avatar name={user.name} color={user.avatarColor} size={34} />
        <div className="hidden text-start leading-tight sm:block">
          <p className="text-xs font-semibold text-ink">{user.name}</p>
          <p className="text-2xs text-muted">{ROLE_LABEL[user.role]}</p>
        </div>
        <ChevronDown className="h-4 w-4 text-faint" />
      </button>

      {open && (
        <div className="absolute end-0 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-elevated shadow-pop animate-fade-up">
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">{user.name}</p>
            <p className="text-2xs text-muted">{user.email}</p>
            <p className="mt-1 text-2xs text-teal-ink">
              {ROLE_LABEL[user.role]}
              {user.departmentName ? ` · ${user.departmentName}` : ""}
            </p>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-danger transition hover:bg-surface-2"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>
      )}
    </div>
  );
}
