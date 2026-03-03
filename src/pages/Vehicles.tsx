import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, Plus, Search, X, Edit3, Trash2, Wrench, ChevronDown, ChevronUp,
  Calendar, Fuel, Gauge, Shield, AlertTriangle, CheckCircle2, Clock,
  FileText, DollarSign, User, Save, Info, Palette, Activity, XCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import type { Vehicle, VehicleMaintenance, VehicleStatus, StaffMember, ExitRequest } from '../lib/supabaseClient';

/* ── Constants ── */
const VEHICLE_TYPES = ['كانتر', 'كيا'];
const FUEL_TYPES = ['ديزل', 'بنزين', 'كهربائي', 'هجين'];
const COLORS = ['أبيض', 'أسود', 'فضي', 'أحمر', 'أزرق', 'أخضر', 'أصفر', 'رمادي', 'بني', 'برتقالي'];
const MAINTENANCE_TYPES = ['صيانة دورية', 'تغيير زيت', 'تغيير إطارات', 'فحص فرامل', 'إصلاح محرك', 'كهرباء', 'بودي', 'أخرى'];

const STATUS_CONFIG: Record<VehicleStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  available:   { label: 'متاحة',  color: 'text-emerald-700 dark:text-emerald-300', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', icon: CheckCircle2 },
  maintenance: { label: 'صيانة',  color: 'text-amber-700 dark:text-amber-300',     bgColor: 'bg-amber-100 dark:bg-amber-900/30',     icon: Wrench },
  broken:      { label: 'معطلة',  color: 'text-red-700 dark:text-red-300',         bgColor: 'bg-red-100 dark:bg-red-900/30',         icon: XCircle },
  reserved:    { label: 'محجوزة', color: 'text-blue-700 dark:text-blue-300',       bgColor: 'bg-blue-100 dark:bg-blue-900/30',       icon: Shield },
};

