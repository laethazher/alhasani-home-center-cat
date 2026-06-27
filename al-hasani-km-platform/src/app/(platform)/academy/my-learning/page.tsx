import { redirect } from "next/navigation";
import { GraduationCap, Award, Download } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listCourses, listMyCertificates } from "@/lib/data/academyRepo";
import { PageHeader } from "@/components/shared/page-header";
import { Card, EmptyState } from "@/components/ui";
import { CourseCard } from "@/components/academy/course-card";
import { arNum, formatDate } from "@/lib/utils";

export const metadata = { title: "تعلّمي" };

export default async function MyLearningPage() {
  const user = await getSession();
  if (!user) redirect("/login?from=/academy/my-learning");
  const enrolled = await listCourses(user, { mine: true });
  const certificates = await listMyCertificates(user);

  return (
    <>
      <PageHeader
        eyebrow="رحلتي التعليمية"
        title="تعلّمي"
        description="دوراتك المُسجَّلة وتقدّمك والشهادات التي حصلت عليها."
      />

      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-bold text-ink">دوراتي</h2>
        {enrolled.length === 0 ? (
          <div className="card"><EmptyState icon={<GraduationCap className="h-8 w-8" />} title="لم تسجّل في أي دورة بعد" hint="تصفّح دليل الدورات وابدأ التعلّم." /></div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enrolled.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-ink">شهاداتي</h2>
        {certificates.length === 0 ? (
          <div className="card"><EmptyState icon={<Award className="h-8 w-8" />} title="لا توجد شهادات بعد" hint="أكمل دورة للحصول على شهادتها." /></div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {certificates.map((c) => (
              <Card key={c.id} className="flex items-center gap-4 p-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold">
                  <Award className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display text-sm font-bold text-ink">{c.courseTitle}</h3>
                  <p className="mt-0.5 text-2xs text-muted">
                    <span className="font-mono" dir="ltr">{c.serial}</span> · {formatDate(c.issuedAt)}
                    {c.score != null && <> · الدرجة {arNum(c.score)}٪</>}
                  </p>
                </div>
                <button className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-2xs font-semibold text-ink transition hover:bg-surface-2">
                  <Download className="h-3.5 w-3.5" /> تحميل
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
