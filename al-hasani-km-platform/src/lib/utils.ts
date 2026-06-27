import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const AR_DATE = new Intl.DateTimeFormat("ar-IQ-u-nu-arab", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const AR_DATETIME = new Intl.DateTimeFormat("ar-IQ-u-nu-arab", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value?: string | Date | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return AR_DATE.format(d);
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return AR_DATETIME.format(d);
}

const AR_NUM = new Intl.NumberFormat("ar-IQ-u-nu-arab");
export function arNum(n: number): string {
  return AR_NUM.format(n);
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  const units = ["بايت", "ك.ب", "م.ب", "غ.ب"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, i);
  return `${arNum(Math.round(val * 10) / 10)} ${units[i]}`;
}

export function relativeTime(value?: string | Date | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = (Date.now() - d.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
  if (diff < 60) return "الآن";
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), "minute");
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), "hour");
  if (diff < 2592000) return rtf.format(-Math.floor(diff / 86400), "day");
  return formatDate(d);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export function isExpiringSoon(expiry?: string | null, days = 30): boolean {
  if (!expiry) return false;
  const d = new Date(expiry).getTime() - Date.now();
  return d > 0 && d < days * 86400 * 1000;
}

// مدة بالثواني → م:ث بأرقام عربية (للفيديو)
export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds) return "٠:٠٠";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  const mm = arNum(m);
  const ss = s < 10 ? `٠${arNum(s)}` : arNum(s);
  return `${mm}:${ss}`;
}

// دقائق → نص عربي موجز
export function formatMinutes(min: number): string {
  if (!min) return "—";
  if (min < 60) return `${arNum(min)} دقيقة`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${arNum(h)} س ${arNum(r)} د` : `${arNum(h)} ساعة`;
}

// تحويل نص إلى slug صالح للروابط (يدعم العربية واللاتينية)
export function slugify(input: string): string {
  return input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\u0600-\u06FF\w-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "video";
}
