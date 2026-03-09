import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Trash2,
  Save,
  RotateCcw,
  Archive,
  Download,
  Check,
  Clock,
  XCircle,
  CalendarOff,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Truck,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import { exportHtmlToPdf } from '../lib/pdfExport';
import { exportToCsv } from '../lib/excelExport';
import { logAttendanceActivity } from '../lib/attendanceActivity';
import type {
  UserProfile,
  StaffMember,
  Attendance,
  AttendanceType,
  Vehicle,
} from '../lib/supabaseClient';

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

interface Props {
  profile: UserProfile | null;
}

export default function CrewAttendance({ profile }: Props) {
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

  const todayStr = getTodayDateStr();
  const isAdmin = profile?.role === 'admin';

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [staffRes, vehRes, attRes] = await Promise.all([
      supabase.from('staff_members').select('*').eq('is_active', true).order('role').order('full_name'),
      supabase.from('vehicles').select('*'),
      supabase.from('attendance').select('*').eq('attendance_date', todayStr),
    ]);
    if (staffRes.data) setStaff(staffRes.data);
    if (vehRes.data) setVehicles(vehRes.data);
    if (attRes.data) setAttendance(attRes.data);
    setLoading(false);
  }, [todayStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const drivers = useMemo(() => staff.filter((s) => s.role === 'driver'), [staff]);
  const assistants = useMemo(() => staff.filter((s) => s.role === 'assistant'), [staff]);

  const filteredStaff = useMemo(() => {
    if (roleFilter === 'driver') return drivers;
    if (roleFilter === 'assistant') return assistants;
    return staff;
  }, [staff, drivers, assistants, roleFilter]);

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
    const initial: RowState[] = filteredStaff.map((s) => {
      const att = attendanceByStaff[Number(s.id)];
      const vehicleId = s.role === 'driver' ? vehicleByDriver[Number(s.id)]?.id ?? null : null;
      return {
        staff_id: Number(s.id),
        attendance_type: (att?.attendance_type as AttendanceType) ?? 'present',
        check_in_time: att?.check_in_time ? String(att.check_in_time).slice(0, 5) : '08:00',
        check_out_time: att?.check_out_time ? String(att.check_out_time).slice(0, 5) : '12:00',
        notes: att?.notes ?? '',
        vehicle_id: att?.vehicle_id ?? vehicleId,
        attendance_id: att?.id,
      };
    });
    setRows(initial);
  }, [filteredStaff, attendanceByStaff, vehicleByDriver]);

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
    if (selectedStaffIds.length === filteredStaff.length) {
      setSelectedStaffIds([]);
    } else {
      setSelectedStaffIds(filteredStaff.map((s) => Number(s.id)));
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
      let addCount = 0;
      let editCount = 0;
      for (const r of rows) {
        const payload = {
          staff_id: r.staff_id,
          attendance_date: todayStr,
          attendance_type: r.attendance_type,
          check_in_time: needsTime(r.attendance_type) ? (r.attendance_type === 'time_leave' ? r.check_in_time : r.check_in_time) : null,
          check_out_time: r.attendance_type === 'time_leave' ? r.check_out_time : null,
          notes: r.notes || null,
          vehicle_id: r.vehicle_id,
          created_by: user?.id,
        };
        if (r.attendance_id) {
          await supabase.from('attendance').update(payload).eq('id', r.attendance_id);
          editCount++;
        } else {
          const { error: insErr } = await supabase.from('attendance').insert(payload);
          if (insErr && insErr.code === '23505') {
            const { data: existing } = await supabase.from('attendance').select('id').eq('staff_id', r.staff_id).eq('attendance_date', todayStr).single();
            if (existing) await supabase.from('attendance').update(payload).eq('id', existing.id);
            editCount++;
          } else if (insErr) throw insErr;
          else addCount++;
        }
      }
      if (addCount > 0) await logAttendanceActivity('add', { date: todayStr, count: addCount });
      if (editCount > 0) await logAttendanceActivity('edit', { date: todayStr, count: editCount });
      await fetchData();
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
    fetchData();
  };

  const handleArchiveDay = async () => {
    if (!window.confirm('هل أنت متأكد من أرشفة يوم الحضور؟ لن يمكن تعديل البيانات إلا من قبل المدير.')) return;
    setArchiving(true);
    try {
      const { data, error } = await supabase.rpc('archive_attendance_day', { p_date: todayStr });
      const result = data as { success?: boolean; error?: string; archived_count?: number } | null;
      if (error) {
        alert('فشل الأرشفة: ' + error.message);
        return;
      }
      if (!result?.success) {
        alert(result?.error === 'admin_only' ? 'هذا الإجراء مسموح للأدمن فقط' : (result?.error || 'فشل الأرشفة'));
        return;
      }
      await logAttendanceActivity('archive', { date: todayStr, archived_count: result?.archived_count ?? 0 });
      await fetchData();
      alert(`تم أرشفة ${result?.archived_count ?? 0} سجل بنجاح`);
    } catch (e) {
      console.error(e);
      alert('فشل الأرشفة');
    } finally {
      setArchiving(false);
    }
  };

  const handleExport = () => {
    const headers = ['الموظف', 'الدور', 'نوع الحضور', 'الوقت / المدى', 'الملاحظات'];
    const exportRows = rows.map((r) => {
      const s = staff.find((x) => Number(x.id) === r.staff_id);
      const roleLabel = s?.role === 'driver' ? 'سائق' : 'مساعد سائق';
      const typeLabel = ATTENDANCE_TYPES.find((t) => t.value === r.attendance_type)?.label ?? r.attendance_type;
      let timeStr = '—';
      if (r.attendance_type === 'present' || r.attendance_type === 'late') timeStr = r.check_in_time;
      else if (r.attendance_type === 'time_leave') timeStr = `${r.check_in_time} → ${r.check_out_time}`;
      return [s?.full_name ?? '', roleLabel, typeLabel, timeStr, r.notes];
    });
    exportToCsv([headers, ...exportRows], `حضور_${todayStr}.csv`);

    const html = `
      <h1 style="text-align:center;font-size:22px;margin-bottom:16px">حضور الكادر - ${todayStr}</h1>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#3b82f6;color:#fff">
          ${headers.map((h) => `<th style="padding:8px;text-align:right">${h}</th>`).join('')}
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
    exportHtmlToPdf(`<div dir="rtl">${html}</div>`, `حضور_${todayStr}.pdf`);
    logAttendanceActivity('export', { date: todayStr });
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
      const { error } = await supabase.from('staff_members').insert({
        full_name: name,
        role,
        is_active: true,
      });
      if (error) throw error;
      setNewName('');
      setShowAddDriver(false);
      setShowAddAssistant(false);
      await fetchData();
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
        await supabase.from('staff_members').delete().eq('id', id);
      }
      setSelectedStaffIds([]);
      setIsSelectionMode(false);
      await fetchData();
    } catch (e) {
      alert('فشل الحذف: ' + (e instanceof Error ? e.message : 'خطأ'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
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
          className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-4 shadow-sm"
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
          className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-4 shadow-sm"
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
          className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-4 shadow-sm"
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
          className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-4 shadow-sm"
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
          className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Truck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{drivers.length}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">السائقون</p>
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Users className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{assistants.length}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">مساعدو السائقين</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
            className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm"
          >
            <option value="all">جميع الكادر</option>
            <option value="driver">السائقون فقط</option>
            <option value="assistant">مساعدو السائقين فقط</option>
          </select>

          {isAdmin && (
            <>
              <button
                onClick={() => { setShowAddDriver(true); setAddError(''); setNewName(''); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
              >
                <UserPlus className="w-4 h-4" /> إضافة سائق
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
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            <Download className="w-4 h-4" /> تصدير
          </button>
        </div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-stone-100 dark:bg-stone-700/50">
                {isSelectionMode && (
                  <th className="px-4 py-3 text-right text-sm font-semibold">
                    <button onClick={toggleSelectAll} className="text-blue-600 hover:underline">
                      {selectedStaffIds.length === filteredStaff.length ? 'إلغاء الكل' : 'تحديد الكل'}
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
              {rows.map((r, idx) => {
                const s = staff.find((x) => Number(x.id) === r.staff_id);
                if (!s) return null;
                const roleLabel = s.role === 'driver' ? 'سائق' : 'مساعد سائق';
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
                    <td className="px-4 py-2 font-medium">{s.full_name}</td>
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
        {rows.length === 0 && (
          <div className="py-16 text-center text-stone-500 dark:text-stone-400">
            لا يوجد موظفين لعرضهم. أضف سائقاً أو مساعد سائق.
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
              <h3 className="text-lg font-bold mb-4">إضافة سائق جديد</h3>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="اسم السائق"
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
              <h3 className="text-lg font-bold mb-4">إضافة مساعد سائق جديد</h3>
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
