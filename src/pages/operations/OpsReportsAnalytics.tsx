import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  FileSpreadsheet,
  Clock,
  Users,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import OperationsPageShell from '../../components/operations/OperationsPageShell';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  operationsModulesRepository,
  type OpsDashboardStats,
  type OpsIncident,
  type OpsTask,
} from '../../data/repositories/operationsModulesRepository';
import { DailyStaffReport } from './reports';

type ReportView = 'menu' | 'daily' | 'weekly' | 'monthly';

const REPORT_TYPES = [
  {
    id: 'daily' as const,
    title: 'التقارير اليومية',
    description: 'تقرير أوقات دخول وخروج الكادر مفصل حسب المحافظات',
    icon: Calendar,
    color: 'bg-cyan-500',
    available: true,
  },
  {
    id: 'weekly' as const,
    title: 'التقارير الأسبوعية',
    description: 'ملخص أسبوعي للأداء والالتزام',
    icon: CalendarDays,
    color: 'bg-purple-500',
    available: false,
  },
  {
    id: 'monthly' as const,
    title: 'التقارير الشهرية',
    description: 'تحليلات شاملة للشهر مع مقارنات',
    icon: CalendarRange,
    color: 'bg-emerald-500',
    available: false,
  },
];

export default function OpsReportsAnalytics() {
  const [view, setView] = useState<ReportView>('menu');
  const [stats, setStats] = useState<OpsDashboardStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<OpsTask[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<OpsIncident[]>([]);

  const load = useCallback(async () => {
    const [s, tasks, incidents] = await Promise.all([
      operationsModulesRepository.getDashboardStats(),
      operationsModulesRepository.listTasks(),
      operationsModulesRepository.listIncidents(),
    ]);
    setStats(s);
    setRecentTasks(tasks.slice(0, 5));
    setRecentIncidents(incidents.slice(0, 5));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (view === 'daily') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setView('menu')}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          العودة لقائمة التقارير
        </button>
        <DailyStaffReport />
      </div>
    );
  }

  return (
    <OperationsPageShell
      title="التقارير والتحليلات"
      subtitle="تحليلات مخصصة لقسم العمليات — مستقلة عن تقارير التجهيز والتركيب"
      icon={BarChart3}
    >
      <div className="space-y-8">
        {/* Report Types Grid */}
        <div>
          <h3 className="text-lg font-bold mb-4">أنواع التقارير</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {REPORT_TYPES.map((report, idx) => {
              const Icon = report.icon;
              return (
                <motion.button
                  key={report.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => report.available && setView(report.id)}
                  disabled={!report.available}
                  className={cn(
                    'group relative rounded-2xl border p-6 text-right transition-all',
                    report.available
                      ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-cyan-400 dark:hover:border-cyan-500 hover:shadow-lg cursor-pointer'
                      : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 opacity-60 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                        report.available ? report.color : 'bg-slate-300 dark:bg-slate-700'
                      )}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                        {report.title}
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {report.description}
                      </p>
                      {!report.available && (
                        <span className="inline-block mt-2 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded">
                          قريباً
                        </span>
                      )}
                    </div>
                  </div>
                  {report.available && (
                    <div className="absolute inset-0 rounded-2xl border-2 border-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Quick Stats */}
        <div>
          <h3 className="text-lg font-bold mb-4">ملخص سريع</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-cyan-600" />
                  ملخص تشغيلي
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  مهام مفتوحة: <strong>{stats?.tasksOpen ?? 0}</strong>
                </p>
                <p>
                  بلاغات نشطة: <strong>{stats?.incidentsOpen ?? 0}</strong>
                </p>
                <p>
                  فرق ميدانية: <strong>{stats?.teamsDeployed ?? 0}</strong>
                </p>
                <p>
                  نواقص مخزون: <strong>{stats?.equipmentLowStock ?? 0}</strong>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-600" />
                  آخر المهام
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا توجد مهام</p>
                ) : null}
                {recentTasks.map((t) => (
                  <p key={t.id} className="text-sm">
                    {t.title} · <span className="text-muted-foreground">{t.status}</span>
                  </p>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-600" />
                  آخر البلاغات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentIncidents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا توجد بلاغات</p>
                ) : null}
                {recentIncidents.map((i) => (
                  <p key={i.id} className="text-sm">
                    {i.title} · <span className="text-muted-foreground">{i.severity}</span>
                  </p>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </OperationsPageShell>
  );
}
