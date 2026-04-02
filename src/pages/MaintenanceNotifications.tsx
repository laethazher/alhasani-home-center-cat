import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Bell, BellOff, Check, CheckCheck, Wrench, Shield, FileWarning,
  Calendar, Truck, Clock, AlertTriangle, RefreshCw, Loader2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getDepartmentClient, getDepartmentTables, normalizeDepartmentVehicleRow } from '../data/supabaseSource';
import type { DepartmentCode } from '../data/department';
import type { MaintenanceNotification, Vehicle, PeriodicMaintenance } from '../lib/supabaseClient';

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  maintenance_due:       { icon: Wrench,        color: 'text-amber-600',   label: 'موعد صيانة' },
  insurance_expiry:      { icon: Shield,        color: 'text-red-600',     label: 'انتهاء التأمين' },
  inspection_expiry:     { icon: FileWarning,   color: 'text-rose-600',    label: 'انتهاء الفحص' },
  maintenance_completed: { icon: Check,         color: 'text-emerald-600', label: 'صيانة مكتملة' },
};

interface Props {
  department?: DepartmentCode;
}

export default function MaintenanceNotifications({ department = 'tajhiz' }: Props) {
  const supabase = getDepartmentClient(department);
  const tables = getDepartmentTables(department);
  const [notifications, setNotifications] = useState<MaintenanceNotification[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [notifRes, vehRes] = await Promise.all([
      supabase.from(tables.maintenanceNotifications).select('*').order('created_at', { ascending: false }),
      supabase.from(tables.vehicles).select('*'),
    ]);
    if (notifRes.data) setNotifications(notifRes.data);
    if (vehRes.data) {
      setVehicles(
        (vehRes.data as Array<Record<string, unknown>>).map((v) => normalizeDepartmentVehicleRow(v)),
      );
    }
    setLoading(false);
  }, [supabase, tables]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') return notifications.filter(n => !n.is_read);
    return notifications;
  }, [notifications, filter]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  async function markAsRead(id: number) {
    await supabase.from(tables.maintenanceNotifications).update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllAsRead() {
    await supabase.from(tables.maintenanceNotifications).update({ is_read: true }).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  async function generateAlerts() {
    setGenerating(true);
    const today = new Date();
    const warningDays = 30;

    // Check vehicle expiry dates
    for (const v of vehicles) {
      if (v.insurance_expiry) {
        const expiry = new Date(v.insurance_expiry);
        const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
        if (daysLeft <= warningDays && daysLeft > 0) {
          const exists = notifications.some(n =>
            n.vehicle_id === v.id && n.notification_type === 'insurance_expiry' &&
            new Date(n.created_at).toDateString() === today.toDateString()
          );
          if (!exists) {
            await supabase.from(tables.maintenanceNotifications).insert({
              vehicle_id: v.id,
              notification_type: 'insurance_expiry',
              title: 'انتهاء التأمين قريباً',
              message: `المركبة ${v.plate_number}: التأمين ينتهي خلال ${daysLeft} يوم (${v.insurance_expiry})`,
              due_date: v.insurance_expiry,
              target_role: 'admin',
            });
          }
        }
      }

      if (v.license_expiry) {
        const expiry = new Date(v.license_expiry);
        const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
        if (daysLeft <= warningDays && daysLeft > 0) {
          const exists = notifications.some(n =>
            n.vehicle_id === v.id && n.notification_type === 'inspection_expiry' &&
            new Date(n.created_at).toDateString() === today.toDateString()
          );
          if (!exists) {
            await supabase.from(tables.maintenanceNotifications).insert({
              vehicle_id: v.id,
              notification_type: 'inspection_expiry',
              title: 'انتهاء الفحص السنوي قريباً',
              message: `المركبة ${v.plate_number}: الفحص ينتهي خلال ${daysLeft} يوم (${v.license_expiry})`,
              due_date: v.license_expiry,
              target_role: 'admin',
            });
          }
        }
      }
    }

    // Check periodic maintenance
    const { data: periodicItems } = await supabase.from(tables.periodicMaintenance).select('*');
    if (periodicItems) {
      for (const item of periodicItems) {
        if (item.status === 'overdue' || item.status === 'approaching') {
          const v = vehicles.find(v => v.id === item.vehicle_id);
          if (!v) continue;
          const exists = notifications.some(n =>
            n.vehicle_id === v.id && n.notification_type === 'maintenance_due' &&
            n.message?.includes(item.maintenance_type) &&
            new Date(n.created_at).toDateString() === today.toDateString()
          );
          if (!exists) {
            await supabase.from(tables.maintenanceNotifications).insert({
              vehicle_id: v.id,
              notification_type: 'maintenance_due',
              title: item.status === 'overdue' ? 'صيانة مستحقة' : 'صيانة قريبة',
              message: `المركبة ${v.plate_number}: ${item.maintenance_type} ${item.status === 'overdue' ? 'مستحقة الآن' : 'قريبة'}`,
              due_date: item.next_due_date,
              target_role: 'maintenance_manager',
            });
          }
        }
      }
    }

    setGenerating(false);
    fetchData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400',
            )}
          >
            الكل ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              filter === 'unread' ? 'bg-blue-600 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400',
            )}
          >
            غير مقروء ({unreadCount})
          </button>
        </div>
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={generateAlerts}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm font-medium border border-amber-200 dark:border-amber-800"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            فحص التنبيهات
          </motion.button>
          {unreadCount > 0 && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-sm font-medium"
            >
              <CheckCheck className="w-4 h-4" /> تحديد الكل كمقروء
            </motion.button>
          )}
        </div>
      </div>

      {/* Notifications list */}
      <div className="space-y-2">
        {filteredNotifications.length === 0 && (
          <div className="text-center py-16 text-stone-400">
            <BellOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{filter === 'unread' ? 'لا توجد تنبيهات غير مقروءة' : 'لا توجد تنبيهات'}</p>
          </div>
        )}
        {filteredNotifications.map((notif, i) => {
          const typeConf = TYPE_CONFIG[notif.notification_type] ?? TYPE_CONFIG.maintenance_due;
          const vehicle = notif.vehicle_id ? vehicles.find(v => v.id === notif.vehicle_id) : null;
          const Icon = typeConf.icon;
          return (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => !notif.is_read && markAsRead(notif.id)}
              className={cn(
                'rounded-2xl border p-4 cursor-pointer transition-all',
                notif.is_read
                  ? 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 opacity-60'
                  : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 shadow-sm hover:shadow-md',
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  notif.notification_type === 'maintenance_completed'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30'
                    : notif.notification_type === 'maintenance_due'
                    ? 'bg-amber-100 dark:bg-amber-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
                )}>
                  <Icon className={cn('w-5 h-5', typeConf.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-stone-900 dark:text-white text-sm">{notif.title}</h4>
                      {!notif.is_read && <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />}
                    </div>
                    <span className="text-[11px] text-stone-400 flex-shrink-0">
                      {new Date(notif.created_at).toLocaleDateString('ar-IQ')}
                    </span>
                  </div>
                  {notif.message && <p className="text-sm text-stone-600 dark:text-stone-400 mt-0.5">{notif.message}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-stone-400">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                      notif.notification_type === 'maintenance_completed'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : notif.notification_type === 'maintenance_due'
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    )}>
                      {typeConf.label}
                    </span>
                    {vehicle && (
                      <span className="flex items-center gap-1">
                        <Truck className="w-3 h-3" /> {vehicle.plate_number}
                      </span>
                    )}
                    {notif.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {new Date(notif.due_date).toLocaleDateString('ar-IQ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
