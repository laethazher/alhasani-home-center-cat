import { redirect } from "next/navigation";
import { ShieldCheck, TrendingUp, AlertTriangle, GraduationCap, Users } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getComplianceOverview } from "@/lib/data/repository";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardBody, Donut, ProgressBar, Badge, Avatar } from "@/components/ui";
import { Kpi } from "@/components/dashboard/kpi";
import { DeptComplianceChart } from "@/components/dashboard/charts";
import { ComplianceQuiz } from "@/components/compliance/quiz";
import { arNum } from "@/lib/utils";

export const metadata = { title: "مراقبة الامتثال" };

export default async function CompliancePage() {
  const user = (await getSession())!;
  if (!can(user, "compliance:view")) redirect("/dashboard");
  const data = await getComplianceOverview(user);

  return (
    <>
      <PageHeader
        eyebrow="الحوكمة والمتابعة"
        title="مراقبة الامتثال"
        description="متابعة معدلات الاطّلاع والإقرار واجتياز الاختبارات عبر الأقسام، وتحديد المتأخرين عن المتطلبات."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="نسبة الامتثال العامة" value={data.overallRate} suffix="٪" icon={<ShieldCheck className="h-5 w-5" />} tone="ok" />
        <Kpi label="الأقسام المتابَعة" value={data.byDept.length} icon={<Users className="h-5 w-5" />} />
        <Kpi label="موظفون دون الحدّ" value={data.nonCompliant.length} icon={<AlertTriangle className="h-5 w-5" />} tone="warn" />
        <Kpi label="متوسط اجتياز الاختبارات" value={78} suffix="٪" icon={<GraduationCap className="h-5 w-5" />} tone="gold" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Overall donut */}
        <Card>
          <CardHeader title="المؤشّر العام" />
          <CardBody className="flex flex-col items-center gap-4 py-8">
            <Donut value={data.overallRate} />
            <p className="text-center text-xs text-muted">نسبة المستندات المُقَرّ بها من إجمالي المطلوب على مستوى نطاقك.</p>
          </CardBody>
        </Card>

        {/* Dept performance */}
        <Card className="lg:col-span-2">
          <CardHeader title="الأداء حسب القسم" subtitle="نسبة الإقرار لكل قسم" action={<TrendingUp className="h-4 w-4 text-faint" />} />
          <CardBody><DeptComplianceChart data={data.byDept} /></CardBody>
        </Card>
      </div>

      {/* Dept table + non-compliant */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="تفصيل الأقسام" />
          <ul className="divide-y divide-line">
            {data.byDept.map((d) => (
              <li key={d.departmentId} className="px-5 py-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{d.departmentName}</span>
                  <span className="tnum font-semibold text-ink">{arNum(d.rate)}٪</span>
                </div>
                <ProgressBar value={d.rate} tone={d.rate >= 85 ? "ok" : d.rate >= 70 ? "teal" : d.rate >= 60 ? "warn" : "danger"} />
                <p className="mt-1.5 text-2xs text-muted">{arNum(d.acknowledged)} من {arNum(d.assigned)} إقراراً</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="بحاجة إلى متابعة" subtitle="موظفون دون حدّ الامتثال المطلوب" />
          <ul className="divide-y divide-line">
            {data.nonCompliant.map((r) => (
              <li key={r.userId} className="flex items-center gap-3 px-5 py-3.5">
                <Avatar name={r.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{r.name}</p>
                  <p className="text-2xs text-muted">{r.departmentName} · {arNum(r.acknowledged)}/{arNum(r.assigned)} إقرار</p>
                </div>
                <Badge tone={r.rate < 55 ? "danger" : "warn"}>{arNum(r.rate)}٪</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Quiz */}
      <Card className="mt-4">
        <CardHeader title="نظام الاختبارات" subtitle="نموذج اختبار امتثال مرتبط بسياسة معتمدة" action={<Badge tone="teal">تجريبي</Badge>} />
        <CardBody className="mx-auto max-w-2xl">
          <ComplianceQuiz />
        </CardBody>
      </Card>
    </>
  );
}
