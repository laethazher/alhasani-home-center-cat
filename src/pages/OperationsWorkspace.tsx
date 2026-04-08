import { Activity, ArrowRight, Database, FileText, ShieldCheck, Wrench } from 'lucide-react';
import type { UserProfile } from '../lib/supabaseClient';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

interface OperationsWorkspaceProps {
  profile: UserProfile;
  onBack: () => void;
  onSignOut: () => void;
  signingOut?: boolean;
}

const MODULES = [
  {
    title: 'لوحة العمليات',
    description: 'مركز متابعة سير العمل والمهام اليومية الخاصة بقسم العمليات.',
    icon: Activity,
  },
  {
    title: 'تقارير العمليات',
    description: 'تحليلات وتقارير مخصصة للعمليات مع إمكانية التوسع لاحقاً.',
    icon: FileText,
  },
  {
    title: 'تكامل الأنظمة',
    description: 'ربط بيانات العمليات الداخلية مع محركات الصيانة والخدمات.',
    icon: Database,
  },
  {
    title: 'ضبط إجراءات التشغيل',
    description: 'قواعد وإعدادات مخصصة لقسم العمليات فقط.',
    icon: Wrench,
  },
];

export default function OperationsWorkspace({
  profile,
  onBack,
  onSignOut,
  signingOut = false,
}: OperationsWorkspaceProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(1000px_520px_at_10%_12%,rgba(14,116,144,0.20),transparent_50%),radial-gradient(900px_500px_at_85%_12%,rgba(6,182,212,0.18),transparent_48%)] p-5 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black tracking-[0.25em] text-cyan-800/80 dark:text-cyan-100/80">
              OPERATIONS CONTROL
            </p>
            <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white md:text-3xl">قسم العمليات</h1>
            <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{profile.full_name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}>
              <ArrowRight className="h-4 w-4" />
              رجوع للأقسام
            </Button>
            <Button variant="destructive" onClick={onSignOut} disabled={signingOut}>
              تسجيل الخروج
            </Button>
          </div>
        </div>

        <Card className="border-cyan-400/30 bg-slate-950 text-white shadow-xl">
          <CardContent className="flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs tracking-[0.2em] text-cyan-200/80">ISOLATED MODE</p>
              <h2 className="mt-2 text-xl font-black md:text-2xl">بيئة تشغيل معزولة بالكامل</h2>
              <p className="mt-2 text-sm text-cyan-100/80">
                كل جداول وبيانات قسم العمليات منفصلة تماماً عن باقي الأقسام.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm font-bold">
              <ShieldCheck className="h-4 w-4" />
              Admin Access Only
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {MODULES.map((module) => (
            <Card key={module.title} className="border-cyan-200/40 bg-white/85 backdrop-blur dark:bg-slate-900/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <module.icon className="h-5 w-5 text-cyan-600" />
                  {module.title}
                </CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full justify-center font-bold">
                  قريباً
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
