import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, Plus, X, Edit3, Trash2, Wrench, ChevronDown, ChevronUp,
  Calendar, Fuel, Gauge, Shield, AlertTriangle, CheckCircle2, Clock,
  FileText, DollarSign, User, Save, Info, Palette, Activity, XCircle,
  History,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import type { Vehicle, VehicleMaintenance, VehicleStatus, StaffMember, ExitRequest } from '../lib/supabaseClient';
import type { UserProfile } from '../lib/supabaseClient';
import VehicleHistory from './VehicleHistory';
import { DRIVER_VEHICLE_PDF_ROWS } from '../data/driverVehiclePdfData';
import { exportHtmlToPdf } from '../lib/pdfExport';
import { exportToExcel } from '../lib/excelExport';
import { Download, Loader2 as Loader2Icon, Printer, FileSpreadsheet } from 'lucide-react';
import {
  SmartSearchBar,
  HighlightText,
  InsightsPanel,
  ChartsPanel,
  ExportMenu,
  SavedViews,
  useAutoRefresh,
  insightsFromVehicles,
} from '../smart';

// دالة تقسيم رقم اللوحة
function splitPlateNumber(plate: string) {
  const parts = plate.trim().split(' ');
  if (parts.length === 3) {
    return { vehicleNumber: parts[0], provinceNumber: parts[1], plateLetter: parts[2] };
  }
  if (parts.length === 2) {
    return { vehicleNumber: parts[0], provinceNumber: '', plateLetter: parts[1] };
  }
  return { vehicleNumber: plate, provinceNumber: '', plateLetter: '' };
}

function exitRequestStatusLabelAr(status: string): string {
  if (status === 'exited') return 'خرج';
  if (status === 'approved') return 'مُوافق';
  if (status === 'rejected') return 'مرفوض';
  if (status === 'pending_issue') return 'مشكلة تحميل';
  if (status === 'approved_override') return 'مسموح (تجاوز)';
  if (status === 'pending') return 'بانتظار';
  return status || 'بانتظار';
}

function exitRequestStatusTextClass(status: string): string {
  if (status === 'exited') return 'text-emerald-600';
  if (status === 'approved') return 'text-blue-600';
  if (status === 'rejected') return 'text-red-600';
  if (status === 'pending_issue') return 'text-orange-600';
  if (status === 'approved_override') return 'text-sky-600';
  return 'text-amber-600';
}

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
interface VehiclesProps {
  profile?: UserProfile | null;
}

const isReserveVehicle = (vehicle: Vehicle) =>
  vehicle.status === 'available' && !vehicle.assigned_driver_id;

