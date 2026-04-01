import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Droplets, Wind, Disc, Search as SearchIcon, Shield, Settings,
  Plus, X, Save, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getDepartmentClient, getDepartmentTables } from '../data/supabaseSource';
import type { DepartmentCode } from '../data/department';
import type { PeriodicMaintenance, Vehicle, PeriodicMaintenanceStatus } from '../lib/supabaseClient';

const PERIODIC_TYPES = [
  { key: 'oil_change',      label: 'تغيير زيت',     icon: Droplets, defaultDays: 90,  defaultKm: 5000 },
  { key: 'oil_filter',      label: 'فلتر زيت',      icon: Settings,  defaultDays: 90,  defaultKm: 5000 },
  { key: 'air_filter',      label: 'فلتر هواء',     icon: Wind,      defaultDays: 180, defaultKm: 15000 },
  { key: 'brake_check',     label: 'فحص الفرامل',   icon: Disc,      defaultDays: 180, defaultKm: 20000 },
  { key: 'full_inspection',  label: 'فحص شامل',     icon: Shield,    defaultDays: 365, defaultKm: 50000 },
];

const STATUS_CONFIG: Record<PeriodicMaintenanceStatus, { bg: string; text: string; border: string; label: string }> = {
  good:        { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-300 dark:border-emerald-700', label: 'جيد' },
  approaching: { bg: 'bg-amber-100 dark:bg-amber-900/30',    text: 'text-amber-700 dark:text-amber-400',    border: 'border-amber-300 dark:border-amber-700',    label: 'قريب' },
  overdue:     { bg: 'bg-red-100 dark:bg-red-900/30',        text: 'text-red-700 dark:text-red-400',        border: 'border-red-300 dark:border-red-700',        label: 'مستحق' },
};

interface Props {
  vehicleId?: number;
  department?: DepartmentCode;
}

export default function PeriodicMaintenancePanel({ vehicleId, department = 'tajhiz' }: Props) {
  const supabase = getDepartmentClient(department);
  const tables = getDepartmentTables(department);
  const [items, setItems] = useState<PeriodicMaintenance[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<number | null>(vehicleId ?? null);
  const [showSetup, setShowSetup] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [itemsRes, vehRes] = await Promise.all([
      supabase.from(tables.periodicMaintenance).select('*'),
      supabase.from(tables.vehicles).select('*'),
    ]);
    if (itemsRes.data) setItems(itemsRes.data);
    if (vehRes.data) setVehicles(vehRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const vehicleItems = useMemo(() => {
    if (!selectedVehicle) return [];
    return items.filter(i => i.vehicle_id === selectedVehicle);
  }, [items, selectedVehicle]);

  const allVehicleStatuses = useMemo(() => {
    const map: Record<number, { good: number; approaching: number; overdue: number }> = {};
    items.forEach(item => {
      if (!map[item.vehicle_id]) map[item.vehicle_id] = { good: 0, approaching: 0, overdue: 0 };
      map[item.vehicle_id][item.status]++;
    });
    return map;
  }, [items]);

  async function setupVehicle(vId: number) {
    setSubmitting(true);
    const existing = items.filter(i => i.vehicle_id === vId);
    const existingTypes = existing.map(i => i.maintenance_type);

    const newItems = PERIODIC_TYPES
      .filter(t => !existingTypes.includes(t.key))
      .map(t => ({
        vehicle_id: vId,
        maintenance_type: t.key,
        interval_days: t.defaultDays,
        interval_km: t.defaultKm,
        status: 'good' as const,
      }));

    if (newItems.length > 0) {
      await supabase.from(tables.periodicMaintenance).insert(newItems);
    }
    setSubmitting(false);
    setShowSetup(false);
    fetchData();
  }

  async function markPerformed(itemId: number) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const today = new Date().toISOString().split('T')[0];
    const nextDate = item.interval_days
      ? new Date(Date.now() + item.interval_days * 86400000).toISOString().split('T')[0]
      : null;

    await supabase.from(tables.periodicMaintenance).update({
      last_performed_at: today,
      next_due_date: nextDate,
      status: 'good',
    }).eq('id', itemId);
    await fetchData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Vehicle selector */}
      {!vehicleId && (
        <div className="flex gap-3 items-center">
          <select
            value={selectedVehicle ?? ''}
            onChange={e => setSelectedVehicle(e.target.value ? Number(e.target.value) : null)}
            className="flex-1 sm:max-w-xs px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm"
          >
            <option value="">اختر المركبة...</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.plate_number} {v.model ? `(${v.model})` : ''}</option>
            ))}
          </select>
          {selectedVehicle && vehicleItems.length === 0 && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setupVehicle(selectedVehicle)}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              إعداد الصيانة الدورية
            </motion.button>
          )}
        </div>
      )}

      {/* Overview grid - all vehicles */}
      {!selectedVehicle && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {vehicles
            .filter(v => allVehicleStatuses[v.id])
            .map(v => {
              const st = allVehicleStatuses[v.id];
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedVehicle(v.id)}
                  className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 text-right hover:shadow-md transition-shadow"
                >
                  <p className="font-semibold text-stone-900 dark:text-white mb-2">{v.plate_number}</p>
                  <div className="flex gap-2">
                    {st.overdue > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">{st.overdue} مستحق</span>
                    )}
                    {st.approaching > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">{st.approaching} قريب</span>
                    )}
                    {st.good > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">{st.good} جيد</span>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      )}

      {/* Vehicle periodic items */}
      {selectedVehicle && vehicleItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {vehicleItems.map(item => {
            const typeInfo = PERIODIC_TYPES.find(t => t.key === item.maintenance_type);
            const sc = STATUS_CONFIG[item.status];
            const Icon = typeInfo?.icon ?? Settings;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn('rounded-2xl border-2 p-4 transition-colors', sc.border, sc.bg)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('w-5 h-5', sc.text)} />
                    <span className="font-semibold text-stone-900 dark:text-white">{typeInfo?.label ?? item.maintenance_type}</span>
                  </div>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', sc.bg, sc.text)}>
                    {sc.label}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-stone-600 dark:text-stone-400">
                  {item.last_performed_at && (
                    <p>آخر صيانة: {new Date(item.last_performed_at).toLocaleDateString('ar-IQ')}</p>
                  )}
                  {item.next_due_date && (
                    <p>الموعد القادم: {new Date(item.next_due_date).toLocaleDateString('ar-IQ')}</p>
                  )}
                  {item.interval_days && <p>كل {item.interval_days} يوم</p>}
                  {item.interval_km && <p>كل {item.interval_km.toLocaleString()} كم</p>}
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => markPerformed(item.id)}
                  className="w-full mt-3 py-2 rounded-xl bg-white/70 dark:bg-stone-800/70 text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-white dark:hover:bg-stone-800 transition-colors border border-stone-200 dark:border-stone-700"
                >
                  تم تنفيذ الصيانة
                </motion.button>
              </motion.div>
            );
          })}
        </div>
      )}

      {selectedVehicle && vehicleItems.length === 0 && !submitting && (
        <div className="text-center py-8 text-stone-400">
          <Settings className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="mb-3">لم يتم إعداد الصيانة الدورية لهذه المركبة</p>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setupVehicle(selectedVehicle)}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium"
          >
            إعداد الصيانة الدورية
          </motion.button>
        </div>
      )}
    </div>
  );
}
