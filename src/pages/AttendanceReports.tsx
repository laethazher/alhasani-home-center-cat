import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Users,
  Truck,
  Download,
  Loader2,
  Calendar,
  FileText,
} from 'lucide-react';
import { cn, ATTENDANCE_TYPE_COLORS } from '../lib/utils';
import { getDepartmentClient, getDepartmentTables } from '../data/supabaseSource';
import type { DepartmentCode } from '../data/department';
import { normalizeDepartmentStaffRole } from '../lib/staffRoleNormalize';
import { exportHtmlToPdf } from '../lib/pdfExport';
import { exportToExcel } from '../lib/excelExport';
import { logAttendanceActivity } from '../lib/attendanceActivity';
import { getBaghdadDateKey } from '../lib/loadingTime';
import type {
  UserProfile,
  StaffMember,
  AttendanceArchive,
} from '../lib/supabaseClient';
import {
  SmartSearchBar,
  HighlightText,
  InsightsPanel,
  ChartsPanel,
  ExportMenu,
  SavedViews,
  useAutoRefresh,
  insightsFromAttendanceRows,
} from '../smart';

interface StaffStats {
  staff_id: number;
  full_name: string;
  role: 'driver' | 'assistant';
  present: number;
  late: number;
  absent: number;
  full_leave: number;
  time_leave: number;
  /** من exit_requests: مرات تأخير التحميل بعد 8:15 (للسائقين فقط) */
  loading_delay_events: number;
  loading_delay_minutes_sum: number;
}

function getDominantType(s: StaffStats): string {
  const types = [
    { k: 'present', v: s.present },
    { k: 'late', v: s.late },
    { k: 'absent', v: s.absent },
    { k: 'full_leave', v: s.full_leave },
    { k: 'time_leave', v: s.time_leave },
  ];
  const max = types.reduce((a, b) => (b.v > a.v ? b : a), { k: 'present', v: 0 });
  return max.v > 0 ? max.k : 'present';
}

interface Props {
  profile: UserProfile | null;
  department?: DepartmentCode;
}

type ExitLoadingRow = {
  driver_id: string | number | null;
  created_at: string;
  loading_is_delay: boolean | null;
  loading_delay_minutes: number | null;
};

