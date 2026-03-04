  // دالة تقسيم رقم اللوحة (نفس دالة Vehicles)
  function splitPlateNumber(plate: string) {
    const parts = plate.trim().split(' ');
    if (parts.length === 3) {
      return { vehicleNumber: parts[0], provinceNumber: parts[1], plateLetter: parts[2] };
    } else if (parts.length === 2) {
      return { vehicleNumber: parts[0], provinceNumber: '', plateLetter: parts[1] };
    } else {
      return { vehicleNumber: plate, provinceNumber: '', plateLetter: '' };
    }
  }
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Truck, User, Wrench, Calendar, Fuel, Gauge, Shield,
  AlertTriangle, CheckCircle2, Clock, FileText, DollarSign, Activity,
  ChevronDown, ChevronUp, Download, Palette, XCircle, MapPin,
  ArrowLeftRight, RefreshCw, Loader2, History, TrendingUp, BarChart3,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import type { Vehicle, VehicleMaintenance, VehicleEvent, StaffMember, ExitRequest, VehicleStatus } from '../lib/supabaseClient';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

/* ── Constants ── */
const STATUS_CONFIG: Record<VehicleStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  available:   { label: 'متاحة',  color: 'text-emerald-700 dark:text-emerald-300', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', icon: CheckCircle2 },
  maintenance: { label: 'صيانة',  color: 'text-amber-700 dark:text-amber-300',     bgColor: 'bg-amber-100 dark:bg-amber-900/30',     icon: Wrench },
  broken:      { label: 'معطلة',  color: 'text-red-700 dark:text-red-300',         bgColor: 'bg-red-100 dark:bg-red-900/30',         icon: XCircle },
  reserved:    { label: 'محجوزة', color: 'text-blue-700 dark:text-blue-300',       bgColor: 'bg-blue-100 dark:bg-blue-900/30',       icon: Shield },
};

