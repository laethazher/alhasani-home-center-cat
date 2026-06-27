import * as React from "react";
import { cn, arNum } from "@/lib/utils";
import type {
  AckStatus,
  Confidentiality,
  DocumentStatus,
  DocumentType,
  SopSeverity,
} from "@/lib/types";
import {
  ACK_LABEL,
  CONFIDENTIALITY_LABEL,
  DOC_STATUS_LABEL,
  DOC_TYPE_LABEL,
  SEVERITY_LABEL,
} from "@/lib/constants";

/* ------------------------------- Card ---------------------------------- */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}
export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        <h3 className="font-display text-[0.95rem] font-bold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------ Button --------------------------------- */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "subtle" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
};
const BTN_VARIANT: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-teal text-white hover:brightness-95 shadow-sm",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
  outline: "border border-line-strong text-ink hover:bg-surface-2",
  subtle: "bg-surface-2 text-ink hover:bg-elevated border border-line",
  danger: "bg-danger text-white hover:brightness-95",
};
const BTN_SIZE: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[0.95rem] gap-2",
  icon: "h-10 w-10 justify-center",
};
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium transition disabled:opacity-50 disabled:pointer-events-none",
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";

/* ------------------------------- Badge --------------------------------- */
const TONE: Record<string, string> = {
  teal: "bg-teal-soft text-teal-ink",
  info: "bg-info/10 text-info",
  gold: "bg-gold/15 text-gold",
  plum: "bg-[#5E5275]/12 text-[#7a6e95] dark:text-[#b3a8cf]",
  muted: "bg-surface-2 text-muted",
  ok: "bg-ok/12 text-ok",
  warn: "bg-warn/12 text-warn",
  danger: "bg-danger/12 text-danger",
};
export function Badge({
  tone = "muted",
  className,
  children,
  dot,
}: {
  tone?: keyof typeof TONE;
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold",
        TONE[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<DocumentStatus, keyof typeof TONE> = {
  PUBLISHED: "ok",
  IN_REVIEW: "warn",
  DRAFT: "muted",
  ARCHIVED: "info",
  EXPIRED: "danger",
};
export function StatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge tone={STATUS_TONE[status]} dot>{DOC_STATUS_LABEL[status]}</Badge>;
}

const TYPE_TONE: Record<DocumentType, keyof typeof TONE> = {
  POLICY: "plum",
  CIRCULAR: "info",
  NOTICE: "gold",
  SOP: "teal",
  ADMIN_BOOK: "teal",
  INSTRUCTION: "muted",
};
export function TypeBadge({ type }: { type: DocumentType }) {
  return <Badge tone={TYPE_TONE[type]}>{DOC_TYPE_LABEL[type]}</Badge>;
}

const ACK_TONE: Record<AckStatus, keyof typeof TONE> = {
  ACKNOWLEDGED: "ok",
  READ: "teal",
  VIEWED: "warn",
  NOT_VIEWED: "danger",
};
export function AckBadge({ status }: { status: AckStatus }) {
  return <Badge tone={ACK_TONE[status]} dot>{ACK_LABEL[status]}</Badge>;
}

export function ConfidentialityBadge({ level }: { level: Confidentiality }) {
  const tone: keyof typeof TONE =
    level === "SECRET" ? "danger" : level === "RESTRICTED" ? "warn" : "muted";
  return <Badge tone={tone}>{CONFIDENTIALITY_LABEL[level]}</Badge>;
}

const SEV_TONE: Record<SopSeverity, keyof typeof TONE> = {
  CRITICAL: "danger",
  HIGH: "warn",
  MEDIUM: "gold",
  LOW: "muted",
};
export function SeverityBadge({ level }: { level: SopSeverity }) {
  return <Badge tone={SEV_TONE[level]}>{SEVERITY_LABEL[level]}</Badge>;
}

/* ------------------------------ Avatar --------------------------------- */
export function Avatar({
  name,
  color,
  size = 36,
}: {
  name: string;
  color?: string | null;
  size?: number;
}) {
  const parts = name.trim().split(/\s+/);
  const init = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white"
      style={{ width: size, height: size, background: color || "rgb(var(--steel,62 92 118))", fontSize: size * 0.36 }}
    >
      {init}
    </span>
  );
}

/* --------------------------- Progress bar ------------------------------ */
export function ProgressBar({ value, tone = "teal" }: { value: number; tone?: "teal" | "ok" | "warn" | "danger" }) {
  const color = tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : tone === "danger" ? "bg-danger" : "bg-teal";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/* ---------------------------- Empty state ------------------------------ */
export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      {icon && <div className="mb-1 text-faint">{icon}</div>}
      <p className="font-display text-sm font-bold text-ink">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
    </div>
  );
}

/* ------------------------------- Stat ---------------------------------- */
export function Donut({ value, label }: { value: number; label?: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div className="relative h-16 w-16">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(var(--teal))" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold tnum text-ink">
        {arNum(value)}%
      </div>
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}

/* --------------------- Phase 1 — Academy & Video ----------------------- */
import type { CourseLevel, EnrollmentStatus, VideoStatus } from "@/lib/types";
import {
  LEVEL_LABEL,
  LEVEL_TONE,
  ENROLLMENT_STATUS_LABEL,
  VIDEO_STATUS_LABEL,
} from "@/lib/constants";

export function LevelBadge({ level }: { level: CourseLevel }) {
  return <Badge tone={LEVEL_TONE[level]}>{LEVEL_LABEL[level]}</Badge>;
}

const ENROLL_TONE: Record<EnrollmentStatus, keyof typeof TONE> = {
  COMPLETED: "ok",
  IN_PROGRESS: "teal",
  ENROLLED: "muted",
};
export function EnrollmentBadge({ status }: { status: EnrollmentStatus }) {
  return <Badge tone={ENROLL_TONE[status]} dot>{ENROLLMENT_STATUS_LABEL[status]}</Badge>;
}

const VSTATUS_TONE: Record<VideoStatus, keyof typeof TONE> = {
  READY: "ok",
  PROCESSING: "warn",
  FAILED: "danger",
  ARCHIVED: "muted",
};
export function VideoStatusBadge({ status }: { status: VideoStatus }) {
  return <Badge tone={VSTATUS_TONE[status]} dot>{VIDEO_STATUS_LABEL[status]}</Badge>;
}
