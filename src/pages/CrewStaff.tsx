import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Check,
  Trash2,
  Download,
  FileText,
  Loader2,
  ChevronLeft,
  User,
} from 'lucide-react';
import { cn, ATTENDANCE_TYPE_COLORS } from '../lib/utils';
import { getDepartmentClient, getDepartmentTables } from '../data/supabaseSource';
import { normalizeDepartmentStaffRole } from '../lib/staffRoleNormalize';
import type { DepartmentCode } from '../data/department';
import { exportHtmlToPdf } from '../lib/pdfExport';
import { exportToExcel } from '../lib/excelExport';
import type { UserProfile, StaffMember, AttendanceArchive } from '../lib/supabaseClient';

interface StaffStats {
  staff_id: number;
  full_name: string;
  role: 'driver' | 'assistant';
  present: number;
  late: number;
  absent: number;
  full_leave: number;
  time_leave: number;
  break: number;
}

const DOMINANT_TYPE_LABELS: Record<string, string> = {
  present: 'حاضر',
  late: 'متأخر',
  absent: 'غائب',
  full_leave: 'إجازة كاملة',
  time_leave: 'إجازة زمنية',
  break: 'استراحه',
};

function getDominantAttendanceType(s: StaffStats): string {
  const types = [
    { k: 'present', v: s.present },
    { k: 'late', v: s.late },
    { k: 'absent', v: s.absent },
    { k: 'full_leave', v: s.full_leave },
    { k: 'time_leave', v: s.time_leave },
    { k: 'break', v: s.break },
  ];
  const max = types.reduce((a, b) => (b.v > a.v ? b : a), { k: 'present', v: 0 });
  return max.v > 0 ? max.k : 'present';
}

interface Props {
  profile: UserProfile | null;
  department?: DepartmentCode;
}

