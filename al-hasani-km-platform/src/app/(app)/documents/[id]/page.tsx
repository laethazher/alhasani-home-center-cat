import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FileText,
  Download,
  History,
  Paperclip,
  Link2,
  Users,
  Eye,
  BookOpenCheck,
  CheckCircle2,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { getDocument } from "@/lib/data/repository";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardHeader,
  CardBody,
  TypeBadge,
  StatusBadge,
  ConfidentialityBadge,
  Badge,
  ProgressBar,
} from "@/components/ui";
import { AcknowledgeButton } from "@/components/documents/acknowledge-button";
import { RELATION_LABEL, DOC_TYPE_LABEL } from "@/lib/constants";
import { formatDate, formatBytes, arNum } from "@/lib/utils";

export default async function DocumentDetailPage({ params }: { params: { id: string } }) {
  const user = (await getSession())!;
  const doc = await getDocument(user, params.id);
  if (!doc) notFound();

  const isManager = can(user, "compliance:view");
  const v = doc.versions?.[0];

  return (
    <>
      <Link href="/documents" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
        <ArrowRight className="h-3.5 w-3.5" /> مكتبة الوثائق
      </Link>

      <PageHeader
        eyebrow={DOC_TYPE_LABEL[doc.type]}
        title={doc.title}
        actions={
          <a href={v?.fileUrl ?? "#"} className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal px-4 text-sm font-medium text-white transition hover:brightness-95">
            <Download className="h-4 w-4" /> تنزيل النسخة المعتمدة
          </a>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-line bg-surface px-2.5 py-1 font-mono text-xs text-muted" dir="ltr">{doc.documentNumber}</span>
        <TypeBadge type={doc.type} />
        <StatusBadge status={doc.status} />
        <ConfidentialityBadge level={doc.confidentiality} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main */}
        <div className="space-y-5 lg:col-span-2">
          {/* Summary */}
          {doc.summary && (
            <Card>
              <CardHeader title="الملخّص التنفيذي" />
              <CardBody>
                <p className="text-sm leading-loose text-ink/90">{doc.summary}</p>
                {doc.keywords.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {doc.keywords.map((k) => (
                      <span key={k} className="rounded-lg bg-surface-2 px-2.5 py-1 text-2xs text-muted">#{k}</span>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* PDF preview */}
          <Card>
            <CardHeader title="معاينة الوثيقة" subtitle={v ? `${v.fileName} · ${arNum(doc.pageCount)} صفحة` : undefined} />
            <CardBody>
              <div className="flex aspect-[1/0.62] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface-2">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-danger/10 text-danger">
                  <FileText className="h-8 w-8" />
                </div>
                <p className="text-sm font-medium text-ink">{v?.fileName ?? "الملف المعتمد"}</p>
                <p className="text-2xs text-faint">تُعرض معاينة الـ PDF هنا (مكوّن العارض المدمج). النص مفهرس بالكامل عبر OCR.</p>
                <a href={v?.fileUrl ?? "#"} className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-ink hover:underline">
                  فتح في عارض كامل <Download className="h-3.5 w-3.5" />
                </a>
              </div>
            </CardBody>
          </Card>

          {/* Acknowledge */}
          {doc.status === "PUBLISHED" && doc.ack && (
            <Card>
              <CardBody className="bg-teal-soft/40">
                <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
                  <BookOpenCheck className="h-5 w-5 text-teal-ink" /> الإقرار بالاطّلاع
                </p>
                <AcknowledgeButton documentId={doc.id} initial={doc.ack} />
              </CardBody>
            </Card>
          )}

          {/* Versions */}
          {doc.versions && doc.versions.length > 0 && (
            <Card>
              <CardHeader title="سجلّ الإصدارات" subtitle="تتبّع التغييرات عبر النسخ" action={<History className="h-4 w-4 text-faint" />} />
              <ul className="divide-y divide-line">
                {doc.versions.map((ver, idx) => (
                  <li key={ver.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-xs font-bold ${idx === 0 ? "bg-teal text-white" : "bg-surface-2 text-muted"}`}>
                      v{arNum(ver.versionNumber)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{ver.changeNote ?? "تحديث"}</p>
                      <p className="text-2xs text-muted">{ver.uploadedByName} · {formatDate(ver.createdAt)} · {formatBytes(ver.fileSize)}</p>
                    </div>
                    {idx === 0 && <Badge tone="ok">الحالية</Badge>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Meta */}
          <Card>
            <CardHeader title="التفاصيل" />
            <CardBody className="space-y-3 text-sm">
              <Meta icon={<Users className="h-4 w-4" />} label="الجهة المالكة" value={doc.ownerName} />
              <Meta icon={<FileText className="h-4 w-4" />} label="القسم" value={doc.departmentName} />
              <Meta icon={<Calendar className="h-4 w-4" />} label="تاريخ النفاذ" value={formatDate(doc.effectiveDate)} />
              <Meta icon={<Calendar className="h-4 w-4" />} label="تاريخ الانتهاء" value={formatDate(doc.expiryDate)} />
            </CardBody>
          </Card>

          {/* Reach (managers/admin) */}
          {isManager && doc.reach && doc.reach.total > 0 && (
            <Card>
              <CardHeader title="مدى الوصول والإقرار" subtitle={`${arNum(doc.reach.total)} موظف مستهدف`} />
              <CardBody className="space-y-4">
                <ReachRow icon={<Eye className="h-4 w-4" />} label="اطّلعوا" value={doc.reach.viewed} total={doc.reach.total} tone="warn" />
                <ReachRow icon={<BookOpenCheck className="h-4 w-4" />} label="قرؤوا" value={doc.reach.read} total={doc.reach.total} tone="teal" />
                <ReachRow icon={<CheckCircle2 className="h-4 w-4" />} label="أقرّوا" value={doc.reach.acknowledged} total={doc.reach.total} tone="ok" />
              </CardBody>
            </Card>
          )}

          {/* Related */}
          {doc.related && doc.related.length > 0 && (
            <Card>
              <CardHeader title="وثائق ذات صلة" action={<Link2 className="h-4 w-4 text-faint" />} />
              <ul className="divide-y divide-line">
                {doc.related.map((r) => (
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

          {/* Attachments */}
          {doc.attachments && doc.attachments.length > 0 && (
            <Card>
              <CardHeader title="المرفقات" action={<Paperclip className="h-4 w-4 text-faint" />} />
              <ul className="divide-y divide-line">
                {doc.attachments.map((a) => (
                  <li key={a.id}>
                    <a href={a.fileUrl} className="flex items-center gap-3 px-5 py-3 transition hover:bg-surface-2">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted"><Paperclip className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{a.name}</span>
                        <span className="text-2xs text-faint">{formatBytes(a.fileSize)}</span>
                      </span>
                      <Download className="h-4 w-4 text-faint" />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-muted"><span className="text-faint">{icon}</span>{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

function ReachRow({ icon, label, value, total, tone }: { icon: React.ReactNode; label: string; value: number; total: number; tone: "teal" | "ok" | "warn" }) {
  const pct = Math.round((value / total) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted">{icon}{label}</span>
        <span className="tnum font-semibold text-ink">{arNum(value)} <span className="text-faint">({arNum(pct)}٪)</span></span>
      </div>
      <ProgressBar value={pct} tone={tone} />
    </div>
  );
}
