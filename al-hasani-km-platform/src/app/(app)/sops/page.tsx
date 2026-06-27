import Link from "next/link";
import { ListChecks, Clock3, ArrowUpLeft, FileCheck2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listSops } from "@/lib/data/repository";
import { PageHeader } from "@/components/shared/page-header";
import { Card, StatusBadge, Badge, EmptyState } from "@/components/ui";
import { arNum, relativeTime } from "@/lib/utils";

export const metadata = { title: "إجراءات العمل" };

export default async function SopsPage() {
  const user = (await getSession())!;
  const sops = await listSops(user);

  return (
    <>
      <PageHeader
        eyebrow="الإجراءات المعيارية"
        title="إجراءات العمل"
        description="خطوات تنفيذية موثّقة بالصور والمقاطع، مع الأخطاء الشائعة والوثائق الرسمية المرتبطة بكل إجراء."
      />

      {sops.length === 0 ? (
        <div className="card"><EmptyState icon={<ListChecks className="h-8 w-8" />} title="لا توجد إجراءات" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sops.map((s) => (
            <Link key={s.id} href={`/sops/${s.id}`} className="card group flex flex-col p-5 transition hover:shadow-pop">
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-soft text-teal-ink">
                  <ListChecks className="h-5 w-5" />
                </div>
                <StatusBadge status={s.status} />
              </div>
              <h3 className="mt-3 font-display text-base font-bold leading-snug text-ink group-hover:text-teal-ink">{s.title}</h3>
              <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-muted">{s.summary}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-2xs text-muted">
                <span className="font-mono" dir="ltr">{s.code}</span>
                <Badge tone="muted">{s.departmentName}</Badge>
                <span className="inline-flex items-center gap-1"><FileCheck2 className="h-3.5 w-3.5" /> {arNum(s.steps.length)} خطوة</span>
                {s.estimatedMinutes && <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {arNum(s.estimatedMinutes)} دقيقة</span>}
                <ArrowUpLeft className="ms-auto h-4 w-4 text-faint" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