/* ── Component ── */
export default function Vehicles() {
  /* State */
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [maintenance, setMaintenance] = useState<VehicleMaintenance[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [exitRequests, setExitRequests] = useState<ExitRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  /* Form state */
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    plate_number: '', model: '', vehicle_type: 'كانتر', color: '', year: '',
    chassis_number: '', fuel_type: 'ديزل', odometer_km: '0', status: 'available' as VehicleStatus,
    license_expiry: '', insurance_expiry: '', image_url: '', notes: '', assigned_driver_id: '',
    has_logo: false,
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  /* Maintenance form state */
  const [showMaintenanceForm, setShowMaintenanceForm] = useState<number | null>(null);
  const [maintenanceData, setMaintenanceData] = useState({
    maintenance_type: 'صيانة دورية', description: '', cost: '', odometer_at: '',
    performed_at: new Date().toISOString().split('T')[0], next_maintenance_date: '',
    next_maintenance_km: '', performed_by: '', notes: '',
  });
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  /* Expanded cards */
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  /* ── Fetch ── */
  const fetchData = useCallback(async () => {
    const [vRes, mRes, sRes, eRes] = await Promise.all([
      supabase.from('vehicles').select('*').order('plate_number'),
      supabase.from('vehicle_maintenance').select('*').order('performed_at', { ascending: false }),
      supabase.from('staff_members').select('*').eq('role', 'driver').eq('is_active', true).order('full_name'),
      supabase.from('exit_requests').select('*').not('vehicle_id', 'is', null).order('created_at', { ascending: false }),
    ]);
    if (vRes.data) setVehicles(vRes.data);
    if (mRes.data) setMaintenance(mRes.data);
    if (sRes.data) setStaff(sRes.data);
    if (eRes.data) setExitRequests(eRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Computed ── */
  const filtered = useMemo(() => {
    let list = vehicles;
    if (statusFilter !== 'all') list = list.filter((v) => v.status === statusFilter);
    if (typeFilter !== 'all') list = list.filter((v) => v.vehicle_type === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((v) =>
        v.plate_number.toLowerCase().includes(q) ||
        (v.model || '').toLowerCase().includes(q) ||
        (v.chassis_number || '').toLowerCase().includes(q) ||
        (v.vehicle_type || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [vehicles, statusFilter, typeFilter, search]);

  const stats = useMemo(() => ({
    total: vehicles.length,
    available: vehicles.filter((v) => v.status === 'available').length,
    maintenance: vehicles.filter((v) => v.status === 'maintenance').length,
    broken: vehicles.filter((v) => v.status === 'broken').length,
    reserved: vehicles.filter((v) => v.status === 'reserved').length,
    expiringSoon: vehicles.filter((v) => {
      if (!v.license_expiry && !v.insurance_expiry) return false;
      const soon = new Date(); soon.setDate(soon.getDate() + 30);
      return (v.license_expiry && new Date(v.license_expiry) <= soon) ||
             (v.insurance_expiry && new Date(v.insurance_expiry) <= soon);
    }).length,
  }), [vehicles]);

  const maintenanceByVehicle = useMemo(() => {
    const map = new Map<number, VehicleMaintenance[]>();
    for (const m of maintenance) {
      if (!map.has(m.vehicle_id)) map.set(m.vehicle_id, []);
      map.get(m.vehicle_id)!.push(m);
    }
    return map;
  }, [maintenance]);

  const driverMap = useMemo(() => new Map(staff.map((s) => [s.id, s.full_name])), [staff]);

  const usageByVehicle = useMemo(() => {
    const map = new Map<number, ExitRequest[]>();
    for (const r of exitRequests) {
      if (!r.vehicle_id) continue;
      if (!map.has(r.vehicle_id)) map.set(r.vehicle_id, []);
      map.get(r.vehicle_id)!.push(r);
    }
    return map;
  }, [exitRequests]);

  /* ── Helpers ── */
  const resetForm = () => {
    setFormData({
    plate_number: '', model: '', vehicle_type: 'كانتر', color: '', year: '',
      chassis_number: '', fuel_type: 'ديزل', odometer_km: '0', status: 'available',
      license_expiry: '', insurance_expiry: '', image_url: '', notes: '', assigned_driver_id: '',
      has_logo: false,
    });
    setEditingVehicle(null);
    setFormError('');
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const openEditForm = (v: Vehicle) => {
    setEditingVehicle(v);
    setFormData({
      plate_number: v.plate_number,
      model: v.model || '',
      vehicle_type: v.vehicle_type || 'كانتر',
      color: v.color || '',
      year: v.year ? String(v.year) : '',
      chassis_number: v.chassis_number || '',
      fuel_type: v.fuel_type || 'ديزل',
      odometer_km: String(v.odometer_km || 0),
      status: v.status,
      license_expiry: v.license_expiry || '',
      insurance_expiry: v.insurance_expiry || '',
      image_url: v.image_url || '',
      notes: v.notes || '',
      assigned_driver_id: v.assigned_driver_id || '',
      has_logo: v.has_logo ?? false,
    });
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  /* ── Save vehicle ── */
  const handleSaveVehicle = async () => {
    if (!formData.plate_number.trim()) { setFormError('رقم اللوحة مطلوب'); return; }
    setSaving(true); setFormError('');

    const payload = {
      plate_number: formData.plate_number.trim(),
      model: formData.model.trim() || null,
      vehicle_type: formData.vehicle_type,
      color: formData.color || null,
      year: formData.year ? Number(formData.year) : null,
      chassis_number: formData.chassis_number.trim() || null,
      fuel_type: formData.fuel_type,
      odometer_km: Number(formData.odometer_km) || 0,
      status: formData.status,
      license_expiry: formData.license_expiry || null,
      insurance_expiry: formData.insurance_expiry || null,
      image_url: formData.image_url.trim() || null,
      notes: formData.notes.trim() || null,
      assigned_driver_id: formData.assigned_driver_id || null,
      has_logo: formData.has_logo,
    };

    if (editingVehicle) {
      const { error } = await supabase.from('vehicles').update(payload).eq('id', editingVehicle.id);
      if (error) { setFormError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('vehicles').insert(payload);
      if (error) {
        if (error.message.includes('duplicate')) setFormError('رقم اللوحة موجود مسبقاً');
        else setFormError(error.message);
        setSaving(false); return;
      }
    }
    await fetchData();
    setShowForm(false); resetForm(); setSaving(false);
  };

  /* ── Delete vehicle ── */
  const handleDelete = async (id: number) => {
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) {
      alert('فشل حذف المركبة: ' + error.message);
    }
    setDeleteConfirm(null);
    await fetchData();
  };

  /* ── Save maintenance ── */
  const handleSaveMaintenance = async () => {
    if (!showMaintenanceForm) return;
    setSavingMaintenance(true);
    const { error } = await supabase.from('vehicle_maintenance').insert({
      vehicle_id: showMaintenanceForm,
      maintenance_type: maintenanceData.maintenance_type,
      description: maintenanceData.description.trim() || null,
      cost: Number(maintenanceData.cost) || 0,
      odometer_at: maintenanceData.odometer_at ? Number(maintenanceData.odometer_at) : null,
      performed_at: maintenanceData.performed_at,
      next_maintenance_date: maintenanceData.next_maintenance_date || null,
      next_maintenance_km: maintenanceData.next_maintenance_km ? Number(maintenanceData.next_maintenance_km) : null,
      performed_by: maintenanceData.performed_by.trim() || null,
      notes: maintenanceData.notes.trim() || null,
    });
    if (!error) {
      await fetchData();
      setShowMaintenanceForm(null);
      setMaintenanceData({
        maintenance_type: 'صيانة دورية', description: '', cost: '', odometer_at: '',
        performed_at: new Date().toISOString().split('T')[0], next_maintenance_date: '',
        next_maintenance_km: '', performed_by: '', notes: '',
      });
    }
    setSavingMaintenance(false);
  };

  /* ── Delete maintenance ── */
  const handleDeleteMaintenance = async (id: number) => {
    await supabase.from('vehicle_maintenance').delete().eq('id', id);
    await fetchData();
  };

  const isExpiringSoon = (dateStr: string | null) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const soon = new Date(); soon.setDate(soon.getDate() + 30);
    return d <= soon;
  };

  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  const totalMaintenanceCost = (vehicleId: number) =>
    (maintenanceByVehicle.get(vehicleId) || []).reduce((sum, m) => sum + Number(m.cost), 0);

  /* ── Render ── */
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">المركبات</h2>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={openAddForm}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> إضافة مركبة
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'الإجمالي', value: stats.total, color: 'bg-stone-100 dark:bg-stone-800', textColor: 'text-stone-700 dark:text-stone-300', icon: Truck },
          { label: 'متاحة', value: stats.available, color: 'bg-emerald-100 dark:bg-emerald-900/30', textColor: 'text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
          { label: 'صيانة', value: stats.maintenance, color: 'bg-amber-100 dark:bg-amber-900/30', textColor: 'text-amber-700 dark:text-amber-300', icon: Wrench },
          { label: 'معطلة', value: stats.broken, color: 'bg-red-100 dark:bg-red-900/30', textColor: 'text-red-700 dark:text-red-300', icon: XCircle },
          { label: 'محجوزة', value: stats.reserved, color: 'bg-blue-100 dark:bg-blue-900/30', textColor: 'text-blue-700 dark:text-blue-300', icon: Shield },
          { label: 'تنتهي قريباً', value: stats.expiringSoon, color: 'bg-orange-100 dark:bg-orange-900/30', textColor: 'text-orange-700 dark:text-orange-300', icon: AlertTriangle },
        ].map((s) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={cn('rounded-xl p-3 text-center', s.color)}>
            <s.icon className={cn('w-5 h-5 mx-auto mb-1', s.textColor)} />
            <p className={cn('text-2xl font-bold', s.textColor)}>{s.value}</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input type="text" placeholder="بحث بالرقم، الموديل، الشاسي..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as VehicleStatus | 'all')}
          className="px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm cursor-pointer">
          <option value="all">كل الحالات</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm cursor-pointer">
          <option value="all">كل الأنواع</option>
          {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* ── Add/Edit Form ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div ref={formRef} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-5 space-y-5 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{editingVehicle ? 'تعديل المركبة' : 'إضافة مركبة جديدة'}</h3>
                <button onClick={() => { setShowForm(false); resetForm(); }}
                  className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700"><X className="w-5 h-5" /></button>
              </div>

              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {formError}
                </div>
              )}

              {/* Basic Info */}
              <div>
                <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2 flex items-center gap-1"><Info className="w-3.5 h-3.5" /> البيانات الأساسية</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">رقم اللوحة *</label>
                    <input type="text" value={formData.plate_number}
                      onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm" placeholder="مثال: 12345 أ" />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">الموديل</label>
                    <input type="text" value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm" placeholder="مثال: تويوتا هايلكس" />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">نوع المركبة</label>
                    <select value={formData.vehicle_type} onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm cursor-pointer">
                      {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">اللون</label>
                    <select value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm cursor-pointer">
                      <option value="">اختر اللون</option>
                      {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">سنة الصنع</label>
                    <input type="number" value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm" placeholder="2024" min="1990" max="2030" />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">رقم الشاسي (VIN)</label>
                    <input type="text" value={formData.chassis_number}
                      onChange={(e) => setFormData({ ...formData, chassis_number: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm" placeholder="رقم الشاسي" />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">نوع الوقود</label>
                    <select value={formData.fuel_type} onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm cursor-pointer">
                      {FUEL_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">عداد الكيلومترات</label>
                    <input type="number" value={formData.odometer_km}
                      onChange={(e) => setFormData({ ...formData, odometer_km: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm" min="0" />
                  </div>
                </div>
              </div>

              {/* Status & Assignment */}
              <div>
                <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2 flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> الحالة والتعيين</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs text-stone-500 mb-1 block">حالة المركبة</label>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <button key={key} onClick={() => setFormData({ ...formData, status: key as VehicleStatus })}
                          className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                            formData.status === key ? cn(cfg.bgColor, cfg.color, 'border-current') : 'border-stone-200 dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-700')}>
                          <cfg.icon className="w-3.5 h-3.5" /> {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">اللوكو</label>
                    <div className="flex gap-2">
                      <button onClick={() => setFormData({ ...formData, has_logo: true })}
                        className={cn('flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium border transition-all',
                          formData.has_logo ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' : 'border-stone-200 dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-700')}>
                        تحتوي
                      </button>
                      <button onClick={() => setFormData({ ...formData, has_logo: false })}
                        className={cn('flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium border transition-all',
                          !formData.has_logo ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700' : 'border-stone-200 dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-700')}>
                        لا تحتوي
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">السائق المسؤول</label>
                    <select value={formData.assigned_driver_id} onChange={(e) => setFormData({ ...formData, assigned_driver_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm cursor-pointer">
                      <option value="">بدون تعيين</option>
                      {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Documents & Dates */}
              <div>
                <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> الوثائق والتواريخ</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">تاريخ انتهاء الرخصة</label>
                    <input type="date" value={formData.license_expiry}
                      onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">تاريخ انتهاء التأمين</label>
                    <input type="date" value={formData.insurance_expiry}
                      onChange={(e) => setFormData({ ...formData, insurance_expiry: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">رابط صورة المركبة</label>
                    <input type="url" value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm" placeholder="https://..." dir="ltr" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-stone-500 mb-1 block">ملاحظات</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2} className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm resize-none" placeholder="ملاحظات إضافية..." />
              </div>

              {/* Save */}
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-600 text-sm hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors">إلغاء</button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleSaveVehicle} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium shadow-lg shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  <Save className="w-4 h-4" /> {saving ? 'جاري الحفظ...' : editingVehicle ? 'تحديث' : 'حفظ'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Vehicle Cards ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
            <Truck className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-bold mb-1">{vehicles.length === 0 ? 'لا توجد مركبات بعد' : 'لا توجد نتائج'}</h3>
          <p className="text-stone-500 dark:text-stone-400 text-sm max-w-xs">
            {vehicles.length === 0 ? 'ابدأ بإضافة المركبات لتتمكن من إدارتها ومتابعة حالتها' : 'جرب تعديل البحث أو الفلاتر'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((v) => {
              const sc = STATUS_CONFIG[v.status];
              const mList = maintenanceByVehicle.get(v.id) || [];
              const uList = usageByVehicle.get(v.id) || [];
              const mCost = totalMaintenanceCost(v.id);
              const licenseExp = isExpired(v.license_expiry);
              const insuranceExp = isExpired(v.insurance_expiry);
              const licenseSoon = !licenseExp && isExpiringSoon(v.license_expiry);
              const insuranceSoon = !insuranceExp && isExpiringSoon(v.insurance_expiry);
              const isExpanded = expandedCards.has(v.id);

              return (
                <motion.div key={v.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn('rounded-2xl border bg-white dark:bg-stone-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden',
                    v.status === 'broken' ? 'border-red-300 dark:border-red-700' :
                    v.status === 'maintenance' ? 'border-amber-300 dark:border-amber-700' :
                    'border-stone-200 dark:border-stone-700')}>

                  {/* Card Header */}
                  <div className="p-4 pb-3">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', sc.bgColor)}>
                          <Truck className={cn('w-5 h-5', sc.color)} />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm">{v.plate_number}</h3>
                          <p className="text-xs text-stone-500 dark:text-stone-400">{v.model || v.vehicle_type || '—'}</p>
                        </div>
                      </div>
                      <span className={cn('px-2.5 py-1 rounded-lg text-xs font-medium', sc.bgColor, sc.color)}>
                        {sc.label}
                      </span>
                    </div>

                    {/* Quick info */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {v.vehicle_type && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                          <Truck className="w-3 h-3" /> {v.vehicle_type}
                        </span>
                      )}
                      {v.color && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                          <Palette className="w-3 h-3" /> {v.color}
                        </span>
                      )}
                      {v.year && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                          <Calendar className="w-3 h-3" /> {v.year}
                        </span>
                      )}
                      {v.fuel_type && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                          <Fuel className="w-3 h-3" /> {v.fuel_type}
                        </span>
                      )}
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                        <Gauge className="w-3 h-3" /> {v.odometer_km.toLocaleString()} كم
                      </span>
                      <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium',
                        v.has_logo ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300')}>
                        لوكو: {v.has_logo ? 'نعم' : 'لا'}
                      </span>
                    </div>

                    {/* Alerts */}
                    {(licenseExp || licenseSoon || insuranceExp || insuranceSoon) && (
                      <div className="mt-2 space-y-1">
                        {licenseExp && (
                          <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" /> الرخصة منتهية!
                          </div>
                        )}
                        {licenseSoon && (
                          <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 font-medium">
                            <Clock className="w-3.5 h-3.5" /> الرخصة تنتهي قريباً ({v.license_expiry})
                          </div>
                        )}
                        {insuranceExp && (
                          <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" /> التأمين منتهي!
                          </div>
                        )}
                        {insuranceSoon && (
                          <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 font-medium">
                            <Clock className="w-3.5 h-3.5" /> التأمين ينتهي قريباً ({v.insurance_expiry})
                          </div>
                        )}
                      </div>
                    )}

                    {/* Driver */}
                    {v.assigned_driver_id && driverMap.has(v.assigned_driver_id) && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                        <User className="w-3.5 h-3.5" /> السائق: {driverMap.get(v.assigned_driver_id)}
                      </div>
                    )}

                    {/* Maintenance summary */}
                    {(mList.length > 0 || uList.length > 0) && (
                      <div className="mt-2 flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
                        {mList.length > 0 && <span className="flex items-center gap-1"><Wrench className="w-3 h-3" /> {mList.length} صيانة</span>}
                        {mCost > 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {mCost.toLocaleString()} د.ع</span>}
                        {uList.length > 0 && <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {uList.length} رحلة</span>}
                      </div>
                    )}
                  </div>

                  {/* Action bar */}
                  <div className="flex items-center border-t border-stone-100 dark:border-stone-700">
                    <button onClick={() => openEditForm(v)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                      <Edit3 className="w-3.5 h-3.5" /> تعديل
                    </button>
                    <div className="w-px h-6 bg-stone-100 dark:bg-stone-700" />
                    <button onClick={() => { setShowMaintenanceForm(v.id); setMaintenanceData((prev) => ({ ...prev, odometer_at: String(v.odometer_km) })); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                      <Wrench className="w-3.5 h-3.5" /> صيانة
                    </button>
                    <div className="w-px h-6 bg-stone-100 dark:bg-stone-700" />
                    <button onClick={() => setExpandedCards((prev) => {
                      const next = new Set(prev);
                      next.has(v.id) ? next.delete(v.id) : next.add(v.id);
                      return next;
                    })}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors">
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
                      <button onClick={() => setDeleteConfirm(v.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> حذف
                      </button>
                    )}
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-stone-100 dark:border-stone-700">
                        <div className="p-4 space-y-3 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div><span className="text-stone-400">رقم الشاسي:</span> <span className="font-medium">{v.chassis_number || '—'}</span></div>
                            <div><span className="text-stone-400">الموديل:</span> <span className="font-medium">{v.model || '—'}</span></div>
                            <div><span className="text-stone-400">الرخصة:</span> <span className={cn('font-medium', licenseExp ? 'text-red-600' : licenseSoon ? 'text-orange-600' : '')}>{v.license_expiry || '—'}</span></div>
                            <div><span className="text-stone-400">التأمين:</span> <span className={cn('font-medium', insuranceExp ? 'text-red-600' : insuranceSoon ? 'text-orange-600' : '')}>{v.insurance_expiry || '—'}</span></div>
                            <div><span className="text-stone-400">آخر تحديث:</span> <span className="font-medium">{new Date(v.updated_at).toLocaleDateString('ar-IQ')}</span></div>
                            <div><span className="text-stone-400">تاريخ الإضافة:</span> <span className="font-medium">{new Date(v.created_at).toLocaleDateString('ar-IQ')}</span></div>
                          </div>
                          {v.notes && <div className="p-2 rounded-lg bg-stone-50 dark:bg-stone-700/50 text-stone-600 dark:text-stone-300">{v.notes}</div>}

                          {/* Maintenance log */}
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
                                        {m.odometer_at && <span>{m.odometer_at.toLocaleString()} كم</span>}
                                        {m.performed_by && <span>بواسطة: {m.performed_by}</span>}
                                      </div>
                                      {m.next_maintenance_date && (
                                        <p className="mt-1 text-blue-500">الصيانة القادمة: {m.next_maintenance_date}</p>
                                      )}
                                    </div>
                                    <button onClick={() => handleDeleteMaintenance(m.id)}
                                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 shrink-0">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Usage history */}
                          {uList.length > 0 && (
                            <div>
                              <p className="font-semibold text-stone-700 dark:text-stone-200 mb-2 flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5" /> سجل الاستخدام ({uList.length})
                              </p>
                              <div className="space-y-2 max-h-60 overflow-y-auto">
                                {uList.slice(0, 10).map((r) => (
                                  <div key={r.id} className="p-2 rounded-lg bg-stone-50 dark:bg-stone-700/50">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">{r.driver_name || '—'}</span>
                                      <span className="text-stone-400">{new Date(r.created_at).toLocaleDateString('ar-IQ')}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-1 text-stone-400">
                                      {r.exit_reason && <span>{r.exit_reason}</span>}
                                      <span>{r.exit_type === 'temporary' ? `مؤقت (${r.exit_duration_minutes || '—'} د)` : 'دائم'}</span>
                                      <span className={cn(
                                        r.status === 'exited' ? 'text-emerald-600' :
                                        r.status === 'approved' ? 'text-blue-600' :
                                        r.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
                                      )}>
                                        {r.status === 'exited' ? 'خرج' : r.status === 'approved' ? 'مُوافق' : r.status === 'rejected' ? 'مرفوض' : 'بانتظار'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                                {uList.length > 10 && (
                                  <p className="text-center text-stone-400 py-1">و {uList.length - 10} رحلة أخرى...</p>
                                )}
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

      {/* ── Maintenance Form Modal ── */}
      <AnimatePresence>
        {showMaintenanceForm !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowMaintenanceForm(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">

              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2"><Wrench className="w-5 h-5 text-amber-600" /> إضافة سجل صيانة</h3>
                <button onClick={() => setShowMaintenanceForm(null)}
                  className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700"><X className="w-5 h-5" /></button>
              </div>

              <p className="text-sm text-stone-500 dark:text-stone-400">
                المركبة: <span className="font-bold text-stone-700 dark:text-stone-200">{vehicles.find((vv) => vv.id === showMaintenanceForm)?.plate_number}</span>
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">نوع الصيانة</label>
                  <select value={maintenanceData.maintenance_type} onChange={(e) => setMaintenanceData({ ...maintenanceData, maintenance_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm cursor-pointer">
                    {MAINTENANCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">التكلفة (د.ع)</label>
                  <input type="number" value={maintenanceData.cost}
                    onChange={(e) => setMaintenanceData({ ...maintenanceData, cost: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm" min="0" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">تاريخ الصيانة</label>
                  <input type="date" value={maintenanceData.performed_at}
                    onChange={(e) => setMaintenanceData({ ...maintenanceData, performed_at: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">عداد الكيلومترات عند الصيانة</label>
                  <input type="number" value={maintenanceData.odometer_at}
                    onChange={(e) => setMaintenanceData({ ...maintenanceData, odometer_at: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm" min="0" />
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">تاريخ الصيانة القادمة</label>
                  <input type="date" value={maintenanceData.next_maintenance_date}
                    onChange={(e) => setMaintenanceData({ ...maintenanceData, next_maintenance_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">الكيلومترات للصيانة القادمة</label>
                  <input type="number" value={maintenanceData.next_maintenance_km}
                    onChange={(e) => setMaintenanceData({ ...maintenanceData, next_maintenance_km: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm" min="0" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-stone-500 mb-1 block">بواسطة (الفني/الورشة)</label>
                  <input type="text" value={maintenanceData.performed_by}
                    onChange={(e) => setMaintenanceData({ ...maintenanceData, performed_by: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm" placeholder="اسم الفني أو الورشة" />
                </div>
              </div>

              <div>
                <label className="text-xs text-stone-500 mb-1 block">الوصف</label>
                <textarea value={maintenanceData.description}
                  onChange={(e) => setMaintenanceData({ ...maintenanceData, description: e.target.value })}
                  rows={2} className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm resize-none" placeholder="وصف العمل المنجز..." />
              </div>

              <div>
                <label className="text-xs text-stone-500 mb-1 block">ملاحظات</label>
                <textarea value={maintenanceData.notes}
                  onChange={(e) => setMaintenanceData({ ...maintenanceData, notes: e.target.value })}
                  rows={2} className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm resize-none" placeholder="ملاحظات إضافية..." />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setShowMaintenanceForm(null)}
                  className="px-5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-600 text-sm hover:bg-stone-50 dark:hover:bg-stone-700">إلغاء</button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleSaveMaintenance} disabled={savingMaintenance}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium shadow-lg shadow-amber-600/25 hover:bg-amber-700 disabled:opacity-50">
                  <Save className="w-4 h-4" /> {savingMaintenance ? 'جاري الحفظ...' : 'حفظ الصيانة'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
