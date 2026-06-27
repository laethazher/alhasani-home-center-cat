import Link from "next/link";
import { GraduationCap, BookOpen, CheckCircle2, Award, TrendingUp, ArrowUpLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getAcademyOverview } from "@/lib/data/academyRepo";
import { PageHeader } from "@/components/shared/page-header";
import { Card, EmptyState, LevelBadge } from "@/components/ui";
import { CourseCard } from "@/components/academy/course-card";
import { arNum } from "@/lib/utils";

export const metadata = { title: "الأكاديمية" };

export default async function AcademyPage() {
  const user = await getSession();
  const o = await getAcademyOverview(user);

  const kpis = [
    { label: "دوراتي", value: o.enrolled.length, icon: BookOpen, tone: "text-teal-ink bg-teal-soft" },
    { label: "قيد التقدّم", value: o.inProgress, icon: TrendingUp, tone: "text-gold bg-gold/15" },
    { label: "مكتملة", value: o.completed, icon: CheckCircle2, tone: "text-ok bg-ok/12" },
    { label: "الشهادات", value: o.certificates, icon: Award, tone: "text-plum bg-[#5E5275]/12" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="أكاديمية الشركة الذكية"
        title="الأكاديمية"
        description="مسارات تعلّم ودورات مهنية مرتبطة بإجراءات العمل ومكتبة الفيديو، مع تتبّع التقدّم والشهادات."
        actions={
          user ? (
            <Link href="/academy/my-learning" className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-ink transition hover:bg-surface-2">
              <GraduationCap className="h-4 w-4" /> تعلّمي
            </Link>
          ) : (
            <Link href="/register" className="inline-flex items-center gap-1.5 rounded-xl bg-teal px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105">
              <GraduationCap className="h-4 w-4" /> أنشئ حساباً للتعلّم
            </Link>
          )
        }
      />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="flex items-center gap-3 p-4">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${k.tone}`}>
              <k.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="tnum font-display text-2xl font-extrabold text-ink">{arNum(k.value)}</p>
              <p className="text-2xs text-muted">{k.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Learning paths */}
      {o.paths.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg font-bold text-ink">مسارات التعلّم</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {o.paths.map((p) => (
              <div key={p.id} className="card relative flex flex-col overflow-hidden">
                <div className="relative h-32 overflow-hidden bg-surface-2">
                  {p.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverImage} alt={p.title} className="h-full w-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
                  <div className="absolute bottom-3 start-4 end-4 flex items-center justify-between">
                    <h3 className="font-display text-base font-bold text-white">{p.title}</h3>
                    <LevelBadge level={p.level} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-muted">{p.description}</p>
                  <div className="mt-3 flex items-center justify-between text-2xs text-muted">
                    <span>{arNum(p.coursesCount)} دورات{p.departmentName ? ` · ${p.departmentName}` : ""}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Continue learning */}
      {o.enrolled.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink">أكمل التعلّم</h2>
            <Link href="/academy/my-learning" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-ink hover:underline">
              عرض الكل <ArrowUpLeft className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {o.enrolled.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        </section>
      )}

      {/* Catalog */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-ink">دليل الدورات</h2>
        {o.catalog.length === 0 ? (
          <div className="card"><EmptyState icon={<BookOpen className="h-8 w-8" />} title="لا توجد دورات متاحة" /></div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {o.catalog.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        )}
      </section>
    </>
  );
}
