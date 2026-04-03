import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, Plus, X, Edit3, Trash2, Wrench, ChevronDown, ChevronUp,
  CheckCircle2, Clock, AlertTriangle, Save, User, MapPin, Gauge, History,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getDepartmentClient } from '../data/supabaseSource';
import {
  SmartSearchBar,
  InsightsPanel,
  ChartsPanel,
  insightsFromVehicles,
} from '../smart';
import InstallationVehicleHistory from './InstallationVehicleHistory';

type InstallationStatus = 'available' | 'maintenance' | 'broken' | 'reserved';
type InstallationVehicleType = 'starex' | 'nissan';

interface InstallationStaff {
  id: number;
  full_name: string;
  is_active: boolean;
}

interface InstallationVehicle {
  id: number;
  vehicle_number: string;
  vehicle_type: InstallationVehicleType;
  model: string | null;
  color: string | null;
  year: number | null;
  chassis_number: string | null;
  status: InstallationStatus;
  location: string | null;
  responsible_staff_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface InstallationMaintenance {
  id: number;
  vehicle_id: number;
  maintenance_type: string;
  description: string | null;
  cost: number;
  performed_at: string;
  next_maintenance_date: string | null;
  performed_by: string | null;
}

const STATUS_CONFIG: Record<InstallationStatus, { label: string; color: string; bgColor: string }> = {
  available: { label: 'متاحة', color: 'text-emerald-700 dark:text-emerald-300', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' },
  maintenance: { label: 'صيانة', color: 'text-amber-700 dark:text-amber-300', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  broken: { label: 'معطلة', color: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  reserved: { label: 'محجوزة', color: 'text-blue-700 dark:text-blue-300', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
};

const VEHICLE_TYPE_LABEL: Record<InstallationVehicleType, string> = {
  starex: 'ستاركس',
  nissan: 'نيسان',
};

interface InstallationVehiclesProps {
  isDarkMode: boolean;
}

export default function InstallationVehicles({ isDarkMode }: InstallationVehiclesProps) {
  const supabase = getDepartmentClient('installation');

  const [vehicles, setVehicles] = useState<InstallationVehicle[]>([]);
  const [staff, setStaff] = useState<InstallationStaff[]>([]);
  const [maintenance, setMaintenance] = useState<InstallationMaintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InstallationStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<InstallationVehicleType | 'all'>('all');

  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<InstallationVehicle | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [historyVehicleId, setHistoryVehicleId] = useState<number | null>(null);

  const [showMaintenanceForm, setShowMaintenanceForm] = useState<number | null>(null);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [maintenanceData, setMaintenanceData] = useState({
    maintenance_type: 'صيانة دورية',
    description: '',
    cost: '',
    performed_at: new Date().toISOString().split('T')[0],
    next_maintenance_date: '',
    performed_by: '',
  });

  const [formData, setFormData] = useState({
    vehicle_number: '',
    vehicle_type: 'starex' as InstallationVehicleType,
    model: '',
    color: '',
    year: '',
    chassis_number: '',
    status: 'available' as InstallationStatus,
    location: '',
    responsible_staff_id: '',
    notes: '',
  });

  const formRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    const [vRes, sRes, mRes] = await Promise.all([
      supabase.from('installation_vehicles').select('*').order('vehicle_number'),
      supabase.from('installation_staff_members').select('id,full_name,is_active').eq('is_active', true).order('full_name'),
      supabase.from('installation_vehicle_maintenance').select('*').order('performed_at', { ascending: false }),
    ]);
    if (vRes.data) setVehicles(vRes.data as InstallationVehicle[]);
    if (sRes.data) setStaff(sRes.data as InstallationStaff[]);
    if (mRes.data) setMaintenance(mRes.data as InstallationMaintenance[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const staffMap = useMemo(() => new Map(staff.map((s) => [s.id, s.full_name])), [staff]);

  const filtered = useMemo(() => {
    let list = vehicles;
    if (statusFilter !== 'all') list = list.filter((v) => v.status === statusFilter);
    if (typeFilter !== 'all') list = list.filter((v) => v.vehicle_type === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((v) =>
        v.vehicle_number.toLowerCase().includes(q) ||
        (v.location || '').toLowerCase().includes(q) ||
        (v.model || '').toLowerCase().includes(q) ||
        (v.chassis_number || '').toLowerCase().includes(q) ||
        (staffMap.get(v.responsible_staff_id || -1) || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [vehicles, statusFilter, typeFilter, search, staffMap]);

  const stats = useMemo(() => ({
    total: vehicles.length,
    available: vehicles.filter((v) => v.status === 'available').length,
    maintenance: vehicles.filter((v) => v.status === 'maintenance').length,
    broken: vehicles.filter((v) => v.status === 'broken').length,
    reserved: vehicles.filter((v) => v.status === 'reserved').length,
    starex: vehicles.filter((v) => v.vehicle_type === 'starex').length,
    nissan: vehicles.filter((v) => v.vehicle_type === 'nissan').length,
  }), [vehicles]);

  const maintenanceByVehicle = useMemo(() => {
    const map = new Map<number, InstallationMaintenance[]>();
    for (const m of maintenance) {
      if (!map.has(m.vehicle_id)) map.set(m.vehicle_id, []);
      map.get(m.vehicle_id)!.push(m);
    }
    return map;
  }, [maintenance]);

  const vehicleInsights = useMemo(
    () => insightsFromVehicles(filtered.map((v) => ({ status: v.status }))),
    [filtered]
  );

  const vehicleDataSuggestions = useMemo(
    () => [
      ...vehicles.map((v) => v.vehicle_number),
      ...staff.map((s) => s.full_name),
    ].slice(0, 50),
    [vehicles, staff]
  );

  const openAddForm = () => {
    setEditingVehicle(null);
    setFormData({
      vehicle_number: '',
      vehicle_type: 'starex',
      model: '',
      color: '',
      year: '',
      chassis_number: '',
      status: 'available',
      location: '',
      responsible_staff_id: '',
      notes: '',
    });
    setFormError('');
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const openEditForm = (v: InstallationVehicle) => {
    setEditingVehicle(v);
    setFormData({
      vehicle_number: v.vehicle_number,
      vehicle_type: v.vehicle_type,
      model: v.model || '',
      color: v.color || '',
      year: v.year ? String(v.year) : '',
      chassis_number: v.chassis_number || '',
      status: v.status,
      location: v.location || '',
      responsible_staff_id: v.responsible_staff_id ? String(v.responsible_staff_id) : '',
      notes: v.notes || '',
    });
    setFormError('');
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleSaveVehicle = async () => {
    if (!formData.vehicle_number.trim()) {
      setFormError('رقم المركبة مطلوب');
      return;
    }
    setSaving(true);
    setFormError('');
    const payload = {
      vehicle_number: formData.vehicle_number.trim(),
      vehicle_type: formData.vehicle_type,
      model: formData.model.trim() || null,
      color: formData.color.trim() || null,
      year: formData.year ? Number(formData.year) : null,
      chassis_number: formData.chassis_number.trim() || null,
      status: formData.status,
      location: formData.location.trim() || null,
      responsible_staff_id: formData.responsible_staff_id ? Number(formData.responsible_staff_id) : null,
      notes: formData.notes.trim() || null,
    };

    if (editingVehicle) {
      const oldStaffName = editingVehicle.responsible_staff_id ? staffMap.get(editingVehicle.responsible_staff_id) || 'غير معروف' : 'بدون فني';
      const newStaffName = payload.responsible_staff_id ? staffMap.get(payload.responsible_staff_id) || 'غير معروف' : 'بدون فني';
      const oldStatusLabel = STATUS_CONFIG[editingVehicle.status].label;
      const newStatusLabel = STATUS_CONFIG[payload.status].label;
      const { error } = await supabase.from('installation_vehicles').update(payload).eq('id', editingVehicle.id);
      if (error) {
        setFormError(error.message);
        setSaving(false);
        return;
      }
      const events: Array<{ vehicle_id: number; event_type: string; description: string; old_value: string | null; new_value: string | null }> = [];
      if (editingVehicle.responsible_staff_id !== payload.responsible_staff_id) {
        events.push({
          vehicle_id: editingVehicle.id,
          event_type: 'responsible_changed',
          description: `تغيّر الفني المسؤول من ${oldStaffName} إلى ${newStaffName}`,
          old_value: oldStaffName,
          new_value: newStaffName,
        });
      }
      if (editingVehicle.status !== payload.status) {
        events.push({
          vehicle_id: editingVehicle.id,
          event_type: 'status_changed',
          description: `تغيّرت الحالة من ${oldStatusLabel} إلى ${newStatusLabel}`,
          old_value: oldStatusLabel,
          new_value: newStatusLabel,
        });
      }
      if (events.length > 0) await supabase.from('installation_vehicle_events').insert(events);
    } else {
      const { data, error } = await supabase.from('installation_vehicles').insert(payload).select('id').single();
      if (error) {
        setFormError(error.message.includes('duplicate') ? 'رقم المركبة موجود مسبقاً' : error.message);
        setSaving(false);
        return;
      }
      if (data?.id) {
        await supabase.from('installation_vehicle_events').insert({
          vehicle_id: data.id,
          event_type: 'created',
          description: 'تم إنشاء مركبة جديدة لقسم التركيب',
          old_value: null,
          new_value: payload.vehicle_number,
        });
      }
    }
    await fetchData();
    setShowForm(false);
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from('installation_vehicles').delete().eq('id', id);
    if (error) {
      alert('فشل حذف المركبة: ' + error.message);
      return;
    }
    setDeleteConfirm(null);
    await fetchData();
  };

  const handleSaveMaintenance = async () => {
    if (!showMaintenanceForm) return;
    setSavingMaintenance(true);
    const { error } = await supabase.from('installation_vehicle_maintenance').insert({
      vehicle_id: showMaintenanceForm,
      maintenance_type: maintenanceData.maintenance_type,
      description: maintenanceData.description.trim() || null,
      cost: Number(maintenanceData.cost) || 0,
      performed_at: maintenanceData.performed_at,
      next_maintenance_date: maintenanceData.next_maintenance_date || null,
      performed_by: maintenanceData.performed_by.trim() || null,
    });
    if (!error) {
      await fetchData();
      setShowMaintenanceForm(null);
      setMaintenanceData({
        maintenance_type: 'صيانة دورية',
        description: '',
        cost: '',
        performed_at: new Date().toISOString().split('T')[0],
        next_maintenance_date: '',
        performed_by: '',
      });
    }
    setSavingMaintenance(false);
  };

  const handleDeleteMaintenance = async (id: number) => {
    await supabase.from('installation_vehicle_maintenance').delete().eq('id', id);
    await fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (historyVehicleId !== null) {
    return (
      <InstallationVehicleHistory vehicleId={historyVehicleId} onBack={() => setHistoryVehicleId(null)} />
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">مركبات قسم التركيب</h2>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={openAddForm}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> إضافة مركبة
        </motion.button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'الإجمالي', value: stats.total, cls: 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300' },
          { label: 'متاحة', value: stats.available, cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
          { label: 'صيانة', value: stats.maintenance, cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
          { label: 'معطلة', value: stats.broken, cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
          { label: 'محجوزة', value: stats.reserved, cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
          { label: 'ستاركس', value: stats.starex, cls: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' },
          { label: 'نيسان', value: stats.nissan, cls: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' },
        ].map((s) => (
          <div key={s.label} className={cn('rounded-xl p-3 text-center', s.cls)}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[220px] max-w-xl">
          <SmartSearchBar
            pageKey="vehicles"
            value={search}
            onChange={setSearch}
            placeholder="بحث برقم المركبة، الفني، الموقع..."
            dataSuggestions={vehicleDataSuggestions}
            showPredictiveChips={false}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InstallationStatus | 'all')}
          className="px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm cursor-pointer"
        >
          <option value="all">كل الحالات</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as InstallationVehicleType | 'all')}
          className="px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm cursor-pointer"
        >
          <option value="all">كل الأنواع</option>
          <option value="starex">ستاركس</option>
          <option value="nissan">نيسان</option>
        </select>
      </div>

      <InsightsPanel metrics={vehicleInsights.metrics} alerts={vehicleInsights.alerts} />
      <ChartsPanel barData={vehicleInsights.bar} pieData={vehicleInsights.pie} />

      <AnimatePresence>
        {showForm && (
          <motion.div
            ref={formRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-5 space-y-5 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{editingVehicle ? 'تعديل مركبة التركيب' : 'إضافة مركبة تركيب'}</h3>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">رقم المركبة *</label>
                  <input
                    value={formData.vehicle_number}
                    onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm"
                    placeholder="مثال: 40001 1 أ"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">نوع المركبة</label>
                  <select
                    value={formData.vehicle_type}
                    onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value as InstallationVehicleType })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm cursor-pointer"
                  >
                    <option value="starex">ستاركس</option>
                    <option value="nissan">نيسان</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">الموقع</label>
                  <input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm"
                    placeholder="اسم المحافظة"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">الفني المسؤول</label>
                  <select
                    value={formData.responsible_staff_id}
                    onChange={(e) => setFormData({ ...formData, responsible_staff_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm cursor-pointer"
                  >
                    <option value="">بدون مسؤول</option>
                    {staff.map((s) => (
                      <option key={s.id} value={String(s.id)}>{s.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">الحالة</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as InstallationStatus })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm cursor-pointer"
                  >
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">الموديل</label>
                  <input
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">اللون</label>
                  <input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">سنة الصنع</label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">الشاسي</label>
                  <input
                    value={formData.chassis_number}
                    onChange={(e) => setFormData({ ...formData, chassis_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">ملاحظات</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm resize-none"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-600 text-sm hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors">
                  إلغاء
                </button>
                <button
                  onClick={handleSaveVehicle}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <Save className="w-4 h-4" /> {saving ? 'جاري الحفظ...' : editingVehicle ? 'تحديث' : 'حفظ'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
            <Truck className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold mb-1">لا توجد مركبات مطابقة</h3>
          <p className="text-stone-500 dark:text-stone-400 text-sm max-w-xs">جرّب تعديل البحث أو الفلاتر أو أضف مركبة جديدة.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((v) => {
              const sc = STATUS_CONFIG[v.status];
              const isExpanded = expandedCards.has(v.id);
              const mList = maintenanceByVehicle.get(v.id) || [];
              return (
                <motion.div
                  key={v.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-2xl border bg-white dark:bg-stone-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden border-stone-200 dark:border-stone-700"
                >
                  <div className="p-4 pb-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className={cn('px-2.5 py-1 rounded-lg text-xs font-medium', sc.bgColor, sc.color)}>{sc.label}</span>
                      <span className="text-xs font-medium text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-700 px-2.5 py-1 rounded-lg">
                        {VEHICLE_TYPE_LABEL[v.vehicle_type]}
                      </span>
                    </div>
                    <div className="font-black text-lg text-stone-900 dark:text-white mb-2">{v.vehicle_number}</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
                        <User className="w-3.5 h-3.5" />
                        <span>الفني المسؤول: {v.responsible_staff_id ? staffMap.get(v.responsible_staff_id) || 'غير معروف' : 'بدون مسؤول'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>الموقع: {v.location || 'غير محدد'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
                        <Gauge className="w-3.5 h-3.5" />
                        <span>الموديل: {v.model || '—'}</span>
                      </div>
                    </div>
                    {mList.length > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                        <Clock className="w-3.5 h-3.5" /> {mList.length} سجل صيانة
                      </div>
                    )}
                  </div>

                  <div className="flex items-center border-t border-stone-100 dark:border-stone-700 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setHistoryVehicleId(v.id)}
                      className="flex-1 min-w-[4.5rem] flex items-center justify-center gap-1.5 py-2.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      <History className="w-3.5 h-3.5" /> السجل
                    </button>
                    <div className="w-px h-6 bg-stone-100 dark:bg-stone-700 hidden sm:block" />
                    <button onClick={() => openEditForm(v)} className="flex-1 min-w-[4.5rem] flex items-center justify-center gap-1.5 py-2.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                      <Edit3 className="w-3.5 h-3.5" /> تعديل
                    </button>
                    <div className="w-px h-6 bg-stone-100 dark:bg-stone-700" />
                    <button
                      onClick={() => setShowMaintenanceForm(v.id)}
                      className="flex-1 min-w-[4.5rem] flex items-center justify-center gap-1.5 py-2.5 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                    >
                      <Wrench className="w-3.5 h-3.5" /> صيانة
                    </button>
                    <div className="w-px h-6 bg-stone-100 dark:bg-stone-700" />
                    <button
                      onClick={() => setExpandedCards((prev) => {
                        const next = new Set(prev);
                        next.has(v.id) ? next.delete(v.id) : next.add(v.id);
                        return next;
                      })}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {isExpanded ? 'أقل' : 'المزيد'}
                    </button>
                    <div className="w-px h-6 bg-stone-100 dark:bg-stone-700" />
                    {deleteConfirm === v.id ? (
                      <div className="flex-1 flex items-center justify-center gap-1">
                        <button onClick={() => handleDelete(v.id)} className="px-2 py-1 text-xs text-red-600 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 rounded">تأكيد</button>
                        <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 text-xs text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700 rounded">إلغاء</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(v.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> حذف
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-stone-100 dark:border-stone-700"
                      >
                        <div className="p-4 space-y-3 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div><span className="text-stone-400">الشاسي:</span> <span className="font-medium">{v.chassis_number || '—'}</span></div>
                            <div><span className="text-stone-400">اللون:</span> <span className="font-medium">{v.color || '—'}</span></div>
                            <div><span className="text-stone-400">السنة:</span> <span className="font-medium">{v.year || '—'}</span></div>
                            <div><span className="text-stone-400">آخر تحديث:</span> <span className="font-medium">{new Date(v.updated_at).toLocaleDateString('ar-IQ')}</span></div>
                          </div>
                          {v.notes && <div className="p-2 rounded-lg bg-stone-50 dark:bg-stone-700/50 text-stone-600 dark:text-stone-300">{v.notes}</div>}
                          {mList.length > 0 && (
                            <div>
                              <p className="font-semibold text-stone-700 dark:text-stone-200 mb-2 flex items-center gap-1.5">
                                <Wrench className="w-3.5 h-3.5" /> سجل الصيانة ({mList.length})
                              </p>
                              <div className="space-y-2 max-h-60 overflow-y-auto">
                                {mList.map((m) => (
                                  <div key={m.id} className="flex items-start justify-between p-2 rounded-lg bg-stone-50 dark:bg-stone-700/50">
                                    <div>
                                      <p className="font-medium">{m.maintenance_type}</p>
                                      {m.description && <p className="text-stone-500 dark:text-stone-400 mt-0.5">{m.description}</p>}
                                      <div className="flex flex-wrap gap-3 mt-1 text-stone-400">
                                        <span>{m.performed_at}</span>
                                        {Number(m.cost) > 0 && <span>{Number(m.cost).toLocaleString()} د.ع</span>}
                                        {m.performed_by && <span>بواسطة: {m.performed_by}</span>}
                                      </div>
                                      {m.next_maintenance_date && <p className="mt-1 text-blue-500">الصيانة القادمة: {m.next_maintenance_date}</p>}
                                    </div>
                                    <button onClick={() => handleDeleteMaintenance(m.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 shrink-0">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showMaintenanceForm !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowMaintenanceForm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2"><Wrench className="w-5 h-5 text-amber-600" /> إضافة سجل صيانة</h3>
                <button onClick={() => setShowMaintenanceForm(null)} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">نوع الصيانة</label>
                  <input
                    value={maintenanceData.maintenance_type}
                    onChange={(e) => setMaintenanceData({ ...maintenanceData, maintenance_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">التكلفة (د.ع)</label>
                  <input
                    type="number"
                    value={maintenanceData.cost}
                    onChange={(e) => setMaintenanceData({ ...maintenanceData, cost: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">تاريخ الصيانة</label>
                  <input
                    type="date"
                    value={maintenanceData.performed_at}
                    onChange={(e) => setMaintenanceData({ ...maintenanceData, performed_at: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">تاريخ الصيانة القادمة</label>
                  <input
                    type="date"
                    value={maintenanceData.next_maintenance_date}
                    onChange={(e) => setMaintenanceData({ ...maintenanceData, next_maintenance_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-stone-500 mb-1 block">بواسطة (الفني/الورشة)</label>
                  <input
                    value={maintenanceData.performed_by}
                    onChange={(e) => setMaintenanceData({ ...maintenanceData, performed_by: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">الوصف</label>
                <textarea
                  rows={2}
                  value={maintenanceData.description}
                  onChange={(e) => setMaintenanceData({ ...maintenanceData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm resize-none"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowMaintenanceForm(null)} className="px-5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-600 text-sm hover:bg-stone-50 dark:hover:bg-stone-700">
                  إلغاء
                </button>
                <button
                  onClick={handleSaveMaintenance}
                  disabled={savingMaintenance}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium shadow-lg shadow-amber-600/25 hover:bg-amber-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> {savingMaintenance ? 'جاري الحفظ...' : 'حفظ الصيانة'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
