import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Search,
  Clock,
  Timer,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  TrendingUp,
  Shield,
  Loader2,
  FileText,
  Plus,
  X,
  Download,
  Printer,
  Trash2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getDepartmentClient, getDepartmentTables } from '../data/supabaseSource';
import type { DepartmentCode } from '../data/department';
import type { ExitRequest, StaffMember, Violation } from '../lib/supabaseClient';
import { useUserProfile } from '../hooks/useUserProfile';
import { exportHtmlToPdf } from '../lib/pdfExport';
import { exportToExcel } from '../lib/excelExport';
import type { ColumnDef } from '../smart/components/DataTableEnhanced';

const DataTableEnhanced = lazy(() =>
  import('../smart/components/DataTableEnhanced').then((m) => ({ default: m.DataTableEnhanced }))
);

/* ── Types ── */
interface ViolationRecord {
  requestId: string;
  exitDate: string;
  exitReason: string | null;
  allowedMinutes: number;
  delayMinutes: number;
  delayText: string;
  returned: boolean;
  returnedAt: string | null;
}

interface StaffViolations {
  staffId: string;
  staffName: string;
  staffRole: 'driver' | 'assistant';
  totalViolations: number;
  totalDelayMinutes: number;
  records: ViolationRecord[];
}

/* ── Helpers ── */
function formatDelay(minutes: number): string {
  if (minutes <= 0) return 'أقل من دقيقة';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours} ساعة${mins > 0 ? ` و ${mins} دقيقة` : ''}`;
  return `${mins} دقيقة`;
}

function getSeverity(count: number): { label: string; color: string; bgColor: string } {
  if (count >= 5) return { label: 'خطير', color: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-100 dark:bg-red-900/30' };
  if (count >= 3) return { label: 'متوسط', color: 'text-orange-700 dark:text-orange-300', bgColor: 'bg-orange-100 dark:bg-orange-900/30' };
  return { label: 'منخفض', color: 'text-yellow-700 dark:text-yellow-300', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' };
}

function toUiRole(role?: string): 'driver' | 'assistant' {
  if (role === 'driver' || role === 'technician') return 'driver';
  return 'assistant';
}

function roleLabel(role: 'driver' | 'assistant', isInstallation: boolean): string {
  if (isInstallation) return 'فني';
  return role === 'driver' ? 'سائق' : 'مساعد';
}

/* ── Component ── */
interface Props {
  department?: DepartmentCode;
}

export default function Violations({ department = 'tajhiz' }: Props) {
  const { profile, user } = useUserProfile();
  const supabase = getDepartmentClient(department);
  const tables = getDepartmentTables(department);
  const violationsTable = tables.violations;
  const isInstallation = department === 'installation';
  const [requests, setRequests] = useState<ExitRequest[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [manualViolations, setManualViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedStaff, setExpandedStaff] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'violations' | 'delay'>('violations');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  const toggleSelectAll = () => {
    if (selectedStaffIds.length === violationsList.length) {
      setSelectedStaffIds([]);
    } else {
      setSelectedStaffIds(violationsList.map((v) => v.staffId));
    }
  };

  const toggleStaffSelection = (id: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const [showAddViolation, setShowAddViolation] = useState(false);
  const [formStaffId, setFormStaffId] = useState('');
  const [formViolationType, setFormViolationType] = useState('');
  const [formViolationReason, setFormViolationReason] = useState('');
  const [formViolationDate, setFormViolationDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingManualId, setDeletingManualId] = useState<number | null>(null);
  const [tableView, setTableView] = useState(false);

  const fetchData = useCallback(async () => {
    const staffQuery = isInstallation
      ? supabase.from(tables.staffMembers).select('*').eq('role', 'technician').eq('is_active', true).order('full_name')
      : supabase.from(tables.staffMembers).select('*').eq('is_active', true).order('full_name');
    const [reqRes, staffRes, violationsRes] = await Promise.all([
      supabase.from(tables.exitRequests).select('*').eq('exit_type', 'temporary').in('status', ['exited']).order('created_at', { ascending: false }),
      staffQuery,
      supabase.from(violationsTable).select('*').order('violation_date', { ascending: false }),
    ]);
    if (reqRes.data) setRequests(reqRes.data);
    if (staffRes.data) {
      const normalizedStaff = (staffRes.data as Array<Record<string, unknown>>).map((s) => ({
        ...s,
        role: toUiRole(String(s.role ?? 'assistant')),
      })) as StaffMember[];
      setStaff(normalizedStaff);
    }
    if (violationsRes.data) setManualViolations(violationsRes.data);
    setLoading(false);
  }, [isInstallation, supabase, tables.exitRequests, tables.staffMembers, violationsTable]);

  const deleteManualViolation = useCallback(
    async (requestId: string) => {
      if (profile?.role !== 'admin' || !requestId.startsWith('manual-')) return;
      const raw = requestId.replace(/^manual-/, '');
      const id = Number(raw);
      if (!Number.isFinite(id) || id <= 0) return;
      if (!window.confirm('حذف هذه المخالفة اليدوية من السجل؟ لا يمكن التراجع.')) return;
      setDeletingManualId(id);
      try {
        const { error } = await supabase.from(violationsTable).delete().eq('id', id);
        if (error) throw error;
        await fetchData();
      } catch (e) {
        alert('فشل الحذف: ' + (e instanceof Error ? e.message : 'خطأ غير معروف'));
      } finally {
        setDeletingManualId(null);
      }
    },
    [profile?.role, fetchData, supabase, violationsTable]
  );

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Compute violations ── */
  const violationsMap = useMemo((): Map<string, StaffViolations> => {
    const map = new Map<string, StaffViolations>();
    const staffMap = new Map<string, StaffMember>(staff.map((s) => [s.id, s]));
    const now = new Date();

    for (const req of requests) {
      if (!req.exited_at || !req.exit_duration_minutes) continue;
      const exitedTime = new Date(req.exited_at).getTime();
      const allowedMs = req.exit_duration_minutes * 60 * 1000;
      const deadline = exitedTime + allowedMs;

      // Installation violations are only for technicians.
      if (!isInstallation) {
      // Check each assistant
      for (let i = 0; i < req.assistant_ids.length; i++) {
        const aId = String(req.assistant_ids[i]);
        const aName = req.assistant_names[i] || 'مساعد';
        const returns = req.assistant_returns || {};
        const returnedAt = returns[aId];

        let delayMs = 0;
        let isViolation = false;

        if (returnedAt) {
          // Returned — check if late
          const returnTime = new Date(returnedAt).getTime();
          delayMs = returnTime - deadline;
          isViolation = delayMs > 0;
        } else {
          // Not returned yet — check if overdue
          delayMs = now.getTime() - deadline;
          isViolation = delayMs > 0;
        }

        if (isViolation) {
          const delayMinutes = Math.floor(delayMs / (1000 * 60));
          if (!map.has(aId)) {
            map.set(aId, {
              staffId: aId,
              staffName: staffMap.get(aId)?.full_name || aName,
              staffRole: 'assistant',
              totalViolations: 0,
              totalDelayMinutes: 0,
              records: [],
            });
          }
          const entry = map.get(aId)!;
          entry.totalViolations++;
          entry.totalDelayMinutes += delayMinutes;
          entry.records.push({
            requestId: req.id,
            exitDate: req.exited_at!,
            exitReason: req.exit_reason,
            allowedMinutes: req.exit_duration_minutes,
            delayMinutes,
            delayText: formatDelay(delayMinutes),
            returned: !!returnedAt,
            returnedAt: returnedAt || null,
          });
        }
      }
      }

      // Check driver too (if present)
      if (req.driver_id) {
        const dId = String(req.driver_id);
        const dName = req.driver_name || 'سائق';
        const returns = req.assistant_returns || {};
        const driverReturnedAt = returns[dId];

        let driverDelayMs = 0;
        let driverIsViolation = false;

        if (driverReturnedAt) {
          // Driver returned — check if late
          const returnTime = new Date(driverReturnedAt).getTime();
          driverDelayMs = returnTime - deadline;
          driverIsViolation = driverDelayMs > 0;
        } else {
          // Driver not returned yet — check if overdue
          driverDelayMs = now.getTime() - deadline;
          driverIsViolation = driverDelayMs > 0;
        }

        if (driverIsViolation) {
          const delayMinutes = Math.floor(driverDelayMs / (1000 * 60));
          if (!map.has(dId)) {
            map.set(dId, {
              staffId: dId,
              staffName: staffMap.get(dId)?.full_name || dName,
              staffRole: 'driver',
              totalViolations: 0,
              totalDelayMinutes: 0,
              records: [],
            });
          }
          const entry = map.get(dId)!;
          entry.totalViolations++;
          entry.totalDelayMinutes += delayMinutes;
          entry.records.push({
            requestId: req.id,
            exitDate: req.exited_at!,
            exitReason: req.exit_reason,
            allowedMinutes: req.exit_duration_minutes,
            delayMinutes,
            delayText: formatDelay(delayMinutes),
            returned: !!driverReturnedAt,
            returnedAt: driverReturnedAt || null,
          });
        }
      }
    }

    // إضافة المخالفات اليدوية
    for (const violation of manualViolations) {
      const staffId = String(violation.staff_id);
      const staffMember = staffMap.get(staffId);
      if (!staffMember) continue;

      if (!map.has(staffId)) {
        map.set(staffId, {
          staffId,
          staffName: staffMember.full_name,
          staffRole: toUiRole(staffMember.role),
          totalViolations: 0,
          totalDelayMinutes: 0,
          records: [],
        });
      }
      const entry = map.get(staffId)!;
      entry.totalViolations++;
      entry.records.push({
        requestId: `manual-${violation.id}`,
        exitDate: violation.violation_date,
        exitReason: `${violation.violation_type}: ${violation.violation_reason}`,
        allowedMinutes: 0,
        delayMinutes: 0,
        delayText: '—',
        returned: true,
        returnedAt: violation.violation_date,
      });
    }

    return map;
  }, [isInstallation, requests, staff, manualViolations]);

  /* ── Sorted + filtered list ── */
  const violationsList = useMemo((): StaffViolations[] => {
    let list: StaffViolations[] = Array.from(violationsMap.values());
    
    // Search filter
    if (search) {
      const term = search.toLowerCase();
      list = list.filter((v) => v.staffName.toLowerCase().includes(term));
    }

    // Sort
    if (sortBy === 'violations') {
      list.sort((a, b) => b.totalViolations - a.totalViolations);
    } else {
      list.sort((a, b) => b.totalDelayMinutes - a.totalDelayMinutes);
    }

    return list;
  }, [violationsMap, search, sortBy]);

  const violationsTableColumns: ColumnDef<StaffViolations>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'الموظف',
        sortable: true,
        getSortValue: (v) => v.staffName,
        accessor: (v) => v.staffName,
      },
      {
        id: 'role',
        header: 'الدور',
        accessor: (v) => roleLabel(v.staffRole, isInstallation),
      },
      {
        id: 'violations',
        header: 'المخالفات',
        sortable: true,
        getSortValue: (v) => v.totalViolations,
        accessor: (v) => v.totalViolations,
      },
      {
        id: 'delay',
        header: 'التأخير',
        sortable: true,
        getSortValue: (v) => v.totalDelayMinutes,
        accessor: (v) => formatDelay(v.totalDelayMinutes),
      },
      {
        id: 'severity',
        header: 'الخطورة',
        accessor: (v) => (
          <span className={cn('text-xs font-semibold', getSeverity(v.totalViolations).color)}>
            {getSeverity(v.totalViolations).label}
          </span>
        ),
      },
    ],
    [isInstallation]
  );

  /* ── Stats ── */
  const stats = useMemo(() => {
    const list: StaffViolations[] = Array.from(violationsMap.values());
    return {
      totalStaff: list.length,
      totalViolations: list.reduce((sum, v) => sum + v.totalViolations, 0),
      totalDelayMinutes: list.reduce((sum, v) => sum + v.totalDelayMinutes, 0),
      critical: list.filter((v) => v.totalViolations >= 5).length,
    };
  }, [violationsMap]);

  const toggleExpand = (id: string) => {
    setExpandedStaff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ── Export ── */
  const exportExcel = () => {
    const toExport = isSelectionMode && selectedStaffIds.length > 0
      ? violationsList.filter((v) => selectedStaffIds.includes(v.staffId))
      : violationsList;

    if (toExport.length === 0) {
      alert('لا توجد مخالفات للتصدير');
      return;
    }

    const headers = ['الموظف', 'الرتبة', 'إجمالي المخالفات', 'إجمالي التأخير', 'حالة الخطورة'];
    const rows = toExport.map(v => {
      const severity = getSeverity(v.totalViolations);
      return [
        v.staffName,
        roleLabel(v.staffRole, isInstallation),
        v.totalViolations,
        formatDelay(v.totalDelayMinutes),
        severity.label
      ];
    });
    const filename = `سجل_المخالفات_${new Date().toISOString().slice(0,10)}`;
    exportToExcel([headers, ...rows], filename, 'المخالفات');
  };

  const exportPDF = async () => {
    const toExport = isSelectionMode && selectedStaffIds.length > 0
      ? violationsList.filter((v) => selectedStaffIds.includes(v.staffId))
      : violationsList;

    if (toExport.length === 0) {
      alert('لا توجد مخالفات للتصدير');
      return;
    }

    setExporting(true);
    const headers = ['الموظف', 'الرتبة', 'المخالفات', 'التأخير'];
    const rows = toExport.map(v => [
      v.staffName,
      roleLabel(v.staffRole, isInstallation),
      v.totalViolations,
      formatDelay(v.totalDelayMinutes)
    ]);

    let html = `
      <h1 style="text-align:center;font-size:22px;margin-bottom:12px">تقرير سجل المخالفات والتأخير</h1>
      <p style="text-align:center;color:#666;margin-bottom:20px">تاريخ التصدير: ${new Date().toLocaleDateString('ar-IQ')} | إجمالي الموظفين المخالفين: ${toExport.length}</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#dc2626;color:#fff">
          ${headers.map(h => `<th style="padding:8px;text-align:right">${h}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${rows.map((row, i) => `
            <tr style="${i % 2 === 0 ? 'background:#fef2f2' : ''}">
              ${row.map(cell => `<td style="padding:6px 8px;border:1px solid #ddd">${cell}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    try {
      await exportHtmlToPdf(`<div dir="rtl">${html}</div>`, `سجل_المخالفات_${Date.now()}.pdf`);
    } catch (e) {
      console.error(e);
      alert('فشل تصدير PDF');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-3">
            <Shield className="w-7 h-7 text-red-600 dark:text-red-400" />
            {isInstallation ? 'سجل مخالفات كادر التركيب' : 'سجل المخالفات'}
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            {isInstallation ? 'تتبع مخالفات وتأخيرات الفنيين في قسم التركيب' : 'تتبع تأخيرات الموظفين في الخروج المؤقت'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSelectionMode(!isSelectionMode)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors",
              isSelectionMode ? "bg-stone-200 dark:bg-stone-700 border-stone-300 dark:border-stone-600 text-stone-900 dark:text-white" : "bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-50"
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
                {selectedStaffIds.length === violationsList.length ? 'إلغاء الكل' : 'تحديد الكل'}
              </button>
              
              {selectedStaffIds.length > 0 && (
                <>
                  <button
                    onClick={exportExcel}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 transition-colors"
                  >
                    <Download className="w-4 h-4" /> Excel ({selectedStaffIds.length})
                  </button>
                  <button
                    onClick={exportPDF}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium shadow-lg shadow-red-600/25 hover:bg-red-700 transition-colors"
                  >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                    PDF ({selectedStaffIds.length})
                  </button>
                </>
              )}
            </>
          )}

          {!isSelectionMode && (
            <>
              <button
                onClick={exportExcel}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                تصدير Excel
              </button>
              <button
                onClick={exportPDF}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium shadow-lg shadow-red-600/25 hover:bg-red-700 transition-colors"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                تصدير PDF
              </button>
            </>
          )}
          {profile?.role === 'admin' && (
            <button
              onClick={() => setShowAddViolation(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium shadow-lg shadow-red-600/25 hover:bg-red-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              إضافة مخالفة
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{stats.totalStaff}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">موظف مخالف</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{stats.totalViolations}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">إجمالي المخالفات</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Timer className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{formatDelay(stats.totalDelayMinutes)}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">إجمالي التأخير</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.critical}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">حالة خطيرة (5+ مخالفة)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم الموظف..."
            className="w-full pr-11 pl-4 py-3 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('violations')}
            className={cn(
              'px-4 py-2.5 rounded-xl text-sm font-medium transition-colors',
              sortBy === 'violations'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-300 dark:border-stone-600'
            )}
          >
            حسب عدد المخالفات
          </button>
          <button
            onClick={() => setSortBy('delay')}
            className={cn(
              'px-4 py-2.5 rounded-xl text-sm font-medium transition-colors',
              sortBy === 'delay'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-300 dark:border-stone-600'
            )}
          >
            حسب مدة التأخير
          </button>
          <button
            type="button"
            onClick={() => setTableView((v) => !v)}
            className={cn(
              'px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border',
              tableView
                ? 'bg-stone-800 text-white border-stone-800 dark:bg-stone-200 dark:text-stone-900'
                : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border-stone-300 dark:border-stone-600'
            )}
          >
            {tableView ? 'عرض البطاقات' : 'جدول محسّن'}
          </button>
        </div>
      </div>

      {/* Violations List */}
      {violationsList.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-lg font-semibold text-stone-700 dark:text-stone-300">لا توجد مخالفات</p>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            {isInstallation ? 'لا توجد مخالفات على كادر التركيب (الفنيين)' : 'جميع الموظفين ملتزمين بأوقات الخروج'}
          </p>
        </div>
      ) : tableView ? (
        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-red-600" />
            </div>
          }
        >
          <DataTableEnhanced
            rows={violationsList as unknown as Record<string, unknown>[]}
            columns={violationsTableColumns as unknown as ColumnDef<unknown>[]}
            getRowKey={(v) => (v as StaffViolations).staffId}
            defaultPageSize={15}
            pageSizeOptions={[10, 15, 25, 50]}
            className="bg-white dark:bg-stone-900"
          />
        </Suspense>
      ) : (
        <div className="space-y-3">
          {violationsList.map((v, index) => {
            const severity = getSeverity(v.totalViolations);
            const isExpanded = expandedStaff.has(v.staffId);

            return (
              <motion.div
                key={v.staffId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={cn(
                  'bg-white dark:bg-stone-900 rounded-2xl border shadow-sm overflow-hidden transition-all',
                  v.totalViolations >= 5
                    ? 'border-red-300 dark:border-red-800 ring-1 ring-red-200/50 dark:ring-red-900/30'
                    : v.totalViolations >= 3
                      ? 'border-orange-300 dark:border-orange-800'
                      : 'border-stone-200 dark:border-stone-800'
                )}
              >
                {/* Header */}
                <div
                  className="w-full flex items-center justify-between p-4 text-right hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {isSelectionMode && (
                      <input
                        type="checkbox"
                        checked={selectedStaffIds.includes(v.staffId)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleStaffSelection(v.staffId);
                        }}
                        className="w-4 h-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                      />
                    )}
                    <div 
                      className={cn(
                        'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer',
                        v.totalViolations >= 5
                          ? 'bg-red-100 dark:bg-red-900/30'
                          : v.totalViolations >= 3
                            ? 'bg-orange-100 dark:bg-orange-900/30'
                            : 'bg-amber-100 dark:bg-amber-900/30'
                      )}
                      onClick={() => toggleExpand(v.staffId)}
                    >
                      <User className={cn(
                        'w-5 h-5',
                        v.totalViolations >= 5
                          ? 'text-red-600 dark:text-red-400'
                          : v.totalViolations >= 3
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-amber-600 dark:text-amber-400'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(v.staffId)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-stone-900 dark:text-white truncate">{v.staffName}</span>
                        <span className="text-xs text-stone-400">
                          ({roleLabel(v.staffRole, isInstallation)})
                        </span>
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', severity.bgColor, severity.color)}>
                          <AlertTriangle className="w-3 h-3" />
                          {severity.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-stone-500 dark:text-stone-400">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {v.totalViolations} مخالفة
                        </span>
                        <span className="flex items-center gap-1">
                          <Timer className="w-3.5 h-3.5" />
                          تأخير {formatDelay(v.totalDelayMinutes)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-stone-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-stone-400 flex-shrink-0" />
                  )}
                </div>

                {/* Expanded Records */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-2 border-t border-stone-100 dark:border-stone-800 pt-3">
                        {v.records.map((rec, i) => (
                          <div
                            key={`${rec.requestId}-${i}`}
                            className={cn(
                              'flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm',
                              rec.returned
                                ? 'bg-amber-50 dark:bg-amber-900/10'
                                : 'bg-red-50 dark:bg-red-900/10'
                            )}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Calendar className="w-4 h-4 text-stone-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-stone-700 dark:text-stone-300">
                                    {new Date(rec.exitDate).toLocaleDateString('ar-IQ', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </span>
                                  <span className="text-stone-400 text-xs">
                                    {new Date(rec.exitDate).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {rec.exitReason && (
                                    <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                                      {rec.exitReason}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                                  <span>المدة المسموحة: {rec.allowedMinutes} دقيقة</span>
                                  <span className="text-stone-300 dark:text-stone-600">|</span>
                                  <span className={cn(
                                    'font-semibold',
                                    rec.returned ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                                  )}>
                                    تأخير: {rec.delayText}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {profile?.role === 'admin' && rec.requestId.startsWith('manual-') && (
                                <button
                                  type="button"
                                  title="حذف المخالفة اليدوية"
                                  disabled={deletingManualId === Number(rec.requestId.replace(/^manual-/, ''))}
                                  onClick={() => deleteManualViolation(rec.requestId)}
                                  className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                                >
                                  {deletingManualId === Number(rec.requestId.replace(/^manual-/, '')) ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                                rec.returned
                                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                              )}>
                                {rec.returned ? (
                                  <>
                                    <Clock className="w-3 h-3" />
                                    عاد متأخراً
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="w-3 h-3" />
                                    لم يعُد بعد
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Violation Modal */}
      <AnimatePresence>
        {showAddViolation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddViolation(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-stone-200 dark:border-stone-700"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  إضافة مخالفة جديدة
                </h2>
                <button
                  onClick={() => setShowAddViolation(false)}
                  className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  <X className="w-5 h-5 text-stone-500" />
                </button>
              </div>

              {formError && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-800">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    <User className="w-4 h-4 inline ml-1" />
                    {isInstallation ? 'اسم الفني' : 'اسم السائق / المساعد'}
                  </label>
                  <select
                    value={formStaffId}
                    onChange={(e) => setFormStaffId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 text-stone-900 dark:text-white"
                  >
                    <option value="">اختر الموظف...</option>
                    {staff.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.full_name} ({roleLabel(toUiRole(s.role), isInstallation)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    <FileText className="w-4 h-4 inline ml-1" />
                    نوع المخالفة
                  </label>
                  <select
                    value={formViolationType}
                    onChange={(e) => setFormViolationType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 text-stone-900 dark:text-white"
                  >
                    <option value="">اختر نوع المخالفة...</option>
                    <option value="تأخير في العودة">تأخير في العودة</option>
                    <option value="عدم الالتزام بالوقت">عدم الالتزام بالوقت</option>
                    <option value="سلوك غير لائق">سلوك غير لائق</option>
                    <option value="إهمال في العمل">إهمال في العمل</option>
                    <option value="عدم اتباع التعليمات">عدم اتباع التعليمات</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    <AlertTriangle className="w-4 h-4 inline ml-1" />
                    سبب المخالفة
                  </label>
                  <textarea
                    value={formViolationReason}
                    onChange={(e) => setFormViolationReason(e.target.value)}
                    rows={3}
                    placeholder="اكتب تفاصيل المخالفة..."
                    className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 resize-none text-stone-900 dark:text-white placeholder:text-stone-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    <Calendar className="w-4 h-4 inline ml-1" />
                    تاريخ المخالفة
                  </label>
                  <input
                    type="date"
                    value={formViolationDate}
                    onChange={(e) => setFormViolationDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 text-stone-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    <FileText className="w-4 h-4 inline ml-1" />
                    ملاحظات إضافية (اختياري)
                  </label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    rows={2}
                    placeholder="أي ملاحظات إضافية..."
                    className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 resize-none text-stone-900 dark:text-white placeholder:text-stone-400"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddViolation(false);
                    setFormStaffId('');
                    setFormViolationType('');
                    setFormViolationReason('');
                    setFormViolationDate(new Date().toISOString().split('T')[0]);
                    setFormNotes('');
                    setFormError('');
                  }}
                  className="px-5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={async () => {
                    if (!formStaffId || !formViolationType || !formViolationReason) return;
                    setSubmitting(true);
                    setFormError('');
                    const { error } = await supabase.from(violationsTable).insert({
                      staff_id: Number(formStaffId),
                      violation_type: formViolationType,
                      violation_reason: formViolationReason,
                      violation_date: formViolationDate,
                      notes: formNotes || null,
                      created_by: user?.id || null,
                    });
                    if (error) {
                      setFormError(error.message || 'حدث خطأ أثناء حفظ المخالفة');
                    } else {
                      setShowAddViolation(false);
                      setFormStaffId('');
                      setFormViolationType('');
                      setFormViolationReason('');
                      setFormViolationDate(new Date().toISOString().split('T')[0]);
                      setFormNotes('');
                      setFormError('');
                      await fetchData();
                    }
                    setSubmitting(false);
                  }}
                  disabled={!formStaffId || !formViolationType || !formViolationReason || submitting}
                  className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium shadow-lg shadow-red-600/25 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      إضافة المخالفة
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
