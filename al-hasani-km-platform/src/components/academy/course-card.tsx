import Link from "next/link";
import { PlayCircle, Users, Clock3 } from "lucide-react";
import type { CourseRecord } from "@/lib/types";
import { LevelBadge, EnrollmentBadge, ProgressBar } from "@/components/ui";
import { arNum, formatMinutes } from "@/lib/utils";

export function CourseCard({ course }: { course: CourseRecord }) {
  return (
    <Link href={`/academy/courses/${course.id}`} className="card group flex flex-col overflow-hidden transition hover:shadow-pop">
      <div className="relative aspect-video overflow-hidden bg-surface-2">
        {course.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.coverImage} alt={course.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
        <div className="absolute bottom-0 start-0 end-0 flex items-center justify-between p-3">
          <LevelBadge level={course.level} />
          {course.categoryName && (
            <span className="rounded-lg bg-black/40 px-2 py-1 text-2xs font-medium text-white backdrop-blur-sm">{course.categoryName}</span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-[0.95rem] font-bold leading-snug text-ink group-hover:text-teal-ink">{course.title}</h3>
        <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-muted">{course.description}</p>

        {course.enrollment ? (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-2xs">
              <EnrollmentBadge status={course.enrollment.status} />
              <span className="tnum font-semibold text-ink">{arNum(course.enrollment.progressPct)}٪</span>
            </div>
            <ProgressBar value={course.enrollment.progressPct} tone={course.enrollment.status === "COMPLETED" ? "ok" : "teal"} />
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-3 border-t border-line pt-3 text-2xs text-muted">
            <span className="inline-flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5" /> {arNum(course.lessonsCount)} درس</span>
            <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {formatMinutes(course.durationMinutes || course.lessonsCount * 7)}</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {arNum(course.enrolledCount)}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
