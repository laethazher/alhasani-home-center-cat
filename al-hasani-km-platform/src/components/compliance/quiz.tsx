"use client";
import * as React from "react";
import { CheckCircle2, XCircle, RotateCcw, Award } from "lucide-react";
import { Button, ProgressBar } from "@/components/ui";
import { arNum } from "@/lib/utils";

interface Q {
  id: string;
  text: string;
  options: { id: string; text: string; correct: boolean }[];
}

// Sample quiz tied to the security policy (AH-POL-2026-001).
const QUIZ: { title: string; passing: number; questions: Q[] } = {
  title: "اختبار الامتثال: سياسة أمن المعلومات",
  passing: 70,
  questions: [
    {
      id: "q1",
      text: "ما الإجراء المطلوب من جميع الموظفين على حساباتهم وفق التعميم AH-CIR-2026-031؟",
      options: [
        { id: "a", text: "تفعيل المصادقة الثنائية (2FA)", correct: true },
        { id: "b", text: "مشاركة كلمة المرور مع المشرف", correct: false },
        { id: "c", text: "تعطيل قفل الشاشة لتسريع العمل", correct: false },
      ],
    },
    {
      id: "q2",
      text: "عند اكتشاف حادث أمني، ما التصرّف الصحيح؟",
      options: [
        { id: "a", text: "تجاهله إن لم يؤثر على العمل", correct: false },
        { id: "b", text: "الإبلاغ فوراً عبر النموذج المعتمد", correct: true },
        { id: "c", text: "محاولة إصلاحه دون إبلاغ", correct: false },
      ],
    },
    {
      id: "q3",
      text: "أيٌّ ممّا يلي يخالف تعليمات إدارة كلمات المرور؟",
      options: [
        { id: "a", text: "استخدام كلمة مرور فريدة وقوية", correct: false },
        { id: "b", text: "إعادة استخدام كلمة المرور نفسها في عدة أنظمة", correct: true },
        { id: "c", text: "تغيير كلمة المرور دورياً", correct: false },
      ],
    },
  ],
};

export function ComplianceQuiz() {
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [submitted, setSubmitted] = React.useState(false);

  const total = QUIZ.questions.length;
  const correct = QUIZ.questions.filter((q) => {
    const sel = answers[q.id];
    return sel && q.options.find((o) => o.id === sel)?.correct;
  }).length;
  const score = Math.round((correct / total) * 100);
  const passed = score >= QUIZ.passing;
  const allAnswered = Object.keys(answers).length === total;

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className={`grid h-16 w-16 place-items-center rounded-2xl ${passed ? "bg-ok/12 text-ok" : "bg-danger/12 text-danger"}`}>
          {passed ? <Award className="h-8 w-8" /> : <RotateCcw className="h-8 w-8" />}
        </div>
        <div>
          <p className="font-display text-2xl font-extrabold tnum text-ink">{arNum(score)}٪</p>
          <p className="mt-1 text-sm font-semibold text-ink">{passed ? "تهانينا، اجتزت الاختبار" : "لم تجتز الحدّ الأدنى"}</p>
          <p className="text-xs text-muted">أجبت بشكل صحيح عن {arNum(correct)} من {arNum(total)} — حدّ النجاح {arNum(QUIZ.passing)}٪</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setSubmitted(false); setAnswers({}); }}>
          <RotateCcw className="h-4 w-4" /> إعادة المحاولة
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-muted">
          <span>{arNum(Object.keys(answers).length)} / {arNum(total)} مُجابة</span>
          <span>حدّ النجاح {arNum(QUIZ.passing)}٪</span>
        </div>
        <ProgressBar value={(Object.keys(answers).length / total) * 100} />
      </div>

      {QUIZ.questions.map((q, qi) => (
        <div key={q.id}>
          <p className="mb-2.5 text-sm font-semibold text-ink">{arNum(qi + 1)}. {q.text}</p>
          <div className="space-y-2">
            {q.options.map((o) => {
              const selected = answers[q.id] === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-start text-sm transition ${
                    selected ? "border-teal bg-teal-soft text-teal-ink" : "border-line bg-surface hover:bg-surface-2 text-ink"
                  }`}
                >
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-teal bg-teal text-white" : "border-line-strong"}`}>
                    {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </span>
                  {o.text}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <Button className="w-full" disabled={!allAnswered} onClick={() => setSubmitted(true)}>
        إنهاء وإظهار النتيجة
      </Button>
    </div>
  );
}
