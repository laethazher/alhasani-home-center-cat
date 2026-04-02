import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ChevronDown, ChevronUp, Truck, Wrench, Clock, DollarSign,
  User, FileText, Image as ImageIcon, Download, Calendar, Check,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getDepartmentClient, getDepartmentTables, normalizeDepartmentVehicleRow } from '../data/supabaseSource';
import type { DepartmentCode } from '../data/department';
import type { MaintenanceRecord, MaintenanceImage, Vehicle, StaffMember, UserProfile } from '../lib/supabaseClient';
import { exportHtmlToPdf } from '../lib/pdfExport';
import { exportToExcel } from '../lib/excelExport';

interface Props {
  profile: UserProfile | null;
  department?: DepartmentCode;
}

export default function MaintenanceHistory({ profile, department = 'tajhiz' }: Props) {
  const supabase = getDepartmentClient(department);
  const tables = getDepartmentTables(department);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [requests, setRequests] = useState<{ id: number; driver_id: number | null; approved_by: string | null }[]>([]);
  const [images, setImages] = useState<MaintenanceImage[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<StaffMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<number | null>(null);
  const [expandedRecord, setExpandedRecord] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Selection & Delete state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const staffQuery =
      department === 'installation'
        ? supabase.from(tables.staffMembers).select('*').eq('is_active', true)
        : supabase.from(tables.staffMembers).select('*').eq('role', 'driver');

    const requestsQuery =
      department === 'installation'
        ? supabase.from(tables.maintenanceRequests).select('id, driver_id, approved_by, staff_id')
        : supabase.from(tables.maintenanceRequests).select('id, driver_id, approved_by');

    const [recRes, reqRes, imgRes, vehRes, drvRes] = await Promise.all([
      supabase.from(tables.maintenanceRecords).select('*').order('created_at', { ascending: false }),
      requestsQuery,
      supabase.from(tables.maintenanceImages).select('*'),
      supabase.from(tables.vehicles).select('*'),
      staffQuery,
    ]);
    if (recRes.data) setRecords(recRes.data);
    if (reqRes.data) {
      setRequests(
        (reqRes.data as Array<Record<string, unknown>>).map((r) => ({
          id: r.id as number,
          driver_id: (r.driver_id ?? r.staff_id ?? null) as number | null,
          approved_by: (r.approved_by ?? null) as string | null,
        })),
      );
    }
    if (imgRes.data) setImages(imgRes.data);
    if (vehRes.data) {
      setVehicles(
        (vehRes.data as Array<Record<string, unknown>>).map((v) => normalizeDepartmentVehicleRow(v)),
      );
    }
    if (drvRes.data) {
      setDrivers(
        (drvRes.data as Array<Record<string, unknown>>).map((d) => ({
          ...d,
          role: d.role === 'assistant' || d.role === 'crew' ? 'assistant' : 'driver',
        })) as StaffMember[],
      );
    }
    setLoading(false);
  }, [supabase, tables, department]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const requestMap = useMemo(() => {
    const m: Record<number, { driver_id: number | null; approved_by: string | null }> = {};
    requests.forEach(req => { m[req.id] = { driver_id: req.driver_id, approved_by: req.approved_by }; });
    return m;
  }, [requests]);

  const filteredRecords = useMemo(() => {
    let list = records;
    if (selectedVehicle) list = list.filter(r => r.vehicle_id === selectedVehicle);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(r => {
        const v = vehicles.find(v => v.id === r.vehicle_id);
        return (
          v?.plate_number?.toLowerCase().includes(q) ||
          r.maintenance_type?.toLowerCase().includes(q) ||
          r.work_done?.toLowerCase().includes(q) ||
          r.technician_name?.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [records, selectedVehicle, searchQuery, vehicles]);

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      return [...prev, id];
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.length === filteredRecords.length) return [];
      return filteredRecords.map(r => r.id);
    });
  }, [filteredRecords]);

  async function handleDeleteSelected() {
    if (selectedIds.length === 0 || deleting) return;
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedIds.length} سجل صيانة؟ سيتم حذف كل ما يرتبط بها (الطلبات، الصور، أحداث المركبة، التنبيهات) دون التأثير على النظام.`)) return;
    
    setDeleting(true);
    try {
      const idsToRemove = [...selectedIds];
      const rpcName = department === 'installation' ? 'installation_delete_maintenance_records' : 'delete_maintenance_records';
      const { data, error } = await supabase.rpc(rpcName, { p_record_ids: idsToRemove });
      const result = data as { success?: boolean; error?: string } | null;
      if (error) {
        alert('فشل الحذف: ' + error.message);
        setDeleting(false);
        return;
      }
      if (!result?.success) {
        alert(result?.error === 'admin_only' ? 'هذا الإجراء مسموح للأدمن فقط' : (result?.error || 'فشل الحذف'));
        setDeleting(false);
        return;
      }
      setSelectedIds([]);
      setIsSelectionMode(false);
      await fetchData();
    } catch (err) {
      console.error('Delete error:', err);
      alert('حدث خطأ أثناء الحذف: ' + (err instanceof Error ? err.message : 'خطأ غير معروف'));
    } finally {
      setDeleting(false);
    }
  }

  const vehicleRecordCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    records.forEach(r => { counts[r.vehicle_id] = (counts[r.vehicle_id] || 0) + 1; });
    return counts;
  }, [records]);

  function getRecordImages(rec: MaintenanceRecord) {
    const byRecord = images.filter(img => img.record_id === rec.id);
    if (byRecord.length > 0) return byRecord;
    if (rec.request_id) {
      return images.filter(img => img.request_id === rec.request_id);
    }
    return [];
  }

  async function exportPDF() {
    const toExport = isSelectionMode && selectedIds.length > 0
      ? filteredRecords.filter((r) => selectedIds.includes(r.id))
      : filteredRecords;

    if (toExport.length === 0) {
      alert('لا توجد سجلات للتصدير');
      return;
    }

    const vehicle = selectedVehicle ? vehicles.find(v => v.id === selectedVehicle) : null;
    const totalCost = toExport.reduce((s, r) => s + Number(r.cost), 0);

    let html = `
      <h1 style="text-align:center;font-size:22px;margin-bottom:12px">تقرير سجل الصيانة</h1>
      ${vehicle ? `<p style="text-align:center;font-size:14px;margin-bottom:8px">المركبة: ${vehicle.plate_number} ${vehicle.model ? '- ' + vehicle.model : ''}</p>` : ''}
      <p style="text-align:center;color:#666;margin-bottom:20px">تاريخ التصدير: ${new Date().toLocaleDateString('ar-IQ')} ${new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</p>
      <p style="margin-bottom:16px"><strong>إجمالي السجلات:</strong> ${toExport.length} &nbsp;|&nbsp; <strong>إجمالي التكلفة:</strong> ${totalCost.toLocaleString('ar-IQ')} د.ع</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#3b82f6;color:#fff">
          <th style="padding:8px;text-align:right">التاريخ</th>
          <th style="padding:8px;text-align:right">النوع</th>
          <th style="padding:8px;text-align:right">العمل المنفذ</th>
          <th style="padding:8px;text-align:right">الفني</th>
          <th style="padding:8px;text-align:right">التكلفة</th>
          <th style="padding:8px;text-align:right">المدة</th>
        </tr></thead>
        <tbody>
    `;
    for (let i = 0; i < toExport.length; i++) {
      const rec = toExport[i];
      const bg = i % 2 === 0 ? 'background:#f8fafc' : '';
      html += `<tr style="${bg}">
        <td style="padding:6px 8px;border:1px solid #ddd">${new Date(rec.created_at).toLocaleDateString('ar-IQ')}</td>
        <td style="padding:6px 8px;border:1px solid #ddd">${(rec.maintenance_type ?? '').slice(0, 25)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd">${(rec.work_done ?? '').slice(0, 40)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd">${(rec.technician_name ?? '—').slice(0, 20)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd">${Number(rec.cost).toLocaleString('ar-IQ')}</td>
        <td style="padding:6px 8px;border:1px solid #ddd">${rec.duration_minutes ? rec.duration_minutes + ' د' : '—'}</td>
      </tr>`;
    }
    html += '</tbody></table>';

    try {
      await exportHtmlToPdf(`<div dir="rtl">${html}</div>`, `maintenance_report_${vehicle?.plate_number ?? 'all'}_${Date.now()}.pdf`);
    } catch (e) {
      console.error(e);
      alert('فشل تصدير PDF');
    }
  }

  const exportExcel = () => {
    const toExport = isSelectionMode && selectedIds.length > 0
      ? filteredRecords.filter((r) => selectedIds.includes(r.id))
      : filteredRecords;

    if (toExport.length === 0) {
      alert('لا توجد سجلات للتصدير');
      return;
    }

    const headers = ['التاريخ', 'رقم المركبة', 'نوع الصيانة', 'التكلفة', 'الفني', 'العمل المنجز', 'قطع الغيار المستهلكة', 'ملاحظات'];
    const rows = toExport.map(r => {
      const v = vehicles.find(v => v.id === r.vehicle_id);
      return [
        new Date(r.created_at).toLocaleDateString('ar-IQ'),
        v?.plate_number || `ID: ${r.vehicle_id}`,
        r.maintenance_type,
        r.cost,
        r.technician_name || '—',
        r.work_done,
        r.parts_replaced || '—',
        r.notes || '—'
      ];
    });
    const vehicle = selectedVehicle ? vehicles.find(v => v.id === selectedVehicle) : null;
    const filename = `سجل_صيانة_${vehicle?.plate_number ?? 'الكل'}_${new Date().toISOString().slice(0,10)}`;
    exportToExcel([headers, ...rows], filename, 'سجلات الصيانة');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث في السجل..."
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <select
            value={selectedVehicle ?? ''}
            onChange={e => setSelectedVehicle(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm"
          >
            <option value="">جميع المركبات</option>
            {vehicles
              .filter(v => vehicleRecordCounts[v.id])
              .sort((a, b) => (vehicleRecordCounts[b.id] || 0) - (vehicleRecordCounts[a.id] || 0))
              .map(v => (
                <option key={v.id} value={v.id}>
                  {v.plate_number} {v.model ? `(${v.model})` : ''} — {vehicleRecordCounts[v.id]} سجل
                </option>
              ))}
          </select>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {isAdmin && (
            <>
              {selectedIds.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={handleDeleteSelected}
                  disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium shadow-lg hover:bg-red-700 disabled:opacity-50"
                >
                  حذف ({selectedIds.length})
                </motion.button>
              )}
              {isSelectionMode && filteredRecords.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400"
                >
                  {selectedIds.length === filteredRecords.length ? 'إلغاء الكل' : 'تحديد الكل'}
                </button>
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
                {isSelectionMode ? 'إلغاء' : 'تحديد'}
              </button>
            </>
          )}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={exportExcel}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium shadow-lg disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> 
            {isSelectionMode && selectedIds.length > 0 ? `Excel (${selectedIds.length})` : 'Excel الكل'}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={exportPDF}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium shadow-lg disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> 
            {isSelectionMode && selectedIds.length > 0 ? `PDF (${selectedIds.length})` : 'PDF الكل'}
          </motion.button>
        </div>
      </div>

      {/* Summary */}
      {filteredRecords.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-3 text-center">
            <p className="text-2xl font-bold text-stone-900 dark:text-white">{filteredRecords.length}</p>
            <p className="text-xs text-stone-500">عمليات صيانة</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-3 text-center">
            <p className="text-2xl font-bold text-stone-900 dark:text-white">
              {filteredRecords.reduce((s, r) => s + Number(r.cost), 0).toLocaleString()}
            </p>
            <p className="text-xs text-stone-500">إجمالي التكاليف (د.ع)</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-3 text-center">
            <p className="text-2xl font-bold text-stone-900 dark:text-white">
              {filteredRecords.length > 0 ? Math.round(filteredRecords.reduce((s, r) => s + (r.duration_minutes ?? 0), 0) / filteredRecords.length) : 0}
            </p>
            <p className="text-xs text-stone-500">متوسط المدة (دقيقة)</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-3 text-center">
            <p className="text-2xl font-bold text-stone-900 dark:text-white">
              {new Set(filteredRecords.map(r => r.vehicle_id)).size}
            </p>
            <p className="text-xs text-stone-500">مركبات</p>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-3">
        {filteredRecords.length === 0 && (
          <div className="text-center py-16 text-stone-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>لا يوجد سجل صيانة</p>
          </div>
        )}
        {filteredRecords.map((rec, i) => {
          const vehicle = vehicles.find(v => v.id === rec.vehicle_id);
          const req = rec.request_id ? requestMap[rec.request_id] : null;
          const driverName = req?.driver_id ? (drivers.find(d => String(d.id) === String(req.driver_id))?.full_name ?? null) : null;
          const recImages = getRecordImages(rec);
          const isExpanded = expandedRecord === rec.id;
          const isSelected = selectedIds.includes(rec.id);
          
          return (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className={cn(
                "rounded-2xl border shadow-sm overflow-hidden transition-all",
                isSelected 
                  ? "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800" 
                  : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 shadow-sm"
              )}
            >
              <button
                onClick={() => {
                  if (isSelectionMode) {
                    toggleSelection(rec.id);
                  } else {
                    setExpandedRecord(isExpanded ? null : rec.id);
                  }
                }}
                className="w-full p-4 flex items-start justify-between gap-3 text-right"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {isSelectionMode && (
                    <div className={cn(
                      "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors mt-1 flex-shrink-0",
                      isSelected ? "bg-blue-600 border-blue-600" : "border-stone-300 dark:border-stone-600"
                    )}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  )}
                  {/* Timeline dot */}
                  {!isSelectionMode && (
                    <div className="w-3 h-3 rounded-full bg-blue-500 mt-1.5 flex-shrink-0 ring-4 ring-blue-100 dark:ring-blue-900/30" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Truck className="w-4 h-4 text-blue-500" />
                      <span className="font-semibold text-stone-900 dark:text-white">{vehicle?.plate_number}</span>
                      {vehicle?.model && <span className="text-xs text-stone-500">({vehicle.model})</span>}
                      {driverName && (
                        <span className="text-xs text-stone-500 flex items-center gap-1">
                          <User className="w-3 h-3" /> آخر سائق: {driverName}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-stone-600 dark:text-stone-400 mt-0.5">{rec.maintenance_type}</p>
                    <div className="flex gap-3 mt-1 text-[11px] text-stone-400 flex-wrap">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(rec.created_at).toLocaleDateString('ar-IQ')}</span>
                      {rec.technician_name && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {rec.technician_name}</span>}
                      {rec.cost > 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {Number(rec.cost).toLocaleString()} د.ع</span>}
                      {rec.duration_minutes && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {rec.duration_minutes} دقيقة</span>}
                    </div>
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5 text-stone-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-stone-400 flex-shrink-0" />}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-3 border-t border-stone-100 dark:border-stone-800 pt-3">
                      {rec.fault_description && (
                        <div>
                          <p className="text-xs font-medium text-stone-500 mb-0.5">وصف العطل</p>
                          <p className="text-sm text-stone-700 dark:text-stone-300">{rec.fault_description}</p>
                        </div>
                      )}
                      {rec.work_done && (
                        <div>
                          <p className="text-xs font-medium text-stone-500 mb-0.5">ما تم عمله</p>
                          <p className="text-sm text-stone-700 dark:text-stone-300">{rec.work_done}</p>
                        </div>
                      )}
                      {rec.parts_replaced && (
                        <div>
                          <p className="text-xs font-medium text-stone-500 mb-0.5">القطع المبدلة</p>
                          <p className="text-sm text-stone-700 dark:text-stone-300">{rec.parts_replaced}</p>
                        </div>
                      )}
                      {rec.inspection_only && (
                        <span className="inline-block text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">فحص فقط</span>
                      )}
                      {rec.notes && (
                        <div>
                          <p className="text-xs font-medium text-stone-500 mb-0.5">ملاحظات</p>
                          <p className="text-sm text-stone-700 dark:text-stone-300">{rec.notes}</p>
                        </div>
                      )}
                      {recImages.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-stone-500 mb-1">الصور</p>
                          <div className="flex gap-2 flex-wrap">
                            {recImages.map(img => (
                              <a key={img.id} href={img.image_url} target="_blank" rel="noopener noreferrer" className="relative">
                                <img src={img.image_url} className="w-20 h-20 object-cover rounded-lg border hover:opacity-80" />
                                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] text-center py-0.5 rounded-b-lg">
                                  {img.image_type}
                                </span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
