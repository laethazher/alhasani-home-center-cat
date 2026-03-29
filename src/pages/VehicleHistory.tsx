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
  ChevronDown, ChevronUp, Download, Palette, XCircle, MapPin, ClipboardCheck,
  ArrowLeftRight, RefreshCw, Loader2, History, TrendingUp, BarChart3, Image as ImageIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import type { Vehicle, VehicleMaintenance, VehicleEvent, StaffMember, ExitRequest, VehicleStatus, MaintenanceRecord, MaintenanceImage } from '../lib/supabaseClient';
import { exportHtmlToPdf } from '../lib/pdfExport';
import { exportToExcel, exportSheetsToExcel } from '../lib/excelExport';

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
  vehicle_exit:      { label: 'إخراج مركبة',     color: 'text-cyan-600 dark:text-cyan-400',     bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',     icon: Activity },
  report_created:    { label: 'تقرير فحص',       color: 'text-rose-600 dark:text-rose-400',     bgColor: 'bg-rose-100 dark:bg-rose-900/30',     icon: ClipboardCheck },
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
  images?: { url: string; type: string }[];
}

export default function VehicleHistory({ vehicleId, onBack }: VehicleHistoryProps) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [maintenanceList, setMaintenanceList] = useState<VehicleMaintenance[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<(MaintenanceRecord & { maintenance_images?: MaintenanceImage[] })[]>([]);
  const [events, setEvents] = useState<VehicleEvent[]>([]);
  const [exitRequests, setExitRequests] = useState<ExitRequest[]>([]);
  const [driverMap, setDriverMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('timeline');
  const [timelineLimit, setTimelineLimit] = useState(30);

  /* ── Fetch everything ── */
  const fetchAll = useCallback(async () => {
    const [vRes, mRes, mrRes, eRes, erRes, sRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('id', vehicleId).single(),
      supabase.from('vehicle_maintenance').select('*').eq('vehicle_id', vehicleId).order('performed_at', { ascending: false }),
      supabase.from('maintenance_records').select('*, maintenance_images(*)').eq('vehicle_id', vehicleId).order('created_at', { ascending: false }),
      supabase.from('vehicle_events').select('*').eq('vehicle_id', vehicleId).order('created_at', { ascending: false }),
      supabase.from('exit_requests').select('*').eq('vehicle_id', vehicleId).order('created_at', { ascending: false }),
      supabase.from('staff_members').select('id,full_name').eq('role', 'driver'),
    ]);
    if (vRes.data) setVehicle(vRes.data);
    if (mRes.data) setMaintenanceList(mRes.data);
    if (mrRes.data) setMaintenanceRecords(mrRes.data);
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

    // Vehicle maintenance (manual admin entries)
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

    // Maintenance records (from workflow - Finish Maintenance)
    for (const rec of maintenanceRecords) {
      const imgs = (rec.maintenance_images || []).map((img) => ({ url: img.image_url, type: img.image_type }));
      const desc = [rec.fault_description, rec.work_done].filter(Boolean).join(' — ');
      items.push({
        id: `mrec-${rec.id}`,
        type: 'maintenance',
        date: rec.created_at,
        title: rec.maintenance_type || 'صيانة',
        description: desc || '',
        details: {
          ...(rec.cost > 0 ? { 'التكلفة': `${rec.cost.toLocaleString()} د.ع` } : {}),
          ...(rec.duration_minutes ? { 'المدة': `${rec.duration_minutes} دقيقة` } : {}),
          ...(rec.technician_name ? { 'الفني': rec.technician_name } : {}),
          ...(rec.odometer_at ? { 'العداد': `${rec.odometer_at.toLocaleString()} كم` } : {}),
          ...(rec.notes ? { 'ملاحظات': rec.notes } : {}),
        },
        images: imgs.length > 0 ? imgs : undefined,
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
  }, [events, maintenanceList, maintenanceRecords, exitRequests]);

  /* ── Stats ── */
  const stats = useMemo(() => {
    const vmCost = maintenanceList.reduce((sum, m) => sum + Number(m.cost), 0);
    const recCost = maintenanceRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
    const totalMaintenanceCost = vmCost + recCost;
    const totalTrips = exitRequests.filter((r) => r.status !== 'rejected').length;
    const totalMaintenance = maintenanceList.length + maintenanceRecords.length;

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
  }, [maintenanceList, maintenanceRecords, exitRequests, events, driverMap]);

  /* ── Combined maintenance list (vehicle_maintenance + maintenance_records) ── */
  const combinedMaintenance = useMemo(() => {
    const vmItems = maintenanceList.map((m) => ({
      id: `vm-${m.id}`,
      source: 'vehicle_maintenance' as const,
      maintenance_type: m.maintenance_type,
      date: m.performed_at + 'T00:00:00',
      description: m.description || '',
      cost: Number(m.cost),
      technician: m.performed_by || undefined,
      odometer_at: m.odometer_at ?? undefined,
      next_maintenance_date: m.next_maintenance_date || undefined,
      next_maintenance_km: m.next_maintenance_km ?? undefined,
      notes: m.notes || undefined,
      images: [] as { url: string; type: string }[],
      parts_replaced: undefined as string | undefined,
      duration_minutes: undefined as number | undefined,
    }));
    const recItems = maintenanceRecords.map((r) => ({
      id: `mrec-${r.id}`,
      source: 'maintenance_record' as const,
      maintenance_type: r.maintenance_type || 'صيانة',
      date: r.created_at,
      description: [r.fault_description, r.work_done].filter(Boolean).join(' — ') || '',
      cost: r.cost || 0,
      technician: r.technician_name || undefined,
      duration_minutes: r.duration_minutes ?? undefined,
      odometer_at: r.odometer_at ?? undefined,
      notes: r.notes || undefined,
      images: (r.maintenance_images || []).map((img) => ({ url: img.image_url, type: img.image_type })),
      parts_replaced: undefined as string | undefined,
      next_maintenance_date: undefined as string | undefined,
      next_maintenance_km: undefined as number | undefined,
    }));
    return [...vmItems, ...recItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [maintenanceList, maintenanceRecords]);

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
    const sheets: { data: unknown[][]; name: string }[] = [
      {
        data: [
          ['التقرير الفني الشامل للمركبة'],
          ['البيان', 'القيمة'],
          ['المعرف الرقمي (ID)', vehicle.id],
          ['رقم اللوحة', vehicle.plate_number],
          ['النوع الطراز', vehicle.vehicle_type || '—'],
          ['اللون المظهري', vehicle.color || '—'],
          ['سنة الصنع', vehicle.year || '—'],
          ['رقم الشاسي (Chassis)', vehicle.chassis_number || '—'],
          ['نوع الوقود', vehicle.fuel_type || '—'],
          ['عداد المسافة الحالي', `${vehicle.odometer_km.toLocaleString()} كم`],
          ['الحالة التشغيلية', STATUS_CONFIG[vehicle.status]?.label || vehicle.status],
          ['تاريخ انتهاء الرخصة', vehicle.license_expiry || '—'],
          ['تاريخ انتهاء التأمين', vehicle.insurance_expiry || '—'],
          ['السائق المسؤول الحالي', currentDriver || 'غير معين'],
          ['تحتوي على شعار (Logo)', vehicle.has_logo ? 'نعم' : 'لا'],
          ['ملاحظات المركبة', vehicle.notes || '—'],
          ['تاريخ الإدخال للنظام', fmtDateTime(vehicle.created_at)],
          ['تاريخ آخر تحديث للبيانات', fmtDateTime(vehicle.updated_at)]
        ],
        name: 'بيانات المركبة الأساسية',
      },
      {
        data: [
          ['سجل عمليات الصيانة والأعمال الفنية'],
          ['التاريخ', 'نوع الصيانة', 'العمل المنجز / الوصف', 'التكلفة (د.ع)', 'العداد (كم)', 'الفني / الجهة المنفذة', 'قطع الغيار المستبدلة', 'المدة (دقيقة)', 'نوع الإدخال', 'موعد الصيانة القادم', 'ملاحظات'],
          ...combinedMaintenance.map((m) => [
            fmtDateTime(m.date),
            m.maintenance_type,
            m.description || '',
            m.cost,
            m.odometer_at || '',
            m.technician || '—',
            m.parts_replaced || '—',
            m.duration_minutes || '—',
            m.source === 'maintenance_record' ? 'نظام الصيانة' : 'إدخال يدوي',
            m.next_maintenance_date || '—',
            m.notes || ''
          ])
        ],
        name: 'سجل الصيانة الشامل',
      },
      {
        data: [
          ['أرشيف الرحلات وإخراجات الكادر'],
          ['تاريخ الطلب', 'السائق', 'المساعدين', 'سبب الخروج', 'نوع الرحلة', 'المدة (د)', 'الحالة', 'الموافق (ID)', 'تاريخ الموافقة', 'تاريخ المغادرة', 'تاريخ العودة المتوقع', 'ملاحظات'],
          ...exitRequests.map((r) => [
            fmtDateTime(r.created_at),
            driverMap.get(String(r.driver_id)) || r.driver_name || '—',
            (r.assistant_names || []).join(' ، '),
            r.exit_reason || '—',
            r.exit_type === 'temporary' ? 'مؤقت' : 'دائم',
            r.exit_duration_minutes || '—',
            r.status === 'exited' ? 'خرج' : r.status === 'approved' ? 'مُوافق' : r.status === 'rejected' ? 'مرفوض' : 'بانتظار',
            r.approved_by || '—',
            r.approved_at ? fmtDateTime(r.approved_at) : '—',
            r.exited_at ? fmtDateTime(r.exited_at) : '—',
            r.returned_at ? fmtDateTime(r.returned_at) : '—',
            r.notes || ''
          ])
        ],
        name: 'سجل الرحلات التفصيلي',
      },
      {
        data: [
          ['سجل الأحداث الإدارية والفنية (Timeline)'],
          ['التاريخ والوقت', 'نوع الحدث', 'التفصيل الكامل', 'القيمة القديمة', 'القيمة الجديدة'],
          ...events.map((e) => [
            fmtDateTime(e.created_at),
            EVENT_CONFIG[e.event_type]?.label || e.event_type,
            e.description,
            e.old_value || '—',
            e.new_value || '—'
          ])
        ],
        name: 'الأرشيف الزمني الكامل',
      },
      {
        data: [
          ['تحليل المؤشرات والإحصائيات'],
          ['المؤشر الإحصائي', 'القيمة الحالية'],
          ['إجمالي الإنفاق على الصيانة', `${stats.totalMaintenanceCost.toLocaleString()} د.ع`],
          ['عدد عمليات الصيانة المسجلة', stats.totalMaintenance],
          ['عدد الرحلات التشغيلية', stats.totalTrips],
          ['المسافة الكلية المقطوعة', `${vehicle.odometer_km.toLocaleString()} كم`],
          ['أكثر السائقين استخداماً للمركبة', stats.topDriver],
          ['عدد رحلات السائق الأكثر استخداماً', stats.topDriverTrips],
          ['عدد مرات تغيير السائق المسؤول', stats.driverChanges],
          ['متوسط تكلفة الصيانة لكل رحلة', `${(stats.totalTrips > 0 ? stats.totalMaintenanceCost / stats.totalTrips : 0).toLocaleString()} د.ع`]
        ],
        name: 'التحليل والإحصائيات',
      }
    ];
    exportSheetsToExcel(sheets, `تقرير_تاريخي_شامل_مركبة_${vehicle.plate_number.replace(/ /g, '_')}`);
  };

  const exportPDF = async () => {
    if (!vehicle) return;
    
    const infoTable = `
      <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:11px;">
        <tr style="background:#f1f5f9;">
          <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; width:20%;">رقم اللوحة</td>
          <td style="padding:8px; border:1px solid #cbd5e1; width:30%;">${vehicle.plate_number}</td>
          <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; width:20%;">نوع المركبة</td>
          <td style="padding:8px; border:1px solid #cbd5e1; width:30%;">${vehicle.vehicle_type || '—'}</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold;">رقم الشاسي</td>
          <td style="padding:8px; border:1px solid #cbd5e1;">${vehicle.chassis_number || '—'}</td>
          <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold;">الموديل / السنة</td>
          <td style="padding:8px; border:1px solid #cbd5e1;">${vehicle.year || '—'}</td>
        </tr>
        <tr style="background:#f1f5f9;">
          <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold;">العداد الحالي</td>
          <td style="padding:8px; border:1px solid #cbd5e1;">${vehicle.odometer_km.toLocaleString()} كم</td>
          <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold;">نوع الوقود</td>
          <td style="padding:8px; border:1px solid #cbd5e1;">${vehicle.fuel_type || '—'}</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold;">السائق المسؤول</td>
          <td style="padding:8px; border:1px solid #cbd5e1;">${currentDriver || '—'}</td>
          <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold;">الحالة الحالية</td>
          <td style="padding:8px; border:1px solid #cbd5e1;">${STATUS_CONFIG[vehicle.status]?.label}</td>
        </tr>
      </table>
    `;

    let html = `
      <div style="font-family:'Noto Sans Arabic', sans-serif; direction:rtl; padding:10px;">
        <div style="text-align:center; border-bottom:4px solid #1e40af; padding-bottom:15px; margin-bottom:20px;">
          <h1 style="font-size:24px; color:#1e40af; margin:0;">التقرير التاريخي والفني الشامل للمركبة</h1>
          <p style="font-size:14px; color:#64748b; margin:5px 0 0;">الحسني هوم سنتر | Fleet Management System</p>
        </div>

        <h3 style="color:#1e40af; border-right:4px solid #1e40af; padding-right:10px; margin-bottom:10px;">أولاً: البيانات الأساسية للمركبة</h3>
        ${infoTable}

        <h3 style="color:#1e40af; border-right:4px solid #1e40af; padding-right:10px; margin-bottom:10px;">ثانياً: ملخص المؤشرات (Statistics)</h3>
        <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:25px;">
          <div style="flex:1; background:#fff7ed; padding:10px; border-radius:8px; text-align:center; border:1px solid #ffedd5;">
            <p style="font-size:10px; color:#9a3412; margin:0;">إجمالي الصيانة</p>
            <p style="font-size:14px; font-weight:bold; color:#c2410c; margin:5px 0 0;">${stats.totalMaintenanceCost.toLocaleString()} د.ع</p>
          </div>
          <div style="flex:1; background:#f0f9ff; padding:10px; border-radius:8px; text-align:center; border:1px solid #e0f2fe;">
            <p style="font-size:10px; color:#0369a1; margin:0;">عدد الرحلات</p>
            <p style="font-size:14px; font-weight:bold; color:#0369a1; margin:5px 0 0;">${stats.totalTrips}</p>
          </div>
          <div style="flex:1; background:#f0fdf4; padding:10px; border-radius:8px; text-align:center; border:1px solid #dcfce7;">
            <p style="font-size:10px; color:#15803d; margin:0;">عمليات الصيانة</p>
            <p style="font-size:14px; font-weight:bold; color:#15803d; margin:5px 0 0;">${stats.totalMaintenance}</p>
          </div>
        </div>

        <h3 style="background:#1e40af; color:white; padding:6px 12px; border-radius:6px; font-size:14px;">ثالثاً: سجل الصيانة وقطع الغيار</h3>
        <table style="width:100%; border-collapse:collapse; font-size:9px; margin-bottom:20px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:6px; border:1px solid #cbd5e1; text-align:right;">التاريخ</th>
              <th style="padding:6px; border:1px solid #cbd5e1; text-align:right;">النوع</th>
              <th style="padding:6px; border:1px solid #cbd5e1; text-align:right;">العمل المنجز</th>
              <th style="padding:6px; border:1px solid #cbd5e1; text-align:right;">قطع الغيار</th>
              <th style="padding:6px; border:1px solid #cbd5e1; text-align:right;">التكلفة</th>
              <th style="padding:6px; border:1px solid #cbd5e1; text-align:right;">الفني</th>
            </tr>
          </thead>
          <tbody>
            ${combinedMaintenance.map(m => `
              <tr>
                <td style="padding:5px; border:1px solid #cbd5e1;">${m.date.slice(0, 10)}</td>
                <td style="padding:5px; border:1px solid #cbd5e1;">${m.maintenance_type}</td>
                <td style="padding:5px; border:1px solid #cbd5e1;">${m.description || '—'}</td>
                <td style="padding:5px; border:1px solid #cbd5e1; color:#64748b;">${m.parts_replaced || '—'}</td>
                <td style="padding:5px; border:1px solid #cbd5e1; font-weight:bold;">${m.cost.toLocaleString()}</td>
                <td style="padding:5px; border:1px solid #cbd5e1;">${m.technician || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="page-break-before: always;"></div>

        <h3 style="background:#10b981; color:white; padding:6px 12px; border-radius:6px; font-size:14px;">رابعاً: سجل الرحلات وإخراجات الكادر التفصيلي</h3>
        <table style="width:100%; border-collapse:collapse; font-size:9px; margin-bottom:20px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:6px; border:1px solid #cbd5e1; text-align:right;">التاريخ</th>
              <th style="padding:6px; border:1px solid #cbd5e1; text-align:right;">السائق</th>
              <th style="padding:6px; border:1px solid #cbd5e1; text-align:right;">المساعدين</th>
              <th style="padding:6px; border:1px solid #cbd5e1; text-align:right;">السبب</th>
              <th style="padding:6px; border:1px solid #cbd5e1; text-align:right;">النوع</th>
              <th style="padding:6px; border:1px solid #cbd5e1; text-align:right;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${exitRequests.map(r => `
              <tr>
                <td style="padding:5px; border:1px solid #cbd5e1;">${r.created_at.slice(0, 10)}</td>
                <td style="padding:5px; border:1px solid #cbd5e1; font-weight:bold;">${driverMap.get(String(r.driver_id)) || r.driver_name || '—'}</td>
                <td style="padding:5px; border:1px solid #cbd5e1; color:#64748b;">${(r.assistant_names || []).join('، ') || '—'}</td>
                <td style="padding:5px; border:1px solid #cbd5e1;">${r.exit_reason || '—'}</td>
                <td style="padding:5px; border:1px solid #cbd5e1;">${r.exit_type === 'temporary' ? 'مؤقت' : 'دائم'}</td>
                <td style="padding:5px; border:1px solid #cbd5e1;">${r.status === 'exited' ? 'خرج' : 'تمت الموافقة'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h3 style="background:#6366f1; color:white; padding:6px 12px; border-radius:6px; font-size:14px;">خامساً: سجل التغييرات الإدارية (Driver History)</h3>
        <table style="width:100%; border-collapse:collapse; font-size:9px; margin-bottom:20px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:6px; border:1px solid #cbd5e1; text-align:right; width:25%;">التاريخ والوقت</th>
              <th style="padding:6px; border:1px solid #cbd5e1; text-align:right; width:15%;">الإجراء</th>
              <th style="padding:6px; border:1px solid #cbd5e1; text-align:right;">الوصف التفصيلي</th>
            </tr>
          </thead>
          <tbody>
            ${driverHistory.map(d => `
              <tr>
                <td style="padding:5px; border:1px solid #cbd5e1;">${fmtDateTime(d.date)}</td>
                <td style="padding:5px; border:1px solid #cbd5e1;">${d.type === 'driver_assigned' ? 'تعيين' : 'إزالة'}</td>
                <td style="padding:5px; border:1px solid #cbd5e1;">${d.description}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top:40px; border-top:1px solid #e2e8f0; padding-top:10px; display:flex; justify-content:space-between; font-size:9px; color:#94a3b8;">
          <span>نظام الحسني هوم سنتر لإدارة الأساطيل</span>
          <span>تاريخ إصدار التقرير: ${fmtDateTime(new Date().toISOString())}</span>
        </div>
      </div>
    `;

    try {
      await exportHtmlToPdf(html, `سجل_تاريخي_مركبة_${vehicle.plate_number}.pdf`);
    } catch (e) {
      console.error(e);
      alert('فشل تصدير التقرير الشامل: ' + (e instanceof Error ? e.message : 'خطأ غير معروف'));
    }
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
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-colors">
            <Download className="w-3.5 h-3.5" /> تصدير Excel
          </motion.button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={exportPDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-medium shadow-lg shadow-red-600/25 hover:bg-red-700 transition-colors">
            <Download className="w-3.5 h-3.5" /> تصدير PDF
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
          { key: 'maintenance' as TabKey, label: 'الصيانة', icon: Wrench, count: combinedMaintenance.length },
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
                        {item.images && item.images.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {item.images.map((img, i) => (
                              <a key={i} href={img.url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-700 text-[11px] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600">
                                <ImageIcon className="w-3 h-3" />
                                {img.type === 'before' ? 'قبل' : img.type === 'during' ? 'أثناء' : img.type === 'after' ? 'بعد' : img.type === 'invoice' ? 'فاتورة' : img.type}
                              </a>
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
            {combinedMaintenance.length === 0 ? (
              <div className="py-16 text-center">
                <Wrench className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-600 mb-3" />
                <p className="text-stone-500 dark:text-stone-400 text-sm">لا توجد سجل صيانة</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-700">
                {combinedMaintenance.map((m) => (
                  <div key={m.id} className="p-4 hover:bg-stone-50/50 dark:hover:bg-stone-700/30">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                          <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-stone-900 dark:text-white">{m.maintenance_type}</p>
                          <p className="text-[10px] text-stone-400">{fmtDateTime(m.date)}</p>
                        </div>
                      </div>
                      {m.cost > 0 && (
                        <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{m.cost.toLocaleString()} د.ع</span>
                      )}
                    </div>
                    <div className="mr-10 space-y-1">
                      {m.description && <p className="text-xs text-stone-600 dark:text-stone-300">{m.description}</p>}
                      <div className="flex flex-wrap gap-3 text-xs text-stone-500 dark:text-stone-400">
                        {m.odometer_at && <span className="flex items-center gap-1"><Gauge className="w-3 h-3" /> {m.odometer_at.toLocaleString()} كم</span>}
                        {m.technician && (
                          <span className="flex items-center gap-1"><User className="w-3 h-3" /> {m.technician}</span>
                        )}
                        {m.duration_minutes && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {m.duration_minutes} دقيقة</span>}
                        {m.next_maintenance_date && (
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400"><Calendar className="w-3 h-3" /> القادمة: {m.next_maintenance_date}</span>
                        )}
                        {m.next_maintenance_km && (
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400"><Gauge className="w-3 h-3" /> القادمة: {m.next_maintenance_km.toLocaleString()} كم</span>
                        )}
                      </div>
                      {m.notes && <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1">{m.notes}</p>}
                      {m.images && m.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {m.images.map((img, i) => (
                            <a key={i} href={img.url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-700 text-[11px] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600">
                              <ImageIcon className="w-3 h-3" />
                              {img.type === 'before' ? 'قبل' : img.type === 'during' ? 'أثناء' : img.type === 'after' ? 'بعد' : img.type === 'invoice' ? 'فاتورة' : img.type}
                            </a>
                          ))}
                        </div>
                      )}
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
              {combinedMaintenance.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-8">لا توجد بيانات صيانة</p>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const monthlyMap = new Map<string, number>();
                    for (const m of combinedMaintenance) {
                      const key = m.date.slice(0, 7); // YYYY-MM
                      monthlyMap.set(key, (monthlyMap.get(key) || 0) + m.cost);
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
