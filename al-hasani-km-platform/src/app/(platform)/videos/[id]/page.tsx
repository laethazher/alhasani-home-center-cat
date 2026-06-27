import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, Building2, User2, CalendarDays, Tag } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getVideo, relatedVideos } from "@/lib/data/videoRepo";
import { VideoPlayer } from "@/components/videos/video-player";
import { VideoCard } from "@/components/videos/video-card";
import { VideoStatusBadge } from "@/components/ui";
import { arNum, formatDate } from "@/lib/utils";

export const metadata = { title: "مشغّل الفيديو" };

export default async function VideoPage({ params }: { params: { id: string } }) {
  const user = await getSession();
  const video = await getVideo(user, params.id);
  if (!video) notFound();
  const related = await relatedVideos(user, video);

  // PRODUCTION: await db.videoView.create({ data: { videoId, userId, ... } });
  //             await db.video.update({ where: { id }, data: { views: { increment: 1 } } });

  return (
    <>
      <nav className="mb-4 flex items-center gap-1.5 text-2xs text-muted">
        <Link href="/videos" className="hover:text-ink">مكتبة الفيديو</Link>
        <span>/</span>
        <span className="text-ink">{video.categoryName}</span>
      </nav>

      <VideoPlayer
        src={video.fileUrl}
        poster={video.thumbnailUrl}
        chapters={video.chapters}
        transcriptPending={video.transcriptStatus !== "COMPLETED"}
      />

      {/* Meta */}
      <div className="card mt-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-extrabold text-ink">{video.title}</h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">{video.description}</p>
          </div>
          <VideoStatusBadge status={video.status} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-2xs text-muted">
          <span className="inline-flex items-center gap-1.5"><User2 className="h-3.5 w-3.5" /> {video.uploaderName}</span>
          {video.departmentName && <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {video.departmentName}</span>}
          <span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> {arNum(video.views)} مشاهدة</span>
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(video.createdAt)}</span>
        </div>

        {video.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-faint" />
            {video.tags.map((t) => (
              <span key={t} className="rounded-md bg-surface-2 px-2 py-0.5 text-2xs font-medium text-muted">{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-bold text-ink">فيديوهات ذات صلة</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((v) => <VideoCard key={v.id} video={v} />)}
          </div>
        </section>
      )}
    </>
  );
}
