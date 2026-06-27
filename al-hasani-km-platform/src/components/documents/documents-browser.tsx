"use client";
import * as React from "react";
import Link from "next/link";
import { Search, LayoutGrid, List, SlidersHorizontal, FileText } from "lucide-react";
import type { DocumentRecord, DocumentStatus, DocumentType } from "@/lib/types";
import {
  DEPARTMENTS,
  DOC_STATUS_LABEL,
  DOC_TYPE_LABEL,
} from "@/lib/constants";
import { TypeBadge, StatusBadge, EmptyState, AckBadge } from "@/components/ui";
import { formatDate, relativeTime, arNum } from "@/lib/utils";
import { cn } from "@/lib/utils";

const TYPES: (DocumentType | "ALL")[] = ["ALL", "POLICY", "CIRCULAR", "NOTICE", "SOP", "INSTRUCTION", "ADMIN_BOOK"];
const STATUSES: (DocumentStatus | "ALL")[] = ["ALL", "PUBLISHED", "IN_REVIEW", "ARCHIVED", "EXPIRED", "DRAFT"];

export function DocumentsBrowser({
  docs,
  initialQuery = "",
}: {
  docs: DocumentRecord[];
  initialQuery?: string;
}) {
  const [q, setQ] = React.useState(initialQuery);
  const [type, setType] = React.useState<DocumentType | "ALL">("ALL");
  const [status, setStatus] = React.useState<DocumentStatus | "ALL">("ALL");
  const [dept, setDept] = React.useState<string>("ALL");
  const [view, setView] = React.useState<"table" | "grid">("table");

  const filtered = React.useMemo(() => {
    return docs.filter((d) => {
      if (type !== "ALL" && d.type !== type) return false;
      if (status !== "ALL" && d.status !== status) return false;
      if (dept !== "ALL" && !d.departmentName.includes(dept)) return false;
      if (q.trim()) {
        const s = q.trim();
        return (
          d.title.includes(s) ||
          d.documentNumber.includes(s) ||
          d.keywords.some((k) => k.includes(s)) ||
          (d.summary?.includes(s) ?? false)
        );
      }
      return true;
    });
  }, [docs, q, type, status, dept]);

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث بالعنوان أو رقم الوثيقة أو الكلمات المفتاحية…"
            className="h-10 w-full rounded-xl border border-line bg-surface-2 pe-10 ps-4 text-sm text-ink placeholder:text-faint focus:border-teal"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <Select value={type} onChange={(v) => setType(v as any)} options={TYPES.map((t) => ({ value: t, label: t === "ALL" ? "كل الأنواع" : DOC_TYPE_LABEL[t] }))} />
          <Select value={dept} onChange={setDept} options={[{ value: "ALL", label: "كل الأقسام" }, ...DEPARTMENTS.map((d) => ({ value: d.name, label: d.name }))]} />
          <Select value={status} onChange={(v) => setStatus(v as any)} options={STATUSES.map((s) => ({ value: s, label: s === "ALL" ? "كل الحالات" : DOC_STATUS_LABEL[s] }))} />
          <div className="flex shrink-0 rounded-xl border border-line bg-surface-2 p-0.5">
            <button onClick={() => setView("table")} className={cn("grid h-9 w-9 place-items-center rounded-lg", view === "table" ? "bg-surface text-teal-ink shadow-sm" : "text-faint")} aria-label="جدول">
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setView("grid")} className={cn("grid h-9 w-9 place-items-center rounded-lg", view === "grid" ? "bg-surface text-teal-ink shadow-sm" : "text-faint")} aria-label="شبكة">
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <p className="mb-3 px-1 text-xs text-muted">
        <SlidersHorizontal className="me-1 inline h-3.5 w-3.5" />
        {arNum(filtered.length)} وثيقة
      </p>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FileText className="h-8 w-8" />} title="لا توجد وثائق مطابقة" hint="جرّب تعديل عوامل التصفية أو كلمات البحث." />
        </div>
      ) : view === "table" ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-b border-line text-2xs uppercase tracking-wider text-faint">
                <th className="px-4 py-3 text-start font-semibold">الوثيقة</th>
                <th className="hidden px-4 py-3 text-start font-semibold md:table-cell">النوع</th>
                <th className="hidden px-4 py-3 text-start font-semibold lg:table-cell">القسم</th>
                <th className="hidden px-4 py-3 text-start font-semibold sm:table-cell">الحالة</th>
                <th className="hidden px-4 py-3 text-start font-semibold lg:table-cell">آخر تحديث</th>
                <th className="px-4 py-3 text-start font-semibold">حالتك</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((d) => (
                <tr key={d.id} className="group transition hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/documents/${d.id}`} className="block">
                      <span className="block font-medium text-ink group-hover:text-teal-ink">{d.title}</span>
                      <span className="font-mono text-2xs text-muted" dir="ltr">{d.documentNumber}</span>
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell"><TypeBadge type={d.type} /></td>
                  <td className="hidden px-4 py-3 text-muted lg:table-cell">{d.departmentName}</td>
                  <td className="hidden px-4 py-3 sm:table-cell"><StatusBadge status={d.status} /></td>
                  <td className="hidden px-4 py-3 text-2xs text-muted lg:table-cell">{relativeTime(d.updatedAt)}</td>
                  <td className="px-4 py-3">{d.ack ? <AckBadge status={d.ack} /> : <span className="text-faint">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => (
            <Link key={d.id} href={`/documents/${d.id}`} className="card group p-5 transition hover:shadow-pop">
              <div className="flex items-center justify-between">
                <TypeBadge type={d.type} />
                <StatusBadge status={d.status} />
              </div>
              <h3 className="mt-3 font-display text-[0.95rem] font-bold leading-snug text-ink group-hover:text-teal-ink">{d.title}</h3>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">{d.summary}</p>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-2xs text-faint">
                <span className="font-mono" dir="ltr">{d.documentNumber}</span>
                <span>{d.departmentName}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 shrink-0 rounded-xl border border-line bg-surface-2 px-3 text-xs font-medium text-ink focus:border-teal"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
