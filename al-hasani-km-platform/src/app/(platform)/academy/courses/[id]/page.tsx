import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Building2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getCourse } from "@/lib/data/academyRepo";
import { CourseDetailClient } from "@/components/academy/course-detail";
import { LevelBadge } from "@/components/ui";

export const metadata = { title: "تفاصيل الدورة" };

export default async function CoursePage({ params }: { params: { id: string } }) {
  const user = await getSession();
  const course = await getCourse(user, params.id);
  if (!course) notFound();

  return (
    <>
      {/* Hero header */}
      <div className="card relative mb-6 overflow-hidden">
        <div className="relative h-44 bg-surface-2 sm:h-56">
          {course.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.coverImage} alt={course.title} className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-0 start-0 end-0 p-5 sm:p-6">
            <nav className="mb-2 flex items-center gap-1.5 text-2xs text-white/70">
              <Link href="/academy" className="hover:text-white">الأكاديمية</Link>
              <span>/</span>
              <span>{course.categoryName}</span>
            </nav>
            <div className="flex flex-wrap items-center gap-2">
              <LevelBadge level={course.level} />
              {course.departmentName && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-2xs font-medium text-white backdrop-blur-sm">
                  <Building2 className="h-3 w-3" /> {course.departmentName}
                </span>
              )}
            </div>
            <h1 className="mt-2 font-display text-xl font-extrabold text-white sm:text-2xl">{course.title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/80">{course.description}</p>
          </div>
        </div>
      </div>

      <CourseDetailClient course={course} />

      <p className="mt-6 text-center text-2xs text-faint">
        <Link href="/academy" className="inline-flex items-center gap-1 hover:text-ink">
          العودة إلى الأكاديمية <ArrowUpRight className="h-3 w-3" />
        </Link>
      </p>
    </>
  );
}
