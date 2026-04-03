import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Truck, User, Calendar, Gauge,
  Clock, Wrench, FileText,
  Activity, Loader2, History, ClipboardCheck, RefreshCw,
  ArrowLeftRight, Image as ImageIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getDepartmentClient } from '../data/supabaseSource';
import { exportSheetsToExcel } from '../lib/excelExport';
import { parseReportIdFromVehicleEventNewValue } from '../lib/savedReportFromRow';
import SavedReportDetailModal from '../components/SavedReportDetailModal';

type InstallationStatus = 'available' | 'maintenance' | 'broken' | 'reserved';

interface InstallationVehicleRow {
  id: number;
  vehicle_number: string;
  vehicle_type: string;
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

interface InstallationVehicleEventRow {
  id: number;
  vehicle_id: number;
  event_type: string;
  description: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

interface InstallationVehicleMaintRow {
  id: number;
  vehicle_id: number;
  maintenance_type: string;
  description: string | null;
  cost: number;
  odometer_at: number | null;
  performed_at: string;
  next_maintenance_date: string | null;
  performed_by: string | null;
  notes: string | null;
}

interface InstallationMaintImageRow {
  image_url: string;
  image_type: string;
}

interface InstallationMaintRecordRow {
  id: number;
  vehicle_id: number;
  maintenance_type: string | null;
  fault_description: string | null;
  work_done: string | null;
  technician_name: string | null;
  cost: number;
  duration_minutes: number | null;
  notes: string | null;
  odometer_at: number | null;
  created_at: string;
  installation_maintenance_images?: InstallationMaintImageRow[];
}

interface InstallationExitRow {
  id: number;
  vehicle_id: number | null;
  driver_id: number | null;
  driver_name: string | null;
  assistant_names: string[];
  exit_reason: string | null;
  exit_type: string;
  exit_duration_minutes: number | null;
  status: string;
  created_at: string;
  notes: string | null;
  vehicle_plate: string | null;
}

const STATUS_CONFIG: Record<InstallationStatus, { label: string; color: string; bgColor: string }> = {
  available: { label: 'متاحة', color: 'text-emerald-700 dark:text-emerald-300', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' },
  maintenance: { label: 'صيانة', color: 'text-amber-700 dark:text-amber-300', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  broken: { label: 'معطلة', color: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  reserved: { label: 'محجوزة', color: 'text-blue-700 dark:text-blue-300', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
};

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  starex: 'ستاركس',
  nissan: 'نيسان',
};

const EVENT_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  driver_assigned: { label: 'تعيين سائق', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30', icon: User },
  driver_removed: { label: 'إزالة سائق', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30', icon: User },
  responsible_changed: { label: 'تغيير المسؤول', color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-100 dark:bg-violet-900/30', icon: User },
  status_changed: { label: 'تغيير حالة', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30', icon: RefreshCw },
  created: { label: 'إنشاء المركبة', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: Truck },
  maintenance: { label: 'صيانة', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30', icon: Wrench },
  exit_request: { label: 'طلب خروج', color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-100 dark:bg-sky-900/30', icon: Activity },
  vehicle_exit: { label: 'إخراج مركبة', color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30', icon: Activity },
  report_created: { label: 'تقرير فحص / جرد', color: 'text-rose-600 dark:text-rose-400', bgColor: 'bg-rose-100 dark:bg-rose-900/30', icon: ClipboardCheck },
  note_added: { label: 'ملاحظة', color: 'text-stone-600 dark:text-stone-400', bgColor: 'bg-stone-100 dark:bg-stone-800', icon: FileText },
};

function exitRequestStatusLabelAr(status: string): string {
  if (status === 'exited') return 'خرج';
  if (status === 'approved') return 'مُوافق';
  if (status === 'rejected') return 'مرفوض';
  if (status === 'pending_issue') return 'مشكلة تحميل';
  if (status === 'approved_override') return 'مسموح (تجاوز)';
  if (status === 'pending') return 'بانتظار';
  return status || 'بانتظار';
}

function exitRequestStatusBadgeClass(status: string): string {
  if (status === 'exited') return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
  if (status === 'approved') return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
  if (status === 'rejected') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
  if (status === 'pending_issue') return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200';
  if (status === 'approved_override') return 'bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200';
  return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
}

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
  reportId?: number | null;
}

interface InstallationVehicleHistoryProps {
  vehicleId: number;
  onBack: () => void;
}

type TabKey = 'timeline' | 'trips' | 'maintenance' | 'responsible';

export default function InstallationVehicleHistory({ vehicleId, onBack }: InstallationVehicleHistoryProps) {
  const supabase = getDepartmentClient('installation');
  const [vehicle, setVehicle] = useState<InstallationVehicleRow | null>(null);
  const [maintenanceList, setMaintenanceList] = useState<InstallationVehicleMaintRow[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<InstallationMaintRecordRow[]>([]);
  const [events, setEvents] = useState<InstallationVehicleEventRow[]>([]);
  const [exitRequests, setExitRequests] = useState<InstallationExitRow[]>([]);
  const [staffMap, setStaffMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('timeline');
  const [timelineLimit, setTimelineLimit] = useState(40);
  const [timelineReportId, setTimelineReportId] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    const [vRes, mRes, mrRes, eRes, erRes, sRes] = await Promise.all([
      supabase.from('installation_vehicles').select('*').eq('id', vehicleId).single(),
      supabase.from('installation_vehicle_maintenance').select('*').eq('vehicle_id', vehicleId).order('performed_at', { ascending: false }),
      supabase
        .from('installation_maintenance_records')
        .select('*, installation_maintenance_images(*)')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false }),
      supabase.from('installation_vehicle_events').select('*').eq('vehicle_id', vehicleId).order('created_at', { ascending: false }),
      supabase.from('installation_exit_requests').select('*').eq('vehicle_id', vehicleId).order('created_at', { ascending: false }),
      supabase.from('installation_staff_members').select('id, full_name'),
    ]);
    if (vRes.data) setVehicle(vRes.data as InstallationVehicleRow);
    if (mRes.data) setMaintenanceList(mRes.data as InstallationVehicleMaintRow[]);
    if (mrRes.data) setMaintenanceRecords(mrRes.data as InstallationMaintRecordRow[]);
    if (eRes.data) setEvents(eRes.data as InstallationVehicleEventRow[]);
    if (erRes.data) setExitRequests(erRes.data as InstallationExitRow[]);
    if (sRes.data) {
      setStaffMap(new Map(sRes.data.map((s: { id: number; full_name: string }) => [String(s.id), s.full_name])));
    }
    setLoading(false);
  }, [supabase, vehicleId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const fmtDateTime = (d: string) => {
    const dt = new Date(d);
    return `${dt.toLocaleDateString('ar-IQ')} ${dt.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    for (const ev of events) {
      items.push({
        id: `ev-${ev.id}`,
        type: ev.event_type,
        date: ev.created_at,
        title: EVENT_CONFIG[ev.event_type]?.label || ev.event_type,
        description: ev.description,
        oldValue: ev.old_value,
        newValue: ev.new_value,
        reportId:
          ev.event_type === 'report_created' ? parseReportIdFromVehicleEventNewValue(ev.new_value) : undefined,
      });
    }

    for (const m of maintenanceList) {
      items.push({
        id: `vm-${m.id}`,
        type: 'maintenance',
        date: m.performed_at + 'T00:00:00',
        title: m.maintenance_type,
        description: m.description || '',
        details: {
          ...(Number(m.cost) > 0 ? { التكلفة: `${Number(m.cost).toLocaleString()} د.ع` } : {}),
          ...(m.odometer_at ? { العداد: `${m.odometer_at.toLocaleString()} كم` } : {}),
          ...(m.performed_by ? { بواسطة: m.performed_by } : {}),
          ...(m.next_maintenance_date ? { 'الصيانة القادمة': m.next_maintenance_date } : {}),
          ...(m.notes ? { ملاحظات: m.notes } : {}),
        },
      });
    }

    for (const rec of maintenanceRecords) {
      const imgs = (rec.installation_maintenance_images || []).map((img) => ({ url: img.image_url, type: img.image_type }));
      const desc = [rec.fault_description, rec.work_done].filter(Boolean).join(' — ');
      items.push({
        id: `mrec-${rec.id}`,
        type: 'maintenance',
        date: rec.created_at,
        title: rec.maintenance_type || 'صيانة (نظام)',
        description: desc || '',
        details: {
          ...(rec.cost > 0 ? { التكلفة: `${rec.cost.toLocaleString()} د.ع` } : {}),
          ...(rec.duration_minutes ? { المدة: `${rec.duration_minutes} دقيقة` } : {}),
          ...(rec.technician_name ? { الفني: rec.technician_name } : {}),
          ...(rec.odometer_at ? { العداد: `${rec.odometer_at.toLocaleString()} كم` } : {}),
          ...(rec.notes ? { ملاحظات: rec.notes } : {}),
        },
        images: imgs.length > 0 ? imgs : undefined,
      });
    }

    for (const r of exitRequests) {
      const assistantNames = (r.assistant_names || []).join('، ');
      const driverLabel = r.driver_id ? staffMap.get(String(r.driver_id)) || r.driver_name || '—' : r.driver_name || '—';
      items.push({
        id: `er-${r.id}`,
        type: 'exit_request',
        date: r.created_at,
        title: `رحلة ${r.exit_type === 'temporary' ? 'مؤقتة' : 'دائمة'}`,
        description: driverLabel ? `الفني/السائق: ${driverLabel}` : '',
        details: {
          ...(assistantNames ? { المساعدون: assistantNames } : {}),
          ...(r.exit_reason ? { السبب: r.exit_reason } : {}),
          ...(r.exit_duration_minutes ? { المدة: `${r.exit_duration_minutes} دقيقة` } : {}),
          الحالة: exitRequestStatusLabelAr(r.status),
        },
      });
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }, [events, maintenanceList, maintenanceRecords, exitRequests, staffMap]);

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
      notes: m.notes || undefined,
      images: [] as { url: string; type: string }[],
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
      images: (r.installation_maintenance_images || []).map((img) => ({ url: img.image_url, type: img.image_type })),
      next_maintenance_date: undefined as string | undefined,
    }));
    return [...vmItems, ...recItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [maintenanceList, maintenanceRecords]);

  const responsibleHistory = useMemo(() => {
    return events
      .filter((e) => e.event_type === 'responsible_changed')
      .map((e) => ({
        id: e.id,
        date: e.created_at,
        oldName: e.old_value || null,
        newName: e.new_value || null,
        description: e.description,
      }));
  }, [events]);

  const currentResponsibleName = vehicle?.responsible_staff_id
    ? staffMap.get(String(vehicle.responsible_staff_id)) || 'غير معروف'
    : null;

  const exportExcel = () => {
    if (!vehicle) return;
    const typeAr = VEHICLE_TYPE_LABEL[vehicle.vehicle_type] || vehicle.vehicle_type;
    const sheets: { data: unknown[][]; name: string }[] = [
      {
        data: [
          ['المركبة — قسم التركيب'],
          ['البيان', 'القيمة'],
          ['رقم المركبة', vehicle.vehicle_number],
          ['النوع', typeAr],
          ['الحالة', STATUS_CONFIG[vehicle.status]?.label || vehicle.status],
          ['الموقع', vehicle.location || '—'],
          ['الموديل', vehicle.model || '—'],
          ['اللون', vehicle.color || '—'],
          ['السنة', vehicle.year ?? '—'],
          ['الشاسي', vehicle.chassis_number || '—'],
          ['الفني المسؤول الحالي', currentResponsibleName || 'بدون مسؤول'],
          ['ملاحظات', vehicle.notes || '—'],
          ['تاريخ الإنشاء', vehicle.created_at],
          ['آخر تحديث', vehicle.updated_at],
        ],
        name: 'بيانات المركبة',
      },
      {
        data: [
          ['الخط الزمني الموحّد'],
          ['التاريخ', 'النوع', 'الوصف', 'قديم', 'جديد'],
          ...events.map((e) => [
            e.created_at,
            EVENT_CONFIG[e.event_type]?.label || e.event_type,
            e.description,
            e.old_value || '—',
            e.new_value || '—',
          ]),
        ],
        name: 'أحداث السجل',
      },
      {
        data: [
          ['الصيانة'],
          ['التاريخ', 'النوع', 'الوصف', 'التكلفة', 'الفني'],
          ...combinedMaintenance.map((m) => [m.date, m.maintenance_type, m.description, m.cost, m.technician || '—']),
        ],
        name: 'الصيانة',
      },
    ];
    exportSheetsToExcel(sheets, `سجل_مركبة_تركيب_${vehicle.vehicle_number.replace(/\s+/g, '_')}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-20" dir="rtl">
        <p className="text-stone-500">المركبة غير موجودة</p>
        <button type="button" onClick={onBack} className="mt-4 text-emerald-600 hover:underline font-medium">
          العودة
        </button>
      </div>
    );
  }

  const sc = STATUS_CONFIG[vehicle.status];
  const typeAr = VEHICLE_TYPE_LABEL[vehicle.vehicle_type] || vehicle.vehicle_type;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3 flex-wrap">
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-sm font-medium transition-colors"
        >
          <ArrowRight className="w-4 h-4" /> العودة للمركبات
        </motion.button>
        <div className="flex-1" />
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={exportExcel}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-medium shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-colors"
        >
          تصدير Excel
        </motion.button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-5 shadow-sm"
      >
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center', sc.bgColor)}>
              <Truck className={cn('w-7 h-7', sc.color)} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl font-black text-stone-900 dark:text-white">{vehicle.vehicle_number}</span>
                <span className={cn('px-2.5 py-1 rounded-lg text-xs font-medium', sc.bgColor, sc.color)}>{sc.label}</span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                  {typeAr}
                </span>
              </div>
              {currentResponsibleName && (
                <div className="flex items-center gap-1.5 mt-1 text-sm text-stone-600 dark:text-stone-300">
                  <User className="w-3.5 h-3.5" /> الفني المسؤول: {currentResponsibleName}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs mr-auto">
            {vehicle.location && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                الموقع: {vehicle.location}
              </span>
            )}
            {vehicle.chassis_number && (
              <span className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                شاسي: {vehicle.chassis_number}
              </span>
            )}
          </div>
        </div>
        {vehicle.notes && (
          <p className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-700 text-sm text-stone-600 dark:text-stone-300">
            {vehicle.notes}
          </p>
        )}
      </motion.div>

      <div className="flex gap-1 p-1 rounded-xl bg-stone-100 dark:bg-stone-800 overflow-x-auto">
        {(
          [
            { key: 'timeline' as const, label: 'التاريخ الكامل', icon: History, count: timeline.length },
            { key: 'trips' as const, label: 'الرحلات', icon: Activity, count: exitRequests.length },
            { key: 'maintenance' as const, label: 'الصيانة', icon: Wrench, count: combinedMaintenance.length },
            { key: 'responsible' as const, label: 'المسؤولون', icon: ArrowLeftRight, count: responsibleHistory.length },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
              activeTab === tab.key
                ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-sm'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200',
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.count > 0 && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-full text-[10px]',
                  activeTab === tab.key
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-stone-200 dark:bg-stone-600 text-stone-500 dark:text-stone-400',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'timeline' && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 overflow-hidden"
          >
            {timeline.length === 0 ? (
              <div className="py-16 text-center">
                <History className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-600 mb-3" />
                <p className="text-stone-500 dark:text-stone-400 text-sm">لا توجد أحداث مسجلة بعد</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-700">
                {timeline.slice(0, timelineLimit).map((item, idx) => {
                  const cfg = EVENT_CONFIG[item.type] || EVENT_CONFIG.note_added;
                  const openReport =
                    item.type === 'report_created' && item.reportId != null && !Number.isNaN(item.reportId);
                  return (
                    <div
                      key={item.id}
                      role={openReport ? 'button' : undefined}
                      tabIndex={openReport ? 0 : undefined}
                      onClick={openReport ? () => setTimelineReportId(item.reportId!) : undefined}
                      onKeyDown={
                        openReport
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setTimelineReportId(item.reportId!);
                              }
                            }
                          : undefined
                      }
                      className={cn(
                        'flex gap-3 p-4 transition-colors rounded-xl -mx-1',
                        openReport
                          ? 'cursor-pointer hover:bg-rose-50/60 dark:hover:bg-rose-950/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400'
                          : 'hover:bg-stone-50/50 dark:hover:bg-stone-700/30',
                      )}
                    >
                      <div className="flex flex-col items-center pt-0.5">
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', cfg.bgColor)}>
                          <cfg.icon className={cn('w-4 h-4', cfg.color)} />
                        </div>
                        {idx < Math.min(timeline.length, timelineLimit) - 1 && (
                          <div className="w-0.5 flex-1 bg-stone-200 dark:bg-stone-700 mt-1 min-h-[16px]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn('text-sm font-semibold', cfg.color)}>{item.title}</span>
                            {openReport && (
                              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                اضغط لعرض التقرير كاملاً
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-stone-400 dark:text-stone-500 whitespace-nowrap">
                            {fmtDateTime(item.date)}
                          </span>
                        </div>
                        {item.description && <p className="text-xs text-stone-600 dark:text-stone-300 mt-1">{item.description}</p>}
                        {(item.oldValue || item.newValue) && (
                          <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                            {item.oldValue && (
                              <span className="px-2 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 line-through">
                                {item.oldValue}
                              </span>
                            )}
                            {item.oldValue && item.newValue && <ArrowRight className="w-3 h-3 text-stone-400 shrink-0" />}
                            {item.newValue && (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                                {item.newValue}
                              </span>
                            )}
                          </div>
                        )}
                        {item.details && Object.keys(item.details).length > 0 && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11px] text-stone-500 dark:text-stone-400">
                            {Object.entries(item.details).map(([k, v]) => (
                              <span key={k}>
                                <span className="text-stone-400 dark:text-stone-500">{k}:</span> {v}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.images && item.images.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {item.images.map((img, i) => (
                              <a
                                key={i}
                                href={img.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-700 text-[11px] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600"
                              >
                                <ImageIcon className="w-3 h-3" />
                                {img.type === 'before'
                                  ? 'قبل'
                                  : img.type === 'during'
                                    ? 'أثناء'
                                    : img.type === 'after'
                                      ? 'بعد'
                                      : img.type === 'invoice'
                                        ? 'فاتورة'
                                        : img.type}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {timeline.length > timelineLimit && (
                  <button
                    type="button"
                    onClick={() => setTimelineLimit((l) => l + 40)}
                    className="w-full py-3 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors font-medium"
                  >
                    عرض المزيد ({timeline.length - timelineLimit} حدث)
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'trips' && (
          <motion.div
            key="trips"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 overflow-hidden"
          >
            {exitRequests.length === 0 ? (
              <div className="py-16 text-center">
                <Activity className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-600 mb-3" />
                <p className="text-stone-500 dark:text-stone-400 text-sm">لا توجد رحلات مسجلة لهذه المركبة</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-700">
                {exitRequests.map((r) => {
                  const driverLabel = r.driver_id ? staffMap.get(String(r.driver_id)) || r.driver_name || '—' : r.driver_name || '—';
                  return (
                    <div key={r.id} className="p-4 hover:bg-stone-50/50 dark:hover:bg-stone-700/30">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                            <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-stone-900 dark:text-white">{driverLabel}</p>
                            <p className="text-[10px] text-stone-400">{fmtDateTime(r.created_at)}</p>
                          </div>
                        </div>
                        <span className={cn('px-2.5 py-1 rounded-lg text-xs font-medium', exitRequestStatusBadgeClass(r.status))}>
                          {exitRequestStatusLabelAr(r.status)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-stone-500 dark:text-stone-400 mr-10">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {r.exit_type === 'temporary' ? `مؤقت (${r.exit_duration_minutes || '—'} د)` : 'دائم'}
                        </span>
                        {r.exit_reason && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" /> {r.exit_reason}
                          </span>
                        )}
                        {(r.assistant_names || []).length > 0 && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" /> {(r.assistant_names || []).join('، ')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'maintenance' && (
          <motion.div
            key="maintenance"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 overflow-hidden"
          >
            {combinedMaintenance.length === 0 ? (
              <div className="py-16 text-center">
                <Wrench className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-600 mb-3" />
                <p className="text-stone-500 dark:text-stone-400 text-sm">لا توجد سجلات صيانة</p>
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
                          <p className="text-[10px] text-stone-400">
                            {fmtDateTime(m.date)} · {m.source === 'maintenance_record' ? 'نظام الصيانة' : 'إدخال يدوي'}
                          </p>
                        </div>
                      </div>
                      {m.cost > 0 && (
                        <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{m.cost.toLocaleString()} د.ع</span>
                      )}
                    </div>
                    <div className="mr-10 space-y-1">
                      {m.description && <p className="text-xs text-stone-600 dark:text-stone-300">{m.description}</p>}
                      <div className="flex flex-wrap gap-3 text-xs text-stone-500 dark:text-stone-400">
                        {m.odometer_at && (
                          <span className="flex items-center gap-1">
                            <Gauge className="w-3 h-3" /> {m.odometer_at.toLocaleString()} كم
                          </span>
                        )}
                        {m.technician && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" /> {m.technician}
                          </span>
                        )}
                        {m.duration_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {m.duration_minutes} د
                          </span>
                        )}
                        {m.next_maintenance_date && (
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <Calendar className="w-3 h-3" /> القادمة: {m.next_maintenance_date}
                          </span>
                        )}
                      </div>
                      {m.notes && <p className="text-[11px] text-stone-400 mt-1">{m.notes}</p>}
                      {m.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {m.images.map((img, i) => (
                            <a
                              key={i}
                              href={img.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-700 text-[11px]"
                            >
                              <ImageIcon className="w-3 h-3" /> صورة
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

        {activeTab === 'responsible' && (
          <motion.div
            key="responsible"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 overflow-hidden"
          >
            <div className="p-4 border-b border-stone-100 dark:border-stone-700">
              <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2">الفني المسؤول حالياً</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <User className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <p className="text-sm font-bold text-stone-900 dark:text-white">
                  {currentResponsibleName || 'بدون فني مسؤول'}
                </p>
              </div>
            </div>
            {responsibleHistory.length === 0 ? (
              <div className="py-12 text-center">
                <ArrowLeftRight className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-600 mb-3" />
                <p className="text-stone-500 dark:text-stone-400 text-sm">لا يوجد سجل تغيير للمسؤول</p>
                <p className="text-[10px] text-stone-400 mt-1">يُسجَّل تلقائياً عند تعديل الفني المسؤول من بطاقة المركبة</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-700">
                {responsibleHistory.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 p-4 hover:bg-stone-50/50 dark:hover:bg-stone-700/30">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                      <User className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        {d.oldName && <span className="text-red-600 dark:text-red-400 line-through">{d.oldName}</span>}
                        {d.oldName && d.newName && <ArrowRight className="w-3.5 h-3.5 text-stone-400" />}
                        {d.newName && <span className="text-emerald-600 dark:text-emerald-400 font-medium">{d.newName}</span>}
                      </div>
                      <p className="text-[10px] text-stone-400 mt-0.5">{fmtDateTime(d.date)}</p>
                      {d.description && <p className="text-xs text-stone-500 mt-1">{d.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <SavedReportDetailModal
        department="installation"
        reportId={timelineReportId}
        onClose={() => setTimelineReportId(null)}
      />
    </div>
  );
}
