import * as React from "react";
import { Card } from "@/components/ui";
import { cn, arNum } from "@/lib/utils";

export function Kpi({
  label,
  value,
  suffix,
  icon,
  hint,
  tone = "teal",
}: {
  label: string;
  value: number | string;
  suffix?: string;
  icon: React.ReactNode;
  hint?: string;
  tone?: "teal" | "ok" | "warn" | "gold";
}) {
  const ic =
    tone === "ok" ? "bg-ok/12 text-ok" : tone === "warn" ? "bg-warn/12 text-warn" : tone === "gold" ? "bg-gold/15 text-gold" : "bg-teal-soft text-teal-ink";
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted">{label}</p>
          <p className="mt-2 font-display text-3xl font-extrabold tnum text-ink">
            {typeof value === "number" ? arNum(value) : value}
            {suffix && <span className="ms-1 text-lg text-muted">{suffix}</span>}
          </p>
          {hint && <p className="mt-1 text-2xs text-faint">{hint}</p>}
        </div>
        <div className={cn("grid h-11 w-11 place-items-center rounded-2xl", ic)}>{icon}</div>
      </div>
    </Card>
  );
}
