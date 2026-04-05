import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Trash2,
  Save,
  RotateCcw,
  Archive,
  Download,
  X,
  Check,
  Clock,
  XCircle,
  CalendarOff,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Truck,
  Package,
  BarChart3,
} from 'lucide-react';
import { cn, ATTENDANCE_TYPE_COLORS } from '../lib/utils';
import {
  getDepartmentClient,
  getDepartmentTables,
  normalizeDepartmentVehicleRow,
} from '../data/supabaseSource';
import type { DepartmentCode } from '../data/department';
import { exportHtmlToPdf } from '../lib/pdfExport';
import { exportToCsv } from '../lib/excelExport';
import { logAttendanceActivity } from '../lib/attendanceActivity';
import { rpcWithInstallationFallback } from '../lib/rpcFallback';
import type {
  UserProfile,
  StaffMember,
  Attendance,
  AttendanceType,
  Vehicle,
  ExitRequest,
} from '../lib/supabaseClient';
import {
  SmartSearchBar,
  HighlightText,
  InsightsPanel,
  ChartsPanel,
  ExportMenu,
  SavedViews,
  useAutoRefresh,
  rankItems,
  insightsFromAttendanceRows,
} from '../smart';
import { WORK_TIMEZONE } from '../lib/loadingTime';

const ATTENDANCE_TYPES: { value: AttendanceType; label: string }[] = [
  { value: 'present', label: 'حاضر' },
  { value: 'late', label: 'متأخر' },
  { value: 'absent', label: 'غائب' },
  { value: 'full_leave', label: 'إجازة كاملة' },
  { value: 'time_leave', label: 'إجازة زمنية' },
];

const TIME_REGEX = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;

function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isValidTime(s: string): boolean {
  return TIME_REGEX.test(s);
}

interface RowState {
  staff_id: number;
  attendance_type: AttendanceType;
  check_in_time: string;
  check_out_time: string;
  notes: string;
  vehicle_id: number | null;
  attendance_id?: number;
}

function buildAttendanceRow(
  s: StaffMember,
  att: Attendance | undefined,
  vehicleByDriver: Record<number, Vehicle>
): RowState {
  const id = Number(s.id);
  const defaultVehicleId = s.role === 'driver' ? vehicleByDriver[id]?.id ?? null : null;
  return {
    staff_id: id,
    attendance_type: (att?.attendance_type as AttendanceType) ?? 'present',
    check_in_time: att?.check_in_time ? String(att.check_in_time).slice(0, 5) : '08:00',
    check_out_time: att?.check_out_time ? String(att.check_out_time).slice(0, 5) : '12:00',
    notes: att?.notes ?? '',
    vehicle_id: att?.vehicle_id ?? defaultVehicleId,
    attendance_id: att?.id,
  };
}

interface Props {
  profile: UserProfile | null;
  department?: DepartmentCode;
}

