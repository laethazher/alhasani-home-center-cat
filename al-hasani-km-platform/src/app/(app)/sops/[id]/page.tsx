import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Clock3,
  AlertTriangle,
  PlayCircle,
  XCircle,
  Link2,
  ListChecks,
  ChevronLeft,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { getSop } from "@/lib/data/repository";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardBody, StatusBadge, Badge, SeverityBadge } from "@/components/ui";
import { RELATION_LABEL } from "@/lib/constants";
import { arNum } from "@/lib/utils";

export default async function SopDetailPage({ params }: { params: { id: string } }) {
  const user = (await getSession())!;
  const sop = await getSop(user, params.id);
  if (!sop) notFound();

  return (
    <>
      <Link href="/sops" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
        <ArrowRight className="h-3.5 w-3.5" /> إجراءات العمل
      </Link>

      <PageHeader eyebrow={`إجراء عمل · ${sop.code}`} title={sop.title} description={sop.summary ?? undefined} />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={sop.status} />
        <Badge tone="teal">{sop.departmentName}</Badge>
        <Badge tone="muted">{arNum(sop.steps.length)} خطوة</Badge>
        {sop.estimatedMinutes && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-2xs text-muted">
            <Clock3 className="h-3.5 w-3.5" /> {arNum(sop.estimatedMinutes)} دقيقة
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Steps */}
        <div className="lg:col-span-2">
          {/* Process flow strip */}
          <Card className="mb-5">
            <CardHeader title="مخطّط سير العملية" subtitle="نظرة سريعة على تسلسل الخطوات" />
            <CardBody>
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {sop.steps.map((s, i) => (
                  <div key={s.id} className="flex shrink-0 items-center">
                    <div className="flex min-w-[120px] flex-col items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-center">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-teal text-2xs font-bold text-white">{arNum(s.order)}</span>
                      <span className="line-clamp-2 text-2xs font-medium text-ink">{s.title}</span>
                    </div>
                    {i < sop.steps.length - 1 && <ChevronLeft className="mx-0.5 h-4 w-4 shrink-0 text-faint" />}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Detailed steps */}
          <div className="space-y-5">
            {sop.steps.map((step) => (
              <Card key={step.id} className="overflow-hidden">
                <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal text-sm font-bold text-white">{arNum(step.order)}</span>
                  <h3 className="flex-1 font-display text-[0.95rem] font-bold text-ink">{step.title}</h3>
                  {step.severity !== "LOW" && <SeverityBadge level={step.severity} />}
                </div>
                <CardBody className="space-y-4">
                  {step.imageUrl && (
                    <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-surface-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={step.imageUrl} alt={step.title} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <p className="text-sm leading-loose text-ink/90">{step.description}</p>
                  {step.videoUrl && (
                    <a href={step.videoUrl} className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-xs font-medium text-teal-ink transition hover:border-teal/40">
                      <PlayCircle className="h-5 w-5" /> مشاهدة الفيديو التوضيحي
                    </a>
                  )}
                  {step.warning && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-xs text-warn">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="leading-relaxed">{step.warning}</span>
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Common mistakes */}
          {sop.commonMistakes.length > 0 && (
            <Card>
              <CardHeader title="أخطاء شائعة" subtitle="تجنّبها لضمان الجودة والسلامة" />
              <ul className="divide-y divide-line">
                {sop.commonMistakes.map((m) => (
                  <li key={m.id} className="px-5 py-4">
                    <div className="flex items-start gap-2.5">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{m.description}</p>
                        {m.consequence && <p className="mt-1 text-2xs leading-relaxed text-muted">الأثر: {m.consequence}</p>}
                        <div className="mt-2"><SeverityBadge level={m.severity} /></div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Related official docs */}
          {sop.related && sop.related.length > 0 && (
            <Card>
              <CardHeader title="الوثائق الرسمية المرتبطة" action={<Link2 className="h-4 w-4 text-faint" />} />
              <ul className="divide-y divide-line">
                {sop.related.map((r) => (
                  <li key={r.id}>
                    <Link href={`/documents/${r.id}`} className="block px-5 py-3 transition hover:bg-surface-2">
                      <span className="mb-1 inline-block"><Badge tone="muted">{RELATION_LABEL[r.relation]}</Badge></span>
                      <span className="block truncate text-sm font-medium text-ink">{r.title}</span>
                      <span className="font-mono text-2xs text-muted" dir="ltr">{r.documentNumber}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {sop.documentNumber && (
            <Card>
              <CardBody className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-soft text-teal-ink"><ListChecks className="h-5 w-5" /></span>
                <div className="text-xs">
                  <p className="text-muted">معتمد ضمن الوثيقة</p>
                  <p className="font-mono font-semibold text-ink" dir="ltr">{sop.documentNumber}</p>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
