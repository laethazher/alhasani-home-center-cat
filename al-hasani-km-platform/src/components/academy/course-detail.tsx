"use client";
import * as React from "react";
import Link from "next/link";
import {
  PlayCircle,
  FileText,
  Newspaper,
  HelpCircle,
  CheckCircle2,
  Circle,
  ChevronDown,
  Loader2,
  GraduationCap,
  Award,
} from "lucide-react";
import type { CourseRecord, LessonType } from "@/lib/types";
import { Button, ProgressBar, LevelBadge } from "@/components/ui";
import { LESSON_TYPE_LABEL } from "@/lib/constants";
import { arNum, formatMinutes, cn } from "@/lib/utils";

const LESSON_ICON: Record<LessonType, React.ReactNode> = {
  VIDEO: <PlayCircle className="h-4 w-4" />,
  DOCUMENT: <FileText className="h-4 w-4" />,
  ARTICLE: <Newspaper className="h-4 w-4" />,
  QUIZ: <HelpCircle className="h-4 w-4" />,
};

export function CourseDetailClient({ course }: { course: CourseRecord }) {
  const allLessons = course.modules?.flatMap((m) => m.lessons) ?? [];
  const [done, setDone] = React.useState<Set<string>>(
    new Set(allLessons.filter((l) => l.completed).map((l) => l.id))
  );
  const [status, setStatus] = React.useState(course.enrollment?.status ?? null);
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState<Set<string>>(new Set(course.modules?.map((m) => m.id) ?? []));

  const progress = allLessons.length ? Math.round((done.size / allLessons.length) * 100) : 0;
  const completed = progress === 100;

  async function enroll() {
    setBusy(true);
    try {
      await fetch("/api/academy/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id, action: "ENROLL" }),
      });
      setStatus("IN_PROGRESS");
    } finally {
      setBusy(false);
    }
  }

  async function toggleLesson(lessonId: string) {
    const next = new Set(done);
    const nowComplete = !next.has(lessonId);
    if (nowComplete) next.add(lessonId);
    else next.delete(lessonId);
    setDone(next);
    if (status === null) setStatus("IN_PROGRESS");
    const pct = allLessons.length ? Math.round((next.size / allLessons.length) * 100) : 0;
    fetch("/api/academy/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: course.id, action: "PROGRESS", lessonId, completed: nowComplete, progressPct: pct }),
    }).catch(() => {});
  }

  function toggleModule(id: string) {
    const next = new Set(open);
    next.has(id) ? next.delete(id) : next.add(id);
    setOpen(next);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Curriculum */}
      <div className="space-y-4 lg:col-span-2">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h3 className="font-display text-[0.95rem] font-bold text-ink">محتوى الدورة</h3>
            <span className="text-2xs text-muted">{arNum(allLessons.length)} درساً · {arNum(course.modules?.length ?? 0)} وحدات</span>
          </div>
          <div className="divide-y divide-line">
            {course.modules?.map((m) => (
              <div key={m.id}>
                <button onClick={() => toggleModule(m.id)} className="flex w-full items-center gap-3 px-5 py-3.5 text-start transition hover:bg-surface-2">
                  <ChevronDown className={cn("h-4 w-4 text-faint transition", open.has(m.id) ? "" : "-rotate-90")} />
                  <span className="flex-1 text-sm font-semibold text-ink">{m.title}</span>
                  <span className="text-2xs text-muted">{arNum(m.lessons.filter((l) => done.has(l.id)).length)}/{arNum(m.lessons.length)}</span>
                </button>
                {open.has(m.id) && (
                  <ul className="bg-surface-2/40">
                    {m.lessons.map((l) => {
                      const isDone = done.has(l.id);
                      const enrolled = status !== null;
                      return (
                        <li key={l.id} className="flex items-center gap-3 px-5 py-3 ps-12">
                          <button
                            onClick={() => enrolled && toggleLesson(l.id)}
                            disabled={!enrolled}
                            className={cn("shrink-0 transition", isDone ? "text-ok" : "text-faint hover:text-teal", !enrolled && "cursor-not-allowed opacity-50")}
                            aria-label="تبديل الإكمال"
                          >
                            {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                          </button>
                          <span className="text-faint">{LESSON_ICON[l.type]}</span>
                          <span className="min-w-0 flex-1">
                            <span className={cn("block truncate text-sm", isDone ? "text-muted line-through" : "text-ink")}>{l.title}</span>
                            <span className="text-2xs text-faint">{LESSON_TYPE_LABEL[l.type]} · {arNum(l.durationMinutes)} د</span>
                          </span>
                          {l.videoId && (
                            <Link href={`/videos/${l.videoId}`} className="shrink-0 text-2xs font-semibold text-teal-ink hover:underline">مشاهدة</Link>
                          )}
                          {l.documentId && (
                            <Link href={`/documents/${l.documentId}`} className="shrink-0 text-2xs font-semibold text-teal-ink hover:underline">فتح الوثيقة</Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Side: enroll + progress */}
      <div className="space-y-4">
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <LevelBadge level={course.level} />
            {course.departmentName && <span className="text-2xs text-muted">{course.departmentName}</span>}
          </div>

          {status === null ? (
            <>
              <p className="mb-3 text-sm text-muted">سجّل في الدورة لتتبّع تقدّمك والحصول على الشهادة عند الإكمال.</p>
              <Button className="w-full" size="lg" onClick={enroll} disabled={busy}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><GraduationCap className="h-5 w-5" /> سجّل الآن</>}
              </Button>
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-ink">تقدّمك</span>
                <span className="tnum font-bold text-ink">{arNum(progress)}٪</span>
              </div>
              <ProgressBar value={progress} tone={completed ? "ok" : "teal"} />
              <p className="mt-2 text-2xs text-muted">{arNum(done.size)} من {arNum(allLessons.length)} درساً مكتمل</p>
              {completed && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm font-semibold text-ok">
                  <Award className="h-5 w-5" /> أكملت الدورة — الشهادة جاهزة
                </div>
              )}
            </>
          )}

          <dl className="mt-5 space-y-2 border-t border-line pt-4 text-xs">
            <div className="flex justify-between"><dt className="text-muted">عدد الدروس</dt><dd className="font-medium text-ink">{arNum(allLessons.length)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">المدة التقديرية</dt><dd className="font-medium text-ink">{formatMinutes(allLessons.reduce((s, l) => s + l.durationMinutes, 0))}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">المُعِدّ</dt><dd className="font-medium text-ink">{course.ownerName}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">المسجّلون</dt><dd className="font-medium text-ink">{arNum(course.enrolledCount)}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}
