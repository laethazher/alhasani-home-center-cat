import Link from "next/link";
import { UploadCloud } from "lucide-react";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listVideos, listVideoCategories } from "@/lib/data/videoRepo";
import { PageHeader } from "@/components/shared/page-header";
import { VideoLibrary } from "@/components/videos/video-library";

export const metadata = { title: "مكتبة الفيديو" };

export default async function VideosPage() {
  const user = await getSession();
  const [videos, categories] = await Promise.all([listVideos(user), listVideoCategories()]);

  return (
    <>
      <PageHeader
        eyebrow="مكتبة المعرفة المرئية"
        title="مكتبة الفيديو"
        description="فيديوهات تدريبية وتسجيلات شاشة وشروحات تشغيلية، قابلة للبحث بالتصنيف والقسم وبالطابع الزمني."
        actions={
          can(user, "video:upload") ? (
            <Link href="/videos/upload" className="inline-flex items-center gap-1.5 rounded-xl bg-teal px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105">
              <UploadCloud className="h-4 w-4" /> رفع فيديو
            </Link>
          ) : undefined
        }
      />
      <VideoLibrary videos={videos} categories={categories} />
    </>
  );
}
