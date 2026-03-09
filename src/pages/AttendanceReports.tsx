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
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import { exportHtmlToPdf } from '../lib/pdfExport';
import { exportToCsv } from '../lib/excelExport';
import { logAttendanceActivity } from '../lib/attendanceActivity';
import type {
  UserProfile,
  StaffMember,
  AttendanceArchive,
} from '../lib/supabaseClient';

interface StaffStats {
  staff_id: number;
  full_name: string;
  role: 'driver' | 'assistant';
  present: number;
  late: number;
  absent: number;
  full_leave: number;
  time_leave: number;
}

interface Props {
  profile: UserProfile | null;
}

export default function AttendanceReports({ profile }: Props) {
  const [archive, setArchive] = useState<AttendanceArchive[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportMode, setReportMode] = useState<'individual' | 'drivers' | 'assistants'>('individual');
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [archRes, staffRes] = await Promise.all([
      supabase.from('attendance_archive').select('*').order('attendance_date', { ascending: false }),
      supabase.from('staff_members').select('*').eq('is_active', true),
    ]);
    if (archRes.data) setArchive(archRes.data);
    if (staffRes.data) setStaff(staffRes.data);
    setLoading(false);
  }, []);

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

    const staffMap = new Map<number, StaffMember>();
    staff.forEach((s) => staffMap.set(Number(s.id), s));

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
  }, [archive, staff, dateFrom, dateTo, reportMode]);

  const driversSummary = useMemo(() => {
    const drivers = staffStats.filter((s) => s.role === 'driver');
    return {
      count: drivers.length,
      present: drivers.reduce((s, d) => s + d.present, 0),
      late: drivers.reduce((s, d) => s + d.late, 0),
      absent: drivers.reduce((s, d) => s + d.absent, 0),
      full_leave: drivers.reduce((s, d) => s + d.full_leave, 0),
      time_leave: drivers.reduce((s, d) => s + d.time_leave, 0),
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

  const handleExport = async (format: 'pdf' | 'csv') => {
    setExporting(true);
    try {
      const headers = ['الموظف', 'الدور', 'حاضر', 'متأخر', 'غائب', 'إجازة كاملة', 'إجازة زمنية'];
      const rows = staffStats.map((s) => [
        s.full_name,
        s.role === 'driver' ? 'سائق' : 'مساعد سائق',
        s.present,
        s.late,
        s.absent,
        s.full_leave,
        s.time_leave,
      ]);

      if (format === 'csv') {
        exportToCsv([headers, ...rows], `تقرير_حضور_${dateFrom}_${dateTo}.csv`);
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
      await logAttendanceActivity('export', { type: 'report', dateFrom, dateTo });
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range & Report Mode */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-4 shadow-sm"
      >
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-stone-500 mb-1">من تاريخ</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-500 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-500 mb-1">نوع التقرير</label>
            <select
              value={reportMode}
              onChange={(e) => setReportMode(e.target.value as typeof reportMode)}
              className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm"
            >
              <option value="individual">تقرير فردي (الكل)</option>
              <option value="drivers">تقرير السائقين</option>
              <option value="assistants">تقرير مساعدي السائقين</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Excel
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              PDF
            </button>
          </div>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-5 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Truck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="font-bold text-lg">تقرير السائقين</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">عدد السائقين</span>
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
          </div>
        </motion.div>

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
            <h3 className="font-bold text-lg">تقرير مساعدي السائقين</h3>
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
      </div>

      {/* Individual Report Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 shadow-sm overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-700 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-stone-500" />
          <h3 className="font-semibold">التقرير الفردي</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-stone-100 dark:bg-stone-700/50">
                <th className="px-4 py-3 text-right text-sm font-semibold">الموظف</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">الدور</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">حاضر</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">متأخر</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">غائب</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">إجازة كاملة</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">إجازة زمنية</th>
              </tr>
            </thead>
            <tbody>
              {staffStats.map((s, idx) => (
                <tr
                  key={s.staff_id}
                  className={cn(
                    'border-t border-stone-100 dark:border-stone-700/50',
                    idx % 2 === 0 && 'bg-stone-50/50 dark:bg-stone-800/30'
                  )}
                >
                  <td className="px-4 py-2 font-medium">{s.full_name}</td>
                  <td className="px-4 py-2">{s.role === 'driver' ? 'سائق' : 'مساعد سائق'}</td>
                  <td className="px-4 py-2 text-emerald-600 dark:text-emerald-400">{s.present}</td>
                  <td className="px-4 py-2 text-amber-600 dark:text-amber-400">{s.late}</td>
                  <td className="px-4 py-2 text-red-600 dark:text-red-400">{s.absent}</td>
                  <td className="px-4 py-2">{s.full_leave}</td>
                  <td className="px-4 py-2">{s.time_leave}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {staffStats.length === 0 && (
          <div className="py-16 text-center text-stone-500">لا توجد بيانات في الفترة المحددة</div>
        )}
      </motion.div>
    </div>
  );
}
