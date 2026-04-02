import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Filter, ChevronDown, Check, XCircle, Eye,
  Camera, Upload, Wrench, AlertTriangle, Clock, Truck, User,
  MessageSquare, Image as ImageIcon, FileWarning, Download, Printer, Loader2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getDepartmentClient, getDepartmentTables, normalizeDepartmentVehicleRow } from '../data/supabaseSource';
import type { DepartmentCode } from '../data/department';
import type {
  MaintenanceRequest, MaintenancePriority, Vehicle, StaffMember,
  UserProfile, DriverIssueReport, MaintenanceRecord,
} from '../lib/supabaseClient';
import type { PageKey } from '../components/Layout';
import { exportHtmlToPdf } from '../lib/pdfExport';
import { exportToExcel } from '../lib/excelExport';
import { rpcWithInstallationFallback } from '../lib/rpcFallback';
import {
  SmartSearchBar,
  HighlightText,
  InsightsPanel,
  ChartsPanel,
  ExportMenu,
  SavedViews,
  useAutoRefresh,
  insightsFromMaintenanceRequests,
} from '../smart';

const MAINTENANCE_TYPES = [
  'صيانة عامة', 'تغيير زيت', 'فلتر زيت', 'فلتر هواء', 'فحص الفرامل',
  'فحص شامل', 'إصلاح محرك', 'إصلاح كهربائي', 'إصلاح إطارات', 'صيانة مكيف',
  'إصلاح ناقل الحركة', 'أخرى',
];

