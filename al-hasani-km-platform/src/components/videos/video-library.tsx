"use client";
import * as React from "react";
import Link from "next/link";
import { Search, Loader2, Clock, X } from "lucide-react";
import type { VideoRecord, VideoCategoryRecord, VideoSearchHit } from "@/lib/types";
import { VideoCard } from "./video-card";
import { EmptyState } from "@/components/ui";
import { DEPARTMENTS } from "@/lib/constants";
import { arNum, formatDuration, cn } from "@/lib/utils";

export function VideoLibrary({
  videos,
  categories,
}: {
  videos: VideoRecord[];
  categories: VideoCategoryRecord[];
}) {
  const [cat, setCat] = React.useState("ALL");
  const [dept, setDept] = React.useState("ALL");
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<VideoSearchHit[] | null>(null);
  const [searching, setSearching] = React.useState(false);

  // debounce search
  React.useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/videos/search?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        setHits(data.results ?? []);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const filtered = videos.filter(
    (v) => (cat === "ALL" || v.categoryId === cat) && (dept === "ALL" || v.departmentId === dept)
  );

  const showSearch = q.trim().length >= 2;

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 start-4 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث في الفيديوهات… مثل: كيف أغلق البوكسات؟ كيف أسجل تعويض؟"
          className="h-12 w-full rounded-xl border border-line bg-surface ps-11 pe-10 text-sm text-ink shadow-sm outline-none transition placeholder:text-faint focus:border-teal focus:ring-2 focus:ring-teal/20"
        />
        {q && (
          <button onClick={() => setQ("")} className="absolute top-1/2 end-3 -translate-y-1/2 text-faint hover:text-ink" aria-label="مسح">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </button>
        )}
      </div>

      {showSearch ? (
        /* ---------- Search results ---------- */
        <div>
          <p className="mb-3 text-xs text-muted">
            {searching ? "جارٍ البحث…" : <>نتائج عن «<span className="font-semibold text-ink">{q}</span>» — {arNum(hits?.length ?? 0)} فيديو</>}
          </p>
          {hits && hits.length === 0 && !searching ? (
            <EmptyState title="لا توجد نتائج" hint="جرّب كلمات أبسط أو مرادفات مختلفة." />
          ) : (
            <ul className="space-y-3">
              {hits?.map((h) => (
                <li key={h.id}>
                  <Link
                    href={h.timestamp ? `/videos/${h.id}?t=${h.timestamp.timeSeconds}` : `/videos/${h.id}`}
                    className="card flex gap-4 p-3 transition hover:shadow-pop"
                  >
                    <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                      {h.thumbnailUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={h.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      )}
                      <span className="absolute bottom-1 end-1 rounded bg-black/70 px-1 text-2xs font-semibold text-white tnum">{formatDuration(h.durationSeconds)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-sm font-bold text-ink">{h.title}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-muted">{h.snippet}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {h.timestamp && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-teal-soft px-2 py-0.5 text-2xs font-semibold text-teal-ink">
                            <Clock className="h-3 w-3" /> <span dir="ltr">{formatDuration(h.timestamp.timeSeconds)}</span> · {h.timestamp.title}
                          </span>
                        )}
                        {h.categoryName && <span className="text-2xs text-faint">{h.categoryName}</span>}
                        {h.departmentName && <span className="text-2xs text-faint">· {h.departmentName}</span>}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        /* ---------- Browse grid ---------- */
        <>
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill active={cat === "ALL"} onClick={() => setCat("ALL")}>كل التصنيفات</FilterPill>
            {categories.map((c) => (
              <FilterPill key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
                {c.name} <span className="opacity-60">({arNum(c.videosCount)})</span>
              </FilterPill>
            ))}
            <span className="mx-1 h-5 w-px bg-line" />
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-teal"
            >
              <option value="ALL">كل الأقسام</option>
              {DEPARTMENTS.map((d) => (
                <option key={d.code} value={`dept_${d.code.toLowerCase()}`}>{d.name}</option>
              ))}
            </select>
          </div>

          {filtered.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          ) : (
            <EmptyState title="لا توجد فيديوهات" hint="لا توجد فيديوهات مطابقة لهذا التصفية." />
          )}
        </>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-2xs font-semibold transition",
        active ? "bg-teal text-white shadow-sm" : "bg-surface-2 text-muted hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