export default function CrewStaff({ profile, department = 'tajhiz' }: Props) {
  const supabase = getDepartmentClient(department);
  const tables = getDepartmentTables(department);
  const isInstallation = department === 'installation';
  const driverSingular = isInstallation ? 'فني' : 'سائق';
  const assistantSingular = isInstallation ? 'مساعد فني' : 'مساعد سائق';
  const staffRoleDisplay = (role: 'driver' | 'assistant') =>
    isInstallation ? driverSingular : role === 'driver' ? driverSingular : assistantSingular;

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [archive, setArchive] = useState<AttendanceArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const canManage = profile?.role === 'admin' || profile?.role === 'manager';

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [staffRes, archRes] = await Promise.all([
      supabase.from(tables.staffMembers).select('*').eq('is_active', true).order('role').order('full_name'),
      supabase.from(department === 'installation' ? 'installation_attendance_archive' : 'attendance_archive').select('*').order('attendance_date', { ascending: false }),
    ]);
    if (staffRes.data) {
      const normalizedStaff = (staffRes.data as Array<Record<string, unknown>>).map((s) => ({
        ...s,
        role: normalizeDepartmentStaffRole(s.role, department),
      })) as StaffMember[];
      setStaff(normalizedStaff);
    }
    if (archRes.data) setArchive(archRes.data);
    setLoading(false);
  }, [supabase, tables, department]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const d = new Date();
    const toStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const fromDate = new Date(d);
    fromDate.setMonth(fromDate.getMonth() - 1);
    const fromStr = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`;
    if (!dateFrom) setDateFrom(fromStr);
    if (!dateTo) setDateTo(toStr);
  }, []);

  const staffStats = useMemo(() => {
    const filtered = archive.filter((a) => {
      const d = a.attendance_date;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
    const statsMap = new Map<number, StaffStats>();
    for (const s of staff) {
      const id = Number(s.id);
      statsMap.set(id, {
        staff_id: id,
        full_name: s.full_name,
        role: s.role as 'driver' | 'assistant',
        present: 0,
        late: 0,
        absent: 0,
        full_leave: 0,
        time_leave: 0,
        break: 0,
      });
    }
    for (const a of filtered) {
      const st = statsMap.get(a.staff_id);
      if (!st) continue;
      if (a.attendance_type === 'present') st.present++;
      else if (a.attendance_type === 'late') st.late++;
      else if (a.attendance_type === 'absent') st.absent++;
      else if (a.attendance_type === 'full_leave') st.full_leave++;
      else if (a.attendance_type === 'time_leave') st.time_leave++;
      else if (a.attendance_type === 'break') st.break++;
    }
    return Array.from(statsMap.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [staff, archive, dateFrom, dateTo]);

  const selectedReport = useMemo(() => {
    if (!selectedStaffId) return null;
    return staffStats.find((s) => s.staff_id === selectedStaffId) ?? null;
  }, [selectedStaffId, staffStats]);

  const toggleSelectAll = () => {
    if (selectedStaffIds.length === staffStats.length) {
      setSelectedStaffIds([]);
    } else {
      setSelectedStaffIds(staffStats.map((s) => s.staff_id));
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedStaffIds.length === 0 || !canManage) return;
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedStaffIds.length} موظف؟`)) return;
    setDeleting(true);
    try {
      for (const id of selectedStaffIds) {
        await supabase.from(tables.staffMembers).delete().eq('id', id);
      }
      setSelectedStaffIds([]);
      setIsSelectionMode(false);
      setSelectedStaffId(null);
      await fetchData();
    } catch (e) {
      alert('فشل الحذف: ' + (e instanceof Error ? e.message : 'خطأ'));
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = (format: 'pdf' | 'excel') => {
    const toExport = isSelectionMode && selectedStaffIds.length > 0
      ? staffStats.filter((s) => selectedStaffIds.includes(s.staff_id))
      : selectedReport ? [selectedReport] : [];

    if (toExport.length === 0) {
      alert(isSelectionMode ? 'يرجى تحديد موظف واحد على الأقل' : 'يرجى اختيار موظف لعرض تقريره أولاً');
      return;
    }

    setExporting(true);
    try {
      const headers = ['الموظف', 'الدور', 'الحضور', 'التأخير', 'الغياب', 'إجازة كاملة', 'إجازة زمنية', 'استراحه'];
      const rows = toExport.map(s => [
        s.full_name,
        staffRoleDisplay(s.role),
        String(s.present),
        String(s.late),
        String(s.absent),
        String(s.full_leave),
        String(s.time_leave),
        String(s.break),
      ]);

      const filename = toExport.length === 1 
        ? `تقرير_${toExport[0].full_name.replace(/[^\w\s\u0600-\u06FF]/g, '_')}_${dateFrom}_${dateTo}`
        : `تقرير_الكادر_المحدد_${dateFrom}_${dateTo}`;

      if (format === 'excel') {
        exportToExcel([headers, ...rows], `${filename}.xlsx`);
      } else {
        const html = `
          <h1 style="text-align:center;font-size:22px;margin-bottom:16px">${toExport.length === 1 ? `تقرير حضور - ${toExport[0].full_name}` : 'تقرير حضور الكادر المحدد'}</h1>
          <p style="text-align:center;color:#666;margin-bottom:20px">من ${dateFrom} إلى ${dateTo}</p>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:#3b82f6;color:#fff">
              ${headers.map(h => `<th style="padding:10px;text-align:right">${h}</th>`).join('')}
            </tr></thead>
            <tbody>
              ${rows.map((row, i) => `
                <tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}">
                  ${row.map(cell => `<td style="padding:8px;border:1px solid #ddd">${cell}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
        exportHtmlToPdf(`<div dir="rtl">${html}</div>`, `${filename}.pdf`);
      }
    } catch (e) {
      alert('فشل التصدير');
    } finally {
      setExporting(false);
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
      {/* Legend - النوع الغالب في الفترة */}
      <div className="flex flex-wrap gap-4 items-center text-sm">
        <span className="text-stone-500">النوع الغالب في الفترة:</span>
        {Object.entries(DOMINANT_TYPE_LABELS).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span
              className={cn(
                'w-2.5 h-2.5 rounded-full',
                ATTENDANCE_TYPE_COLORS[k]?.dot ?? 'bg-stone-300'
              )}
            />
            <span className="text-stone-600 dark:text-stone-400">{v}</span>
          </div>
        ))}
      </div>

      {/* Date range & toolbar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-2xl p-4 shadow-sm"
      >
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-stone-500 mb-1">من تاريخ</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-500 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm"
            />
          </div>
          {canManage && (
            <>
              <button
                onClick={() => setIsSelectionMode(!isSelectionMode)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium',
                  isSelectionMode ? 'bg-stone-200 dark:bg-stone-700' : 'bg-stone-100 dark:bg-stone-800'
                )}
              >
                <Check className="w-4 h-4" /> {isSelectionMode ? 'إلغاء التحديد' : 'تحديد'}
              </button>
              {isSelectionMode && (
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-200 dark:bg-stone-700 text-sm font-medium hover:bg-stone-300"
                >
                  {selectedStaffIds.length === staffStats.length ? 'إلغاء الكل' : 'تحديد الكل'}
                </button>
              )}
              {isSelectionMode && selectedStaffIds.length > 0 && (
                <>
                  <button
                    onClick={() => handleExport('excel')}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    تصدير Excel ({selectedStaffIds.length})
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    تصدير PDF ({selectedStaffIds.length})
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={deleting}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    حذف ({selectedStaffIds.length})
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Staff list */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 shadow-sm overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-stone-500" />
              <h3 className="font-semibold">الكادر</h3>
            </div>
            {isSelectionMode && staffStats.length > 0 && (
              <button 
                onClick={toggleSelectAll}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {selectedStaffIds.length === staffStats.length ? 'إلغاء الكل' : 'تحديد الكل'}
              </button>
            )}
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {staffStats.map((s) => (
              <div
                key={s.staff_id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 border-b border-stone-100 dark:border-stone-700/50 cursor-pointer transition-colors',
                  selectedStaffId === s.staff_id
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : 'hover:bg-stone-50 dark:hover:bg-stone-800/50'
                )}
                onClick={() => setSelectedStaffId(s.staff_id)}
              >
                {canManage && isSelectionMode && (
                  <input
                    type="checkbox"
                    checked={selectedStaffIds.includes(s.staff_id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelection(s.staff_id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded"
                  />
                )}
                <span
                  className={cn(
                    'w-2.5 h-2.5 rounded-full shrink-0',
                    ATTENDANCE_TYPE_COLORS[getDominantAttendanceType(s)]?.dot ?? 'bg-stone-300'
                  )}
                  title={`النوع الغالب: ${DOMINANT_TYPE_LABELS[getDominantAttendanceType(s)] ?? '—'}`}
                />
                <User className="w-5 h-5 text-stone-400" />
                <div className="flex-1">
                  <p className="font-medium">{s.full_name}</p>
                  <p className="text-sm text-stone-500">{staffRoleDisplay(s.role)}</p>
                </div>
              </div>
            ))}
          </div>
          {staffStats.length === 0 && (
            <div className="py-16 text-center text-stone-500">لا يوجد كادر</div>
          )}
        </motion.div>

        {/* Report panel */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 shadow-sm overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
            <h3 className="font-semibold">تقرير الموظف</h3>
            {selectedReport && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('excel')}
                  disabled={exporting}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Excel
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={exporting}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  PDF
                </button>
              </div>
            )}
          </div>
          <div className="p-6">
            {selectedReport ? (
              <div className="space-y-4">
                <div>
                  <p className="text-2xl font-bold">{selectedReport.full_name}</p>
                  <p className="text-stone-500">{staffRoleDisplay(selectedReport.role)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4">
                    <p className="text-2xl font-bold text-emerald-600">{selectedReport.present}</p>
                    <p className="text-sm text-stone-500">أيام الحضور</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-4">
                    <p className="text-2xl font-bold text-amber-600">{selectedReport.late}</p>
                    <p className="text-sm text-stone-500">مرات التأخير</p>
                  </div>
                  <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4">
                    <p className="text-2xl font-bold text-red-600">{selectedReport.absent}</p>
                    <p className="text-sm text-stone-500">أيام الغياب</p>
                  </div>
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4">
                    <p className="text-2xl font-bold text-blue-600">{selectedReport.full_leave}</p>
                    <p className="text-sm text-stone-500">إجازات كاملة</p>
                  </div>
                  <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 p-4">
                    <p className="text-2xl font-bold text-violet-600">{selectedReport.time_leave}</p>
                    <p className="text-sm text-stone-500">إجازات زمنية</p>
                  </div>
                  <div className="rounded-xl bg-cyan-50 dark:bg-cyan-900/20 p-4">
                    <p className="text-2xl font-bold text-cyan-600">{selectedReport.break}</p>
                    <p className="text-sm text-stone-500">استراحه</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-stone-500">
                <ChevronLeft className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>اضغط على اسم موظف لعرض تقريره</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