const EVENT_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  driver_assigned:   { label: 'تعيين سائق',      color: 'text-blue-600 dark:text-blue-400',    bgColor: 'bg-blue-100 dark:bg-blue-900/30',    icon: User },
  driver_removed:    { label: 'إزالة سائق',      color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30', icon: User },
  status_changed:    { label: 'تغيير حالة',      color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30', icon: RefreshCw },
  license_renewed:   { label: 'تجديد رخصة',      color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', icon: FileText },
  insurance_renewed: { label: 'تجديد تأمين',     color: 'text-teal-600 dark:text-teal-400',     bgColor: 'bg-teal-100 dark:bg-teal-900/30',    icon: Shield },
  odometer_updated:  { label: 'تحديث عداد',      color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30', icon: Gauge },
  note_added:        { label: 'ملاحظة',          color: 'text-stone-600 dark:text-stone-400',   bgColor: 'bg-stone-100 dark:bg-stone-800',     icon: FileText },
  created:           { label: 'إنشاء المركبة',   color: 'text-green-600 dark:text-green-400',   bgColor: 'bg-green-100 dark:bg-green-900/30',  icon: Truck },
  maintenance:       { label: 'صيانة',           color: 'text-amber-600 dark:text-amber-400',   bgColor: 'bg-amber-100 dark:bg-amber-900/30',  icon: Wrench },
  exit_request:      { label: 'رحلة خروج',       color: 'text-sky-600 dark:text-sky-400',       bgColor: 'bg-sky-100 dark:bg-sky-900/30',      icon: Activity },
};

type TabKey = 'timeline' | 'trips' | 'maintenance' | 'drivers' | 'stats';

/* ── Props ── */
interface VehicleHistoryProps {
  vehicleId: number;
  onBack: () => void;
}

/* ── Timeline Item Type ── */
interface TimelineItem {
  id: string;
  type: string;
  date: string;
  title: string;
  description: string;
  details?: Record<string, string>;
  oldValue?: string | null;
  newValue?: string | null;
}

export default function VehicleHistory({ vehicleId, onBack }: VehicleHistoryProps) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [maintenanceList, setMaintenanceList] = useState<VehicleMaintenance[]>([]);
  const [events, setEvents] = useState<VehicleEvent[]>([]);
  const [exitRequests, setExitRequests] = useState<ExitRequest[]>([]);
  const [driverMap, setDriverMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('timeline');
  const [timelineLimit, setTimelineLimit] = useState(30);

  /* ── Fetch everything ── */
  const fetchAll = useCallback(async () => {
    const [vRes, mRes, eRes, erRes, sRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('id', vehicleId).single(),
      supabase.from('vehicle_maintenance').select('*').eq('vehicle_id', vehicleId).order('performed_at', { ascending: false }),
      supabase.from('vehicle_events').select('*').eq('vehicle_id', vehicleId).order('created_at', { ascending: false }),
      supabase.from('exit_requests').select('*').eq('vehicle_id', vehicleId).order('created_at', { ascending: false }),
      supabase.from('staff_members').select('id,full_name').eq('role', 'driver'),
    ]);
    if (vRes.data) setVehicle(vRes.data);
    if (mRes.data) setMaintenanceList(mRes.data);
    if (eRes.data) setEvents(eRes.data);
    if (erRes.data) setExitRequests(erRes.data);
    if (sRes.data) setDriverMap(new Map(sRes.data.map((s: { id: string; full_name: string }) => [String(s.id), s.full_name])));
    setLoading(false);
  }, [vehicleId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Unified Timeline ── */
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    // Events
    for (const ev of events) {
      items.push({
        id: `ev-${ev.id}`,
        type: ev.event_type,
        date: ev.created_at,
        title: EVENT_CONFIG[ev.event_type]?.label || ev.event_type,
        description: ev.description,
        oldValue: ev.old_value,
        newValue: ev.new_value,
      });
    }

    // Maintenance records
    for (const m of maintenanceList) {
      items.push({
        id: `mt-${m.id}`,
        type: 'maintenance',
        date: m.performed_at + 'T00:00:00',
        title: m.maintenance_type,
        description: m.description || '',
        details: {
          ...(Number(m.cost) > 0 ? { 'التكلفة': `${Number(m.cost).toLocaleString()} د.ع` } : {}),
          ...(m.odometer_at ? { 'العداد': `${m.odometer_at.toLocaleString()} كم` } : {}),
          ...(m.performed_by ? { 'بواسطة': m.performed_by } : {}),
          ...(m.next_maintenance_date ? { 'الصيانة القادمة': m.next_maintenance_date } : {}),
          ...(m.notes ? { 'ملاحظات': m.notes } : {}),
        },
      });
    }

    // Exit requests
    for (const r of exitRequests) {
      const assistantNames = (r.assistant_names || []).join('، ');
      items.push({
        id: `er-${r.id}`,
        type: 'exit_request',
        date: r.created_at,
        title: `رحلة ${r.exit_type === 'temporary' ? 'مؤقتة' : 'دائمة'}`,
        description: driverMap.get(String(r.driver_id)) ? `السائق: ${driverMap.get(String(r.driver_id))}` : (r.driver_name ? `السائق: ${r.driver_name}` : ''),
        details: {
          ...(assistantNames ? { 'المساعدين': assistantNames } : {}),
          ...(r.exit_reason ? { 'السبب': r.exit_reason } : {}),
          ...(r.exit_duration_minutes ? { 'المدة': `${r.exit_duration_minutes} دقيقة` } : {}),
          'الحالة': r.status === 'exited' ? 'خرج' : r.status === 'approved' ? 'مُوافق' : r.status === 'rejected' ? 'مرفوض' : 'بانتظار',
        },
      });
    }

    // Sort by date descending
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }, [events, maintenanceList, exitRequests]);

  /* ── Stats ── */
  const stats = useMemo(() => {
    const totalMaintenanceCost = maintenanceList.reduce((sum, m) => sum + Number(m.cost), 0);
    const totalTrips = exitRequests.filter((r) => r.status !== 'rejected').length;
    const totalMaintenance = maintenanceList.length;

    // Most frequent driver
    const driverCounts = new Map<string, number>();
    for (const r of exitRequests) {
      if (r.driver_id && r.status !== 'rejected') {
        const name = driverMap.get(String(r.driver_id)) || r.driver_name || 'غير معروف';
        driverCounts.set(name, (driverCounts.get(name) || 0) + 1);
      }
    }
    let topDriver = '—';
    let topDriverTrips = 0;
    for (const [name, count] of driverCounts) {
      if (count > topDriverTrips) { topDriver = name; topDriverTrips = count; }
    }

    // Driver assignment history from events
    const driverChanges = events.filter((e) => e.event_type === 'driver_assigned' || e.event_type === 'driver_removed');

    return { totalMaintenanceCost, totalTrips, totalMaintenance, topDriver, topDriverTrips, driverChanges: driverChanges.length };
  }, [maintenanceList, exitRequests, events, driverMap]);

  /* ── Expiry alerts ── */
  const expiryAlerts = useMemo(() => {
    if (!vehicle) return [];
    const alerts: { type: string; label: string; date: string; severity: 'expired' | 'warning' }[] = [];
    const now = new Date();
    const soon = new Date(); soon.setDate(soon.getDate() + 30);

    if (vehicle.license_expiry) {
      const d = new Date(vehicle.license_expiry);
      if (d < now) alerts.push({ type: 'license', label: 'الرخصة', date: vehicle.license_expiry, severity: 'expired' });
      else if (d <= soon) alerts.push({ type: 'license', label: 'الرخصة', date: vehicle.license_expiry, severity: 'warning' });
    }
    if (vehicle.insurance_expiry) {
      const d = new Date(vehicle.insurance_expiry);
      if (d < now) alerts.push({ type: 'insurance', label: 'التأمين', date: vehicle.insurance_expiry, severity: 'expired' });
      else if (d <= soon) alerts.push({ type: 'insurance', label: 'التأمين', date: vehicle.insurance_expiry, severity: 'warning' });
    }

    // Next maintenance date
    const latestMaintenance = maintenanceList.find((m) => m.next_maintenance_date);
    if (latestMaintenance?.next_maintenance_date) {
      const d = new Date(latestMaintenance.next_maintenance_date);
      if (d < now) alerts.push({ type: 'maintenance', label: 'الصيانة القادمة', date: latestMaintenance.next_maintenance_date, severity: 'expired' });
      else if (d <= soon) alerts.push({ type: 'maintenance', label: 'الصيانة القادمة', date: latestMaintenance.next_maintenance_date, severity: 'warning' });
    }

    return alerts;
  }, [vehicle, maintenanceList]);

  /* ── Driver history (from events) ── */
  const driverHistory = useMemo(() => {
    return events
      .filter((e) => e.event_type === 'driver_assigned' || e.event_type === 'driver_removed')
      .map((e) => ({
        id: e.id,
        type: e.event_type as 'driver_assigned' | 'driver_removed',
        date: e.created_at,
        oldDriver: e.old_value || null,
        newDriver: e.new_value || null,
        description: e.description,
      }));
  }, [events]);

  /* ── Export ── */
  const exportExcel = () => {
    if (!vehicle) return;
    const wb = XLSX.utils.book_new();

    // Vehicle info sheet
    const infoData = [
      ['رقم اللوحة', vehicle.plate_number],
      ['النوع', vehicle.vehicle_type || '—'],
      ['اللون', vehicle.color || '—'],
      ['السنة', vehicle.year || '—'],
      ['رقم الشاسي', vehicle.chassis_number || '—'],
      ['الوقود', vehicle.fuel_type || '—'],
      ['العداد', `${vehicle.odometer_km} كم`],
      ['الحالة', STATUS_CONFIG[vehicle.status]?.label || vehicle.status],
      ['الرخصة', vehicle.license_expiry || '—'],
      ['التأمين', vehicle.insurance_expiry || '—'],
      ['السائق', vehicle.assigned_driver_id ? (driverMap.get(String(vehicle.assigned_driver_id)) || '—') : '—'],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet([['البيان', 'القيمة'], ...infoData]);
    XLSX.utils.book_append_sheet(wb, ws1, 'بيانات المركبة');

    // Maintenance sheet
    if (maintenanceList.length > 0) {
      const mHeaders = ['النوع', 'الوصف', 'التكلفة', 'العداد', 'التاريخ', 'بواسطة', 'الصيانة القادمة', 'ملاحظات'];
      const mRows = maintenanceList.map((m) => [
        m.maintenance_type, m.description || '', Number(m.cost), m.odometer_at || '', m.performed_at, m.performed_by || '', m.next_maintenance_date || '', m.notes || '',
      ]);
      const ws2 = XLSX.utils.aoa_to_sheet([mHeaders, ...mRows]);
      XLSX.utils.book_append_sheet(wb, ws2, 'الصيانة');
    }

    // Trips sheet
    if (exitRequests.length > 0) {
      const tHeaders = ['التاريخ', 'السائق', 'المساعدين', 'النوع', 'المدة', 'السبب', 'الحالة'];
      const tRows = exitRequests.map((r) => [
        new Date(r.created_at).toLocaleDateString('ar-IQ'),
        driverMap.get(String(r.driver_id)) || r.driver_name || '—',
        (r.assistant_names || []).join('، '),
        r.exit_type === 'temporary' ? 'مؤقت' : 'دائم',
        r.exit_duration_minutes ? `${r.exit_duration_minutes} د` : '—',
        r.exit_reason || '—',
        r.status === 'exited' ? 'خرج' : r.status === 'approved' ? 'مُوافق' : r.status === 'rejected' ? 'مرفوض' : 'بانتظار',
      ]);
      const ws3 = XLSX.utils.aoa_to_sheet([tHeaders, ...tRows]);
      XLSX.utils.book_append_sheet(wb, ws3, 'الرحلات');
    }

    // Events sheet
    if (events.length > 0) {
      const eHeaders = ['التاريخ', 'النوع', 'الوصف', 'القيمة القديمة', 'القيمة الجديدة'];
      const eRows = events.map((e) => [
        new Date(e.created_at).toLocaleDateString('ar-IQ') + ' ' + new Date(e.created_at).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
        EVENT_CONFIG[e.event_type]?.label || e.event_type,
        e.description,
        e.old_value || '',
        e.new_value || '',
      ]);
      const ws4 = XLSX.utils.aoa_to_sheet([eHeaders, ...eRows]);
      XLSX.utils.book_append_sheet(wb, ws4, 'السجل');
    }

    XLSX.writeFile(wb, `تقرير_مركبة_${vehicle.plate_number}.xlsx`);
  };

  const exportPDF = () => {
    if (!vehicle) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFont('Helvetica');
    let y = 15;

    doc.setFontSize(16);
    doc.text(`Vehicle Report - ${vehicle.plate_number}`, 105, y, { align: 'center' });
    y += 12;

    doc.setFontSize(10);
    const info = [
      `Plate: ${vehicle.plate_number}`,
      `Type: ${vehicle.vehicle_type || '-'}`,
      `Color: ${vehicle.color || '-'}`,
      `Year: ${vehicle.year || '-'}`,
      `Chassis: ${vehicle.chassis_number || '-'}`,
      `Fuel: ${vehicle.fuel_type || '-'}`,
      `Odometer: ${vehicle.odometer_km} km`,
      `Status: ${STATUS_CONFIG[vehicle.status]?.label || vehicle.status}`,
      `License: ${vehicle.license_expiry || '-'}`,
      `Insurance: ${vehicle.insurance_expiry || '-'}`,
      `Driver: ${vehicle.assigned_driver_id ? (driverMap.get(String(vehicle.assigned_driver_id)) || '-') : '-'}`,
    ];
    for (const line of info) { doc.text(line, 15, y); y += 6; }

    y += 5;
    doc.setFontSize(12);
    doc.text(`Statistics`, 15, y); y += 8;
    doc.setFontSize(10);
    doc.text(`Total Maintenance Cost: ${stats.totalMaintenanceCost.toLocaleString()} IQD`, 15, y); y += 6;
    doc.text(`Total Trips: ${stats.totalTrips}`, 15, y); y += 6;
    doc.text(`Total Maintenance: ${stats.totalMaintenance}`, 15, y); y += 6;
    doc.text(`Top Driver: ${stats.topDriver} (${stats.topDriverTrips} trips)`, 15, y); y += 6;

    if (maintenanceList.length > 0) {
      y += 5;
      doc.setFontSize(12);
      doc.text(`Maintenance Log (${maintenanceList.length})`, 15, y); y += 8;
      doc.setFontSize(9);
      for (const m of maintenanceList.slice(0, 20)) {
        if (y > 270) { doc.addPage(); y = 15; }
        doc.text(`${m.performed_at} | ${m.maintenance_type} | ${Number(m.cost).toLocaleString()} IQD | ${m.performed_by || '-'}`, 15, y);
        y += 5;
      }
    }

    if (exitRequests.length > 0) {
      y += 5;
      if (y > 250) { doc.addPage(); y = 15; }
      doc.setFontSize(12);
      doc.text(`Trip Log (${exitRequests.length})`, 15, y); y += 8;
      doc.setFontSize(9);
      for (const r of exitRequests.slice(0, 20)) {
        if (y > 270) { doc.addPage(); y = 15; }
        const date = new Date(r.created_at).toLocaleDateString('en');
        doc.text(`${date} | ${driverMap.get(String(r.driver_id)) || r.driver_name || '-'} | ${r.exit_type} | ${r.exit_reason || '-'}`, 15, y);
        y += 5;
      }
    }

    doc.save(`Vehicle_${vehicle.plate_number}_Report.pdf`);
  };

  /* ── Format date ── */
  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('ar-IQ');
  };
  const fmtDateTime = (d: string) => {
    const dt = new Date(d);
    return `${dt.toLocaleDateString('ar-IQ')} ${dt.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}`;
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-500">المركبة غير موجودة</p>
        <button onClick={onBack} className="mt-4 text-blue-600 hover:underline">العودة</button>
      </div>
    );
  }

  const sc = STATUS_CONFIG[vehicle.status];
  const currentDriver = vehicle.assigned_driver_id ? driverMap.get(vehicle.assigned_driver_id) : null;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-sm font-medium transition-colors">
          <ArrowRight className="w-4 h-4" /> العودة للمركبات
        </motion.button>
        <div className="flex-1" />
        <div className="flex gap-2">
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-medium shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 transition-colors">
            <Download className="w-3.5 h-3.5" /> Excel
          </motion.button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={exportPDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-medium shadow-lg shadow-red-600/25 hover:bg-red-700 transition-colors">
            <Download className="w-3.5 h-3.5" /> PDF
          </motion.button>
        </div>
      </div>

      {/* ── Vehicle Info Card ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-5 shadow-sm">
        <div className="flex items-start gap-4 flex-wrap">
          {/* Icon + Status */}
          <div className="flex items-center gap-3">
            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center', sc.bgColor)}>
              <Truck className={cn('w-7 h-7', sc.color)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  {(() => {
                    const plate = splitPlateNumber(vehicle.plate_number);
                    return <>
                      <span className="px-2 py-1 rounded bg-stone-100 dark:bg-stone-700 text-xl font-bold text-stone-900 dark:text-white border border-stone-200 dark:border-stone-600">{plate.vehicleNumber}</span>
                      <span className="px-2 py-1 rounded bg-stone-100 dark:bg-stone-700 text-xl font-bold text-blue-700 dark:text-blue-300 border border-stone-200 dark:border-stone-600">{plate.provinceNumber}</span>
                      <span className="px-2 py-1 rounded bg-stone-100 dark:bg-stone-700 text-xl font-bold text-purple-700 dark:text-purple-300 border border-stone-200 dark:border-stone-600">{plate.plateLetter}</span>
                    </>;
                  })()}
                </div>
                <span className={cn('px-2.5 py-1 rounded-lg text-xs font-medium', sc.bgColor, sc.color)}>
                  {sc.label}
                </span>
                {vehicle.has_logo && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">لوكو</span>
                )}
              </div>
              {currentDriver && (
                <div className="flex items-center gap-1.5 mt-1 text-sm text-stone-600 dark:text-stone-300">
                  <User className="w-3.5 h-3.5" /> {currentDriver}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1" />

          {/* Quick info */}
          <div className="flex flex-wrap gap-2 text-xs">
            {vehicle.vehicle_type && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                <Truck className="w-3 h-3" /> {vehicle.vehicle_type}
              </span>
            )}
            {vehicle.color && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                <Palette className="w-3 h-3" /> {vehicle.color}
              </span>
            )}
            {vehicle.year && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                <Calendar className="w-3 h-3" /> {vehicle.year}
              </span>
            )}
            {vehicle.fuel_type && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                <Fuel className="w-3 h-3" /> {vehicle.fuel_type}
              </span>
            )}
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
              <Gauge className="w-3 h-3" /> {vehicle.odometer_km.toLocaleString()} كم
            </span>
            {vehicle.chassis_number && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                <FileText className="w-3 h-3" /> {vehicle.chassis_number}
              </span>
            )}
          </div>
        </div>

        {/* Dates row */}
        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-stone-100 dark:border-stone-700 text-xs text-stone-500 dark:text-stone-400">
          <span>الرخصة: <span className={cn('font-medium', vehicle.license_expiry && new Date(vehicle.license_expiry) < new Date() ? 'text-red-600' : '')}>{vehicle.license_expiry || '—'}</span></span>
          <span>التأمين: <span className={cn('font-medium', vehicle.insurance_expiry && new Date(vehicle.insurance_expiry) < new Date() ? 'text-red-600' : '')}>{vehicle.insurance_expiry || '—'}</span></span>
          <span>تاريخ الإضافة: <span className="font-medium">{fmtDate(vehicle.created_at)}</span></span>
          <span>آخر تحديث: <span className="font-medium">{fmtDate(vehicle.updated_at)}</span></span>
        </div>
      </motion.div>

      {/* ── Expiry Alerts ── */}
      {expiryAlerts.length > 0 && (
        <div className="space-y-2">
          {expiryAlerts.map((a) => (
            <motion.div key={a.type} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border',
                a.severity === 'expired'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800')}>
              <AlertTriangle className={cn('w-5 h-5 shrink-0', a.severity === 'expired' ? 'text-red-600' : 'text-amber-600')} />
              <div className="flex-1">
                <p className={cn('text-sm font-medium', a.severity === 'expired' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300')}>
                  {a.severity === 'expired' ? `${a.label} منتهية!` : `${a.label} تنتهي قريباً`}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">تاريخ الانتهاء: {a.date}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'إجمالي الصيانة', value: stats.totalMaintenanceCost.toLocaleString(), suffix: ' د.ع', color: 'bg-amber-100 dark:bg-amber-900/30', textColor: 'text-amber-700 dark:text-amber-300', icon: DollarSign },
          { label: 'عدد الصيانات', value: stats.totalMaintenance, suffix: '', color: 'bg-orange-100 dark:bg-orange-900/30', textColor: 'text-orange-700 dark:text-orange-300', icon: Wrench },
          { label: 'عدد الرحلات', value: stats.totalTrips, suffix: '', color: 'bg-sky-100 dark:bg-sky-900/30', textColor: 'text-sky-700 dark:text-sky-300', icon: Activity },
          { label: 'عدد الكيلومتر', value: vehicle.odometer_km.toLocaleString(), suffix: ' كم', color: 'bg-indigo-100 dark:bg-indigo-900/30', textColor: 'text-indigo-700 dark:text-indigo-300', icon: Gauge },
          { label: 'أكثر سائق', value: stats.topDriver, suffix: ` (${stats.topDriverTrips})`, color: 'bg-blue-100 dark:bg-blue-900/30', textColor: 'text-blue-700 dark:text-blue-300', icon: User },
          { label: 'تغييرات السائق', value: stats.driverChanges, suffix: '', color: 'bg-purple-100 dark:bg-purple-900/30', textColor: 'text-purple-700 dark:text-purple-300', icon: ArrowLeftRight },
        ].map((s) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={cn('rounded-xl p-3 text-center', s.color)}>
            <s.icon className={cn('w-5 h-5 mx-auto mb-1', s.textColor)} />
            <p className={cn('text-lg font-bold leading-tight', s.textColor)}>
              {s.value}<span className="text-[10px] font-normal">{s.suffix}</span>
            </p>
            <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 rounded-xl bg-stone-100 dark:bg-stone-800 overflow-x-auto">
        {([
          { key: 'timeline' as TabKey, label: 'التاريخ الكامل', icon: History, count: timeline.length },
          { key: 'trips' as TabKey, label: 'الرحلات', icon: Activity, count: exitRequests.length },
          { key: 'maintenance' as TabKey, label: 'الصيانة', icon: Wrench, count: maintenanceList.length },
          { key: 'drivers' as TabKey, label: 'السائقين', icon: User, count: driverHistory.length },
          { key: 'stats' as TabKey, label: 'إحصائيات', icon: BarChart3, count: 0 },
        ]).map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn('flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
              activeTab === tab.key
                ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-sm'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200')}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.count > 0 && (
              <span className={cn('px-1.5 py-0.5 rounded-full text-[10px]',
                activeTab === tab.key ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-stone-200 dark:bg-stone-600 text-stone-500 dark:text-stone-400')}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <motion.div key="timeline" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 overflow-hidden">
            {timeline.length === 0 ? (
              <div className="py-16 text-center">
                <History className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-600 mb-3" />
                <p className="text-stone-500 dark:text-stone-400 text-sm">لا توجد أحداث مسجلة بعد</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-700">
                {timeline.slice(0, timelineLimit).map((item, idx) => {
                  const cfg = EVENT_CONFIG[item.type] || EVENT_CONFIG.note_added;
                  return (
                    <div key={item.id} className="flex gap-3 p-4 hover:bg-stone-50/50 dark:hover:bg-stone-700/30 transition-colors">
                      {/* Timeline dot */}
                      <div className="flex flex-col items-center pt-0.5">
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', cfg.bgColor)}>
                          <cfg.icon className={cn('w-4 h-4', cfg.color)} />
                        </div>
                        {idx < Math.min(timeline.length, timelineLimit) - 1 && (
                          <div className="w-0.5 flex-1 bg-stone-200 dark:bg-stone-700 mt-1 min-h-[16px]" />
                        )}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={cn('text-sm font-semibold', cfg.color)}>{item.title}</span>
                            <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-medium', cfg.bgColor, cfg.color)}>
                              {cfg.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-stone-400 dark:text-stone-500 whitespace-nowrap">{fmtDateTime(item.date)}</span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-stone-600 dark:text-stone-300 mt-1">{item.description}</p>
                        )}
                        {(item.oldValue || item.newValue) && (
                          <div className="flex items-center gap-2 mt-1 text-xs">
                            {item.oldValue && <span className="px-2 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 line-through">{item.oldValue}</span>}
                            {item.oldValue && item.newValue && <ArrowRight className="w-3 h-3 text-stone-400" />}
                            {item.newValue && <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">{item.newValue}</span>}
                          </div>
                        )}
                        {item.details && Object.keys(item.details).length > 0 && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11px] text-stone-500 dark:text-stone-400">
                            {Object.entries(item.details).map(([k, v]) => (
                              <span key={k}><span className="text-stone-400 dark:text-stone-500">{k}:</span> {v}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {timeline.length > timelineLimit && (
                  <button onClick={() => setTimelineLimit((l) => l + 30)}
                    className="w-full py-3 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors font-medium">
                    عرض المزيد ({timeline.length - timelineLimit} حدث آخر)
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Trips Tab */}
        {activeTab === 'trips' && (
          <motion.div key="trips" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 overflow-hidden">
            {exitRequests.length === 0 ? (
              <div className="py-16 text-center">
                <Activity className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-600 mb-3" />
                <p className="text-stone-500 dark:text-stone-400 text-sm">لا توجد رحلات مسجلة</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-700">
                {exitRequests.map((r) => (
                  <div key={r.id} className="p-4 hover:bg-stone-50/50 dark:hover:bg-stone-700/30">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                          <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-stone-900 dark:text-white">{driverMap.get(String(r.driver_id)) || r.driver_name || 'بدون سائق'}</p>
                          <p className="text-[10px] text-stone-400">{fmtDateTime(r.created_at)}</p>
                        </div>
                      </div>
                      <span className={cn('px-2.5 py-1 rounded-lg text-xs font-medium',
                        r.status === 'exited' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                        r.status === 'approved' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                        r.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                        'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300')}>
                        {r.status === 'exited' ? 'خرج' : r.status === 'approved' ? 'مُوافق' : r.status === 'rejected' ? 'مرفوض' : 'بانتظار'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-stone-500 dark:text-stone-400 mr-10">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {r.exit_type === 'temporary' ? `مؤقت (${r.exit_duration_minutes || '—'} د)` : 'دائم'}
                      </span>
                      {r.exit_reason && <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {r.exit_reason}</span>}
                      {(r.assistant_names || []).length > 0 && (
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {(r.assistant_names || []).join('، ')}</span>
                      )}
                      {r.vehicle_plate && <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> {r.vehicle_plate}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Maintenance Tab */}
        {activeTab === 'maintenance' && (
          <motion.div key="maintenance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 overflow-hidden">
            {maintenanceList.length === 0 ? (
              <div className="py-16 text-center">
                <Wrench className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-600 mb-3" />
                <p className="text-stone-500 dark:text-stone-400 text-sm">لا توجد سجل صيانة</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-700">
                {maintenanceList.map((m) => (
                  <div key={m.id} className="p-4 hover:bg-stone-50/50 dark:hover:bg-stone-700/30">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                          <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-stone-900 dark:text-white">{m.maintenance_type}</p>
                          <p className="text-[10px] text-stone-400">{m.performed_at}</p>
                        </div>
                      </div>
                      {Number(m.cost) > 0 && (
                        <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{Number(m.cost).toLocaleString()} د.ع</span>
                      )}
                    </div>
                    <div className="mr-10 space-y-1">
                      {m.description && <p className="text-xs text-stone-600 dark:text-stone-300">{m.description}</p>}
                      <div className="flex flex-wrap gap-3 text-xs text-stone-500 dark:text-stone-400">
                        {m.odometer_at && <span className="flex items-center gap-1"><Gauge className="w-3 h-3" /> {m.odometer_at.toLocaleString()} كم</span>}
                        {m.performed_by && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {m.performed_by}</span>}
                        {m.next_maintenance_date && (
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400"><Calendar className="w-3 h-3" /> القادمة: {m.next_maintenance_date}</span>
                        )}
                        {m.next_maintenance_km && (
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400"><Gauge className="w-3 h-3" /> القادمة: {m.next_maintenance_km.toLocaleString()} كم</span>
                        )}
                      </div>
                      {m.notes && <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1">{m.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Drivers Tab */}
        {activeTab === 'drivers' && (
          <motion.div key="drivers" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 overflow-hidden">
            {/* Current driver */}
            <div className="p-4 border-b border-stone-100 dark:border-stone-700">
              <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2">السائق الحالي</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-sm font-bold text-stone-900 dark:text-white">
                  {currentDriver || 'لا يوجد سائق معيّن'}
                </p>
              </div>
            </div>

            {/* Change history */}
            {driverHistory.length === 0 ? (
              <div className="py-12 text-center">
                <ArrowLeftRight className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-600 mb-3" />
                <p className="text-stone-500 dark:text-stone-400 text-sm">لا يوجد سجل تغيير سائقين</p>
                <p className="text-[10px] text-stone-400 mt-1">سيتم التسجيل تلقائياً عند تغيير السائق</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-700">
                {driverHistory.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 p-4 hover:bg-stone-50/50 dark:hover:bg-stone-700/30">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                      d.type === 'driver_assigned' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-orange-100 dark:bg-orange-900/30')}>
                      <User className={cn('w-4 h-4', d.type === 'driver_assigned' ? 'text-blue-600' : 'text-orange-600')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        {d.oldDriver && <span className="text-red-600 dark:text-red-400 line-through">{d.oldDriver}</span>}
                        {d.oldDriver && d.newDriver && <ArrowRight className="w-3.5 h-3.5 text-stone-400" />}
                        {d.newDriver && <span className="text-emerald-600 dark:text-emerald-400 font-medium">{d.newDriver}</span>}
                        {!d.oldDriver && !d.newDriver && <span className="text-stone-500">{d.description}</span>}
                      </div>
                      <p className="text-[10px] text-stone-400 mt-0.5">{fmtDateTime(d.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <motion.div key="stats" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-4">
            {/* Monthly breakdown */}
            <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-5">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-600" /> تكاليف الصيانة حسب الشهر</h3>
              {maintenanceList.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-8">لا توجد بيانات صيانة</p>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const monthlyMap = new Map<string, number>();
                    for (const m of maintenanceList) {
                      const key = m.performed_at.slice(0, 7); // YYYY-MM
                      monthlyMap.set(key, (monthlyMap.get(key) || 0) + Number(m.cost));
                    }
                    const entries = [...monthlyMap.entries()].sort().slice(-12);
                    const maxVal = Math.max(...entries.map(([, v]) => v), 1);

                    return entries.map(([month, cost]) => (
                      <div key={month} className="flex items-center gap-3">
                        <span className="text-xs text-stone-500 w-20 text-left">{month}</span>
                        <div className="flex-1 h-6 bg-stone-100 dark:bg-stone-700 rounded-lg overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(cost / maxVal) * 100}%` }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="h-full bg-gradient-to-l from-amber-500 to-amber-400 rounded-lg" />
                        </div>
                        <span className="text-xs font-bold text-amber-600 w-24 text-left">{cost.toLocaleString()} د.ع</span>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            {/* Trip count by month */}
            <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-5">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-sky-600" /> عدد الرحلات حسب الشهر</h3>
              {exitRequests.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-8">لا توجد بيانات رحلات</p>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const monthlyMap = new Map<string, number>();
                    for (const r of exitRequests) {
                      if (r.status === 'rejected') continue;
                      const key = r.created_at.slice(0, 7);
                      monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
                    }
                    const entries = [...monthlyMap.entries()].sort().slice(-12);
                    const maxVal = Math.max(...entries.map(([, v]) => v), 1);

                    return entries.map(([month, count]) => (
                      <div key={month} className="flex items-center gap-3">
                        <span className="text-xs text-stone-500 w-20 text-left">{month}</span>
                        <div className="flex-1 h-6 bg-stone-100 dark:bg-stone-700 rounded-lg overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(count / maxVal) * 100}%` }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="h-full bg-gradient-to-l from-sky-500 to-sky-400 rounded-lg" />
                        </div>
                        <span className="text-xs font-bold text-sky-600 w-16 text-left">{count} رحلة</span>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            {/* Maintenance type breakdown */}
            <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-5">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-purple-600" /> أنواع الصيانة</h3>
              {maintenanceList.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-8">لا توجد بيانات صيانة</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(() => {
                    const typeMap = new Map<string, { count: number; cost: number }>();
                    for (const m of maintenanceList) {
                      const prev = typeMap.get(m.maintenance_type) || { count: 0, cost: 0 };
                      typeMap.set(m.maintenance_type, { count: prev.count + 1, cost: prev.cost + Number(m.cost) });
                    }
                    return [...typeMap.entries()].sort((a, b) => b[1].count - a[1].count).map(([type, data]) => (
                      <div key={type} className="p-3 rounded-xl bg-stone-50 dark:bg-stone-700/50 text-center">
                        <p className="text-xs font-bold text-stone-700 dark:text-stone-200">{type}</p>
                        <p className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-1">{data.count}</p>
                        <p className="text-[10px] text-stone-400">{data.cost.toLocaleString()} د.ع</p>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
