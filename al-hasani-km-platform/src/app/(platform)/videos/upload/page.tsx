import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listVideoCategories } from "@/lib/data/videoRepo";
import { PageHeader } from "@/components/shared/page-header";
import { UploadForm } from "@/components/videos/upload-form";

export const metadata = { title: "رفع فيديو" };

export default async function UploadVideoPage() {
  const user = await getSession();
  if (!user || !can(user, "video:upload")) redirect("/videos");
  const categories = await listVideoCategories();

  return (
    <>
      <PageHeader
        eyebrow="إضافة محتوى مرئي"
        title="رفع فيديو جديد"
        description="ارفع فيديو تدريبياً أو تسجيل شاشة وصنّفه وأضف الوسوم والقسم. تُجهَّز عملية النسخ النصي تلقائياً لاحقاً."
      />
      <UploadForm categories={categories} />
    </>
  );
}