export default function Vehicles({ profile }: VehiclesProps) {
  /* State */
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [importingPdf, setImportingPdf] = useState(false);
  const [importPdfError, setImportPdfError] = useState('');
  const [maintenance, setMaintenance] = useState<VehicleMaintenance[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [exitRequests, setExitRequests] = useState<ExitRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'all' | 'reserve'>('all');


  /* Form state */
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    vehicleNumber: '', // رقم المركبة
    provinceNumber: '', // رقم المحافظة
    plateLetter: '',   // الحرف
    vehicle_type: 'كانتر', color: '', year: '',
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
  const [historyVehicleId, setHistoryVehicleId] = useState<number | null>(null);

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
  const driverMap = useMemo(() => new Map(staff.map((s) => [String(s.id), s.full_name])), [staff]);
  const filtered = useMemo(() => {
    let list = vehicles;
    if (statusFilter === 'reserve') {
      list = list.filter(isReserveVehicle);
    } else if (statusFilter !== 'all') {
      list = list.filter((v) => v.status === statusFilter);
      if (statusFilter === 'available') {
        list = list.filter((v) => !isReserveVehicle(v));
      }
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((v) =>
        v.plate_number.toLowerCase().includes(q) ||
        (v.chassis_number || '').toLowerCase().includes(q) ||
        (v.vehicle_type || '').toLowerCase().includes(q) ||
        (driverMap.get(String(v.assigned_driver_id)) || '').toLowerCase().includes(q) ||
        (isReserveVehicle(v) && (
          'احتياط'.includes(q) ||
          'بدون تعيين'.includes(q) ||
          'غير معين'.includes(q)
        ))
      );
    }
    return list;
  }, [vehicles, statusFilter, search, driverMap]);

  const vehicleInsights = useMemo(
    () => insightsFromVehicles(filtered.map((v) => ({ status: v.status }))),
    [filtered]
  );

  const vehicleDataSuggestions = useMemo(
    () =>
      [
        ...vehicles.map((v) => v.plate_number),
        ...staff.map((s) => s.full_name),
      ].slice(0, 50),
    [vehicles, staff]
  );

  useAutoRefresh(30_000, fetchData, true);

  const stats = useMemo(() => ({
    total: vehicles.length,
    available: vehicles.filter((v) => v.status === 'available' && !isReserveVehicle(v)).length,
    reserve: vehicles.filter(isReserveVehicle).length,
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
      vehicleNumber: '',
      provinceNumber: '',
      plateLetter: '',
      vehicle_type: 'كانتر', color: '', year: '',
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
    // تقسيم رقم اللوحة عند التعديل
    let vehicleNumber = '', provinceNumber = '', plateLetter = '';
    if (v.plate_number) {
      // توقع الشكل: رقم مركبة [فراغ] رقم محافظة [فراغ] حرف
      const parts = v.plate_number.trim().split(' ');
      if (parts.length === 3) {
        vehicleNumber = parts[0];
        provinceNumber = parts[1];
        plateLetter = parts[2];
      } else if (parts.length === 2) {
        vehicleNumber = parts[0];
        plateLetter = parts[1];
      } else {
        vehicleNumber = v.plate_number;
      }
    }
    setFormData({
      vehicleNumber,
      provinceNumber,
      plateLetter,
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
    if (!formData.vehicleNumber.trim() || !formData.plateLetter.trim() || !formData.provinceNumber.trim()) {
      setFormError('جميع أجزاء رقم اللوحة مطلوبة');
      return;
    }
    setSaving(true); setFormError('');

    const payload = {
      plate_number: `${formData.vehicleNumber.trim()} ${formData.provinceNumber.trim()} ${formData.plateLetter.trim()}`,
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

      /* ── Auto-log changes to vehicle_events ── */
      const events: { vehicle_id: number; event_type: string; description: string; old_value: string | null; new_value: string | null }[] = [];

      // Driver change
      const oldDriverId = editingVehicle.assigned_driver_id ? String(editingVehicle.assigned_driver_id) : null;
      const newDriverId = payload.assigned_driver_id ? String(payload.assigned_driver_id) : null;
      if (oldDriverId !== newDriverId) {
        const oldName = oldDriverId ? (driverMap.get(oldDriverId) || oldDriverId) : 'بدون سائق';
        const newName = newDriverId ? (driverMap.get(newDriverId) || newDriverId) : 'بدون سائق';
        if (oldDriverId && newDriverId) {
          events.push({ vehicle_id: editingVehicle.id, event_type: 'driver_removed', description: `تم إزالة السائق ${oldName}`, old_value: oldName, new_value: null });
          events.push({ vehicle_id: editingVehicle.id, event_type: 'driver_assigned', description: `تم تعيين السائق ${newName}`, old_value: null, new_value: newName });
        } else if (newDriverId) {
          events.push({ vehicle_id: editingVehicle.id, event_type: 'driver_assigned', description: `تم تعيين السائق ${newName}`, old_value: null, new_value: newName });
        } else {
          events.push({ vehicle_id: editingVehicle.id, event_type: 'driver_removed', description: `تم إزالة السائق ${oldName}`, old_value: oldName, new_value: null });
        }
      }

      // Status change
      if (editingVehicle.status !== payload.status) {
        const oldLabel = STATUS_CONFIG[editingVehicle.status]?.label || editingVehicle.status;
        const newLabel = STATUS_CONFIG[payload.status as VehicleStatus]?.label || payload.status;
        events.push({ vehicle_id: editingVehicle.id, event_type: 'status_changed', description: `تغيّرت الحالة من ${oldLabel} إلى ${newLabel}`, old_value: oldLabel, new_value: newLabel });
      }

      // License renewal
      if (editingVehicle.license_expiry !== payload.license_expiry && payload.license_expiry) {
        events.push({ vehicle_id: editingVehicle.id, event_type: 'license_renewed', description: `تم تجديد الرخصة حتى ${payload.license_expiry}`, old_value: editingVehicle.license_expiry || null, new_value: payload.license_expiry });
      }

      // Insurance renewal
      if (editingVehicle.insurance_expiry !== payload.insurance_expiry && payload.insurance_expiry) {
        events.push({ vehicle_id: editingVehicle.id, event_type: 'insurance_renewed', description: `تم تجديد التأمين حتى ${payload.insurance_expiry}`, old_value: editingVehicle.insurance_expiry || null, new_value: payload.insurance_expiry });
      }

      // Odometer update
      if ((editingVehicle.odometer_km || 0) !== (Number(payload.odometer_km) || 0)) {
        events.push({ vehicle_id: editingVehicle.id, event_type: 'odometer_updated', description: `تحديث عداد المسافة من ${editingVehicle.odometer_km || 0} إلى ${payload.odometer_km}`, old_value: String(editingVehicle.odometer_km || 0), new_value: String(payload.odometer_km) });
      }

      if (events.length > 0) {
        await supabase.from('vehicle_events').insert(events);
      }
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

  /* Selection state */
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<number[]>([]);

  const toggleSelectAll = () => {
    if (selectedVehicleIds.length === filtered.length) {
      setSelectedVehicleIds([]);
    } else {
      setSelectedVehicleIds(filtered.map((v) => v.id));
    }
  };

  const toggleVehicleSelection = (id: number) => {
    setSelectedVehicleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedVehicleIds.length === 0) return;
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedVehicleIds.length} مركبة؟`)) return;
    setSaving(true);
    try {
      await supabase.from('vehicles').delete().in('id', selectedVehicleIds);
      setSelectedVehicleIds([]);
      setIsSelectionMode(false);
      await fetchData();
    } catch (e) {
      alert('فشل الحذف');
    } finally {
      setSaving(false);
    }
  };

  /* ── Export ── */
  const exportExcel = () => {
    const toExport = isSelectionMode && selectedVehicleIds.length > 0
      ? filtered.filter((v) => selectedVehicleIds.includes(v.id))
      : filtered;

    if (toExport.length === 0) {
      alert('لا توجد مركبات للتصدير');
      return;
    }

    const headers = ['رقم اللوحة', 'السائق المسؤول', 'الحالة', 'نوع المركبة', 'اللون', 'سنة الصنع', 'العداد (كم)', 'نوع الوقود', 'رقم الشاسي', 'انتهاء الرخصة', 'انتهاء التأمين', 'تكلفة الصيانة'];
    const rows = toExport.map(v => [
      v.plate_number,
      driverMap.get(String(v.assigned_driver_id)) || 'غير معين',
      STATUS_CONFIG[v.status]?.label || v.status,
      v.vehicle_type || '—',
      v.color || '—',
      v.year || '—',
      v.odometer_km,
      v.fuel_type || '—',
      v.chassis_number || '—',
      v.license_expiry || '—',
      v.insurance_expiry || '—',
      totalMaintenanceCost(v.id)
    ]);
    const filename = `تقرير_المركبات_${new Date().toISOString().slice(0,10)}`;
    exportToExcel([headers, ...rows], filename, 'المركبات');
  };

  const exportPDF = async () => {
    const toExport = isSelectionMode && selectedVehicleIds.length > 0
      ? filtered.filter((v) => selectedVehicleIds.includes(v.id))
      : filtered;

    if (toExport.length === 0) {
      alert('لا توجد مركبات للتصدير');
      return;
    }

    const headers = ['رقم اللوحة', 'السائق', 'الحالة', 'النوع', 'العداد', 'الرخصة'];
    const rows = toExport.map(v => [
      v.plate_number,
      (driverMap.get(String(v.assigned_driver_id)) || '').slice(0, 15),
      STATUS_CONFIG[v.status]?.label || v.status,
      v.vehicle_type || '—',
      `${v.odometer_km.toLocaleString()} كم`,
      v.license_expiry || '—'
    ]);

    let html = `
      <h1 style="text-align:center;font-size:22px;margin-bottom:12px">تقرير قائمة المركبات</h1>
      <p style="text-align:center;color:#666;margin-bottom:20px">تاريخ التصدير: ${new Date().toLocaleDateString('ar-IQ')} | عدد المركبات: ${toExport.length}</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="background:#3b82f6;color:#fff">
          ${headers.map(h => `<th style="padding:8px;text-align:right">${h}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${rows.map((row, i) => `
            <tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}">
              ${row.map(cell => `<td style="padding:6px 8px;border:1px solid #ddd">${cell}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    try {
      await exportHtmlToPdf(`<div dir="rtl">${html}</div>`, `قائمة_المركبات_${Date.now()}.pdf`);
    } catch (e) {
      console.error(e);
      alert('فشل تصدير PDF: ' + (e instanceof Error ? e.message : 'خطأ غير معروف'));
    }
  };

  /* ── استيراد بيانات المركبات 1 (من PDF) إلى Supabase ── */
  const handleImportPdfData = useCallback(async () => {
    if (profile?.role !== 'admin') return;
    setImportingPdf(true);
    setImportPdfError('');
    try {
      const nameToId = new Map<string, string>();
      for (const row of DRIVER_VEHICLE_PDF_ROWS) {
        const { driverName, vehicleNumber } = row;
        const isReserve = driverName === 'احتياط' || driverName === 'احتياط زیرو';
        let driverId: string | null = null;
        if (!isReserve) {
          if (nameToId.has(driverName)) {
            driverId = nameToId.get(driverName)!;
          } else {
            const { data: existing } = await supabase
              .from('staff_members')
              .select('id')
              .eq('full_name', driverName)
              .eq('role', 'driver')
              .limit(1)
              .maybeSingle();
            if (existing?.id) {
              driverId = String(existing.id);
              nameToId.set(driverName, driverId);
            } else {
              const { data: inserted, error: insertErr } = await supabase
                .from('staff_members')
                .insert({ full_name: driverName, role: 'driver', is_active: true })
                .select('id')
                .single();
              if (insertErr) throw new Error(`إضافة السائق ${driverName}: ${insertErr.message}`);
              if (!inserted?.id) throw new Error(`إضافة السائق ${driverName}: لم يُرجَع معرف.`);
              driverId = String(inserted.id);
              nameToId.set(driverName, driverId);
            }
          }
        }
        const plateNumber = `${vehicleNumber} 0 أ`;
        const { error: vehicleErr } = await supabase
          .from('vehicles')
          .upsert(
            {
              plate_number: plateNumber,
              assigned_driver_id: driverId,
              vehicle_type: 'كانتر',
              status: 'available',
            },
            { onConflict: 'plate_number' }
          );
        if (vehicleErr) throw new Error(`إضافة المركبة ${plateNumber}: ${vehicleErr.message}`);
      }
      await fetchData();
      setImportPdfError('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'خطأ غير متوقع';
      setImportPdfError(msg);
      // عرض ما تم استيراده حتى عند الفشل الجزئي
      await fetchData();
    } finally {
      setImportingPdf(false);
    }
  }, [profile?.role, fetchData]);

  /* ── Render ── */
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  /* ── Vehicle History sub-page ── */
  if (historyVehicleId !== null) {
    return <VehicleHistory vehicleId={historyVehicleId} onBack={() => setHistoryVehicleId(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">المركبات</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {profile?.role === 'admin' && (
            <>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={exportExcel}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" /> تصدير Excel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={exportPDF}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium shadow-lg shadow-red-600/25 hover:bg-red-700 transition-colors"
              >
                <Printer className="w-4 h-4" /> تصدير PDF
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleImportPdfData}
                disabled={importingPdf}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 disabled:opacity-60 transition-colors"
              >
                {importingPdf ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {importingPdf ? 'جاري الاستيراد...' : 'استيراد بيانات المركبات 1 (PDF)'}
              </motion.button>
            </>
          )}
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={openAddForm}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> إضافة مركبة
          </motion.button>
        </div>
      </div>
      {importPdfError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {importPdfError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {[
          { label: 'الإجمالي', value: stats.total, color: 'bg-stone-100 dark:bg-stone-800', textColor: 'text-stone-700 dark:text-stone-300', icon: Truck },
          { label: 'متاحة', value: stats.available, color: 'bg-emerald-100 dark:bg-emerald-900/30', textColor: 'text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
          { label: 'احتياط', value: stats.reserve, color: 'bg-cyan-100 dark:bg-cyan-900/30', textColor: 'text-cyan-700 dark:text-cyan-300', icon: Shield },
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
      <div className="flex flex-wrap gap-3 items-start">
        <div className="flex-1 min-w-[200px] max-w-xl">
          <SmartSearchBar
            pageKey="vehicles"
            value={search}
            onChange={setSearch}
            placeholder="بحث بالرقم، السائق، النوع، الشاسي..."
            dataSuggestions={vehicleDataSuggestions}
            showPredictiveChips={false}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as VehicleStatus | 'all' | 'reserve')}
          className="px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm cursor-pointer">
          <option value="all">كل الحالات</option>
          <option value="reserve">احتياط</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        
        <div className="flex gap-2">
          <button
            onClick={() => setIsSelectionMode(!isSelectionMode)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors",
              isSelectionMode ? "bg-stone-200 dark:bg-stone-700 border-stone-300 dark:border-stone-600" : "bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700"
            )}
          >
            <CheckCircle2 className="w-4 h-4" />
            {isSelectionMode ? 'إلغاء التحديد' : 'تحديد'}
          </button>
          
          {isSelectionMode && (
            <>
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-700 text-sm font-medium border border-stone-200 dark:border-stone-600"
              >
                {selectedVehicleIds.length === filtered.length ? 'إلغاء الكل' : 'تحديد الكل'}
              </button>
              
              {selectedVehicleIds.length > 0 && (
                <>
                  <button
                    onClick={exportExcel}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Excel ({selectedVehicleIds.length})
                  </button>
                  <button
                    onClick={exportPDF}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium shadow-lg shadow-red-600/25 hover:bg-red-700 transition-colors"
                  >
                    <Printer className="w-4 h-4" /> PDF ({selectedVehicleIds.length})
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium shadow-lg shadow-red-600/25 hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> حذف ({selectedVehicleIds.length})
                  </button>
                </>
              )}
            </>
          )}
        </div>
        <ExportMenu
          meta={{
            title: 'المركبات — عرض مفلتر',
            filterDescription:
              [search && `بحث: ${search}`, statusFilter !== 'all' && `حالة: ${statusFilter}`]
                .filter(Boolean)
                .join(' | ') || '—',
            rowCount: filtered.length,
          }}
          headerRow={[
            'رقم اللوحة',
            'النوع',
            'الحالة',
            'السائق',
            'الشاسي',
          ]}
          dataRows={filtered.map((v) => [
            v.plate_number,
            v.vehicle_type ?? '—',
            STATUS_CONFIG[v.status]?.label ?? v.status,
            driverMap.get(String(v.assigned_driver_id)) ?? '—',
            v.chassis_number ?? '—',
          ])}
          sheetName="مركبات"
        />
        <SavedViews<Record<string, unknown>>
          pageKey="vehicles"
          getCurrentPayload={() => ({ search, statusFilter })}
          onApply={(p) => {
            if (typeof p.search === 'string') setSearch(p.search);
            const sf = p.statusFilter as VehicleStatus | 'all' | 'reserve' | undefined;
            if (sf !== undefined) setStatusFilter(sf);
          }}
        />
      </div>

      <InsightsPanel metrics={vehicleInsights.metrics} alerts={vehicleInsights.alerts} />
      <ChartsPanel barData={vehicleInsights.bar} pieData={vehicleInsights.pie} />

      {/* ── Add/Edit Form ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div ref={formRef} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-2xl p-5 space-y-5 shadow-lg">
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

              {/* اسم السائق ورقم المركبة — الحقول الأساسية من جدول المركبات */}
              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                <p className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3 flex items-center gap-1">
                  <User className="w-4 h-4 text-blue-600" />
                  اسم السائق ورقم المركبة
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">السائق المسؤول *</label>
                    <select
                      value={formData.assigned_driver_id}
                      onChange={(e) => setFormData({ ...formData, assigned_driver_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-sm cursor-pointer"
                    >
                      <option value="">بدون تعيين</option>
                      {staff.map((s) => (
                        <option key={String(s.id)} value={String(s.id)}>{s.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">رقم المركبة (من الجدول)</label>
                    <input
                      type="text"
                      value={[formData.vehicleNumber, formData.provinceNumber, formData.plateLetter].filter(Boolean).join(' ') || ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\s+/g, ' ').trim();
                        const parts = raw.split(' ');
                        if (parts.length >= 3) {
                          setFormData({ ...formData, vehicleNumber: parts[0], provinceNumber: parts[1], plateLetter: parts[2] });
                        } else if (parts.length === 1 && /^\d+$/.test(parts[0])) {
                          setFormData({ ...formData, vehicleNumber: parts[0], provinceNumber: '0', plateLetter: 'أ' });
                        } else if (parts.length === 2) {
                          setFormData({ ...formData, vehicleNumber: parts[0], provinceNumber: parts[1], plateLetter: formData.plateLetter || 'أ' });
                        } else {
                          setFormData({ ...formData, vehicleNumber: raw, provinceNumber: formData.provinceNumber, plateLetter: formData.plateLetter });
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-sm"
                      placeholder="مثال: 25472 أو 25472 0 أ"
                      dir="ltr"
                    />
                    <p className="text-[10px] text-stone-400 mt-0.5">أدخل الرقم فقط (مثل 25472) لملء اللوحة تلقائياً</p>
                  </div>
                </div>
              </div>

              {/* Basic Info */}
              <div>
                <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2 flex items-center gap-1"><Info className="w-3.5 h-3.5" /> أجزاء اللوحة (تفصيلي)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">رقم المركبة *</label>
                    <input type="text" value={formData.vehicleNumber}
                      onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value.replace(/[^0-9]/g, '') })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm" placeholder="مثال: 12345" />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">رقم المحافظة *</label>
                    <input type="text" value={formData.provinceNumber}
                      onChange={(e) => setFormData({ ...formData, provinceNumber: e.target.value.replace(/[^0-9]/g, '') })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm" placeholder="مثال: 1" />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">الحرف *</label>
                    <input type="text" value={formData.plateLetter}
                      onChange={(e) => setFormData({ ...formData, plateLetter: e.target.value.replace(/[^ء-يA-Za-z]/g, '').slice(0,1) })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-sm" placeholder="مثال: أ أو A" />
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

              {/* Status & Assignment — السائق معروض أعلاه في "اسم السائق ورقم المركبة" */}
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
              const assignedDriverName = driverMap.get(String(v.assigned_driver_id)) || '';

              return (
                <motion.div key={v.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn('rounded-2xl border bg-white dark:bg-stone-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden',
                    v.status === 'broken' ? 'border-red-300 dark:border-red-700' :
                    v.status === 'maintenance' ? 'border-amber-300 dark:border-amber-700' :
                    'border-stone-200 dark:border-stone-700')}>

                  {/* Card Header */}
                  <div className="p-4 pb-3">
                    {/* Top row: status badge + vehicle type */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {isSelectionMode && (
                          <input
                            type="checkbox"
                            checked={selectedVehicleIds.includes(v.id)}
                            onChange={() => toggleVehicleSelection(v.id)}
                            className="w-4 h-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                          />
                        )}
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', sc.bgColor)}>
                          <Truck className={cn('w-5 h-5', sc.color)} />
                        </div>
                        <span className={cn('px-2.5 py-1 rounded-lg text-xs font-medium', sc.bgColor, sc.color)}>
                          {sc.label}
                        </span>
                        {v.has_logo && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">لوكو</span>
                        )}
                      </div>
                      {v.vehicle_type && (
                        <span className="text-xs font-medium text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-700 px-2.5 py-1 rounded-lg">
                          {v.vehicle_type}
                        </span>
                      )}
                    </div>

                    {/* Main info: Driver name + plate */}
                    <div className="mb-3">
                    <div className="flex flex-col gap-1">
                      <div className="font-bold text-xs text-stone-500 dark:text-stone-400">رقم المركبة</div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const plate = splitPlateNumber(v.plate_number);
                          return <>
                            <span className="px-2 py-1 rounded bg-stone-100 dark:bg-stone-700 text-lg font-bold text-stone-900 dark:text-white border border-stone-200 dark:border-stone-600">
                              <HighlightText text={plate.vehicleNumber} query={search} />
                            </span>
                            <span className="px-2 py-1 rounded bg-stone-100 dark:bg-stone-700 text-lg font-bold text-blue-700 dark:text-blue-300 border border-stone-200 dark:border-stone-600">
                              <HighlightText text={plate.provinceNumber} query={search} />
                            </span>
                            <span className="px-2 py-1 rounded bg-stone-100 dark:bg-stone-700 text-lg font-bold text-purple-700 dark:text-purple-300 border border-stone-200 dark:border-stone-600">
                              <HighlightText text={plate.plateLetter} query={search} />
                            </span>
                          </>;
                        })()}
                      </div>
                      <div className="mt-2 flex items-start gap-2 rounded-xl border border-stone-200/80 dark:border-stone-700 bg-stone-50/80 dark:bg-stone-900/30 px-3 py-2">
                        <User className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">السائق المسؤول</div>
                          <div className="truncate text-sm font-bold text-stone-900 dark:text-white">
                            {assignedDriverName ? (
                              <HighlightText text={assignedDriverName} query={search} />
                            ) : (
                              'غير معين'
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    </div>

                    {/* Quick info */}
                    <div className="flex flex-wrap gap-2 text-xs">
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
                      {!v.has_logo && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                          بدون لوكو
                        </span>
                      )}
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
                    <button onClick={() => setHistoryVehicleId(v.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors">
                      <History className="w-3.5 h-3.5" /> السجل
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
                            <div><span className="text-stone-400">النوع:</span> <span className="font-medium">{v.vehicle_type || '—'}</span></div>
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
                                      <span className={exitRequestStatusTextClass(r.status)}>
                                        {exitRequestStatusLabelAr(r.status)}
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
