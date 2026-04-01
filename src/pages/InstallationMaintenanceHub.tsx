import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCircle2, ClipboardList, Cog, History, Package, Wrench } from 'lucide-react';
import { getDepartmentClient } from '../data/supabaseSource';

interface MaintenanceCounts {
  pending: number;
  inProgress: number;
  completed: number;
  requestsTotal: number;
  spareParts: number;
  notifications: number;
}

const initialCounts: MaintenanceCounts = {
  pending: 0,
  inProgress: 0,
  completed: 0,
  requestsTotal: 0,
  spareParts: 0,
  notifications: 0,
};

export default function InstallationMaintenanceHub() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<MaintenanceCounts>(initialCounts);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const client = getDepartmentClient('installation');

      const [
        pendingRes,
        inProgressRes,
        completedRes,
        totalRes,
        partsRes,
        notificationsRes,
      ] = await Promise.all([
        client.from('installation_maintenance_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        client.from('installation_maintenance_requests').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
        client.from('installation_maintenance_requests').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        client.from('installation_maintenance_requests').select('*', { count: 'exact', head: true }),
        client.from('installation_spare_parts').select('*', { count: 'exact', head: true }),
        client.from('installation_maintenance_notifications').select('*', { count: 'exact', head: true }),
      ]);

      setCounts({
        pending: pendingRes.count ?? 0,
        inProgress: inProgressRes.count ?? 0,
        completed: completedRes.count ?? 0,
        requestsTotal: totalRes.count ?? 0,
        spareParts: partsRes.count ?? 0,
        notifications: notificationsRes.count ?? 0,
      });
      setLoading(false);
    };

    load();
  }, []);

  const cards = useMemo(
    () => [
      { label: 'طلبات الصيانة', value: counts.requestsTotal, icon: ClipboardList, color: 'from-blue-500 to-indigo-600' },
      { label: 'قيد الانتظار', value: counts.pending, icon: Wrench, color: 'from-amber-500 to-orange-600' },
      { label: 'نشطة حالياً', value: counts.inProgress, icon: Cog, color: 'from-cyan-500 to-sky-600' },
      { label: 'مكتملة', value: counts.completed, icon: CheckCircle2, color: 'from-emerald-500 to-teal-600' },
      { label: 'قطع الغيار', value: counts.spareParts, icon: Package, color: 'from-violet-500 to-purple-600' },
      { label: 'التنبيهات', value: counts.notifications, icon: Bell, color: 'from-rose-500 to-pink-600' },
    ],
    [counts],
  );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-900/50 bg-white dark:bg-stone-900 p-4 md:p-5">
        <h3 className="text-lg font-black text-stone-900 dark:text-white">صيانة قسم التركيب</h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
          تم تفعيل قاعدة بيانات الصيانة الخاصة بقسم التركيب عبر جداول مستقلة. جاري إكمال واجهات: الطلبات، الصيانة النشطة، السجل، قطع الغيار والتنبيهات.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-500 dark:text-stone-400">{card.label}</p>
                <p className="text-2xl font-black text-stone-900 dark:text-white mt-1">
                  {loading ? '...' : card.value}
                </p>
              </div>
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-md`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4">
        <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300 font-semibold">
          <History className="w-4 h-4" />
          المرحلة التالية
        </div>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          الخطوة القادمة هي نسخ واجهات الصيانة من قسم التجهيز بنسبة مطابقة عالية وربطها بجداول
          {' '}
          <span className="font-semibold">installation_*</span>
          {' '}
          فقط.
        </p>
      </div>
    </div>
  );
}
