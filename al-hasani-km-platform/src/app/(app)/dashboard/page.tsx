import Link from "next/link";
import {
  Files,
  CheckCircle2,
  ListChecks,
  Megaphone,
  ArrowUpLeft,
  Clock3,
  AlertTriangle,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { getDashboard } from "@/lib/data/repository";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardBody, Donut, TypeBadge, StatusBadge, EmptyState, Badge } from "@/components/ui";
import { Kpi } from "@/components/dashboard/kpi";
import { TypeBarChart, DeptComplianceChart, TrendChart } from "@/components/dashboard/charts";
import { formatDate, relativeTime, isExpiringSoon, arNum } from "@/lib/utils";

export const metadata = { title: "لوحة المعلومات" };

export default async function DashboardPage() {
  const user = (await getSession())!;
  const d = await getDashboard(user);
  const isExec = user.role === "ADMIN";

  return (
    <>
      <PageHeader
        eyebrow={`أهلاً، ${user.name.split(" ")[0]}`}
        title="لوحة المعلومات"
        description="نظرة شاملة على الوثائق المعتمدة وحالة الامتثال والمهام التي تنتظر إجراءك."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="إجمالي الوثائق" value={d.totals.documents} icon={<Files className="h-5 w-5" />} hint={`${arNum(d.totals.published)} منشورة`} />
        <Kpi label="إجراءات العمل" value={d.totals.sops} icon={<ListChecks className="h-5 w-5" />} tone="gold" />
        <Kpi label="التعاميم" value={d.totals.circulars} icon={<Megaphone className="h-5 w-5" />} tone="warn" />
        <Kpi label="نسبة امتثالك" value={d.myCompliance.rate} suffix="٪" icon={<CheckCircle2 className="h-5 w-5" />} tone="ok" hint={`${arNum(d.myCompliance.pending)} بانتظار الإقرار`} />
      </div>

      {/* Charts row */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="الوثائق حسب النوع" subtitle="توزيع مكتبة المعرفة على أنواع الوثائق" />
          <CardBody><TypeBarChart data={d.byType} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="امتثالك الشخصي" subtitle="نسبة ما أقررت به من المطلوب" />
          <CardBody className="flex flex-col items-center justify-center gap-4 py-8">
            <Donut value={d.myCompliance.rate} />
            <div className="text-center text-xs text-muted">
              أقررت <span className="font-semibold text-ink">{arNum(d.myCompliance.acknowledged)}</span> من
              <span className="font-semibold text-ink"> {arNum(d.myCompliance.assigned)}</span> وثيقة مطلوبة
            </div>
          </CardBody>
        </Card>
      </div>

      {isExec && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="الامتثال حسب القسم" subtitle="نسبة الإقرار في كل قسم" />
            <CardBody><DeptComplianceChart data={d.byDept} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="اتجاه الإقرار" subtitle="آخر ستة أشهر" />
            <CardBody><TrendChart data={d.trend} /></CardBody>
          </Card>
        </div>
      )}

      {/* Lists row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Pending for me */}
        <Card>
          <CardHeader
            title="بانتظار إجراءك"
            subtitle="وثائق تتطلب الاطّلاع أو الإقرار"
            action={<Link href="/documents" className="text-xs font-semibold text-teal-ink hover:underline">الكل</Link>}
          />
          {d.pendingForMe.length ? (
            <ul className="divide-y divide-line">
              {d.pendingForMe.map((doc) => (
                <li key={doc.id}>
                  <Link href={`/documents/${doc.id}`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-surface-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warn/12 text-warn">
                      <Clock3 className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{doc.title}</span>
                      <span className="block text-2xs text-muted">{doc.documentNumber}</span>
                    </span>
                    <ArrowUpLeft className="h-4 w-4 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<CheckCircle2 className="h-8 w-8" />} title="لا مهام معلّقة" hint="أنت مطّلع على كل ما يلزم." />
          )}
        </Card>

        {/* Recent */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="أحدث الوثائق المنشورة"
            action={<Link href="/documents" className="text-xs font-semibold text-teal-ink hover:underline">مكتبة الوثائق</Link>}
          />
          <ul className="divide-y divide-line">
            {d.recent.map((doc) => (
              <li key={doc.id}>
                <Link href={`/documents/${doc.id}`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{doc.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-2xs text-muted">
                      <span className="font-mono" dir="ltr">{doc.documentNumber}</span>
                      <span>·</span>
                      <span>{doc.departmentName}</span>
                      <span>·</span>
                      <span>{relativeTime(doc.updatedAt)}</span>
                    </span>
                  </span>
                  <TypeBadge type={doc.type} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Expiring */}
      {d.expiringSoon.length > 0 && (
        <Card className="mt-4">
          <CardHeader title="وثائق تقترب من تاريخ الانتهاء" subtitle="تحتاج إلى مراجعة أو تجديد" />
          <ul className="divide-y divide-line">
            {d.expiringSoon.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-danger/12 text-danger">
                  <AlertTriangle className="h-[18px] w-[18px]" />
                </span>
                <Link href={`/documents/${doc.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate text-sm font-medium text-ink">{doc.title}</span>
                  <span className="block text-2xs text-muted">ينتهي في {formatDate(doc.expiryDate)}</span>
                </Link>
                {isExpiringSoon(doc.expiryDate, 14) ? (
                  <Badge tone="danger">عاجل</Badge>
                ) : (
                  <Badge tone="warn">قريباً</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