export default function CrewAttendance({ profile, department = 'tajhiz' }: Props) {
  const supabase = getDepartmentClient(department);
  const tables = getDepartmentTables(department);
  const isInstallation = department === 'installation';
  const driverSingular = isInstallation ? 'فني' : 'سائق';
  const assistantSingular = isInstallation ? 'مساعد فني' : 'مساعد سائق';
  const driverPlural = isInstallation ? 'الفنيون' : 'السائقون';
  const assistantPlural = isInstallation ? 'مساعدو الفنيين' : 'مساعدو السائقين';

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [roleFilter, setRoleFilter] = useState<'all' | 'driver' | 'assistant'>('all');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [showAddAssistant, setShowAddAssistant] = useState(false);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortRelevance, setSortRelevance] = useState(false);
  const [driverLoadingModal, setDriverLoadingModal] = useState<{ staffId: number; name: string } | null>(null);
  const [driverExitRequests, setDriverExitRequests] = useState<ExitRequest[]>([]);
  const [driverExitLoading, setDriverExitLoading] = useState(false);
  /** تجميع احتساب التحميل لكل سائق (للتصدير وبطاقات سريعة) */
  const [driverExitAggMap, setDriverExitAggMap] = useState<
    Record<number, { tracked: number; delayEvents: number; totalDelayMin: number }>
  >({});

  const resyncRowsFromServerRef = useRef(false);

  const todayStr = getTodayDateStr();
  const isAdmin = profile?.role === 'admin';

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [staffRes, vehRes, attRes, exitRes] = await Promise.all([
      supabase.from(tables.staffMembers).select('*').eq('is_active', true).order('role').order('full_name'),
      supabase.from(tables.vehicles).select('*'),
      supabase.from(tables.attendance).select('*').eq('attendance_date', todayStr),
      supabase
        .from(tables.exitRequests)
        .select('driver_id, loading_is_delay, loading_delay_minutes')
        .eq('track_driver_loading_time', true),
    ]);
    if (staffRes.data) {
      const normalizedStaff = (staffRes.data as Array<Record<string, unknown>>).map((s) => ({
        ...s,
        role: s.role === 'assistant' || s.role === 'crew' ? 'assistant' : 'driver',
      })) as StaffMember[];
      setStaff(normalizedStaff);
    }
    if (vehRes.data) {
      setVehicles(
        (vehRes.data as Array<Record<string, unknown>>).map((v) => normalizeDepartmentVehicleRow(v)),
      );
    }
    if (attRes.data) setAttendance(attRes.data);
    if (exitRes.data) {
      const m: Record<number, { tracked: number; delayEvents: number; totalDelayMin: number }> = {};
      for (const row of exitRes.data) {
        if (row.driver_id == null) continue;
        const id = Number(row.driver_id);
        if (!Number.isFinite(id)) continue;
        if (!m[id]) m[id] = { tracked: 0, delayEvents: 0, totalDelayMin: 0 };
        m[id].tracked += 1;
        if (row.loading_is_delay === true || (row.loading_delay_minutes ?? 0) > 0) {
          m[id].delayEvents += 1;
          m[id].totalDelayMin += row.loading_delay_minutes ?? 0;
        }
      }
      setDriverExitAggMap(m);
    } else {
      setDriverExitAggMap({});
    }
    if (!silent) setLoading(false);
  }, [todayStr, supabase, tables]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!driverLoadingModal) {
      setDriverExitRequests([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setDriverExitLoading(true);
      const { data, error } = await supabase
        .from(tables.exitRequests)
        .select('*')
        .eq('track_driver_loading_time', true)
        .eq('driver_id', driverLoadingModal.staffId)
        .order('created_at', { ascending: false });
      if (!cancelled) {
        if (!error && data) setDriverExitRequests(data as ExitRequest[]);
        else setDriverExitRequests([]);
        setDriverExitLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [driverLoadingModal]);

  const drivers = useMemo(() => staff.filter((s) => s.role === 'driver'), [staff]);
  const assistants = useMemo(() => staff.filter((s) => s.role === 'assistant'), [staff]);

  const attendanceByStaff = useMemo(() => {
    const m: Record<number, Attendance> = {};
    attendance.forEach((a) => { m[a.staff_id] = a; });
    return m;
  }, [attendance]);

  const vehicleByDriver = useMemo(() => {
    const m: Record<number, Vehicle> = {};
    vehicles.forEach((v) => {
      if (v.assigned_driver_id) m[Number(v.assigned_driver_id)] = v;
    });
    return m;
  }, [vehicles]);

  useEffect(() => {
    if (resyncRowsFromServerRef.current) {
      resyncRowsFromServerRef.current = false;
      setRows(staff.map((s) => buildAttendanceRow(s, attendanceByStaff[Number(s.id)], vehicleByDriver)));
      return;
    }
    setRows((prev) => {
      const prevMap = new Map<number, RowState>(prev.map((r) => [r.staff_id, r]));
      return staff.map((s) => {
        const id = Number(s.id);
        const att = attendanceByStaff[id];
        const existing = prevMap.get(id);
        const defaultVehicleId = s.role === 'driver' ? vehicleByDriver[id]?.id ?? null : null;
        if (existing) {
          return {
            ...existing,
            attendance_id: att?.id ?? existing.attendance_id,
            vehicle_id: existing.vehicle_id ?? att?.vehicle_id ?? defaultVehicleId,
          };
        }
        return buildAttendanceRow(s, att, vehicleByDriver);
      });
    });
  }, [staff, attendanceByStaff, vehicleByDriver]);

  const driverLoadingStats = useMemo(() => {
    const delayRows = driverExitRequests.filter((r) => r.loading_is_delay === true || (r.loading_delay_minutes ?? 0) > 0);
    const delayCount = delayRows.length;
    const totalDelayMinutes = driverExitRequests.reduce((s, r) => s + (r.loading_delay_minutes ?? 0), 0);
    const avgDelayMinutes =
      delayCount > 0 ? Math.round((totalDelayMinutes / delayCount) * 10) / 10 : 0;
    return { delayCount, totalDelayMinutes, avgDelayMinutes };
  }, [driverExitRequests]);

  const visibleRows = useMemo(() => {
    let list = rows;
    if (roleFilter === 'driver') {
      list = list.filter((r) => staff.find((x) => Number(x.id) === r.staff_id)?.role === 'driver');
    } else if (roleFilter === 'assistant') {
      list = list.filter((r) => staff.find((x) => Number(x.id) === r.staff_id)?.role === 'assistant');
    }
    const query = searchQuery.trim().toLowerCase();
    if (!query) return list;
    return list.filter((r) => {
      const s = staff.find((x) => Number(x.id) === r.staff_id);
      return s?.full_name.toLowerCase().includes(query);
    });
  }, [rows, searchQuery, staff, roleFilter]);

  const visibleRowsDisplayed = useMemo(() => {
    if (!sortRelevance || !searchQuery.trim()) return visibleRows;
    return rankItems<RowState>(visibleRows, searchQuery, {
      getSearchableText: (r) => {
        const s = staff.find((x) => Number(x.id) === r.staff_id);
        return [s?.full_name ?? '', r.notes ?? ''].join(' ');
      },
    });
  }, [visibleRows, sortRelevance, searchQuery, staff]);

  const attendanceInsights = useMemo(
    () =>
      insightsFromAttendanceRows(
        visibleRowsDisplayed.map((r) => ({ attendance_type: r.attendance_type })),
        staff.length
      ),
    [visibleRowsDisplayed, staff.length]
  );

  const attendanceNameSuggestions = useMemo(
    () => staff.map((s) => s.full_name).slice(0, 40),
    [staff]
  );

  const attendanceSmartRefetch = useCallback(() => {
    void fetchData(true);
  }, [fetchData]);

  useAutoRefresh(30_000, attendanceSmartRefetch, true);

  const stats = useMemo(() => {
    let present = 0, late = 0, absent = 0, leave = 0;
    attendance.forEach((a) => {
      if (a.attendance_type === 'present') present++;
      else if (a.attendance_type === 'late') late++;
      else if (a.attendance_type === 'absent') absent++;
      else if (a.attendance_type === 'full_leave' || a.attendance_type === 'time_leave') leave++;
    });
    return { present, late, absent, leave };
  }, [attendance]);

  const updateRow = useCallback((staffId: number, updates: Partial<RowState>) => {
    setRows((prev) =>
      prev.map((r) => (r.staff_id === staffId ? { ...r, ...updates } : r))
    );
  }, []);

  const toggleSelection = (staffId: number) => {
    setSelectedStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  const toggleSelectAll = () => {
    const visibleIds = visibleRowsDisplayed.map((r) => r.staff_id);
    const allVisibleSelected = visibleIds.every(id => selectedStaffIds.includes(id));

    if (allVisibleSelected) {
      setSelectedStaffIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedStaffIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const needsTime = (type: AttendanceType) =>
    type === 'present' || type === 'late' || type === 'time_leave';

  const needsTimeRange = (type: AttendanceType) => type === 'time_leave';

  const validateRows = (): string | null => {
    for (const r of rows) {
      if (r.attendance_type === 'time_leave') {
        if (!r.check_in_time || !r.check_out_time)
          return `يرجى إدخال وقت البداية والنهاية لـ الإجازة الزمنية`;
        if (!isValidTime(r.check_in_time) || !isValidTime(r.check_out_time))
          return `صيغة الوقت غير صحيحة (استخدم HH:MM)`;
        const [h1, m1] = r.check_in_time.split(':').map(Number);
        const [h2, m2] = r.check_out_time.split(':').map(Number);
        if (h2 < h1 || (h2 === h1 && m2 <= m1))
          return `وقت النهاية يجب أن يكون أكبر من وقت البداية`;
      } else if (r.attendance_type === 'present' || r.attendance_type === 'late') {
        if (!r.check_in_time) return `يرجى إدخال وقت الحضور`;
        if (!isValidTime(r.check_in_time)) return `صيغة الوقت غير صحيحة (استخدم HH:MM)`;
      }
    }
    return null;
  };

  const handleSaveAll = async () => {
    const err = validateRows();
    if (err) {
      alert(err);
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const existingStaffIds = new Set(attendance.map((a) => Number(a.staff_id)));
      const payloads = rows.map((r) => ({
        staff_id: r.staff_id,
        attendance_date: todayStr,
        attendance_type: r.attendance_type,
        check_in_time: needsTime(r.attendance_type) ? r.check_in_time : null,
        check_out_time: r.attendance_type === 'time_leave' ? r.check_out_time : null,
        notes: r.notes || null,
        vehicle_id: r.vehicle_id,
        created_by: user?.id,
      }));

      const { error: upsertErr } = await supabase
        .from(tables.attendance)
        .upsert(payloads, { onConflict: 'staff_id,attendance_date' });

      if (upsertErr) throw upsertErr;

      let addCount = 0;
      let editCount = 0;
      rows.forEach((r) => {
        if (existingStaffIds.has(r.staff_id)) editCount++;
        else addCount++;
      });

      if (addCount > 0) await logAttendanceActivity('add', { date: todayStr, count: addCount }, department);
      if (editCount > 0) await logAttendanceActivity('edit', { date: todayStr, count: editCount }, department);
      resyncRowsFromServerRef.current = true;
      await fetchData(true);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      alert('فشل الحفظ: ' + (e instanceof Error ? e.message : 'خطأ غير معروف'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    resyncRowsFromServerRef.current = true;
    fetchData();
  };

  const handleArchiveDay = async () => {
    if (!window.confirm('هل أنت متأكد من أرشفة يوم الحضور؟ لن يمكن تعديل البيانات إلا من قبل المدير.')) return;
    setArchiving(true);
    try {
      const { data, error } = await rpcWithInstallationFallback<{ success?: boolean; error?: string; archived_count?: number }>(supabase, {
        department,
        installationRpc: 'installation_archive_attendance_day',
        defaultRpc: 'archive_attendance_day',
        /** التركيب: الدالة في DB تستخدم p_day — إرسال p_date كان يترك التاريخ null فيُرشَف 0 صفوف */
        installationParams: { p_day: todayStr },
        defaultParams: { p_date: todayStr },
      });
      const result = data as { success?: boolean; error?: string; archived_count?: number } | null;
      if (error) {
        alert('فشل الأرشفة: ' + error.message);
        return;
      }
      if (!result?.success) {
        alert(result?.error === 'admin_only' ? 'هذا الإجراء مسموح للأدمن فقط' : (result?.error || 'فشل الأرشفة'));
        return;
      }
      await logAttendanceActivity('archive', { date: todayStr, archived_count: result?.archived_count ?? 0 }, department);
      resyncRowsFromServerRef.current = true;
      await fetchData(true);
      alert(`تم أرشفة ${result?.archived_count ?? 0} سجل بنجاح`);
    } catch (e) {
      console.error(e);
      alert('فشل الأرشفة');
    } finally {
      setArchiving(false);
    }
  };

  const handleExport = (format: 'pdf' | 'excel') => {
    const toExportRows = isSelectionMode && selectedStaffIds.length > 0
      ? rows.filter((r) => selectedStaffIds.includes(r.staff_id))
      : rows;

    if (toExportRows.length === 0) {
      alert('لا توجد بيانات للتصدير');
      return;
    }

    const headers = [
      'الموظف',
      'الدور',
      'نوع الحضور',
      'الوقت / المدى',
      'الملاحظات',
      'طلبات إخراج باحتساب تحميل',
      'مرات تأخير التحميل',
      'مجموع دقائق تأخير التحميل',
    ];
    const exportRows = toExportRows.map((r) => {
      const s = staff.find((x) => Number(x.id) === r.staff_id);
      const roleLabel = s?.role === 'driver' ? driverSingular : assistantSingular;
      const typeLabel = ATTENDANCE_TYPES.find((t) => t.value === r.attendance_type)?.label ?? r.attendance_type;
      let timeStr = '—';
      if (r.attendance_type === 'present' || r.attendance_type === 'late') timeStr = r.check_in_time;
      else if (r.attendance_type === 'time_leave') timeStr = `${r.check_in_time} → ${r.check_out_time}`;
      const agg = s?.role === 'driver' ? driverExitAggMap[r.staff_id] : undefined;
      return [
        s?.full_name ?? '',
        roleLabel,
        typeLabel,
        timeStr,
        r.notes,
        agg ? String(agg.tracked) : '—',
        agg ? String(agg.delayEvents) : '—',
        agg ? String(agg.totalDelayMin) : '—',
      ];
    });

    const filename = `حضور_${todayStr}`;

    if (format === 'excel') {
      exportToCsv([headers, ...exportRows], `${filename}.csv`);
    } else {
      const html = `
        <h1 style="text-align:center;font-size:22px;margin-bottom:16px">حضور الكادر - ${todayStr}</h1>
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead><tr style="background:#3b82f6;color:#fff">
            ${headers.map((h) => `<th style="padding:6px 4px;text-align:right">${h}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${exportRows.map((row, i) => `
              <tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}">
                ${row.map((c) => `<td style="padding:6px 8px;border:1px solid #ddd">${c}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      exportHtmlToPdf(`<div dir="rtl">${html}</div>`, `${filename}.pdf`);
    }
    logAttendanceActivity('export', { date: todayStr }, department);
  };

  const handleAddStaff = async (role: 'driver' | 'assistant') => {
    const name = newName.trim();
    if (!name) {
      setAddError('يرجى إدخال الاسم');
      return;
    }
    setAddLoading(true);
    setAddError('');
    try {
      const { error } = await supabase.from(tables.staffMembers).insert({
        full_name: name,
        role,
        is_active: true,
      });
      if (error) throw error;
      setNewName('');
      setShowAddDriver(false);
      setShowAddAssistant(false);
      await fetchData(true);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'فشل الإضافة');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedStaffIds.length === 0 || !isAdmin) return;
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedStaffIds.length} موظف؟`)) return;
    setDeleting(true);
    try {
      for (const id of selectedStaffIds) {
        await supabase.from(tables.staffMembers).delete().eq('id', id);
      }
      setSelectedStaffIds([]);
      setIsSelectionMode(false);
      resyncRowsFromServerRef.current = true;
      await fetchData(true);
    } catch (e) {
      alert('فشل الحذف: ' + (e instanceof Error ? e.message : 'خطأ'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success message */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-4 py-2 flex items-center gap-2 text-emerald-800 dark:text-emerald-200"
          >
            <Check className="w-5 h-5" />
            <span className="font-medium">تم الحفظ بنجاح</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-2xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{stats.present}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">حاضر اليوم</p>
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-2xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{stats.late}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">متأخر اليوم</p>
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-2xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{stats.absent}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">غائب اليوم</p>
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-2xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <CalendarOff className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{stats.leave}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">إجازة اليوم</p>
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-2xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Truck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{drivers.length}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">{driverPlural}</p>
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-2xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Users className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{assistants.length}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">{assistantPlural}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
          <div className="flex flex-col sm:flex-row gap-2 flex-1 min-w-[240px] max-w-2xl">
            <div className="flex-1 min-w-[200px]">
              <SmartSearchBar
                pageKey="crew-attendance"
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="بحث باسم الموظف (كلمات مفتاحية)..."
                dataSuggestions={attendanceNameSuggestions}
                showPredictiveChips={false}
              />
            </div>
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={sortRelevance}
                onChange={(e) => setSortRelevance(e.target.checked)}
                className="rounded"
              />
              ترتيب التطابق
            </label>
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
            className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm"
          >
            <option value="all">جميع الكادر</option>
            <option value="driver">{driverPlural} فقط</option>
            <option value="assistant">{assistantPlural} فقط</option>
          </select>

          {isAdmin && (
            <>
              <button
                onClick={() => { setShowAddDriver(true); setAddError(''); setNewName(''); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
              >
                <UserPlus className="w-4 h-4" /> إضافة {driverSingular}
              </button>
              <button
                onClick={() => { setShowAddAssistant(true); setAddError(''); setNewName(''); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700"
              >
                <UserPlus className="w-4 h-4" /> إضافة مساعد
              </button>
              <button
                onClick={() => setIsSelectionMode(!isSelectionMode)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium',
                  isSelectionMode ? 'bg-stone-200 dark:bg-stone-700' : 'bg-stone-100 dark:bg-stone-800'
                )}
              >
                <Check className="w-4 h-4" /> {isSelectionMode ? 'إلغاء التحديد' : 'تحديد'}
              </button>
              {isSelectionMode && selectedStaffIds.length > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  disabled={deleting}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  حذف ({selectedStaffIds.length})
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ الكل
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-200 dark:bg-stone-700 text-sm font-medium hover:bg-stone-300 dark:hover:bg-stone-600"
          >
            <RotateCcw className="w-4 h-4" /> إعادة تحميل
          </button>
          {isAdmin && (
            <button
              onClick={handleArchiveDay}
              disabled={archiving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              أرشفة اليوم
            </button>
          )}
          <button
            onClick={() => handleExport('excel')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            <Download className="w-4 h-4" /> 
            Excel {isSelectionMode && selectedStaffIds.length > 0 ? `(${selectedStaffIds.length})` : 'الكل'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700"
          >
            <Download className="w-4 h-4" /> 
            PDF {isSelectionMode && selectedStaffIds.length > 0 ? `(${selectedStaffIds.length})` : 'الكل'}
          </button>
          <ExportMenu
            meta={{
              title: `حضور الكادر ${todayStr}`,
              filterDescription:
                [
                  searchQuery && `بحث: ${searchQuery}`,
                  roleFilter !== 'all' && `الدور: ${roleFilter === 'driver' ? driverSingular : assistantSingular}`,
                  sortRelevance && 'ترتيب حسب التطابق',
                ]
                  .filter(Boolean)
                  .join(' | ') || '—',
              rowCount: visibleRowsDisplayed.length,
            }}
            headerRow={[
              'الموظف',
              'الدور',
              'نوع الحضور',
              'الوقت / المدى',
              'الملاحظات',
              'طلبات إخراج باحتساب تحميل',
              'مرات تأخير التحميل',
              'مجموع دقائق تأخير التحميل',
            ]}
            dataRows={visibleRowsDisplayed.map((r) => {
              const s = staff.find((x) => Number(x.id) === r.staff_id);
              const roleLabel = s?.role === 'driver' ? driverSingular : assistantSingular;
              const typeLabel = ATTENDANCE_TYPES.find((t) => t.value === r.attendance_type)?.label ?? r.attendance_type;
              let timeStr = '—';
              if (r.attendance_type === 'present' || r.attendance_type === 'late') timeStr = r.check_in_time;
              else if (r.attendance_type === 'time_leave') timeStr = `${r.check_in_time} → ${r.check_out_time}`;
              const agg = s?.role === 'driver' ? driverExitAggMap[r.staff_id] : undefined;
              return [
                s?.full_name ?? '',
                roleLabel,
                typeLabel,
                timeStr,
                r.notes,
                agg ? String(agg.tracked) : '—',
                agg ? String(agg.delayEvents) : '—',
                agg ? String(agg.totalDelayMin) : '—',
              ];
            })}
            sheetName="حضور"
          />
          <SavedViews<Record<string, unknown>>
            pageKey="crew-attendance"
            getCurrentPayload={() => ({
              searchQuery,
              roleFilter,
              sortRelevance,
            })}
            onApply={(p) => {
              setSearchQuery(String(p.searchQuery ?? ''));
              setRoleFilter((p.roleFilter as typeof roleFilter) ?? 'all');
              setSortRelevance(Boolean(p.sortRelevance));
            }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 items-center text-sm">
        {ATTENDANCE_TYPES.map((t) => (
          <div key={t.value} className="flex items-center gap-2">
            <span
              className={cn(
                'w-2.5 h-2.5 rounded-full',
                ATTENDANCE_TYPE_COLORS[t.value]?.dot ?? 'bg-stone-300'
              )}
            />
            <span className="text-stone-600 dark:text-stone-400">{t.label}</span>
          </div>
        ))}
      </div>

      <InsightsPanel metrics={attendanceInsights.metrics} alerts={attendanceInsights.alerts} />
      <ChartsPanel barData={attendanceInsights.bar} pieData={attendanceInsights.pie} />

      {/* Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-2xl shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-stone-100 dark:bg-stone-700/50">
                {isSelectionMode && (
                  <th className="px-4 py-3 text-right text-sm font-semibold">
                    <button onClick={toggleSelectAll} className="text-blue-600 hover:underline">
                      {selectedStaffIds.length === visibleRowsDisplayed.length && visibleRowsDisplayed.length > 0 ? 'إلغاء الكل' : 'تحديد الكل'}
                    </button>
                  </th>
                )}
                <th className="px-4 py-3 text-right text-sm font-semibold">الموظف</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الدور</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">نوع الحضور</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الوقت / المدى</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {visibleRowsDisplayed.map((r, idx) => {
                const s = staff.find((x) => Number(x.id) === r.staff_id);
                if (!s) return null;
                const roleLabel = s.role === 'driver' ? driverSingular : assistantSingular;
                return (
                  <tr
                    key={r.staff_id}
                    className={cn(
                      'border-t border-stone-100 dark:border-stone-700/50',
                      idx % 2 === 0 && 'bg-stone-50/50 dark:bg-stone-800/30'
                    )}
                  >
                    {isSelectionMode && (
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selectedStaffIds.includes(r.staff_id)}
                          onChange={() => toggleSelection(r.staff_id)}
                          className="rounded"
                        />
                      </td>
                    )}
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'w-2.5 h-2.5 rounded-full shrink-0',
                            ATTENDANCE_TYPE_COLORS[r.attendance_type]?.dot ?? 'bg-stone-300'
                          )}
                          title={ATTENDANCE_TYPES.find((t) => t.value === r.attendance_type)?.label}
                        />
                        {s.role === 'driver' ? (
                          <button
                            type="button"
                            onClick={() => setDriverLoadingModal({ staffId: r.staff_id, name: s.full_name })}
                            className="font-medium text-left text-blue-700 dark:text-blue-300 hover:underline underline-offset-2"
                          >
                            <HighlightText text={s.full_name} query={searchQuery} />
                          </button>
                        ) : (
                          <span className="font-medium">
                            <HighlightText text={s.full_name} query={searchQuery} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-stone-600 dark:text-stone-400">{roleLabel}</td>
                    <td className="px-4 py-2">
                      <select
                        value={r.attendance_type}
                        onChange={(e) => updateRow(r.staff_id, { attendance_type: e.target.value as AttendanceType })}
                        className="px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm w-full max-w-[140px]"
                      >
                        {ATTENDANCE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      {needsTimeRange(r.attendance_type) ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="time"
                            value={r.check_in_time}
                            onChange={(e) => updateRow(r.staff_id, { check_in_time: e.target.value })}
                            className="px-2 py-1 rounded border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm w-24"
                          />
                          <span>→</span>
                          <input
                            type="time"
                            value={r.check_out_time}
                            onChange={(e) => updateRow(r.staff_id, { check_out_time: e.target.value })}
                            className="px-2 py-1 rounded border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm w-24"
                          />
                        </div>
                      ) : needsTime(r.attendance_type) ? (
                        <input
                          type="time"
                          value={r.check_in_time}
                          onChange={(e) => updateRow(r.staff_id, { check_in_time: e.target.value })}
                          className="px-2 py-1 rounded border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm w-24"
                        />
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={r.notes}
                        onChange={(e) => updateRow(r.staff_id, { notes: e.target.value })}
                        placeholder="ملاحظات..."
                        className="px-2 py-1 rounded border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm w-full max-w-[180px]"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {visibleRowsDisplayed.length === 0 && (
          <div className="py-16 text-center text-stone-500 dark:text-stone-400">
            {searchQuery
              ? 'لا توجد نتائج تطابق بحثك'
              : isInstallation
                ? 'لا يوجد موظفين لعرضهم. أضف فنيًا أو مساعد فني.'
                : 'لا يوجد موظفين لعرضهم. أضف سائقاً أو مساعد سائق.'}
          </div>
        )}
      </motion.div>

      {/* Add Driver Modal */}
      <AnimatePresence>
        {showAddDriver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setShowAddDriver(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-stone-800 rounded-2xl p-6 w-full max-w-md shadow-xl"
            >
              <h3 className="text-lg font-bold mb-4">إضافة {driverSingular} جديد</h3>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={isInstallation ? 'اسم الفني' : 'اسم السائق'}
                className="w-full px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 mb-3"
              />
              {addError && (
                <p className="text-red-600 text-sm mb-3 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> {addError}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAddDriver(false)} className="px-4 py-2 rounded-xl bg-stone-200 dark:bg-stone-700">إلغاء</button>
                <button onClick={() => handleAddStaff('driver')} disabled={addLoading} className="px-4 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50">
                  {addLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'إضافة'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Driver loading delay modal */}
      <AnimatePresence>
        {driverLoadingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setDriverLoadingModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-stone-800 rounded-2xl p-6 w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-xl flex flex-col"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-amber-500/20">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-stone-900 dark:text-white leading-tight">ملف تحميل {driverSingular}</h3>
                    <p className="text-base font-semibold text-amber-800 dark:text-amber-200 mt-0.5 truncate">{driverLoadingModal.name}</p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" />
                      {WORK_TIMEZONE} — التأخير يُحسب بعد 8:15 صباحاً من وقت إنشاء الطلب
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDriverLoadingModal(null)}
                  className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700"
                  aria-label="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {driverExitLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    <div className="rounded-2xl border border-stone-200/80 dark:border-stone-600 bg-gradient-to-br from-stone-50 to-stone-100/80 dark:from-stone-800/80 dark:to-stone-900 p-4 shadow-sm">
                      <p className="text-[11px] font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide">طلبات باحتساب</p>
                      <p className="text-2xl font-black text-stone-900 dark:text-white tabular-nums mt-1">{driverExitRequests.length}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 dark:border-amber-800/80 bg-gradient-to-br from-amber-50 to-amber-100/70 dark:from-amber-950/50 dark:to-amber-900/30 p-4 shadow-sm">
                      <p className="text-[11px] font-medium text-amber-800/90 dark:text-amber-300">مرات التأخير</p>
                      <p className="text-2xl font-black text-amber-900 dark:text-amber-100 tabular-nums mt-1">{driverLoadingStats.delayCount}</p>
                    </div>
                    <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-gradient-to-br from-red-50 to-red-100/60 dark:from-red-950/40 dark:to-red-900/20 p-4 shadow-sm">
                      <p className="text-[11px] font-medium text-red-700/90 dark:text-red-300">مجموع دقائق التأخير</p>
                      <p className="text-2xl font-black text-red-800 dark:text-red-200 tabular-nums mt-1">{driverLoadingStats.totalDelayMinutes}</p>
                      <p className="text-[10px] text-red-600/80 dark:text-red-400/90 mt-0.5">دقيقة</p>
                    </div>
                    <div className="rounded-2xl border border-violet-200 dark:border-violet-900/50 bg-gradient-to-br from-violet-50 to-violet-100/60 dark:from-violet-950/40 dark:to-violet-900/20 p-4 shadow-sm col-span-2 lg:col-span-1">
                      <p className="text-[11px] font-medium text-violet-800/90 dark:text-violet-300">متوسط التأخير</p>
                      <p className="text-2xl font-black text-violet-900 dark:text-violet-100 tabular-nums mt-1">
                        {driverLoadingStats.delayCount > 0 ? driverLoadingStats.avgDelayMinutes : '—'}
                      </p>
                      <p className="text-[10px] text-violet-600/80 dark:text-violet-400/90 mt-0.5">دقيقة / حادثة</p>
                    </div>
                  </div>
                  <div className="overflow-auto flex-1 min-h-0 rounded-2xl border border-stone-200 dark:border-stone-600 shadow-inner bg-stone-50/30 dark:bg-stone-900/40">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="bg-stone-200/90 dark:bg-stone-700 text-right text-stone-800 dark:text-stone-100">
                          <th className="px-3 py-2.5 font-bold text-xs">اليوم / التاريخ</th>
                          <th className="px-3 py-2.5 font-bold text-xs">وقت الطلب</th>
                          <th className="px-3 py-2.5 font-bold text-xs">وقت الخروج</th>
                          <th className="px-3 py-2.5 font-bold text-xs">دقائق من 7:00</th>
                          <th className="px-3 py-2.5 font-bold text-xs">تأخير؟</th>
                          <th className="px-3 py-2.5 font-bold text-xs">دقائق التأخير</th>
                          <th className="px-3 py-2.5 font-bold text-xs">الطلب</th>
                          <th className="px-3 py-2.5 font-bold text-xs">المركبة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {driverExitRequests.map((req, idx) => (
                          <tr
                            key={req.id}
                            className={cn(
                              'border-t border-stone-200 dark:border-stone-600/80 transition-colors',
                              idx % 2 === 0 ? 'bg-white/90 dark:bg-stone-800/40' : 'bg-stone-50/90 dark:bg-stone-800/20'
                            )}
                          >
                            <td className="px-3 py-2.5 whitespace-nowrap text-stone-800 dark:text-stone-200">
                              {new Date(req.created_at).toLocaleDateString('ar-IQ', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap font-medium">
                              {new Date(req.created_at).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                              {req.exited_at
                                ? new Date(req.exited_at).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })
                                : '—'}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-stone-700 dark:text-stone-300">{req.loading_minutes_from_shift_start ?? '—'}</td>
                            <td className="px-3 py-2.5">
                              {req.loading_is_delay ? (
                                <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:text-red-300">نعم</span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">لا</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums font-semibold text-red-700 dark:text-red-300">{req.loading_delay_minutes ?? '—'}</td>
                            <td className="px-3 py-2.5 font-mono text-[11px] text-stone-500">#{String(req.id).slice(0, 8)}</td>
                            <td className="px-3 py-2.5 max-w-[130px] truncate text-xs" title={req.vehicle_plate ?? ''}>
                              {req.vehicle_plate || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {driverExitRequests.length === 0 && (
                      <p className="text-center py-10 text-stone-500 text-sm">
                        {isInstallation
                          ? 'لا توجد طلبات إخراج باحتساب وقت التحميل لهذا الفني'
                          : 'لا توجد طلبات إخراج باحتساب وقت التحميل لهذا السائق'}
                      </p>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Assistant Modal */}
      <AnimatePresence>
        {showAddAssistant && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setShowAddAssistant(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-stone-800 rounded-2xl p-6 w-full max-w-md shadow-xl"
            >
              <h3 className="text-lg font-bold mb-4">إضافة {assistantSingular} جديد</h3>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="اسم المساعد"
                className="w-full px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 mb-3"
              />
              {addError && (
                <p className="text-red-600 text-sm mb-3 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> {addError}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAddAssistant(false)} className="px-4 py-2 rounded-xl bg-stone-200 dark:bg-stone-700">إلغاء</button>
                <button onClick={() => handleAddStaff('assistant')} disabled={addLoading} className="px-4 py-2 rounded-xl bg-violet-600 text-white disabled:opacity-50">
                  {addLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'إضافة'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