export default function AttendanceReports({ profile, department = 'tajhiz' }: Props) {
  const supabase = getDepartmentClient(department);
  const tables = getDepartmentTables(department);
  const attendanceArchiveTable = department === 'installation' ? 'installation_attendance_archive' : 'attendance_archive';
  const isInstallation = department === 'installation';
  const driverLabel = isInstallation ? 'فني' : 'سائق';
  const assistantLabel = isInstallation ? 'مساعد فني' : 'مساعد سائق';
  const driversReportTitle = isInstallation ? 'تقرير الفنيين' : 'تقرير السائقين';
  const assistantsReportTitle = isInstallation ? 'تقرير مساعدي الفنيين' : 'تقرير مساعدي السائقين';
  const roleColumnLabel = (role: 'driver' | 'assistant') =>
    isInstallation ? driverLabel : role === 'driver' ? driverLabel : assistantLabel;
  const [archive, setArchive] = useState<AttendanceArchive[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [exitLoadingRows, setExitLoadingRows] = useState<ExitLoadingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportMode, setReportMode] = useState<'individual' | 'drivers' | 'assistants'>('individual');
  const [exporting, setExporting] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
  const [tableSearch, setTableSearch] = useState('');

  const toggleStaffSelection = (id: number) => {
    setSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [archRes, staffRes, exitRes] = await Promise.all([
      supabase.from(attendanceArchiveTable).select('*').order('attendance_date', { ascending: false }),
      supabase.from(tables.staffMembers).select('*').eq('is_active', true),
      supabase
        .from(tables.exitRequests)
        .select('driver_id, created_at, loading_is_delay, loading_delay_minutes')
        .eq('track_driver_loading_time', true),
    ]);
    if (archRes.data) setArchive(archRes.data);
    if (staffRes.data) {
      const normalizedStaff = (staffRes.data as Array<Record<string, unknown>>).map((s) => ({
        ...s,
        role: normalizeDepartmentStaffRole(s.role, department),
      })) as StaffMember[];
      setStaff(normalizedStaff);
    }
    if (exitRes.data) setExitLoadingRows(exitRes.data as ExitLoadingRow[]);
    if (!silent) setLoading(false);
  }, [attendanceArchiveTable, department, supabase, tables.staffMembers, tables.exitRequests]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (isInstallation && reportMode === 'assistants') setReportMode('individual');
  }, [isInstallation, reportMode]);

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

    const staffMap = new Map<number, StaffMember>();
    staff.forEach((s) => staffMap.set(Number(s.id), s));

    const loadingByDriver = new Map<number, { events: number; minutes: number }>();
    for (const row of exitLoadingRows) {
      if (row.driver_id == null) continue;
      const dk = getBaghdadDateKey(row.created_at);
      if (dateFrom && dk < dateFrom) continue;
      if (dateTo && dk > dateTo) continue;
      const id = Number(row.driver_id);
      if (!loadingByDriver.has(id)) loadingByDriver.set(id, { events: 0, minutes: 0 });
      const cur = loadingByDriver.get(id)!;
      if (row.loading_is_delay === true || (row.loading_delay_minutes ?? 0) > 0) cur.events += 1;
      cur.minutes += row.loading_delay_minutes ?? 0;
    }

    const statsMap = new Map<number, StaffStats>();
    for (const s of staff) {
      const id = Number(s.id);
      const load = loadingByDriver.get(id);
      statsMap.set(id, {
        staff_id: id,
        full_name: s.full_name,
        role: s.role as 'driver' | 'assistant',
        present: 0,
        late: 0,
        absent: 0,
        full_leave: 0,
        time_leave: 0,
        loading_delay_events: (isInstallation || s.role === 'driver') ? (load?.events ?? 0) : 0,
        loading_delay_minutes_sum: (isInstallation || s.role === 'driver') ? (load?.minutes ?? 0) : 0,
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
    }

    let list = Array.from(statsMap.values());
    if (reportMode === 'drivers') list = list.filter((s) => s.role === 'driver');
    else if (reportMode === 'assistants') list = list.filter((s) => s.role === 'assistant');
    return list.sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [archive, staff, dateFrom, dateTo, reportMode, exitLoadingRows, isInstallation]);

  const filteredStaffStats = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return staffStats;
    return staffStats.filter((s) => s.full_name.toLowerCase().includes(q));
  }, [staffStats, tableSearch]);

  const toggleSelectAll = () => {
    if (selectedStaffIds.length === filteredStaffStats.length && filteredStaffStats.length > 0) {
      setSelectedStaffIds([]);
    } else {
      setSelectedStaffIds(filteredStaffStats.map((s) => s.staff_id));
    }
  };

  const reportTableInsights = useMemo(() => {
    const rows = filteredStaffStats.map((s) => ({ attendance_type: getDominantType(s) }));
    return insightsFromAttendanceRows(rows, staff.length);
  }, [filteredStaffStats, staff.length]);

  const reportNameSuggestions = useMemo(
    () => staffStats.map((s) => s.full_name).slice(0, 40),
    [staffStats]
  );

  useAutoRefresh(30_000, () => {
    void fetchData(true);
  }, true);

  const driversSummary = useMemo(() => {
    const drivers = staffStats.filter((s) => s.role === 'driver');
    return {
      count: drivers.length,
      present: drivers.reduce((s, d) => s + d.present, 0),
      late: drivers.reduce((s, d) => s + d.late, 0),
      absent: drivers.reduce((s, d) => s + d.absent, 0),
      full_leave: drivers.reduce((s, d) => s + d.full_leave, 0),
      time_leave: drivers.reduce((s, d) => s + d.time_leave, 0),
      loading_delay_events: drivers.reduce((s, d) => s + d.loading_delay_events, 0),
      loading_delay_minutes: drivers.reduce((s, d) => s + d.loading_delay_minutes_sum, 0),
    };
  }, [staffStats]);

  const assistantsSummary = useMemo(() => {
    const assistants = staffStats.filter((s) => s.role === 'assistant');
    return {
      count: assistants.length,
      present: assistants.reduce((s, d) => s + d.present, 0),
      late: assistants.reduce((s, d) => s + d.late, 0),
      absent: assistants.reduce((s, d) => s + d.absent, 0),
      full_leave: assistants.reduce((s, d) => s + d.full_leave, 0),
      time_leave: assistants.reduce((s, d) => s + d.time_leave, 0),
    };
  }, [staffStats]);

  const handleExport = async (format: 'pdf' | 'excel') => {
    const toExport = isSelectionMode && selectedStaffIds.length > 0
      ? filteredStaffStats.filter((s) => selectedStaffIds.includes(s.staff_id))
      : filteredStaffStats;

    if (toExport.length === 0) {
      alert('لا توجد بيانات للتصدير');
      return;
    }

    setExporting(true);
    try {
      const headers = [
        'الموظف', 'الدور', 'حاضر', 'متأخر', 'غائب', 'إجازة كاملة', 'إجازة زمنية',
        'مرات تأخير التحميل', 'مجموع دقائق تأخير التحميل',
      ];
      const rows = toExport.map((s) => [
        s.full_name,
        roleColumnLabel(s.role),
        s.present,
        s.late,
        s.absent,
        s.full_leave,
        s.time_leave,
        (isInstallation || s.role === 'driver') ? s.loading_delay_events : '—',
        (isInstallation || s.role === 'driver') ? s.loading_delay_minutes_sum : '—',
      ]);

      if (format === 'excel') {
        exportToExcel([headers, ...rows], `تقرير_حضور_${dateFrom}_${dateTo}.xlsx`);
      } else {
        const html = `
          <h1 style="text-align:center;font-size:22px;margin-bottom:16px">تقرير الحضور</h1>
          <p style="text-align:center;color:#666;margin-bottom:20px">من ${dateFrom} إلى ${dateTo}</p>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:#3b82f6;color:#fff">
              ${headers.map((h) => `<th style="padding:8px;text-align:right">${h}</th>`).join('')}
            </tr></thead>
            <tbody>
              ${rows.map((row, i) => `
                <tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}">
                  ${row.map((c) => `<td style="padding:6px 8px;border:1px solid #ddd">${c}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
        await exportHtmlToPdf(`<div dir="rtl">${html}</div>`, `تقرير_حضور_${dateFrom}_${dateTo}.pdf`);
      }
      await logAttendanceActivity('export', { type: 'report', dateFrom, dateTo }, department);
    } catch (e) {
      console.error(e);
      alert('فشل التصدير');
    } finally {
      setExporting(false);
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
      {/* Date Range & Report Mode */}
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
          <div>
            <label className="block text-sm text-stone-500 mb-1">نوع التقرير</label>
            <select
              value={reportMode}
              onChange={(e) => setReportMode(e.target.value as typeof reportMode)}
              className="px-3 py-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm"
            >
              <option value="individual">تقرير فردي (الكل)</option>
              <option value="drivers">{driversReportTitle}</option>
              {!isInstallation && <option value="assistants">{assistantsReportTitle}</option>}
            </select>
          </div>
          
          <button
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              setSelectedStaffIds([]);
            }}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
              isSelectionMode ? "bg-stone-200 dark:bg-stone-700 border-stone-300 dark:border-stone-600" : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700"
            )}
          >
            {isSelectionMode ? 'إلغاء التحديد' : 'تحديد'}
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => handleExport('excel')}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Excel {isSelectionMode && selectedStaffIds.length > 0 ? `(${selectedStaffIds.length})` : 'الكل'}
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              PDF {isSelectionMode && selectedStaffIds.length > 0 ? `(${selectedStaffIds.length})` : 'الكل'}
            </button>
            <ExportMenu
              meta={{
                title: `تقرير حضور ${dateFrom} — ${dateTo}`,
                filterDescription:
                  [
                    `الوضع: ${reportMode}`,
                    tableSearch && `بحث جدول: ${tableSearch}`,
                  ]
                    .filter(Boolean)
                    .join(' | ') || '—',
                rowCount: filteredStaffStats.length,
              }}
              headerRow={[
                'الموظف',
                'الدور',
                'حاضر',
                'متأخر',
                'غائب',
                'إجازة كاملة',
                'إجازة زمنية',
                'مرات تأخير التحميل',
                'مجموع دقائق تأخير التحميل',
              ]}
              dataRows={filteredStaffStats.map((s) => [
                s.full_name,
                roleColumnLabel(s.role),
                s.present,
                s.late,
                s.absent,
                s.full_leave,
                s.time_leave,
                s.role === 'driver' ? s.loading_delay_events : '—',
                s.role === 'driver' ? s.loading_delay_minutes_sum : '—',
              ])}
              sheetName="تقرير"
            />
            <SavedViews<Record<string, unknown>>
              pageKey="attendance-reports"
              getCurrentPayload={() => ({
                dateFrom,
                dateTo,
                reportMode,
                tableSearch,
              })}
              onApply={(p) => {
                if (typeof p.dateFrom === 'string') setDateFrom(p.dateFrom);
                if (typeof p.dateTo === 'string') setDateTo(p.dateTo);
                const rm = p.reportMode as typeof reportMode | undefined;
                if (rm === 'individual' || rm === 'drivers') setReportMode(rm);
                else if (rm === 'assistants' && !isInstallation) setReportMode('assistants');
                if (typeof p.tableSearch === 'string') setTableSearch(p.tableSearch);
              }}
            />
          </div>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className={cn('grid grid-cols-1 gap-4', !isInstallation && 'md:grid-cols-2')}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-5 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Truck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="font-bold text-lg">{isInstallation ? 'ملخص حضور الفنيين' : driversReportTitle}</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">{isInstallation ? 'عدد الفنيين' : 'عدد السائقين'}</span>
              <span className="font-semibold">{driversSummary.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">أيام الحضور</span>
              <span className="font-semibold text-emerald-600">{driversSummary.present}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">مرات التأخير</span>
              <span className="font-semibold text-amber-600">{driversSummary.late}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">أيام الغياب</span>
              <span className="font-semibold text-red-600">{driversSummary.absent}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">إجازات كاملة</span>
              <span className="font-semibold">{driversSummary.full_leave}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">إجازات زمنية</span>
              <span className="font-semibold">{driversSummary.time_leave}</span>
            </div>
            <div className="flex justify-between col-span-2 border-t border-stone-100 dark:border-stone-700 pt-2 mt-1">
              <span className="text-stone-500">تأخير تحميل (طلبات إخراج، بعد 8:15)</span>
              <span className="font-semibold text-amber-700 dark:text-amber-300">
                {driversSummary.loading_delay_events} مرات / {driversSummary.loading_delay_minutes} دقيقة
              </span>
            </div>
          </div>
        </motion.div>

        {!isInstallation && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-5 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Users className="w-6 h-6 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="font-bold text-lg">{assistantsReportTitle}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">عدد المساعدين</span>
                <span className="font-semibold">{assistantsSummary.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">أيام الحضور</span>
                <span className="font-semibold text-emerald-600">{assistantsSummary.present}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">مرات التأخير</span>
                <span className="font-semibold text-amber-600">{assistantsSummary.late}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">أيام الغياب</span>
                <span className="font-semibold text-red-600">{assistantsSummary.absent}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">إجازات كاملة</span>
                <span className="font-semibold">{assistantsSummary.full_leave}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">إجازات زمنية</span>
                <span className="font-semibold">{assistantsSummary.time_leave}</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Individual Report Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 shadow-sm overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-700 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-stone-500" />
            <h3 className="font-semibold">التقرير الفردي</h3>
          </div>
          <div className="max-w-md">
            <SmartSearchBar
              pageKey="attendance-reports"
              value={tableSearch}
              onChange={setTableSearch}
              placeholder="بحث باسم الموظف في الجدول..."
              dataSuggestions={reportNameSuggestions}
              showPredictiveChips={false}
            />
          </div>
          <InsightsPanel metrics={reportTableInsights.metrics} alerts={reportTableInsights.alerts} />
          <ChartsPanel barData={reportTableInsights.bar} pieData={reportTableInsights.pie} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-stone-100 dark:bg-stone-700/50">
                {isSelectionMode && (
                  <th className="px-4 py-3 text-right text-sm font-semibold w-24">
                    <button 
                      onClick={toggleSelectAll} 
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      {selectedStaffIds.length === filteredStaffStats.length && filteredStaffStats.length > 0 ? 'إلغاء الكل' : 'تحديد الكل'}
                    </button>
                  </th>
                )}
                <th className="px-4 py-3 text-right text-sm font-semibold">الموظف</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الدور</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">حاضر</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">متأخر</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">غائب</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">إجازة كاملة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">إجازة زمنية</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">تأخير تحميل (مرات)</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">دقائق تأخير التحميل</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaffStats.map((s, idx) => (
                <tr
                  key={s.staff_id}
                  className={cn(
                    'border-t border-stone-100 dark:border-stone-700/50',
                    idx % 2 === 0 && 'bg-stone-50/50 dark:bg-stone-800/30',
                    selectedStaffIds.includes(s.staff_id) && 'bg-blue-50 dark:bg-blue-900/10'
                  )}
                >
                  {isSelectionMode && (
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedStaffIds.includes(s.staff_id)}
                        onChange={() => toggleStaffSelection(s.staff_id)}
                        className="rounded"
                      />
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'w-2.5 h-2.5 rounded-full shrink-0',
                          ATTENDANCE_TYPE_COLORS[getDominantType(s)]?.dot ?? 'bg-stone-300'
                        )}
                      />
                      <span className="font-medium">
                        <HighlightText text={s.full_name} query={tableSearch} />
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2">{roleColumnLabel(s.role)}</td>
                  <td className="px-4 py-2 text-emerald-600 dark:text-emerald-400">{s.present}</td>
                  <td className="px-4 py-2 text-amber-600 dark:text-amber-400">{s.late}</td>
                  <td className="px-4 py-2 text-red-600 dark:text-red-400">{s.absent}</td>
                  <td className="px-4 py-2">{s.full_leave}</td>
                  <td className="px-4 py-2">{s.time_leave}</td>
                  <td className="px-4 py-2 text-amber-700 dark:text-amber-300">
                    {(isInstallation || s.role === 'driver') ? s.loading_delay_events : '—'}
                  </td>
                  <td className="px-4 py-2 text-amber-800 dark:text-amber-200">
                    {(isInstallation || s.role === 'driver') ? s.loading_delay_minutes_sum : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredStaffStats.length === 0 && (
          <div className="py-16 text-center text-stone-500">
            {staffStats.length === 0 ? 'لا توجد بيانات في الفترة المحددة' : 'لا توجد نتائج تطابق البحث'}
          </div>
        )}
      </motion.div>
    </div>
  );
}
