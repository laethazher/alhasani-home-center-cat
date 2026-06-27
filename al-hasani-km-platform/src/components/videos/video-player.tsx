"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { List, FileText, Sparkles } from "lucide-react";
import type { VideoChapter } from "@/lib/types";
import { arNum, formatDuration, cn } from "@/lib/utils";

export function VideoPlayer({
  src,
  poster,
  chapters = [],
  transcriptPending = true,
}: {
  src: string;
  poster?: string | null;
  chapters?: VideoChapter[];
  transcriptPending?: boolean;
}) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const params = useSearchParams();
  const [current, setCurrent] = React.useState(0);

  // deep-link ?t=seconds
  React.useEffect(() => {
    const t = Number(params.get("t"));
    if (t && ref.current) {
      ref.current.currentTime = t;
      ref.current.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function seek(seconds: number) {
    if (ref.current) {
      ref.current.currentTime = seconds;
      ref.current.play().catch(() => {});
    }
  }

  const hasSrc = src && src !== "#";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="overflow-hidden rounded-2xl border border-line bg-black">
          {hasSrc ? (
            <video
              ref={ref}
              src={src}
              poster={poster ?? undefined}
              controls
              className="aspect-video w-full"
              onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
            />
          ) : (
            <div className="relative aspect-video w-full">
              {poster && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt="" className="h-full w-full object-cover opacity-60" />
              )}
              <div className="absolute inset-0 grid place-items-center bg-black/40 text-center">
                <div>
                  <p className="font-display text-sm font-bold text-white">معاينة الفيديو</p>
                  <p className="mt-1 text-2xs text-white/70">يُعرض المشغّل هنا. ارفع الملف إلى التخزين (MinIO/S3) لتشغيله مباشرة.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chapters */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <List className="h-4 w-4 text-faint" />
          <h3 className="font-display text-sm font-bold text-ink">الفصول</h3>
        </div>
        {chapters.length ? (
          <ul className="max-h-72 divide-y divide-line overflow-y-auto">
            {chapters.map((c, i) => {
              const active = current >= c.timeSeconds && (i === chapters.length - 1 || current < chapters[i + 1].timeSeconds);
              return (
                <li key={i}>
                  <button
                    onClick={() => seek(c.timeSeconds)}
                    className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-start transition hover:bg-surface-2", active && "bg-teal-soft/50")}
                  >
                    <span className={cn("rounded-md px-1.5 py-0.5 font-mono text-2xs font-semibold tnum", active ? "bg-teal text-white" : "bg-surface-2 text-teal-ink")} dir="ltr">
                      {formatDuration(c.timeSeconds)}
                    </span>
                    <span className={cn("flex-1 text-xs", active ? "font-semibold text-ink" : "text-muted")}>{c.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-4 py-6 text-center text-2xs text-muted">لا توجد فصول لهذا الفيديو.</div>
        )}

        {transcriptPending && (
          <div className="flex items-start gap-2 border-t border-line bg-surface-2/50 px-4 py-3 text-2xs text-muted">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 text-teal-ink" />
            النسخ النصي والبحث داخل الكلام يُفعَّلان في المرحلة الثانية (محرّك النسخ).
          </div>
        )}
      </div>
    </div>
  );
}
