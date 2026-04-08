import { motion } from 'framer-motion';
import { Activity, ArrowLeft, BarChart3, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

interface OperationsHeroProps {
  onOpenWorkspace: () => void;
}

export default function OperationsHero({ onOpenWorkspace }: OperationsHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-slate-950 text-white shadow-2xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(34,211,238,0.28),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.22),transparent_40%)]" />
      <div className="relative grid gap-6 p-8 md:grid-cols-2 md:items-center md:p-10">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-1 text-xs font-bold tracking-[0.22em] text-cyan-100">
            <Sparkles className="h-3.5 w-3.5" />
            OPERATIONS DEPARTMENT
          </div>
          <h2 className="text-3xl font-black leading-tight md:text-4xl">
            قسم العمليات
            <span className="block text-cyan-300">نظام مستقل داخل النظام</span>
          </h2>
          <p className="text-sm leading-7 text-cyan-100/85 md:text-base">
            واجهة عمليات جديدة بهوية بصرية مختلفة، مصممة لإدارة أعمال العمليات بعزل كامل عن قسم التجهيز وقسم التركيب.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onOpenWorkspace} className="bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400">
              فتح قسم العمليات
              <ArrowLeft className="ms-1 h-4 w-4" />
            </Button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <Card className="border-cyan-400/25 bg-slate-900/70">
            <CardContent className="p-4">
              <p className="text-xs text-cyan-200/80">Monitoring</p>
              <p className="mt-2 flex items-center gap-2 text-lg font-bold">
                <Activity className="h-4 w-4 text-emerald-300" />
                تدفق العمليات
              </p>
            </CardContent>
          </Card>
          <Card className="border-cyan-400/25 bg-slate-900/70">
            <CardContent className="p-4">
              <p className="text-xs text-cyan-200/80">Insights</p>
              <p className="mt-2 flex items-center gap-2 text-lg font-bold">
                <BarChart3 className="h-4 w-4 text-sky-300" />
                مؤشرات الأداء
              </p>
            </CardContent>
          </Card>
          <Card className="border-cyan-400/25 bg-slate-900/70 sm:col-span-2">
            <CardContent className="p-4">
              <p className="text-xs text-cyan-200/80">Security</p>
              <p className="mt-2 flex items-center gap-2 text-lg font-bold">
                <ShieldCheck className="h-4 w-4 text-cyan-200" />
                وصول محمي للأدمن فقط
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
