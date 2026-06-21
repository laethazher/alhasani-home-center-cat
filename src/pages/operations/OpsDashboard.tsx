import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, Calendar, ClipboardList, MapPin, Package, Plug, RefreshCw, ScrollText } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import OperationsPageShell from '../../components/operations/OperationsPageShell';
import { Button } from '../../components/ui/button';
import {
  operationsModulesRepository,
  type OpsDashboardStats,
} from '../../data/repositories/operationsModulesRepository';
import type { OperationsPageKey } from './types';

interface OpsDashboardProps {
  onNavigate: (page: OperationsPageKey) => void;
}

const KPI_CONFIG: {
  key: keyof OpsDashboardStats;
  label: string;
  icon: React.ElementType;
  page: OperationsPageKey;
  accent: string;
}[] = [
  { key: 'tasksOpen', label: 'مهام مفتوحة', icon: ClipboardList, page: 'ops-tasks', accent: 'from-cyan-500 to-blue-600' },
  { key: 'tasksUrgent', label: 'مهام عاجلة', icon: AlertTriangle, page: 'ops-tasks', accent: 'from-red-500 to-orange-600' },
  { key: 'teamsDeployed', label: 'فرق ميدانية نشطة', icon: MapPin, page: 'ops-field', accent: 'from-emerald-500 to-teal-600' },
  { key: 'incidentsOpen', label: 'بلاغات مفتوحة', icon: AlertTriangle, page: 'ops-incidents', accent: 'from-amber-500 to-orange-600' },
  { key: 'schedulesToday', label: 'جدول اليوم', icon: Calendar, page: 'ops-scheduling', accent: 'from-violet-500 to-purple-600' },
  { key: 'equipmentLowStock', label: 'نواقص مخزون', icon: Package, page: 'ops-inventory', accent: 'from-pink-500 to-rose-600' },
  { key: 'integrationsActive', label: 'تكاملات نشطة', icon: Plug, page: 'ops-integrations', accent: 'from-sky-500 to-indigo-600' },
  { key: 'lettersUnsigned', label: 'كتب بانتظار التوقيع', icon: ScrollText, page: 'ops-admin-letters', accent: 'from-indigo-500 to-violet-600' },
];

export default function OpsDashboard({ onNavigate }: OpsDashboardProps) {
  const [stats, setStats] = useState<OpsDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await operationsModulesRepository.getDashboardStats());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر تحميل المؤشرات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <OperationsPageShell
      title="لوحة العمليات"
      subtitle="مركز متابعة سير العمل والمؤشرات اليومية لقسم العمليات"
      icon={Activity}
      actions={
        <Button variant="outline" onClick={() => void load()} disabled={loading} className="font-bold">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      }
    >
      {error ? (
        <Card className="border-red-300/50 bg-red-50 dark:bg-red-950/30">
          <CardContent className="p-4 text-sm font-semibold text-red-700 dark:text-red-300">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_CONFIG.map(({ key, label, icon: Icon, page, accent }) => (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate(page)}
            className="text-right transition-transform hover:scale-[1.02]"
          >
            <Card className="overflow-hidden border-cyan-200/40 dark:border-cyan-800/40">
              <CardContent className="p-0">
                <div className={`bg-gradient-to-br ${accent} p-4 text-white`}>
                  <Icon className="h-5 w-5 opacity-90" />
                  <p className="mt-3 text-3xl font-black">{loading ? '—' : (stats?.[key] ?? 0)}</p>
                </div>
                <p className="px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">{label}</p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </OperationsPageShell>
  );
}
