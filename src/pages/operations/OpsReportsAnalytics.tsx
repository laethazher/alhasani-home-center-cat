import { useCallback, useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import OperationsPageShell from '../../components/operations/OperationsPageShell';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  operationsModulesRepository,
  type OpsDashboardStats,
  type OpsIncident,
  type OpsTask,
} from '../../data/repositories/operationsModulesRepository';

export default function OpsReportsAnalytics() {
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

  return (
    <OperationsPageShell
      title="التقارير والتحليلات"
      subtitle="تحليلات مخصصة لقسم العمليات — مستقلة عن تقارير التجهيز والتركيب"
      icon={BarChart3}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">ملخص تشغيلي</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>مهام مفتوحة: <strong>{stats?.tasksOpen ?? 0}</strong></p>
            <p>بلاغات نشطة: <strong>{stats?.incidentsOpen ?? 0}</strong></p>
            <p>فرق ميدانية: <strong>{stats?.teamsDeployed ?? 0}</strong></p>
            <p>نواقص مخزون: <strong>{stats?.equipmentLowStock ?? 0}</strong></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">آخر المهام</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recentTasks.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد مهام</p> : null}
            {recentTasks.map((t) => (
              <p key={t.id} className="text-sm">{t.title} · <span className="text-muted-foreground">{t.status}</span></p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">آخر البلاغات</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recentIncidents.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد بلاغات</p> : null}
            {recentIncidents.map((i) => (
              <p key={i.id} className="text-sm">{i.title} · <span className="text-muted-foreground">{i.severity}</span></p>
            ))}
          </CardContent>
        </Card>
      </div>
    </OperationsPageShell>
  );
}