const PRIORITY_CONFIG: Record<MaintenancePriority, { bg: string; text: string; label: string }> = {
  low:    { bg: 'bg-stone-100 dark:bg-stone-800', text: 'text-stone-600 dark:text-stone-400', label: 'منخفض' },
  medium: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'متوسط' },
  high:   { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'عالي' },
  urgent: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'عاجل' },
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  pending:     { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'قيد الانتظار' },
  approved:    { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-400',   label: 'تمت الموافقة' },
  rejected:    { bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-400',     label: 'مرفوض' },
  in_progress: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', label: 'جاري التنفيذ' },
  completed:   { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'مكتمل' },
};

interface Props {
  profile: UserProfile | null;
  onNavigate: (page: PageKey) => void;
  department?: DepartmentCode;
}

export default function MaintenanceRequests({ profile, onNavigate, department = 'tajhiz' }: Props) {
  const supabase = getDepartmentClient(department);
  const tables = getDepartmentTables(department);
  const maintenanceImagesBucket = department === 'installation' ? 'installation-maintenance-images' : 'maintenance-images';
  const isInstallation = department === 'installation';
  const driverLabel = isInstallation ? 'فني' : 'سائق';
  const driverPluralLabel = isInstallation ? 'الفنيين' : 'السائقين';
  const driverIssuesTitle = isInstallation ? 'بلاغات الفنيين' : 'بلاغات السائقين';
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<StaffMember[]>([]);
  const [driverIssues, setDriverIssues] = useState<DriverIssueReport[]>([]);
  const [pastRecords, setPastRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<MaintenanceRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState<'requests' | 'issues'>('requests');

  // Selection & Delete state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Form state
  const [formDriverId, setFormDriverId] = useState('');
  const [formVehicleId, setFormVehicleId] = useState('');
  const [formType, setFormType] = useState(MAINTENANCE_TYPES[0]);
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<MaintenancePriority>('medium');
  const [formNotes, setFormNotes] = useState('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = profile?.role === 'admin';
  const isManager = profile?.role === 'maintenance_manager';

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const staffQuery = department === 'installation'
      ? supabase.from(tables.staffMembers).select('*').eq('is_active', true)
      : supabase.from(tables.staffMembers).select('*').eq('role', 'driver').eq('is_active', true);

    const [reqRes, vehRes, drvRes, issRes, recRes] = await Promise.all([
      supabase.from(tables.maintenanceRequests).select('*').order('created_at', { ascending: false }),
      supabase.from(tables.vehicles).select('*'),
      staffQuery,
      supabase.from(tables.driverIssueReports).select('*').order('created_at', { ascending: false }),
      supabase.from(tables.maintenanceRecords).select('*').order('created_at', { ascending: false }),
    ]);
    if (reqRes.data) {
      const normalized = (reqRes.data as Array<Record<string, unknown>>).map((r) => ({
        ...r,
        // Installation schema used staff_id historically; normalize to driver_id for shared UI logic.
        driver_id: r.driver_id ?? r.staff_id ?? null,
        priority: (r.priority as MaintenancePriority) ?? 'medium',
        status: (r.status as MaintenanceRequest['status']) ?? 'pending',
        images: Array.isArray(r.images) ? r.images : [],
        admin_notes: r.admin_notes ?? null,
      })) as MaintenanceRequest[];
      setRequests(normalized);
    }
    if (vehRes.data) {
      setVehicles(
        (vehRes.data as Array<Record<string, unknown>>).map((v) => normalizeDepartmentVehicleRow(v)),
      );
    }
    if (drvRes.data) {
      const normalizedDrivers = (drvRes.data as Array<Record<string, unknown>>)
        .map((d) => ({
          ...d,
          role: d.role === 'assistant' || d.role === 'crew' ? 'assistant' : 'driver',
        })) as StaffMember[];
      setDrivers(normalizedDrivers);
    }
    if (issRes.data) {
      const normalizedIssues = (issRes.data as Array<Record<string, unknown>>).map((issue) => ({
        ...issue,
        driver_id: issue.driver_id ?? issue.staff_id ?? null,
        images: Array.isArray(issue.images) ? issue.images : [],
      })) as DriverIssueReport[];
      setDriverIssues(normalizedIssues);
    }
    if (recRes.data) setPastRecords(recRes.data);
    if (!silent) setLoading(false);
  }, [department, supabase, tables.maintenanceRequests, tables.vehicles, tables.staffMembers, tables.driverIssueReports, tables.maintenanceRecords]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  async function handleDeleteSelected() {
    if (selectedIds.length === 0 || !window.confirm(`هل أنت متأكد من حذف ${selectedIds.length} طلب؟ سيتم حذف كل ما يرتبط بها (السجلات، الصور، أحداث المركبة، التنبيهات) دون التأثير على النظام.`)) return;
    setDeleting(true);
    const { data, error } = await rpcWithInstallationFallback<{ success?: boolean; error?: string }>(supabase, {
      department,
      installationRpc: 'installation_delete_maintenance_requests',
      defaultRpc: 'delete_maintenance_requests',
      params: { p_request_ids: selectedIds },
    });
    const result = data as { success?: boolean; error?: string } | null;
    if (error) {
      alert('فشل الحذف: ' + error.message);
    } else if (!result?.success) {
      alert(result?.error === 'admin_only' ? 'هذا الإجراء مسموح للأدمن فقط' : (result?.error || 'فشل الحذف'));
    } else {
      setSelectedIds([]);
      setIsSelectionMode(false);
      fetchData();
    }
    setDeleting(false);
  }

  const handleExport = (format: 'pdf' | 'excel') => {
    const toExport = isSelectionMode && selectedIds.length > 0
      ? filteredRequests.filter((r) => selectedIds.includes(r.id))
      : filteredRequests;

    if (toExport.length === 0) {
      alert('لا توجد طلبات للتصدير');
      return;
    }

    setExporting(true);
    try {
      const headers = ['التاريخ', 'المركبة', 'نوع الصيانة', 'الأولوية', 'الحالة', 'وصف المشكلة'];
      const rows = toExport.map(r => {
        const v = vehicles.find(veh => veh.id === r.vehicle_id);
        return [
          new Date(r.created_at).toLocaleDateString('ar-IQ'),
          v?.plate_number || `ID: ${r.vehicle_id}`,
          r.maintenance_type,
          PRIORITY_CONFIG[r.priority]?.label || r.priority,
          STATUS_CONFIG[r.status]?.label || r.status,
          r.description || '—',
        ];
      });

      const filename = `طلبات_الصيانة_${new Date().toISOString().slice(0, 10)}`;

      if (format === 'excel') {
        exportToExcel([headers, ...rows], filename, 'الطلبات');
      } else {
        const html = `
          <h1 style="text-align:center;font-size:22px;margin-bottom:16px">سجل طلبات الصيانة</h1>
          <p style="text-align:center;color:#666;margin-bottom:20px">تاريخ التصدير: ${new Date().toLocaleDateString('ar-IQ')}</p>
          <table style="width:100%;border-collapse:collapse;font-size:10px">
            <thead><tr style="background:#3b82f6;color:#fff">
              ${headers.map(h => `<th style="padding:8px;text-align:right">${h}</th>`).join('')}
            </tr></thead>
            <tbody>
              ${rows.map((row, i) => `
                <tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}">
                  ${row.map(cell => `<td style="padding:6px;border:1px solid #ddd">${cell}</td>`).join('')}
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

  const driverVehicleMap = useMemo(() => {
    const map: Record<string, Vehicle | undefined> = {};
    drivers.forEach(d => {
      const v = vehicles.find(v => v.assigned_driver_id === String(d.id));
      if (v) map[d.id] = v;
    });
    return map;
  }, [drivers, vehicles]);

  // Auto-fill vehicle when driver is selected
  useEffect(() => {
    if (formDriverId) {
      const v = driverVehicleMap[formDriverId];
      if (v) setFormVehicleId(String(v.id));
    }
  }, [formDriverId, driverVehicleMap]);

  const hasActiveRequest = useMemo(() =>
    requests.some(r => r.status === 'in_progress'),
  [requests]);

  const filteredRequests = useMemo(() => {
    let list = requests;
    if (filterStatus !== 'all') list = list.filter(r => r.status === filterStatus);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(r => {
        const v = vehicles.find(v => v.id === r.vehicle_id);
        const plate = String(v?.plate_number ?? '').toLowerCase();
        const mType = String(r.maintenance_type ?? '').toLowerCase();
        const desc = String(r.description ?? '').toLowerCase();
        return (
          plate.includes(q) ||
          mType.includes(q) ||
          desc.includes(q)
        );
      });
    }
    return list;
  }, [requests, filterStatus, searchQuery, vehicles]);

  const maintInsights = useMemo(
    () =>
      insightsFromMaintenanceRequests(
        filteredRequests.map((r) => ({ status: r.status, priority: r.priority }))
      ),
    [filteredRequests]
  );

  const maintSearchSuggestions = useMemo(
    () => [...vehicles.map((v) => v.plate_number), ...MAINTENANCE_TYPES].slice(0, 40),
    [vehicles]
  );

  useAutoRefresh(30_000, () => {
    void fetchData(true);
  }, tab === 'requests');

  const safeStatus = (status: string) => STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const safePriority = (priority: string) => PRIORITY_CONFIG[(priority as MaintenancePriority)] ?? PRIORITY_CONFIG.medium;

  async function uploadImage(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop();
    const path = `requests/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(maintenanceImagesBucket).upload(path, file);
    if (error) return null;
    const { data } = supabase.storage.from(maintenanceImagesBucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const url = await uploadImage(file);
      if (url) setFormImages(prev => [...prev, url]);
    }
  }

  async function handleSubmit() {
    if (!formVehicleId) return;
    setSubmitting(true);
    setFormError('');
    const { error } = await supabase.from(tables.maintenanceRequests).insert({
      vehicle_id: Number(formVehicleId),
      driver_id: formDriverId ? Number(formDriverId) : null,
      maintenance_type: formType,
      description: formDescription,
      priority: formPriority,
      admin_notes: formNotes,
      images: formImages,
      requested_by: (await supabase.auth.getUser()).data.user?.id,
    });
    if (error) {
      console.error('Maintenance request insert error:', error);
      setFormError('فشل في إرسال الطلب: ' + error.message);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    resetForm();
    setShowForm(false);
    fetchData();
  }

  function resetForm() {
    setFormDriverId('');
    setFormVehicleId('');
    setFormType(MAINTENANCE_TYPES[0]);
    setFormDescription('');
    setFormPriority('medium');
    setFormNotes('');
    setFormImages([]);
    setFormError('');
  }

  async function handleApprove(req: MaintenanceRequest) {
    if (hasActiveRequest) return;
    const now = new Date().toISOString();
    await supabase.from(tables.maintenanceRequests).update({
      status: 'in_progress',
      approved_by: (await supabase.auth.getUser()).data.user?.id,
      approved_at: now,
      started_at: now,
    }).eq('id', req.id);
    setShowDetail(null);
    fetchData();
  }

  async function handleReject(req: MaintenanceRequest) {
    await supabase.from(tables.maintenanceRequests).update({
      status: 'rejected',
      approved_by: (await supabase.auth.getUser()).data.user?.id,
      approved_at: new Date().toISOString(),
    }).eq('id', req.id);
    setShowDetail(null);
    fetchData();
  }

  async function convertIssueToRequest(issue: DriverIssueReport) {
    const driver = drivers.find((d) => String(d.id) === String(issue.driver_id ?? ''));
    const vehicle = vehicles.find(v => v.id === issue.vehicle_id);
    if (!vehicle) return;

    await supabase.from(tables.maintenanceRequests).insert({
      vehicle_id: vehicle.id,
      driver_id: issue.driver_id,
      maintenance_type: 'صيانة عامة',
      description: issue.description,
      priority: 'medium',
      images: issue.images,
      requested_by: (await supabase.auth.getUser()).data.user?.id,
    });

    await supabase.from(tables.driverIssueReports).update({ status: 'converted' }).eq('id', issue.id);
    fetchData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('requests')}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
            tab === 'requests' ? 'bg-blue-600 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400',
          )}
        >
          طلبات الصيانة ({requests.length})
        </button>
        <button
          onClick={() => setTab('issues')}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
            tab === 'issues' ? 'bg-blue-600 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400',
          )}
        >
          {driverIssuesTitle} ({driverIssues.filter(i => i.status === 'pending').length})
        </button>
      </div>

      {tab === 'requests' ? (
        <>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-1 gap-3 w-full sm:w-auto flex-wrap">
              <div className="flex-1 min-w-[200px] sm:max-w-md">
                <SmartSearchBar
                  pageKey="maintenance-requests"
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="بحث بالمركبة، نوع الصيانة، الوصف..."
                  dataSuggestions={maintSearchSuggestions}
                  showPredictiveChips={false}
                />
              </div>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm"
              >
                <option value="all">جميع الحالات</option>
                <option value="pending">قيد الانتظار</option>
                <option value="in_progress">جاري التنفيذ</option>
                <option value="completed">مكتمل</option>
                <option value="rejected">مرفوض</option>
              </select>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              {isAdmin && (
                <>
                  <button
                    onClick={() => handleExport('excel')}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Excel {isSelectionMode && selectedIds.length > 0 ? `(${selectedIds.length})` : 'الكل'}
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium shadow-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                    PDF {isSelectionMode && selectedIds.length > 0 ? `(${selectedIds.length})` : 'الكل'}
                  </button>
                  <ExportMenu
                    meta={{
                      title: 'طلبات الصيانة',
                      filterDescription:
                        [searchQuery && `بحث: ${searchQuery}`, filterStatus !== 'all' && `حالة: ${filterStatus}`]
                          .filter(Boolean)
                          .join(' | ') || '—',
                      rowCount: filteredRequests.length,
                    }}
                    headerRow={['التاريخ', 'المركبة', 'نوع الصيانة', 'الأولوية', 'الحالة', 'وصف المشكلة']}
                    dataRows={filteredRequests.map((r) => {
                      const v = vehicles.find((veh) => veh.id === r.vehicle_id);
                      return [
                        new Date(r.created_at).toLocaleDateString('ar-IQ'),
                        v?.plate_number || `ID: ${r.vehicle_id}`,
                        r.maintenance_type,
                        PRIORITY_CONFIG[r.priority]?.label || r.priority,
                        STATUS_CONFIG[r.status]?.label || r.status,
                        r.description || '—',
                      ];
                    })}
                    sheetName="الطلبات"
                  />
                  <SavedViews<Record<string, unknown>>
                    pageKey="maintenance-requests"
                    getCurrentPayload={() => ({ searchQuery, filterStatus })}
                    onApply={(p) => {
                      if (typeof p.searchQuery === 'string') setSearchQuery(p.searchQuery);
                      if (typeof p.filterStatus === 'string') setFilterStatus(p.filterStatus);
                    }}
                  />
                  {selectedIds.length > 0 && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={handleDeleteSelected}
                      disabled={deleting}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium shadow-lg shadow-red-600/30 hover:bg-red-700 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      حذف ({selectedIds.length})
                    </motion.button>
                  )}
                  <button
                    onClick={() => {
                      setIsSelectionMode(!isSelectionMode);
                      setSelectedIds([]);
                    }}
                    className={cn(
                      "px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors",
                      isSelectionMode 
                        ? "bg-stone-800 text-white border-stone-800" 
                        : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400"
                    )}
                  >
                    {isSelectionMode ? 'إلغاء التحديد' : 'تحديد'}
                  </button>
                </>
              )}
              {isAdmin && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  طلب صيانة جديد
                </motion.button>
              )}
            </div>
          </div>

          <InsightsPanel metrics={maintInsights.metrics} alerts={maintInsights.alerts} />
          <ChartsPanel barData={maintInsights.bar} pieData={maintInsights.pie} />

          {/* Active maintenance warning */}
          {hasActiveRequest && (isManager || isAdmin) && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                يوجد طلب صيانة نشط حالياً. يجب إنهاء الصيانة الحالية قبل الموافقة على طلب جديد.
              </p>
            </div>
          )}

          {/* Requests list */}
          <div className="space-y-3">
            {filteredRequests.length === 0 && (
              <div className="text-center py-16 text-stone-400">
                <Wrench className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد طلبات صيانة</p>
              </div>
            )}
            {filteredRequests.map((req, i) => {
              const vehicle = vehicles.find(v => v.id === req.vehicle_id);
              const driver = drivers.find((d) => String(d.id) === String(req.driver_id ?? ''));
              const sc = safeStatus(req.status);
              const pc = safePriority(req.priority);
              const isSelected = selectedIds.includes(req.id);

              return (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => isSelectionMode ? toggleSelection(req.id) : setShowDetail(req)}
                  className={cn(
                    "rounded-2xl border p-4 shadow-sm cursor-pointer transition-all relative group",
                    isSelected 
                      ? "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800" 
                      : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:shadow-md"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {isSelectionMode && (
                        <div className={cn(
                          "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors mt-1",
                          isSelected ? "bg-blue-600 border-blue-600" : "border-stone-300 dark:border-stone-600"
                        )}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      )}
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                        <Wrench className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-stone-900 dark:text-white">
                            <HighlightText
                              text={vehicle?.plate_number ?? `#${req.vehicle_id}`}
                              query={searchQuery}
                            />
                          </p>
                          {vehicle?.model && <span className="text-xs text-stone-500">({vehicle.model})</span>}
                        </div>
                        <p className="text-sm text-stone-600 dark:text-stone-400 mt-0.5">
                          <HighlightText text={req.maintenance_type} query={searchQuery} />
                        </p>
                        {driver && (
                          <p className="text-xs text-stone-500 dark:text-stone-500 mt-0.5 flex items-center gap-1">
                            <User className="w-3 h-3" /> {driver.full_name}
                          </p>
                        )}
                        {req.description && (
                          <p className="text-xs text-stone-400 mt-1 line-clamp-1">
                            <HighlightText text={req.description} query={searchQuery} />
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', sc.bg, sc.text)}>{sc.label}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', pc.bg, pc.text)}>{pc.label}</span>
                      <span className="text-[11px] text-stone-400">{new Date(req.created_at).toLocaleDateString('ar-IQ')}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      ) : (
        /* Driver Issues Tab */
        <div className="space-y-3">
          {driverIssues.length === 0 && (
            <div className="text-center py-16 text-stone-400">
              <FileWarning className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد بلاغات من {driverPluralLabel}</p>
            </div>
          )}
          {driverIssues.map((issue, i) => {
            const vehicle = vehicles.find(v => v.id === issue.vehicle_id);
            const driver = drivers.find((d) => String(d.id) === String(issue.driver_id ?? ''));
            const isConverted = issue.status === 'converted';
            return (
              <motion.div
                key={issue.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  'rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 shadow-sm',
                  isConverted && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileWarning className="w-4 h-4 text-amber-500" />
                      <span className="font-semibold text-stone-900 dark:text-white">{vehicle?.plate_number}</span>
                      {driver && <span className="text-xs text-stone-500">— {driver.full_name}</span>}
                    </div>
                    <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">{issue.description}</p>
                    {issue.images?.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {issue.images.map((img, idx) => (
                          <img key={idx} src={img} className="w-16 h-16 object-cover rounded-lg border" />
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-stone-400 mt-2">{new Date(issue.created_at).toLocaleDateString('ar-IQ')}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {isConverted ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">تم التحويل</span>
                    ) : (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => convertIssueToRequest(issue)}
                        className="text-xs px-3 py-1.5 rounded-xl bg-blue-600 text-white font-medium"
                      >
                        تحويل لطلب صيانة
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Request Modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="fixed inset-0 bg-black z-40"
            />
            <motion.div
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
              className="fixed inset-x-4 top-[5%] bottom-[5%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-50 bg-white dark:bg-stone-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800">
                <h2 className="text-lg font-bold text-stone-900 dark:text-white">طلب صيانة جديد</h2>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Driver select */}
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">اسم {driverLabel}</label>
                  <select
                    value={formDriverId}
                    onChange={e => setFormDriverId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm"
                  >
                    <option value="">اختر {driverLabel}...</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.full_name} {driverVehicleMap[d.id] ? `(${driverVehicleMap[d.id]!.plate_number})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vehicle select */}
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">المركبة</label>
                  <select
                    value={formVehicleId}
                    onChange={e => setFormVehicleId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm"
                  >
                    <option value="">اختر المركبة...</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.plate_number} {v.model ? `— ${v.model}` : ''}</option>
                    ))}
                  </select>
                </div>

                {/* Maintenance type */}
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">نوع الصيانة</label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm"
                  >
                    {MAINTENANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">وصف المشكلة</label>
                  <textarea
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm resize-none"
                    placeholder="صف المشكلة بالتفصيل..."
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">مستوى الأولوية</label>
                  <div className="flex gap-2">
                    {(Object.entries(PRIORITY_CONFIG) as [MaintenancePriority, typeof PRIORITY_CONFIG['low']][]).map(([key, cfg]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormPriority(key)}
                        className={cn(
                          'flex-1 py-2 rounded-xl text-sm font-medium border transition-all',
                          formPriority === key
                            ? cn(cfg.bg, cfg.text, 'border-current ring-2 ring-current/20')
                            : 'border-stone-200 dark:border-stone-700 text-stone-500',
                        )}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Admin notes */}
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">ملاحظات الأدمن</label>
                  <textarea
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm resize-none"
                    placeholder="ملاحظات إضافية..."
                  />
                </div>

                {/* Images */}
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-stone-700 dark:text-stone-300">صور المشكلة</label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
                    >
                      <Camera className="w-4 h-4" /> التقاط صورة
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
                    >
                      <Upload className="w-4 h-4" /> رفع ملف
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={e => handleFileUpload(e.target.files)} />
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={e => handleFileUpload(e.target.files)} />
                  </div>
                  {formImages.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {formImages.map((img, idx) => (
                        <div key={idx} className="relative group">
                          <img src={img} className="w-20 h-20 object-cover rounded-xl border" />
                          <button
                            type="button"
                            onClick={() => setFormImages(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {formError && (
                <div className="mx-5 mb-0 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
                </div>
              )}
              <div className="px-5 py-4 border-t border-stone-200 dark:border-stone-800 flex gap-3">
                <button
                  onClick={() => { setShowForm(false); setFormError(''); }}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-sm font-medium"
                >
                  إلغاء
                </button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={!formVehicleId || submitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetail && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              onClick={() => setShowDetail(null)}
              className="fixed inset-0 bg-black z-40"
            />
            <motion.div
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
              className="fixed inset-x-4 top-[5%] bottom-[5%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-50 bg-white dark:bg-stone-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              {(() => {
                const req = showDetail;
                const vehicle = vehicles.find(v => v.id === req.vehicle_id);
                const driver = drivers.find((d) => String(d.id) === String(req.driver_id ?? ''));
                const sc = safeStatus(req.status);
                const pc = safePriority(req.priority);
                const vehicleHistory = pastRecords.filter(r => r.vehicle_id === req.vehicle_id);

                return (
                  <>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800">
                      <h2 className="text-lg font-bold text-stone-900 dark:text-white">تفاصيل طلب الصيانة</h2>
                      <button onClick={() => setShowDetail(null)} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                      {/* Status & Priority */}
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm px-3 py-1 rounded-full font-medium', sc.bg, sc.text)}>{sc.label}</span>
                        <span className={cn('text-sm px-3 py-1 rounded-full font-medium', pc.bg, pc.text)}>{pc.label}</span>
                      </div>

                      {/* Vehicle info */}
                      <div className="rounded-xl bg-stone-50 dark:bg-stone-800/50 p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-blue-500" />
                          <span className="font-semibold text-stone-900 dark:text-white">{vehicle?.plate_number}</span>
                          {vehicle?.model && <span className="text-sm text-stone-500">({vehicle.model})</span>}
                        </div>
                        {driver && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm text-stone-700 dark:text-stone-300">{driver.full_name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-stone-400" />
                          <span className="text-sm text-stone-600 dark:text-stone-400">{req.maintenance_type}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-stone-400" />
                          <span className="text-sm text-stone-600 dark:text-stone-400">{new Date(req.created_at).toLocaleString('ar-IQ')}</span>
                        </div>
                      </div>

                      {/* Description */}
                      {req.description && (
                        <div>
                          <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">وصف المشكلة</p>
                          <p className="text-sm text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/50 p-3 rounded-xl">{req.description}</p>
                        </div>
                      )}

                      {/* Admin notes */}
                      {req.admin_notes && (
                        <div>
                          <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">ملاحظات الأدمن</p>
                          <p className="text-sm text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/50 p-3 rounded-xl">{req.admin_notes}</p>
                        </div>
                      )}

                      {/* Images */}
                      {req.images?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">صور المشكلة</p>
                          <div className="flex gap-2 flex-wrap">
                            {req.images.map((img, idx) => (
                              <a key={idx} href={img} target="_blank" rel="noopener noreferrer">
                                <img src={img} className="w-24 h-24 object-cover rounded-xl border hover:opacity-80 transition-opacity" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Previous maintenance */}
                      {vehicleHistory.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">سجل الصيانات السابقة</p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {vehicleHistory.slice(0, 5).map(rec => (
                              <div key={rec.id} className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 text-sm">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-stone-900 dark:text-white">{rec.maintenance_type}</span>
                                  <span className="text-[11px] text-stone-400">{new Date(rec.created_at).toLocaleDateString('ar-IQ')}</span>
                                </div>
                                {rec.work_done && <p className="text-xs text-stone-500 mt-0.5">{rec.work_done}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {req.status === 'pending' && (isManager || isAdmin) && (
                      <div className="px-5 py-4 border-t border-stone-200 dark:border-stone-800 flex gap-3">
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleReject(req)}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <XCircle className="w-4 h-4" /> رفض
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleApprove(req)}
                          disabled={hasActiveRequest}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" /> موافقة وبدء الصيانة
                        </motion.button>
                      </div>
                    )}

                    {req.status === 'in_progress' && (isManager || isAdmin) && (
                      <div className="px-5 py-4 border-t border-stone-200 dark:border-stone-800">
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => { setShowDetail(null); onNavigate('active-maintenance'); }}
                          className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium"
                        >
                          الذهاب للصيانة النشطة
                        </motion.button>
                      </div>
                    )}
                  </>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
