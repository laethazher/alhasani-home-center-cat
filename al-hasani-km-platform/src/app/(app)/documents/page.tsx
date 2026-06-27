import { Plus } from "lucide-react";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listDocuments } from "@/lib/data/repository";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui";
import { DocumentsBrowser } from "@/components/documents/documents-browser";

export const metadata = { title: "مكتبة الوثائق" };

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const user = (await getSession())!;
  const docs = await listDocuments(user);

  return (
    <>
      <PageHeader
        eyebrow="المعرفة المؤسسية"
        title="مكتبة الوثائق"
        description="الكتب الإدارية والتعاميم والسياسات وإجراءات العمل المعتمدة، مع تتبّع حالتك لكل وثيقة."
        actions={
          can(user, "document:create") ? (
            <Link href="/admin?tab=upload">
              <Button size="md"><Plus className="h-4 w-4" /> رفع وثيقة</Button>
            </Link>
          ) : undefined
        }
      />
      <DocumentsBrowser docs={docs} initialQuery={searchParams.q ?? ""} />
    </>
  );
}
