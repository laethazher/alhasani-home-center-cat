"use client";
import Link from "next/link";
import { Play, Eye, Clock3 } from "lucide-react";
import type { VideoRecord } from "@/lib/types";
import { arNum, formatDuration, relativeTime } from "@/lib/utils";

export function VideoCard({ video, timestamp }: { video: VideoRecord; timestamp?: number }) {
  const href = timestamp ? `/videos/${video.id}?t=${timestamp}` : `/videos/${video.id}`;
  return (
    <Link href={href} className="card group flex flex-col overflow-hidden transition hover:shadow-pop">
      <div className="relative aspect-video overflow-hidden bg-surface-2">
        {video.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailUrl} alt={video.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        )}
        <div className="absolute inset-0 bg-black/10 transition group-hover:bg-black/25" />
        <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-ink shadow-pop">
            <Play className="h-5 w-5 translate-x-px -scale-x-100 fill-current" />
          </span>
        </span>
        <span className="absolute bottom-2 end-2 rounded-md bg-black/70 px-1.5 py-0.5 text-2xs font-semibold text-white tnum">
          {formatDuration(video.durationSeconds)}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-display text-sm font-bold leading-snug text-ink group-hover:text-teal-ink">{video.title}</h3>
        <div className="mt-auto flex items-center gap-3 pt-3 text-2xs text-muted">
          {video.categoryName && <span className="rounded bg-surface-2 px-2 py-0.5">{video.categoryName}</span>}
          <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {arNum(video.views)}</span>
          <span className="ms-auto inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {relativeTime(video.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
