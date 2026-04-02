import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Wrench, ClipboardList, CheckCircle2, Clock, DollarSign, AlertTriangle,
  TrendingUp, ArrowLeft, Activity, Package, Bell, ChevronLeft,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getDepartmentClient, getDepartmentTables, normalizeDepartmentVehicleRow } from '../data/supabaseSource';
import type { DepartmentCode } from '../data/department';
import type { MaintenanceRequest, MaintenanceRecord, Vehicle, PeriodicMaintenance } from '../lib/supabaseClient';
import type { PageKey } from '../components/Layout';
import PeriodicMaintenancePanel from '../components/PeriodicMaintenancePanel';

interface Props {
  onNavigate: (page: PageKey) => void;
  department?: DepartmentCode;
}

export default function MaintenanceDashboard({ onNavigate, department = 'tajhiz' }: Props) {
  const supabase = getDepartmentClient(department);
  const tables = getDepartmentTables(department);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [periodic, setPeriodic] = useState<PeriodicMaintenance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [reqRes, recRes, vehRes, perRes] = await Promise.all([
      supabase.from(tables.maintenanceRequests).select('*').order('created_at', { ascending: false }),
      supabase.from(tables.maintenanceRecords).select('*').order('created_at', { ascending: false }),
      supabase.from(tables.vehicles).select('*'),
      supabase.from(tables.periodicMaintenance).select('*'),
    ]);
    if (reqRes.data) setRequests(reqRes.data);
    if (recRes.data) setRecords(recRes.data);
    if (vehRes.data) {
      setVehicles(
        (vehRes.data as Array<Record<string, unknown>>).map((v) => normalizeDepartmentVehicleRow(v)),
      );
    }
    if (perRes.data) setPeriodic(perRes.data);
    setLoading(false);
  }, [supabase, tables]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => {
    const pending = requests.filter(r => r.status === 'pending').length;
    const inProgress = requests.filter(r => r.status === 'in_progress').length;
    const completed = requests.filter(r => r.status === 'completed').length;

    const avgDuration = records.length > 0
      ? Math.round(records.reduce((sum, r) => sum + (r.duration_minutes ?? 0), 0) / records.length)
      : 0;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthlyCost = records
      .filter(r => r.created_at >= monthStart)
      .reduce((sum, r) => sum + Number(r.cost), 0);

    const vehicleCounts: Record<number, number> = {};
    requests.forEach(r => {
      vehicleCounts[r.vehicle_id] = (vehicleCounts[r.vehicle_id] || 0) + 1;
    });
    const topVehicleId = Object.entries(vehicleCounts).sort((a, b) => b[1] - a[1])[0];
    const topVehicle = topVehicleId ? vehicles.find(v => v.id === Number(topVehicleId[0])) : null;

    const overdueCount = periodic.filter(p => p.status === 'overdue').length;

    return { pending, inProgress, completed, avgDuration, monthlyCost, topVehicle, topVehicleCount: topVehicleId?.[1] ?? 0, overdueCount };
  }, [requests, records, vehicles, periodic]);

  const monthlyData = useMemo(() => {
    const months: { label: string; cost: number; count: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.toISOString();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
      const monthRecords = records.filter(r => r.created_at >= start && r.created_at < end);
      months.push({
        label: d.toLocaleDateString('ar-IQ', { month: 'short' }),
        cost: monthRecords.reduce((s, r) => s + Number(r.cost), 0),
        count: monthRecords.length,
      });
    }
    return months;
  }, [records]);

  const maxCost = Math.max(...monthlyData.map(m => m.cost), 1);

  const recentRequests = useMemo(() => requests.slice(0, 5), [requests]);

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    pending:     { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'قيد الانتظار' },
    approved:    { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-400',   label: 'تمت الموافقة' },
    rejected:    { bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-400',     label: 'مرفوض' },
    in_progress: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', label: 'جاري التنفيذ' },
    completed:   { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'مكتمل' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    { label: 'طلبات قيد الانتظار', value: stats.pending, icon: ClipboardList, color: 'from-amber-500 to-orange-600', onClick: () => onNavigate('maintenance-requests') },
    { label: 'مركبات تحت الصيانة', value: stats.inProgress, icon: Activity, color: 'from-blue-500 to-indigo-600', onClick: () => onNavigate('active-maintenance') },
    { label: 'صيانات مكتملة', value: stats.completed, icon: CheckCircle2, color: 'from-emerald-500 to-teal-600', onClick: () => onNavigate('maintenance-history') },
    { label: 'متوسط مدة الصيانة', value: `${stats.avgDuration} د`, icon: Clock, color: 'from-purple-500 to-violet-600' },
    { label: 'تكاليف هذا الشهر', value: `${stats.monthlyCost.toLocaleString()} د.ع`, icon: DollarSign, color: 'from-rose-500 to-pink-600' },
    { label: 'صيانات مستحقة', value: stats.overdueCount, icon: AlertTriangle, color: 'from-red-500 to-rose-600', onClick: () => onNavigate('notifications') },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={card.onClick}
            className={cn(
              'relative overflow-hidden rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 shadow-sm',
              card.onClick && 'cursor-pointer hover:shadow-md transition-shadow',
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-stone-500 dark:text-stone-400 mb-1">{card.label}</p>
                <p className="text-2xl font-bold text-stone-900 dark:text-white">{card.value}</p>
              </div>
              <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg', card.color)}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Most repaired vehicle */}
      {stats.topVehicle && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-rose-500" />
            <h3 className="font-semibold text-stone-900 dark:text-white">أكثر المركبات تعرضاً للأعطال</h3>
          </div>
          <p className="text-stone-600 dark:text-stone-400">
            المركبة <span className="font-bold text-stone-900 dark:text-white">{stats.topVehicle.plate_number}</span>
            {stats.topVehicle.model && <span> ({stats.topVehicle.model})</span>}
            {' — '}
            <span className="text-rose-600 dark:text-rose-400 font-bold">{stats.topVehicleCount}</span> طلب صيانة
          </p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Cost Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 shadow-sm"
        >
          <h3 className="font-semibold text-stone-900 dark:text-white mb-4">تكاليف الصيانة الشهرية</h3>
          <div className="flex items-end gap-2 h-40">
            {monthlyData.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-stone-500 dark:text-stone-400">
                  {m.cost > 0 ? `${(m.cost / 1000).toFixed(0)}k` : '0'}
                </span>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max((m.cost / maxCost) * 100, 4)}%` }}
                  transition={{ delay: 0.4 + i * 0.05, duration: 0.5 }}
                  className="w-full rounded-t-lg bg-gradient-to-t from-blue-600 to-indigo-500 min-h-[4px]"
                />
                <span className="text-[10px] text-stone-500 dark:text-stone-400 mt-1">{m.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Requests */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-stone-900 dark:text-white">آخر طلبات الصيانة</h3>
            <button
              onClick={() => onNavigate('maintenance-requests')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              عرض الكل <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {recentRequests.length === 0 && (
              <p className="text-sm text-stone-400 text-center py-4">لا توجد طلبات صيانة بعد</p>
            )}
            {recentRequests.map(req => {
              const vehicle = vehicles.find(v => v.id === req.vehicle_id);
              const sc = statusConfig[req.status];
              return (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <Wrench className="w-4 h-4 text-stone-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900 dark:text-white truncate">
                        {vehicle?.plate_number ?? `#${req.vehicle_id}`} — {req.maintenance_type}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {new Date(req.created_at).toLocaleDateString('ar-IQ')}
                      </p>
                    </div>
                  </div>
                  <span className={cn('text-xs px-2 py-1 rounded-full font-medium flex-shrink-0', sc?.bg, sc?.text)}>
                    {sc?.label}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Periodic Maintenance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 shadow-sm"
      >
        <h3 className="font-semibold text-stone-900 dark:text-white mb-4">الصيانة الدورية</h3>
        <PeriodicMaintenancePanel department={department} />
      </motion.div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'طلب صيانة جديد', page: 'maintenance-requests' as PageKey, icon: ClipboardList, color: 'text-blue-600' },
          { label: 'الصيانة النشطة', page: 'active-maintenance' as PageKey, icon: Activity, color: 'text-indigo-600' },
          { label: 'قطع الغيار', page: 'spare-parts' as PageKey, icon: Package, color: 'text-emerald-600' },
          { label: 'التنبيهات', page: 'notifications' as PageKey, icon: Bell, color: 'text-amber-600' },
        ].map(link => (
          <motion.button
            key={link.page}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onNavigate(link.page)}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm hover:shadow-md transition-shadow"
          >
            <link.icon className={cn('w-6 h-6', link.color)} />
            <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{link.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
