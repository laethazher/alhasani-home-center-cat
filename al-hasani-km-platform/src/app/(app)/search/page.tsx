"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, Sparkles, Loader2, FileSearch, Hash, Building2, Tag, FileText, Type } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { TypeBadge, StatusBadge, EmptyState, Badge, Button } from "@/components/ui";
import { DOC_TYPE_LABEL } from "@/lib/constants";
import type { SearchHit, DocumentType } from "@/lib/types";
import { arNum, cn } from "@/lib/utils";

const MATCH_META: Record<string, { label: string; icon: React.ReactNode }> = {
  title: { label: "العنوان", icon: <Type className="h-3 w-3" /> },
  number: { label: "رقم الوثيقة", icon: <Hash className="h-3 w-3" /> },
  department: { label: "القسم", icon: <Building2 className="h-3 w-3" /> },
  keyword: { label: "كلمة مفتاحية", icon: <Tag className="h-3 w-3" /> },
  content: { label: "داخل النص (OCR)", icon: <FileText className="h-3 w-3" /> },
  semantic: { label: "دلالي", icon: <Sparkles className="h-3 w-3" /> },
};

const TYPES: (DocumentType | "ALL")[] = ["ALL", "POLICY", "CIRCULAR", "NOTICE", "SOP", "INSTRUCTION", "ADMIN_BOOK"];

export default function SearchPage() {
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get("q") ?? "");
  const [semantic, setSemantic] = React.useState(false);
  const [type, setType] = React.useState<DocumentType | "ALL">("ALL");
  const [results, setResults] = React.useState<SearchHit[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  const run = React.useCallback(async (query: string, sem: boolean, t: string) => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    const url = new URL("/api/search", window.location.origin);
    url.searchParams.set("q", query.trim());
    if (sem) url.searchParams.set("semantic", "1");
    if (t !== "ALL") url.searchParams.set("type", t);
    const res = await fetch(url.toString());
    const data = await res.json();
    setResults(data.results ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (params.get("q")) run(params.get("q")!, false, "ALL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(q, semantic, type);
  }

  return (
    <>
      <PageHeader
        eyebrow="بحث موحّد"
        title="البحث الذكي"
        description="ابحث في العناوين وأرقام الوثائق والكلمات المفتاحية وداخل نص الـ PDF، أو فعّل البحث الدلالي لإيجاد المعنى لا الكلمة فقط."
      />

      <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute end-3 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="مثال: المصادقة الثنائية، AH-POL-2026-001، إجراء استلام الشحنات…"
              className="h-12 w-full rounded-xl border border-line bg-surface-2 pe-12 ps-4 text-sm text-ink placeholder:text-faint focus:border-teal"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="h-12 rounded-xl border border-line bg-surface-2 px-3 text-sm font-medium text-ink focus:border-teal"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{t === "ALL" ? "كل الأنواع" : DOC_TYPE_LABEL[t]}</option>
            ))}
          </select>
          <Button type="submit" size="lg" disabled={loading} className="lg:w-32">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "بحث"}
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setSemantic((v) => !v)}
          className={cn(
            "mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition",
            semantic ? "border-teal/40 bg-teal-soft text-teal-ink" : "border-line text-muted hover:bg-surface-2"
          )}
        >
          <Sparkles className="h-4 w-4" />
          البحث الدلالي بالذكاء الاصطناعي {semantic ? "مُفعّل" : "متوقف"}
        </button>
      </form>

      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted">
            <Loader2 className="me-2 h-5 w-5 animate-spin" /> جارٍ البحث…
          </div>
        ) : results === null ? (
          <div className="card"><EmptyState icon={<FileSearch className="h-8 w-8" />} title="ابدأ بكتابة استعلام" hint="يمكنك البحث برقم الوثيقة أو العنوان أو كلمة وردت داخل المستند." /></div>
        ) : results.length === 0 ? (
          <div className="card"><EmptyState icon={<FileSearch className="h-8 w-8" />} title="لا نتائج مطابقة" hint="جرّب صياغة مختلفة أو فعّل البحث الدلالي." /></div>
        ) : (
          <>
            <p className="mb-3 px-1 text-xs text-muted">{arNum(results.length)} نتيجة</p>
            <div className="space-y-3">
              {results.map((r) => (
                <Link key={r.id} href={`/documents/${r.id}`} className="card group block p-5 transition hover:shadow-pop">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-[0.95rem] font-bold text-ink group-hover:text-teal-ink">{r.title}</h3>
                      <p className="mt-0.5 font-mono text-2xs text-muted" dir="ltr">{r.documentNumber}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <TypeBadge type={r.type} />
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">{r.snippet}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {r.matchedIn.map((m) => (
                      <span key={m} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-2xs text-muted">
                        {MATCH_META[m]?.icon}{MATCH_META[m]?.label ?? m}
                      </span>
                    ))}
                    {r.page && <span className="text-2xs text-faint">صفحة {arNum(r.page)}</span>}
                    <span className="ms-auto text-2xs text-faint">{r.departmentName}</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
