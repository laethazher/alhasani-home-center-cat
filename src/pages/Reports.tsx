/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Truck, 
  ClipboardCheck, 
  Wrench, 
  Send, 
  User, 
  Hash, 
  Calendar,
  CheckCircle,
  Loader2,
  AlertTriangle,
  FileText,
  Download,
  History,
  ArrowRight,
  Printer,
  Package,
  RotateCcw,
  Search,
  Check,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  X,
  Brain,
} from 'lucide-react';
import { BulkDeleteSelectedButton } from '../components/BulkDeleteSelectedButton';
import { DamageMap } from '../components/DamageMap';
import { InspectionForm } from '../components/InspectionForm';
import { ToolInventory } from '../components/ToolInventory';
import { SignaturePad } from '../components/SignaturePad';
import { cn } from '../lib/utils';
import { formatInventoryLabel } from '../lib/inventoryDisplay';
import { getDepartmentClient, getDepartmentTables } from '../data/supabaseSource';
import type { DepartmentCode } from '../data/department';
import type { Report, StaffMember, Vehicle } from '../lib/supabaseClient';
import {
  assignReportDisplaySequences,
  buildReportSequenceMap,
  formatReportInventoryNo,
  mapDbRowToSavedReportView,
  type SavedReportView,
} from '../lib/savedReportFromRow';
import { getVehicleInspectionMapUrl } from '../lib/vehicleInspectionMapUrl';
import { exportHtmlToPdf, wrapReportHtmlForPdf } from '../lib/pdfExport';
import { exportToExcel } from '../lib/excelExport';
import { WEEKLY_INSPECTION_ITEMS, TOOL_INVENTORY_ITEMS } from '../constants';
import { useUserProfile } from '../hooks/useUserProfile';
import InspectionIntelligenceDrawer from '../components/inspection-intelligence/InspectionIntelligenceDrawer';
import { calculateInspectionRecovery } from '../lib/inspectionRecovery/calculateInspectionRecovery';
import { useInspectionRecoveryStats } from '../hooks/useInspectionRecoveryStats';

type Tab = 'damage' | 'inspection' | 'tools' | 'history';

interface ReportsProps {
  userId: string;
  department?: DepartmentCode;
  /** رابط عميق / QR — يُستهلك مرة واحدة عند التركيب */
  initialInspectionVehicleId?: string | null;
  onConsumedInitialInspectionVehicle?: () => void;
}

interface InventoryItemView {
  id: number;
  name: string;
  barcode?: string | null;
  quantity: number;
  sortOrder: number;
}

/** يملأ tool_values بكل مفاتيح قالب الجرد الحالي (بما فيها العناصر المضافة لاحقاً) — القيمة الافتراضية 0 إن لم يُدخل المستخدم شيئاً. */
function buildNormalizedToolValuesForReport(
  hasToolkit: boolean,
  templates: InventoryItemView[],
  draft: Record<number, number>,
): Record<number, number> {
  if (!hasToolkit) return {};
  const out: Record<number, number> = {};
  for (const item of templates) {
    const raw = draft[item.id];
    const n = raw !== undefined && raw !== null ? Number(raw) : 0;
    out[item.id] = Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  return out;
}

/**
 * عرض تفاصيل نواقص التعويض داخل التقرير نفسه مُعطّل؛
 * التفاصيل والإجراءات تُدار حصراً عبر واجهة "نواقص الجرد" في Inspection Intelligence.
 */
const SHOW_RECOVERY_DETAILS_IN_REPORT = false;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'خطأ غير معروف';
}

interface VehicleSelectProps {
  vehicles: Vehicle[];
  selectedVehicleId: string;
  onSelect: (vehicle: Vehicle) => void;
  driverMap: Map<string, string>;
  staffLabel: string;
}

function VehicleSelect({ vehicles, selectedVehicleId, onSelect, driverMap, staffLabel }: VehicleSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredVehicles = useMemo(() => {
    const q = search.trim();
    if (!q) return vehicles;
    return vehicles.filter((vehicle) => {
      const driverName = vehicle.assigned_driver_id ? (driverMap.get(String(vehicle.assigned_driver_id)) || '') : '';
      return vehicle.plate_number.includes(q) || driverName.includes(q);
    });
  }, [vehicles, search, driverMap]);

  const selectedVehicle = vehicles.find((vehicle) => String(vehicle.id) === String(selectedVehicleId)) || null;
  const selectedDriver = selectedVehicle?.assigned_driver_id ? driverMap.get(String(selectedVehicle.assigned_driver_id)) : '';

  return (
    <div ref={ref} className="space-y-2 relative">
      <label className="text-xs font-bold text-stone-500 dark:text-stone-400 flex items-center gap-2">
        <Hash className="w-3 h-3" /> رقم المركبة
      </label>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'input-field flex items-center justify-between text-right',
          open && 'ring-2 ring-red-500/20 border-red-400 dark:border-red-500'
        )}
      >
        <span className={cn('truncate', !selectedVehicle && 'text-stone-400 dark:text-stone-500')}>
          {selectedVehicle ? selectedVehicle.plate_number : 'اختر المركبة أو ابحث عنها'}
        </span>
        <ChevronDown className={cn('w-4 h-4 text-stone-400 transition-transform', open && 'rotate-180')} />
      </button>

      {selectedVehicle && (
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-bold">
            {selectedVehicle.status === 'available' ? 'متاحة' : selectedVehicle.status === 'maintenance' ? 'صيانة' : selectedVehicle.status === 'broken' ? 'معطلة' : 'محجوزة'}
          </span>
          <span className="px-2 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-medium">
            {staffLabel} الحالي: {selectedDriver || `بدون ${staffLabel}`}
          </span>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute z-50 mt-1 w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="p-2 border-b border-stone-100 dark:border-stone-700">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-700/50">
                <Search className="w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`ابحث برقم المركبة أو اسم ${staffLabel}`}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400 text-stone-900 dark:text-white"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto p-1">
              {filteredVehicles.length === 0 ? (
                <div className="py-5 text-center text-sm text-stone-400">لا توجد نتائج مطابقة</div>
              ) : (
                filteredVehicles.map((vehicle) => {
                  const isSelected = String(vehicle.id) === String(selectedVehicleId);
                  const driverName = vehicle.assigned_driver_id ? (driverMap.get(String(vehicle.assigned_driver_id)) || 'بدون سائق') : 'بدون سائق';
                  return (
                    <button
                      key={vehicle.id}
                      type="button"
                      onClick={() => {
                        onSelect(vehicle);
                        setOpen(false);
                        setSearch('');
                      }}
                      className={cn(
                        'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-right transition-colors',
                        isSelected
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                          : 'hover:bg-stone-50 dark:hover:bg-stone-700/50 text-stone-700 dark:text-stone-300'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center flex-shrink-0',
                        isSelected ? 'bg-red-600 border-red-600 text-white' : 'border-stone-300 dark:border-stone-600'
                      )}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{vehicle.plate_number}</div>
                        <div className="text-xs text-stone-500 dark:text-stone-400 truncate">
                          {driverName}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Reports({
  userId,
  department = 'tajhiz',
  initialInspectionVehicleId = null,
  onConsumedInitialInspectionVehicle,
}: ReportsProps) {
  const { profile } = useUserProfile();
  const canManageReports =
    profile?.role === 'admin' ||
    profile?.role === 'manager' ||
    (department === 'installation' && profile?.role === 'installation_department');
  const canDeleteReports = profile?.role === 'admin';
  const canRebuildRecovery =
    profile?.role === 'admin' ||
    profile?.role === 'manager' ||
    profile?.role === 'maintenance_manager' ||
    profile?.role === 'logistics' ||
    (department === 'installation' && profile?.role === 'installation_department');
  const supabase = getDepartmentClient(department);
  const tables = getDepartmentTables(department);
  const [activeTab, setActiveTab] = useState<Tab>('damage');
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [postSubmitNotice, setPostSubmitNotice] = useState<string | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReportView[]>([]);
  const [reportsPage, setReportsPage] = useState(0);
  const [hasMoreReports, setHasMoreReports] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);
  const [viewingReport, setViewingReport] = useState<SavedReportView | null>(null);
  const [loadingReportDetails, setLoadingReportDetails] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<StaffMember[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemView[]>(
    TOOL_INVENTORY_ITEMS.map((item, index) => ({
      id: item.id,
      name: item.name,
      barcode: null,
      quantity: item.quantity,
      sortOrder: index + 1,
    }))
  );
  const [templateName, setTemplateName] = useState('');
  const [templateBarcode, setTemplateBarcode] = useState('');
  const [templateQuantity, setTemplateQuantity] = useState<number>(1);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showToolsEditor, setShowToolsEditor] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [draggingTemplateId, setDraggingTemplateId] = useState<number | null>(null);
  const [reorderingTemplates, setReorderingTemplates] = useState(false);
  
  // Selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedReportIds, setSelectedStaffIds] = useState<number[]>([]);
  const [exportingSelected, setExportingSelected] = useState(false);
  const [deletingReportsBulk, setDeletingReportsBulk] = useState(false);

  const toggleSelectAll = () => {
    if (selectedReportIds.length === savedReports.length) {
      setSelectedStaffIds([]);
    } else {
      setSelectedStaffIds(savedReports.map((r) => r.id));
    }
  };

  const toggleReportSelection = (id: number) => {
    setSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDeleteSelectedReports = async () => {
    if (!canDeleteReports || selectedReportIds.length === 0) return;
    setDeletingReportsBulk(true);
    try {
      const { data: deletedRows, error } = await supabase
        .from(tables.reports)
        .delete()
        .in('id', selectedReportIds)
        .select('id');
      if (error) throw error;
      const deletedCount = deletedRows?.length ?? 0;
      if (deletedCount === 0 && selectedReportIds.length > 0) {
        alert(
          'لم يُحذف أي تقرير. غالباً سياسات الأمان (RLS) لا تسمح بالحذف بعد — نفّذ ترحيل قاعدة البيانات الأخير (reports_delete_rls) أو راجع صلاحية الحساب في Supabase.'
        );
        return;
      }
      setSelectedStaffIds([]);
      setIsSelectionMode(false);
      await fetchReports();
    } catch (e) {
      console.error(e);
      alert('تعذر حذف التقارير المحددة: ' + getErrorMessage(e));
    } finally {
      setDeletingReportsBulk(false);
    }
  };

  const exportSelectedExcel = () => {
    const toExport = savedReports.filter(r => selectedReportIds.includes(r.id));
    if (toExport.length === 0) return;

    const headers = ['رقم الجرد', `اسم ${staffLabel}`, 'رقم المركبة', 'التاريخ', 'عدد الأضرار', 'اكتمال الفحص', 'تاريخ الإنشاء'];
    const rows = toExport.map((r) => [
      r.displaySequence,
      r.driverName,
      r.truckNumber,
      r.date,
      r.damagePoints.length,
      `${Object.values(r.inspectionValues).filter(Boolean).length}/17`,
      new Date(r.createdAt).toLocaleString('ar-IQ')
    ]);
    
    exportToExcel([headers, ...rows], `سجل_التقارير_المحددة_${Date.now()}`);
  };

  const exportSelectedPDF = async () => {
    const toExport = savedReports.filter(r => selectedReportIds.includes(r.id));
    if (toExport.length === 0) return;

    setExportingSelected(true);
    const headers = [staffLabel, 'المركبة', 'التاريخ', 'الأضرار', 'الفحص'];
    const rows = toExport.map(r => [
      r.driverName,
      r.truckNumber,
      r.date,
      r.damagePoints.length,
      `${Object.values(r.inspectionValues).filter(Boolean).length}/17`
    ]);

    const sectionText = isInstallation ? ' | القسم: التركيب' : '';
    let html = `
      <h1 style="text-align:center;font-size:22px;margin-bottom:12px">ملخص سجل تقارير الفحص المختارة</h1>
      <p style="text-align:center;color:#666;margin-bottom:20px">تاريخ التصدير: ${new Date().toLocaleDateString('ar-IQ')}${sectionText}</p>
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
      await exportHtmlToPdf(`<div dir="rtl">${html}</div>`, `ملخص_تقارير_${Date.now()}.pdf`);
    } catch (e) {
      alert('فشل تصدير PDF');
    } finally {
      setExportingSelected(false);
    }
  };
  
  const reportRef = useRef<HTMLDivElement>(null);

  // Form State
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [truckNumber, setTruckNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [damagePoints, setDamagePoints] = useState<any[]>([]);
  const [inspectionValues, setInspectionValues] = useState<Record<number, boolean>>({});
  const [toolValues, setToolValues] = useState<Record<number, number>>({});
  const [toolImages, setToolImages] = useState<Record<number, string[]>>({});
  
  // Signatures
  const [driverSignature, setDriverSignature] = useState('');
  const [equipmentManagerSignature, setEquipmentManagerSignature] = useState('');
  const [logisticsManagerSignature, setLogisticsManagerSignature] = useState('');
  const [warehouseManagerSignature, setWarehouseManagerSignature] = useState('');

  const [cacheBuster] = useState(() => Date.now());
  const isInstallation = department === 'installation';
  const isTajhiz = department === 'tajhiz';
  const { stats: recoveryStats } = useInspectionRecoveryStats(department, true);
  const staffLabel = isInstallation ? 'الفني' : 'السائق';
  const departmentManagerLabel = isInstallation ? 'توقيع مسؤول قسم التركيب' : 'توقيع مسؤول قسم التجهيز';
  const departmentManagerText = isInstallation ? 'مسؤول قسم التركيب' : 'مسؤول قسم التجهيز';
  const toolsSectionTitle = isInstallation ? 'جرد عدة كادر التركيب' : 'جرد العدة والمواد';
  const driverMap = useMemo(
    () => new Map(drivers.map((driver) => [String(driver.id), driver.full_name])),
    [drivers]
  );
  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => String(vehicle.id) === String(selectedVehicleId)) || null,
    [vehicles, selectedVehicleId]
  );
  const selectedVehicleHasToolkit = selectedVehicle?.has_toolkit !== false;
  const selectedVehicleDriver = selectedVehicle?.assigned_driver_id
    ? (driverMap.get(String(selectedVehicle.assigned_driver_id)) || '')
    : '';
  const selectedVehicleImage = getVehicleInspectionMapUrl(
    department,
    (selectedVehicle as unknown as { vehicle_type?: unknown } | null)?.vehicle_type,
  );

  const REPORTS_PAGE_SIZE = 20;
  const REPORTS_QUERY_TIMEOUT_MS = 12000;
  const fetchReports = useCallback(async (opts?: { append?: boolean; page?: number }) => {
    const append = opts?.append === true;
    const page = append ? Math.max(0, Number(opts?.page ?? 0)) : 0;
    const from = page * REPORTS_PAGE_SIZE;
    const to = from + REPORTS_PAGE_SIZE - 1;
    setLoadingReports(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REPORTS_QUERY_TIMEOUT_MS);
    try {
      if (isTajhiz) {
        const { data, error } = await supabase
          .from(tables.reports)
          .select('id,vehicle_id,driver_name,truck_number,date,created_at')
          .abortSignal(controller.signal)
          .range(from, to)
          .order('created_at', { ascending: false });
        if (error) throw error;
        const mapped = ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
          mapDbRowToSavedReportView(
            {
              ...row,
              damage_points: [],
              inspection_values: {},
              tool_values: {},
              tool_images: {},
              driver_signature: '',
              equipment_manager: '',
              logistics_manager: '',
              warehouse_manager: '',
            },
            false,
          ),
        );
        const { data: allRowsForSequence, error: seqError } = await supabase
          .from(tables.reports)
          .select('id,created_at')
          .abortSignal(controller.signal);
        if (seqError) throw seqError;
        const sequenceMap = buildReportSequenceMap((allRowsForSequence ?? []) as Array<{ id: unknown; created_at?: unknown }>);

        setSavedReports((prev) => {
          const next = append ? [...prev, ...mapped] : mapped;
          const unique = Array.from(new Map(next.map((item) => [item.id, item])).values());
          return unique.map((item) => ({
            ...item,
            displaySequence: sequenceMap.get(item.id) ?? item.displaySequence ?? 1,
          }));
        });
        setHasMoreReports((data?.length ?? 0) >= REPORTS_PAGE_SIZE);
        setReportsPage(append ? page + 1 : 1);
        return;
      }
      const { data, error } = await supabase
        .from(tables.reports)
        .select('id,vehicle_id,vehicle_number,vehicle_type,created_at')
        .abortSignal(controller.signal)
        .range(from, to)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const mapped = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
        const listRow = {
          ...row,
          driver_name: row.driver_name ?? '—',
          truck_number: row.truck_number ?? row.vehicle_number ?? '',
          date: row.date ?? '',
        };
        return mapDbRowToSavedReportView(listRow, true);
      });
      const { data: allRowsForSequence, error: seqError } = await supabase
        .from(tables.reports)
        .select('id,created_at')
        .abortSignal(controller.signal);
      if (seqError) throw seqError;
      const sequenceMap = buildReportSequenceMap((allRowsForSequence ?? []) as Array<{ id: unknown; created_at?: unknown }>);
      setSavedReports((prev) => {
        const next = append ? [...prev, ...mapped] : mapped;
        const unique = Array.from(new Map(next.map((item) => [item.id, item])).values());
        return unique.map((item) => ({
          ...item,
          displaySequence: sequenceMap.get(item.id) ?? item.displaySequence ?? 1,
        }));
      });
      setHasMoreReports((data?.length ?? 0) >= REPORTS_PAGE_SIZE);
      setReportsPage(append ? page + 1 : 1);
    } catch (error) {
      console.error("Failed to fetch reports:", error);
      if ((error as { name?: string })?.name === 'AbortError') {
        alert('استعلام سجل التقارير استغرق وقتاً طويلاً وتم إيقافه. حاول التحديث مرة أخرى.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      setLoadingReports(false);
    }
  }, [REPORTS_PAGE_SIZE, REPORTS_QUERY_TIMEOUT_MS, isInstallation, isTajhiz, supabase, tables.reports]);

  const openReportDetails = useCallback(
    async (report: SavedReportView) => {
      setViewingReport(report);
      setLoadingReportDetails(true);
      try {
        const { data, error } = await supabase
          .from(tables.reports)
          .select('*')
          .eq('id', report.id)
          .single();
        if (error) throw error;
        const full = mapDbRowToSavedReportView(data as Record<string, unknown>, isInstallation);
        setViewingReport({ ...full, displaySequence: report.displaySequence });
      } catch (error) {
        console.error('Failed to load full report details:', error);
        alert('تعذر تحميل تفاصيل التقرير: ' + getErrorMessage(error));
      } finally {
        setLoadingReportDetails(false);
      }
    },
    [isInstallation, supabase, tables.reports],
  );

  useEffect(() => {
    if (!selectedVehicleHasToolkit && activeTab === 'tools') {
      setActiveTab('inspection');
    }
  }, [activeTab, selectedVehicleHasToolkit]);

  const fetchVehicles = useCallback(async () => {
    const orderColumn = department === 'installation' ? 'vehicle_number' : 'plate_number';
    const { data, error } = await supabase
      .from(tables.vehicles)
      .select('*')
      .order(orderColumn);
    if (error) {
      console.error('Failed to fetch vehicles:', error);
      return;
    }
    const normalizedVehicles = ((data ?? []) as Array<Record<string, unknown>>).map((v) => ({
      ...v,
      plate_number: String(v.plate_number ?? v.vehicle_number ?? ''),
      assigned_driver_id:
        v.assigned_driver_id != null
          ? String(v.assigned_driver_id)
          : v.responsible_staff_id != null
            ? String(v.responsible_staff_id)
            : null,
    })) as Vehicle[];
    setVehicles(normalizedVehicles);
  }, [department, supabase, tables.vehicles]);

  const fetchDrivers = useCallback(async () => {
    let query = supabase
      .from(tables.staffMembers)
      .select('*')
      .eq('is_active', true)
      .order('full_name');
    if (department !== 'installation') query = query.eq('role', 'driver');
    const { data, error } = await query;
    if (error) {
      console.error('Failed to fetch drivers:', error);
      return;
    }
    const normalizedDrivers = ((data ?? []) as Array<Record<string, unknown>>).map((d) => ({
      ...d,
      role: d.role === 'assistant' || d.role === 'crew' ? 'assistant' : 'driver',
    })) as StaffMember[];
    setDrivers(normalizedDrivers.filter((d) => d.role === 'driver'));
  }, [department, supabase, tables.staffMembers]);

  const fetchInventoryTemplates = useCallback(async () => {
    const { data, error } = await supabase
      .from(tables.inventoryTemplates)
      .select('id, item_name, barcode, required_quantity, sort_order')
      .eq('department_code', department)
      .eq('category', 'tools')
      .eq('is_active', true)
      .order('sort_order');
    if (error) {
      console.error('Failed to fetch inventory templates:', error);
      setInventoryItems(
        TOOL_INVENTORY_ITEMS.map((item, index) => ({
          id: item.id,
          name: item.name,
          barcode: null,
          quantity: item.quantity,
          sortOrder: index + 1,
        }))
      );
      return;
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) {
      setInventoryItems(
        TOOL_INVENTORY_ITEMS.map((item, index) => ({
          id: item.id,
          name: item.name,
          barcode: null,
          quantity: item.quantity,
          sortOrder: index + 1,
        }))
      );
      return;
    }
    setInventoryItems(
      rows.map((row) => ({
        id: Number(row.id),
        name: String(row.item_name ?? ''),
        barcode: row.barcode != null && String(row.barcode).trim() ? String(row.barcode).trim() : null,
        quantity: Number(row.required_quantity ?? 0),
        sortOrder: Number(row.sort_order ?? 0),
      }))
    );
  }, [department, supabase, tables.inventoryTemplates]);

  useEffect(() => {
    Promise.all([fetchReports(), fetchVehicles(), fetchDrivers(), fetchInventoryTemplates()]).catch((error) => {
      console.error('Failed to initialize reports page:', error);
    });
  }, [fetchReports, fetchVehicles, fetchDrivers, fetchInventoryTemplates]);

  useEffect(() => {
    if (!initialInspectionVehicleId) return;
    const id = String(initialInspectionVehicleId);
    if (!vehicles.some((v) => String(v.id) === id)) return;
    setSelectedVehicleId(id);
    setActiveTab('damage');
    onConsumedInitialInspectionVehicle?.();
  }, [initialInspectionVehicleId, vehicles, onConsumedInitialInspectionVehicle]);

  const resetTemplateForm = () => {
    setTemplateName('');
    setTemplateBarcode('');
    setTemplateQuantity(1);
    setEditingTemplateId(null);
    setShowTemplateModal(false);
  };

  const startEditTemplate = (item: InventoryItemView) => {
    setEditingTemplateId(item.id);
    setTemplateName(item.name);
    setTemplateBarcode(item.barcode ?? '');
    setTemplateQuantity(item.quantity);
    setShowTemplateModal(true);
  };

  const startAddTemplate = () => {
    setEditingTemplateId(null);
    setTemplateName('');
    setTemplateBarcode('');
    setTemplateQuantity(1);
    setShowTemplateModal(true);
  };

  const saveTemplate = async () => {
    const normalizedName = templateName.trim();
    const normalizedBarcode = templateBarcode.trim() || null;
    const normalizedQty = Number(templateQuantity || 0);
    if (!normalizedName) {
      alert('يرجى إدخال اسم العنصر');
      return;
    }
    if (normalizedQty < 0) {
      alert('الكمية المطلوبة يجب أن تكون 0 أو أكبر');
      return;
    }
    setSavingTemplate(true);
    try {
      if (editingTemplateId) {
        const target = inventoryItems.find((x) => x.id === editingTemplateId);
        const { error } = await supabase
          .from(tables.inventoryTemplates)
          .update({
            item_name: normalizedName,
            barcode: normalizedBarcode,
            required_quantity: normalizedQty,
            sort_order: target?.sortOrder ?? 0,
          })
          .eq('id', editingTemplateId)
          .eq('department_code', department)
          .eq('category', 'tools');
        if (error) throw error;
      } else {
        const maxSort = inventoryItems.reduce((max, item) => Math.max(max, item.sortOrder), 0);
        const { error } = await supabase.from(tables.inventoryTemplates).insert({
          department_code: department,
          category: 'tools',
          item_name: normalizedName,
          barcode: normalizedBarcode,
          required_quantity: normalizedQty,
          sort_order: maxSort + 1,
          is_active: true,
        });
        if (error) throw error;
      }
      await fetchInventoryTemplates();
      resetTemplateForm();
    } catch (error) {
      const message = getErrorMessage(error);
      alert(`فشل حفظ عنصر الجرد: ${message}`);
    } finally {
      setSavingTemplate(false);
    }
  };

  const archiveTemplate = async (item: InventoryItemView) => {
    if (!window.confirm(`تعطيل عنصر "${item.name}" من الجرد؟`)) return;
    try {
      const { error } = await supabase
        .from(tables.inventoryTemplates)
        .update({ is_active: false })
        .eq('id', item.id)
        .eq('department_code', department)
        .eq('category', 'tools');
      if (error) throw error;
      await fetchInventoryTemplates();
      if (editingTemplateId === item.id) resetTemplateForm();
    } catch (error) {
      const message = getErrorMessage(error);
      alert(`فشل تعطيل عنصر الجرد: ${message}`);
    }
  };

  const persistTemplateOrder = async (items: InventoryItemView[]) => {
    setReorderingTemplates(true);
    try {
      const updates = items.map((item, index) =>
        supabase
          .from(tables.inventoryTemplates)
          .update({ sort_order: index + 1 })
          .eq('id', item.id)
          .eq('department_code', department)
          .eq('category', 'tools')
      );
      const results = await Promise.all(updates);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
    } catch (error) {
      const message = getErrorMessage(error);
      alert(`فشل تحديث ترتيب العناصر: ${message}`);
      await fetchInventoryTemplates();
    } finally {
      setReorderingTemplates(false);
      setDraggingTemplateId(null);
    }
  };

  const moveTemplate = async (draggedId: number, targetId: number) => {
    if (draggedId === targetId) return;
    const ordered = [...inventoryItems].sort((a, b) => a.sortOrder - b.sortOrder);
    const fromIndex = ordered.findIndex((item) => item.id === draggedId);
    const toIndex = ordered.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = ordered.splice(fromIndex, 1);
    ordered.splice(toIndex, 0, moved);
    const normalized = ordered.map((item, index) => ({ ...item, sortOrder: index + 1 }));
    setInventoryItems(normalized);
    await persistTemplateOrder(normalized);
  };

  const resetNewReportForm = useCallback(() => {
    setSubmitted(false);
    setPostSubmitNotice(null);
    setActiveTab('damage');
    setSelectedVehicleId('');
    setDriverName('');
    setTruckNumber('');
    setDate(new Date().toISOString().split('T')[0]);
    setDamagePoints([]);
    setInspectionValues({});
    setToolValues({});
    setToolImages({});
    setDriverSignature('');
    setEquipmentManagerSignature('');
    setLogisticsManagerSignature('');
    setWarehouseManagerSignature('');
  }, []);

  const handleSubmit = async () => {
    if (!selectedVehicle || !driverName.trim()) {
      alert(`يرجى اختيار المركبة وتأكيد اسم ${staffLabel}`);
      return;
    }

    setIsSubmitting(true);

    try {
      const normalizedToolValues = buildNormalizedToolValuesForReport(
        selectedVehicleHasToolkit,
        inventoryItems,
        toolValues,
      );
      const reportPayload = {
        user_id: userId,
        vehicle_id: selectedVehicle.id,
        driver_name: driverName.trim(),
        truck_number: selectedVehicle.plate_number,
        date,
        damage_points: damagePoints,
        inspection_values: inspectionValues,
        tool_values: normalizedToolValues,
        tool_images: selectedVehicleHasToolkit ? toolImages : {},
        driver_signature: driverSignature,
        equipment_manager: equipmentManagerSignature,
        logistics_manager: logisticsManagerSignature,
        warehouse_manager: warehouseManagerSignature,
      };

      let insertedRow: Record<string, unknown> | null = null;
      if (isInstallation) {
        const installationInsert = {
          user_id: userId,
          vehicle_id: selectedVehicle.id,
          vehicle_number: selectedVehicle.plate_number,
          vehicle_type: String((selectedVehicle as unknown as { vehicle_type?: unknown }).vehicle_type ?? ''),
          report_type: 'inventory',
          payload: {
            ...reportPayload,
            vehicle_type: String((selectedVehicle as unknown as { vehicle_type?: unknown }).vehicle_type ?? ''),
          },
        };
        const { data, error } = await supabase
          .from('installation_reports')
          .insert(installationInsert)
          .select('*')
          .single();
        if (error) throw error;
        insertedRow = data as Record<string, unknown>;
      } else {
        const { data, error } = await supabase
          .from('reports')
          .insert(reportPayload)
          .select('*')
          .single();
        if (error) throw error;
        insertedRow = data as Record<string, unknown>;
      }

      const newView = mapDbRowToSavedReportView(insertedRow, isInstallation);
      setSavedReports((prev) => {
        const rest = prev.filter((r) => r.id !== newView.id);
        return assignReportDisplaySequences([newView, ...rest]);
      });

      setSubmitted(true);

      void calculateInspectionRecovery({
        client: supabase,
        department,
        inspectionId: Number(newView.id),
        vehicleId: Number(selectedVehicle.id),
        userId,
        hasToolkit: selectedVehicleHasToolkit,
        toolValues: normalizedToolValues,
      })
        .then((recoveryResult) => {
          if (recoveryResult.skippedNoToolkit) {
            setPostSubmitNotice('لا تحتوي على عدة');
          } else {
            setPostSubmitNotice(null);
          }
        })
        .catch((recoveryError) => {
          console.error('Post-inspection recovery failed:', recoveryError);
        });

      const completedInspectionCount = Object.values(inspectionValues).filter(Boolean).length;
      const reportSummary = `تم إنشاء تقرير فحص للمركبة ${selectedVehicle.plate_number} للـ${staffLabel} ${driverName.trim()}`;
      const reportDetails = `الأضرار: ${damagePoints.length} | الفحص السليم: ${completedInspectionCount}/${WEEKLY_INSPECTION_ITEMS.length}`;

      void (async () => {
        try {
          const { error: eventError } = await supabase.from(tables.vehicleEvents).insert({
            vehicle_id: selectedVehicle.id,
            event_type: 'report_created',
            description: `${reportSummary} - ${reportDetails}`,
            old_value: null,
            new_value: newView.id ? `report:${newView.id}` : reportDetails,
          });
          if (eventError) {
            console.error('Failed to log report event:', eventError);
            if (isInstallation) {
              alert(
                'تم حفظ التقرير لكن تعذّر تسجيل الحدث في سجل المركبة. طبّق ترحيل قاعدة البيانات الأخير أو أبلغ المسؤول.',
              );
            }
          }
        } catch (e) {
          console.error('vehicle event after report:', e);
        }
      await fetchReports();
      })();
    } catch (error: unknown) {
      console.error('Submission error:', error);
      const msg = getErrorMessage(error);
      alert('فشل في حفظ التقرير: ' + msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const exportPDF = async () => {
    if (!reportRef.current || !viewingReport) return;

    setIsExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const raw = reportRef.current.innerHTML;
      const html = wrapReportHtmlForPdf(raw, window.location.origin);
      const truck = String(viewingReport.truckNumber || 'truck').replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '-');
      const dt = String(viewingReport.date || new Date().toISOString().slice(0, 10));

      await exportHtmlToPdf(html, `report-${truck}-${dt}.pdf`, { reportInspectionLayout: true });
    } catch (error: unknown) {
      console.error('PDF Export failed:', error);
      alert('فشل في تصدير ملف PDF: ' + getErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center justify-center p-6">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full glass p-12 rounded-3xl text-center space-y-6"
        >
          <div className="w-20 h-20 bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">تم حفظ التقرير بنجاح!</h1>
          <p className="text-stone-500 dark:text-stone-400">تم تخزين التقرير في قاعدة بيانات الموقع ويمكنك الرجوع إليه في أي وقت.</p>
          {postSubmitNotice && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              {postSubmitNotice}
            </div>
          )}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={resetNewReportForm}
              className="btn-primary w-full"
            >
              تقديم جرد جديد
            </button>
            <button 
              onClick={() => {
                setSubmitted(false);
                setActiveTab('history');
              }}
              className="w-full py-2 text-stone-600 dark:text-stone-300 font-bold hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
            >
              عرض السجل
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pb-24" dir="rtl">
      {/* Tab bar */}
      {(recoveryStats.pendingCount > 0 || recoveryStats.dueReminderCount > 0) && (
        <div className="mb-4 rounded-2xl border border-amber-300/70 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/30 px-4 py-3">
          <p className="text-xs font-black text-amber-900 dark:text-amber-100">
            نواقص الجرد المفتوحة: {recoveryStats.pendingCount} | مستحق الآن: {recoveryStats.dueReminderCount} | إجمالي النقص: {recoveryStats.totalMissing}
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          type="button"
          onClick={() => setIntelligenceOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md hover:opacity-95 transition-opacity font-black text-sm"
        >
          <Brain className="w-4 h-4" />
          Inspection Intelligence
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-stone-600 dark:text-stone-300 font-bold text-sm"
        >
          <History className="w-4 h-4" />
          السجل
        </button>
      </div>

      <div className="space-y-8">
        {activeTab === 'history' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <History className="w-6 h-6 text-red-700" />
                سجل التقارير المحفوظة
              </h2>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setIsSelectionMode(!isSelectionMode);
                    setSelectedStaffIds([]);
                  }}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-bold border transition-colors",
                    isSelectionMode ? "bg-stone-200 dark:bg-stone-700 border-stone-300 dark:border-stone-600" : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700"
                  )}
                >
                  {isSelectionMode ? 'إلغاء التحديد' : 'تحديد'}
                </button>

                {isSelectionMode && savedReports.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="px-4 py-2 rounded-xl text-sm font-bold border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                  >
                    {selectedReportIds.length === savedReports.length ? 'إلغاء الكل' : 'تحديد الكل'}
                  </button>
                )}

                {canDeleteReports && isSelectionMode && (
                  <BulkDeleteSelectedButton
                    selectedCount={selectedReportIds.length}
                    deleting={deletingReportsBulk}
                    confirmMessage={(n) =>
                      `هل أنت متأكد من حذف ${n} تقرير من قاعدة البيانات؟ لا يمكن التراجع.`
                    }
                    onDelete={handleDeleteSelectedReports}
                  />
                )}

                {isSelectionMode && selectedReportIds.length > 0 && (
                  <>
                    <button
                      onClick={exportSelectedExcel}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-lg"
                    >
                      <Download className="w-4 h-4" /> Excel ({selectedReportIds.length})
                    </button>
                    <button
                      onClick={exportSelectedPDF}
                      disabled={exportingSelected}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold shadow-lg"
                    >
                      {exportingSelected ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      PDF ({selectedReportIds.length})
                    </button>
                  </>
                )}

                <button 
                  onClick={() => fetchReports()}
                  className="p-2 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-400 transition-colors"
                  title="تحديث السجل"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setActiveTab('damage')}
                  className="flex items-center gap-2 text-stone-500 dark:text-stone-400 hover:text-red-700 dark:hover:text-red-400 font-bold"
                >
                  <ArrowRight className="w-4 h-4" />
                  رجوع للنموذج
                </button>
              </div>
            </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedReports.length === 0 && !loadingReports ? (
                <div className="col-span-full py-20 text-center text-stone-400 dark:text-stone-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>لا توجد تقارير محفوظة حالياً</p>
                </div>
              ) : (
                savedReports.map((report) => (
                  <div 
                    key={report.id}
                    className={cn(
                      "glass p-6 rounded-2xl hover:border-red-200 transition-all cursor-pointer group relative",
                      selectedReportIds.includes(report.id) && "ring-2 ring-red-500/50 bg-red-50/10"
                    )}
                    onClick={() => isSelectionMode ? toggleReportSelection(report.id) : void openReportDetails(report)}
                  >
                    {isSelectionMode && (
                      <div className="absolute top-4 left-4 z-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedReportIds.includes(report.id)}
                          onChange={() => toggleReportSelection(report.id)}
                          className="w-5 h-5 rounded border-stone-300 text-red-600 focus:ring-red-500"
                        />
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{report.driverName}</h3>
                        <p className="text-sm text-stone-500 dark:text-stone-400">مركبة رقم: {report.truckNumber}</p>
                        {report.vehicleId && (
                          <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">مرتبطة بالمركبة #{report.vehicleId}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-mono font-bold bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-200 px-2 py-0.5 rounded">
                          جرد #{formatReportInventoryNo(report)}
                        </span>
                        <span className="text-xs font-mono bg-stone-100 dark:bg-stone-700 px-2 py-1 rounded text-stone-500 dark:text-stone-300">
                          {new Date(report.createdAt).toLocaleDateString('ar-EG')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-stone-100 dark:border-stone-700">
                      <div className="flex gap-2">
                        <span className="text-[10px] font-bold px-2 py-1 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-full">
                          {report.damagePoints.length} أضرار
                        </span>
                        <span className="text-[10px] font-bold px-2 py-1 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-full">
                          {Object.values(report.inspectionValues).filter(Boolean).length}/17 فحص
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-stone-300 dark:text-stone-600 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors" />
                    </div>
                  </div>
                ))
              )}
              {loadingReports && (
                <div className="col-span-full py-10 text-center text-stone-500 dark:text-stone-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  جاري تحميل السجل...
                </div>
              )}
            </div>
            {savedReports.length > 0 && hasMoreReports && (
              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => fetchReports({ append: true, page: reportsPage })}
                  disabled={loadingReports}
                  className="px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-600 text-sm font-bold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-60"
                >
                  تحميل المزيد من السجل
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Driver Info */}
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <VehicleSelect
                vehicles={vehicles}
                selectedVehicleId={selectedVehicleId}
                onSelect={(vehicle) => {
                  const nextVehicleId = String(vehicle.id);
                  if (isInstallation && selectedVehicleId && selectedVehicleId !== nextVehicleId) {
                    const hasDraftData =
                      driverName.trim().length > 0 ||
                      damagePoints.length > 0 ||
                      Object.keys(inspectionValues).length > 0 ||
                      Object.keys(toolValues).length > 0 ||
                      Object.values(toolImages).some((images) => Array.isArray(images) && images.length > 0);
                    if (hasDraftData) {
                      const approved = window.confirm(
                        'تم إدخال بيانات جرد للمركبة الحالية. تغيير المركبة سيحذف هذه البيانات من النموذج الحالي. هل تريد المتابعة؟'
                      );
                      if (!approved) return;
                    }
                  }

                  setSelectedVehicleId(String(vehicle.id));
                  setTruckNumber(vehicle.plate_number);
                  // لا يتم تعبئة driverName تلقائيًا - يبقى إدخال يدوي
                  if (isInstallation && selectedVehicleId !== nextVehicleId) {
                    // Prevent mixing old damage/tool images across different installation vehicle types.
                    setDamagePoints([]);
                    setInspectionValues({});
                    setToolValues({});
                    setToolImages({});
                  }
                }}
                driverMap={driverMap}
                staffLabel={staffLabel}
              />
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 dark:text-stone-400 flex items-center gap-2">
                  <User className="w-3 h-3" /> {`اسم ${staffLabel}`}
                </label>
                <div className="space-y-2">
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder={`اسم ${staffLabel} وقت إنشاء التقرير`}
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                />
                {selectedVehicle && (
                  <div className="text-[11px] text-stone-500 dark:text-stone-400">
                    <span>{`${staffLabel} الحالي على المركبة: ${selectedVehicleDriver || `بدون ${staffLabel}`}`} (مرجع فقط)</span>
                  </div>
                )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 dark:text-stone-400 flex items-center gap-2">
                  <Hash className="w-3 h-3" /> رقم المركبة
                </label>
                <input 
                  type="text"
                  readOnly
                  className="input-field" 
                  placeholder="سيُملأ تلقائياً من المركبات"
                  value={truckNumber}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 dark:text-stone-400 flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> تاريخ الجرد
                </label>
                <input 
                  type="date" 
                  className="input-field"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </section>

            {selectedVehicle && (
              <section className="glass p-4 rounded-2xl border border-stone-200/70 dark:border-stone-700/70">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-bold text-stone-900 dark:text-stone-100">المركبة المرجعية:</span>
                  <span className="px-3 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 font-bold">
                    {selectedVehicle.plate_number}
                  </span>
                  <span className="text-stone-500 dark:text-stone-400">
                    {staffLabel} الحالي: {selectedVehicleDriver || `بدون ${staffLabel}`}
                  </span>
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-bold',
                      selectedVehicleHasToolkit
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    )}
                  >
                    {selectedVehicleHasToolkit ? 'تحتوي على عُدّة' : 'لا تحتوي على عُدّة'}
                  </span>
                </div>
              </section>
            )}

            {/* Tabs Navigation */}
            <div className="flex p-1 bg-stone-200 dark:bg-stone-800 rounded-2xl">
              {(['damage', 'inspection', ...(selectedVehicleHasToolkit ? (['tools'] as const) : ([] as const))] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
                    activeTab === tab 
                      ? "bg-white dark:bg-stone-700 text-red-700 dark:text-red-400 shadow-sm" 
                      : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
                  )}
                >
                  {tab === 'damage' && <AlertTriangle className="w-4 h-4" />}
                  {tab === 'inspection' && <ClipboardCheck className="w-4 h-4" />}
                  {tab === 'tools' && <Wrench className="w-4 h-4" />}
                  {tab === 'damage' ? 'أضرار المركبة' : tab === 'inspection' ? 'الفحص الأسبوعي' : 'جرد العدة'}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'damage' && (
                    <div className="space-y-6">
                      <DamageMap 
                        points={damagePoints}
                        onDamageChange={setDamagePoints} 
                        cacheBuster={cacheBuster}
                        imageSrc={selectedVehicleImage}
                      />
                    </div>
                  )}
                  
                  {activeTab === 'inspection' && (
                    <div className="space-y-6">
                      <InspectionForm 
                        values={inspectionValues} 
                        onChange={(id, checked) => setInspectionValues(prev => ({ ...prev, [id]: checked }))} 
                      />
                    </div>
                  )}
                  
                  {activeTab === 'tools' && (
                    <div className="space-y-6">
                      <section className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <h4 className="text-sm font-extrabold text-stone-800 dark:text-stone-100">
                            {toolsSectionTitle}
                          </h4>
                          <div className="flex items-center gap-2">
                            {showToolsEditor && (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowToolsEditor(false);
                                  resetTemplateForm();
                                }}
                                className="text-xs font-bold text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
                              >
                                إلغاء
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setShowToolsEditor((prev) => !prev)}
                              className={cn(
                                "flex items-center gap-2 rounded-xl text-xs font-bold px-3 py-2 border transition-colors",
                                showToolsEditor
                                  ? "bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-100 border-stone-300 dark:border-stone-600"
                                  : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                              )}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              {showToolsEditor ? 'إخفاء التعديل' : 'تعديل الجرد'}
                            </button>
                          </div>
                        </div>

                        {showToolsEditor && (
                          <>
                            <div className="flex items-center justify-end">
                              <button
                                type="button"
                                onClick={startAddTemplate}
                                className="flex items-center gap-2 rounded-xl bg-emerald-600 text-white text-xs font-bold px-3 py-2 hover:bg-emerald-700"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                إضافة عنصر
                              </button>
                            </div>

                            <div className="space-y-2">
                              {inventoryItems.length === 0 ? (
                                <p className="text-xs text-stone-500 dark:text-stone-400">لا توجد عناصر جرد حالياً.</p>
                              ) : (
                                [...inventoryItems]
                                  .sort((a, b) => a.sortOrder - b.sortOrder)
                                  .map((item) => (
                                  <div
                                    key={item.id}
                                    draggable={!reorderingTemplates}
                                    onDragStart={() => setDraggingTemplateId(item.id)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={async () => {
                                      if (!draggingTemplateId) return;
                                      await moveTemplate(draggingTemplateId, item.id);
                                    }}
                                    className={cn(
                                      "flex items-center justify-between gap-3 p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700",
                                      draggingTemplateId === item.id && 'opacity-60',
                                      reorderingTemplates && 'cursor-wait'
                                    )}
                                  >
                                    <div className="min-w-0 flex items-center gap-2">
                                      <GripVertical className="w-4 h-4 text-stone-400" />
                                      <div className="min-w-0">
                                        <p className="text-sm font-bold text-stone-800 dark:text-stone-100 truncate">{item.name}</p>
                                        {item.barcode ? (
                                          <p className="text-[10px] font-mono text-stone-500 dark:text-stone-400 truncate">
                                            باركود: {item.barcode}
                                          </p>
                                        ) : null}
                                      </div>
                                      <p className="text-xs text-stone-500 dark:text-stone-400 shrink-0">المطلوب: {item.quantity}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => startEditTemplate(item)}
                                        className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                        title="تعديل"
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => archiveTemplate(item)}
                                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        title="تعطيل"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                            <p className="text-[11px] text-stone-400 dark:text-stone-500">
                              اسحب العنصر وأفلته لإعادة ترتيب جرد العدة.
                            </p>
                          </>
                        )}
                      </section>

                      <ToolInventory 
                        values={toolValues} 
                        onChange={(id, count) => setToolValues(prev => ({ ...prev, [id]: count }))} 
                        toolImages={toolImages}
                        onImagesChange={(id, images) => setToolImages(prev => ({ ...prev, [id]: images }))}
                        items={inventoryItems.map((item) => ({
                          id: item.id,
                          item_name: item.name,
                          barcode: item.barcode ?? null,
                          required_quantity: item.quantity,
                        }))}
                      />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Signatures Section */}
            <section className="space-y-6 pt-8 border-t border-stone-200">
              <h3 className="text-xl font-bold">التوقيعات والاعتمادات</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <SignaturePad 
                  label={`اسم وتوقيع ${staffLabel}`} 
                  onSave={setDriverSignature} 
                />
                <SignaturePad 
                  label={departmentManagerLabel} 
                  onSave={setEquipmentManagerSignature} 
                />
                <SignaturePad 
                  label="توقيع مدير قسم اللوجستك" 
                  onSave={setLogisticsManagerSignature} 
                />
                <SignaturePad 
                  label="توقيع مدير المخازن" 
                  onSave={setWarehouseManagerSignature} 
                />
              </div>
            </section>
          </>
        )}
      </div>

      <AnimatePresence>
        {showTemplateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={resetTemplateForm}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-base font-black text-stone-900 dark:text-stone-100">
                  {editingTemplateId ? 'تعديل عنصر جرد' : 'إضافة عنصر جرد'}
                </h4>
                <button
                  type="button"
                  onClick={resetTemplateForm}
                  className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 dark:text-stone-400">اسم العنصر</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="مثال: مفك + دريل"
                  className="input-field"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 dark:text-stone-400">الباركود</label>
                <input
                  type="text"
                  value={templateBarcode}
                  onChange={(e) => setTemplateBarcode(e.target.value)}
                  placeholder="اختياري"
                  className="input-field font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 dark:text-stone-400">الكمية المطلوبة</label>
                <input
                  type="number"
                  min={0}
                  value={templateQuantity}
                  onChange={(e) => setTemplateQuantity(Number(e.target.value || 0))}
                  className="input-field"
                />
              </div>

              {editingTemplateId && (
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  سيتم تحديث اسم العنصر والباركود والكمية مع الحفاظ على ترتيبه الحالي.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetTemplateForm}
                  className="px-4 py-2 rounded-xl text-sm font-bold border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={saveTemplate}
                  disabled={savingTemplate}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2"
                >
                  {savingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingTemplateId ? 'حفظ التعديل' : 'إضافة العنصر'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Action Bar */}
      {activeTab !== 'history' && (
        <div className="fixed bottom-0 left-0 right-0 glass dark:glass p-4 border-t border-stone-200 dark:border-stone-700 z-50">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="hidden sm:block">
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">سيتم الحفظ في:</p>
              <p className="text-[10px] font-mono text-stone-400 dark:text-stone-500">قاعدة بيانات الموقع المحلية</p>
            </div>

            <div className="flex items-center gap-4 flex-1 sm:flex-none">
              <div className="hidden md:flex items-center gap-4 text-[10px] font-bold text-stone-400 dark:text-stone-500 border-r border-stone-200 dark:border-stone-700 pr-4">
                <span className={damagePoints.length > 0 ? 'text-red-500' : ''}>
                  {damagePoints.length} أضرار
                </span>
                <span className={Object.keys(inspectionValues).length > 0 ? 'text-green-600' : ''}>
                  {Object.keys(inspectionValues).length} فحص
                </span>
                {selectedVehicleHasToolkit ? (
                  <span className={Object.keys(toolValues).length > 0 ? 'text-blue-600' : ''}>
                    {Object.keys(toolValues).length} جرد
                  </span>
                ) : (
                  <span className="text-red-600 dark:text-red-300">لا تحتوي على عُدّة</span>
                )}
              </div>
              
              <button 
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="btn-primary flex-1 flex items-center justify-center gap-3 min-w-[200px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    حفظ التقرير في الموقع
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal / PDF View */}
      <AnimatePresence>
        {viewingReport && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[rgba(0,0,0,0.6)] backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white dark:bg-stone-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl relative"
            >
              <div className="sticky top-0 bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 p-4 flex justify-between items-center z-10">
                <div className="flex gap-2">
                  <button 
                    onClick={exportPDF}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-xl font-bold text-sm hover:bg-red-800 transition-colors disabled:opacity-50"
                  >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {isExporting ? 'جاري التحميل...' : 'تحميل PDF'}
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl font-bold text-sm hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    طباعة
                  </button>
                </div>
                <button 
                  onClick={() => setViewingReport(null)}
                  className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-full transition-colors"
                >
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>

              <div ref={reportRef} id="print-section" className="p-12 space-y-12 bg-white dark:bg-stone-900" dir="rtl">
                {/* PDF Header */}
                <div className="flex justify-between items-start border-b-4 border-rose-400 pb-8" style={{ pageBreakInside: 'avoid' }}>
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 flex items-center justify-center bg-rose-50 rounded-2xl">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-rose-500">
                        <path d="M3 14l9-9 9 9" />
                      </svg>
                    </div>
                    <div className="border-r-4 border-stone-200 pr-6">
                      <h1 className="text-4xl font-black text-stone-900 leading-tight">الحسني هوم سنتر</h1>
                      <h2 className="text-2xl font-bold text-stone-800 leading-tight">ALHASANI HOME CENTER</h2>
                    </div>
                  </div>
                  <div className="text-left">
                    <h2 className="text-3xl font-bold text-rose-500">تقرير فحص المركبة</h2>
                    <p className="text-stone-500 font-mono text-lg">#{formatReportInventoryNo(viewingReport)}</p>
                    <div className="mt-6 text-right">
                      <h3 className="text-xl font-black text-stone-900">الحسني هوم سنتر</h3>
                      <p className="text-xs font-bold text-stone-500">ALHASANI HOME CENTER</p>
                    </div>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-3 gap-8 bg-stone-50 p-6 rounded-2xl" style={{ pageBreakInside: 'avoid' }}>
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">{staffLabel}</span>
                    <p className="font-bold text-lg">{viewingReport.driverName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">رقم المركبة</span>
                    <p className="font-bold text-lg">{viewingReport.truckNumber}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">التاريخ</span>
                    <p className="font-bold text-lg">{viewingReport.date}</p>
                  </div>
                </div>

                <div className="pdf-damage-stack">
                  {/* Vehicle Damage Map */}
                  <div className="space-y-4 pdf-section">
                    <h3 className="text-xl font-bold border-r-4 border-rose-400 pr-4">مخطط أضرار المركبة</h3>
                    <div className="pdf-vehicle-map relative rounded-2xl overflow-hidden border-2 border-stone-100">
                      <img
                        src={getVehicleInspectionMapUrl(department, viewingReport.vehicleType)}
                        alt="مخطط المركبة"
                        className="w-full h-auto object-contain"
                      />
                      {viewingReport.damagePoints.map((point: any, idx: number) => (
                        <div
                          key={idx}
                          className="absolute w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                          style={{
                            left: `${point.x}%`,
                            top: `${point.y}%`,
                            transform: 'translate(-50%, -50%)',
                            backgroundColor:
                              point.severity === 'high'
                                ? '#dc2626'
                                : point.severity === 'medium'
                                  ? '#f97316'
                                  : '#facc15',
                          }}
                        >
                          <span className="text-[10px] font-bold text-white">{idx + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Damage Summary */}
                  <div className="space-y-4 pdf-section">
                    <h3 className="text-xl font-bold border-r-4 border-red-700 pr-4">أضرار المركبة الموثقة</h3>
                  {viewingReport.damagePoints.length === 0 ? (
                    <p className="text-stone-400 dark:text-stone-500 italic">لا توجد أضرار مسجلة</p>
                  ) : (
                    <div className="space-y-4">
                      {viewingReport.damagePoints.map((p: any, idx: number) => (
                        <div
                          key={idx}
                          className="pdf-damage-card border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden"
                        >
                          <div className="flex items-center gap-4 p-3 bg-white dark:bg-stone-800 border-b border-stone-100 dark:border-stone-700">
                            <span className="font-mono font-bold text-stone-300 dark:text-stone-500">#{idx + 1}</span>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap ${
                              p.severity === 'high' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200' : 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200'
                            }`}>
                              {p.severity === 'high' ? 'كبير' : 'متوسط'}
                            </span>
                            <p className="flex-1 font-medium">{p.description}</p>
                          </div>
                          
                          {/* Damage Images */}
                          {p.images && p.images.length > 0 && (
                            <div className="p-4 bg-stone-50 dark:bg-stone-700 border-t border-stone-100 dark:border-stone-700">
                              <p className="text-xs font-bold text-stone-600 dark:text-stone-300 mb-4">صور الضرر ({p.images.length}):</p>
                              <div className="space-y-4">
                                {p.images.map((image: string, imgIdx: number) => (
                                  <div
                                    key={imgIdx}
                                    className="bg-white dark:bg-stone-800 rounded border border-stone-200 dark:border-stone-700 flex flex-col w-full h-auto"
                                  >
                                    <img
                                      src={image}
                                      alt={`صورة الضرر ${imgIdx + 1}`}
                                      className="report-embed-photo"
                                      style={{
                                        width: '100%',
                                        height: 'auto',
                                        display: 'block',
                                        maxHeight: '600px',
                                        objectFit: 'contain',
                                        backgroundColor: '#ffffff',
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                </div>

                {/* Inspection Results */}
                <div className="space-y-4 pdf-section">
                  <h3 className="text-xl font-bold border-r-4 border-rose-400 pr-4">نتائج الفحص الأسبوعي</h3>
                  <div className="space-y-2">
                    {WEEKLY_INSPECTION_ITEMS.map((item) => (
                      <div
                        key={item.id}
                        className="pdf-print-flow-row flex items-center justify-between p-3 border-b border-stone-100 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-lg text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-stone-400 dark:text-stone-500 font-mono text-xs">{item.id.toString().padStart(2, '0')}</span>
                          <span className="font-medium">{item.label}</span>
                        </div>
                        <span className={`font-bold px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${viewingReport.inspectionValues[item.id] ? 'bg-green-50 dark:bg-green-900 text-green-600 dark:text-green-200' : 'bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200'}`}>
                          {viewingReport.inspectionValues[item.id] ? '✓ سليم' : '✗ غير سليم'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {SHOW_RECOVERY_DETAILS_IN_REPORT && (
                  <div className="space-y-4 pdf-section">
                    <h3 className="text-xl font-bold border-r-4 border-amber-500 pr-4">تقرير موسّع — التنبيهات والتوصيات</h3>
                    {(() => {
                      const nonCompliant = WEEKLY_INSPECTION_ITEMS.filter((item) => !viewingReport.inspectionValues[item.id]);
                      const deficits = inventoryItems
                        .map((item) => {
                          const available = Number(viewingReport.toolValues[item.id] || 0);
                          const required = Number(item.quantity || 0);
                          return {
                            id: item.id,
                            name: item.name,
                            barcode: item.barcode ?? null,
                            available,
                            required,
                            deficit: Math.max(required - available, 0),
                          };
                        })
                        .filter((d) => d.deficit > 0);
                      return (
                        <div className="space-y-3">
                          {nonCompliant.length === 0 && deficits.length === 0 ? (
                            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm font-bold">
                              لا توجد عناصر غير سليمة أو نواقص في هذا التقرير.
                            </div>
                          ) : (
                            <>
                              {nonCompliant.length > 0 && (
                                <div className="p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20">
                                  <p className="text-sm font-black text-red-700 dark:text-red-300 mb-2">
                                    عناصر غير سليمة — يجب الاستبدال/الصيانة ({nonCompliant.length})
                                  </p>
                                  <ul className="space-y-1 text-xs text-red-700 dark:text-red-300">
                                    {nonCompliant.map((item) => (
                                      <li key={`warn-${item.id}`}>- {item.label} (توصية: استبدال أو إصلاح فوري)</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {deficits.length > 0 && (
                                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                                  <p className="text-sm font-black text-amber-800 dark:text-amber-200 mb-2">
                                    نواقص العُدّة — يجب التعويض ({deficits.length})
                                  </p>
                                  <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-200">
                                    {deficits.map((d) => (
                                      <li key={`def-${d.id}`}>
                                        - {formatInventoryLabel(d.name, d.barcode)}: مطلوب {d.required} / متوفر {d.available} / نقص{' '}
                                        {d.deficit}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Tool Inventory */}
                <div className="space-y-4 pdf-section">
                  <h3 className="text-xl font-bold border-r-4 border-rose-400 pr-4">جرد العدة والمواد</h3>
                  {Object.keys(viewingReport.toolValues || {}).length === 0 ? (
                    <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 text-sm text-stone-500 dark:text-stone-400">
                      لا تحتوي المركبة على عُدّة أو لا توجد بيانات جرد عُدّة في هذا التقرير.
                    </div>
                  ) : (
                  <div className="space-y-4">
                    {inventoryItems.map((item) => (
                      <div key={item.id} className="pdf-print-flow-row border border-stone-200 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between p-3 bg-white dark:bg-stone-800 border-b border-stone-100 dark:border-stone-700">
                          <div className="flex items-center gap-3 min-w-0">
                            <Package className="w-4 h-4 text-stone-400 dark:text-stone-500 shrink-0" />
                            <span className="font-medium">{formatInventoryLabel(item.name, item.barcode)}</span>
                          </div>
                          <div className="flex items-center gap-6">
                            <span className="text-xs text-stone-400 dark:text-stone-500 whitespace-nowrap">المطلوب: {item.quantity}</span>
                            <span className={`font-bold px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${
                              (viewingReport.toolValues[item.id] || 0) < item.quantity ? 'bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200' : 'bg-green-50 dark:bg-green-900 text-green-600 dark:text-green-200'
                            }`}>
                              المتوفر: {viewingReport.toolValues[item.id] || 0}
                            </span>
                          </div>
                        </div>
                        
                        {/* Tool Images */}
                        {viewingReport.toolImages && viewingReport.toolImages[item.id] && viewingReport.toolImages[item.id].length > 0 && (
                          <div className="p-4 bg-stone-50 dark:bg-stone-700 border-t border-stone-100 dark:border-stone-700">
                            <p className="text-xs font-bold text-stone-600 dark:text-stone-300 mb-4">الصور المرتبطة ({viewingReport.toolImages[item.id].length}):</p>
                            <div className="space-y-4">
                              {viewingReport.toolImages[item.id].map((image: string, imgIdx: number) => (
                                <div
                                  key={imgIdx}
                                  className="bg-white dark:bg-stone-800 rounded border border-stone-200 dark:border-stone-700 flex flex-col w-full h-auto"
                                >
                                  <img
                                    src={image}
                                    alt={`${item.name} - الصورة ${imgIdx + 1}`}
                                    className="report-embed-photo"
                                    style={{
                                      width: '100%',
                                      height: 'auto',
                                      display: 'block',
                                      maxHeight: '600px',
                                      objectFit: 'contain',
                                      backgroundColor: '#ffffff',
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  )}
                </div>

                {/* Signatures */}
                <div className="pdf-section pdf-section-signatures flex flex-wrap gap-x-8 gap-y-12 pt-12 border-t border-stone-100 dark:border-stone-700">
                  <div className="text-center space-y-4 flex-1 min-w-[200px]">
                    <p className="text-sm font-bold text-stone-500 dark:text-stone-400">{`اسم وتوقيع ${staffLabel}`}</p>
                    <div className="h-24 border-b border-stone-200 dark:border-stone-700 flex items-center justify-center bg-white dark:bg-stone-800">
                      {viewingReport.driverSignature && <img src={viewingReport.driverSignature} className="max-h-full" />}
                    </div>
                    <p className="text-xs font-bold text-stone-400 dark:text-stone-500">{viewingReport.driverName}</p>
                  </div>
                  <div className="text-center space-y-4 flex-1 min-w-[200px]">
                    <p className="text-sm font-bold text-stone-500 dark:text-stone-400">{departmentManagerText}</p>
                    <div className="h-24 border-b border-stone-200 dark:border-stone-700 flex items-center justify-center bg-white dark:bg-stone-800">
                      {viewingReport.equipmentManagerSignature && <img src={viewingReport.equipmentManagerSignature} className="max-h-full" />}
                    </div>
                  </div>
                  <div className="text-center space-y-4 flex-1 min-w-[200px]">
                    <p className="text-sm font-bold text-stone-500">مدير قسم اللوجستك</p>
                    <div className="h-24 border-b border-stone-200 flex items-center justify-center">
                      {viewingReport.logisticsManagerSignature && <img src={viewingReport.logisticsManagerSignature} className="max-h-full" />}
                    </div>
                  </div>
                  <div className="text-center space-y-4 flex-1 min-w-[200px]">
                    <p className="text-sm font-bold text-stone-500">مدير المخازن</p>
                    <div className="h-24 border-b border-stone-200 flex items-center justify-center">
                      {viewingReport.warehouseManagerSignature && <img src={viewingReport.warehouseManagerSignature} className="max-h-full" />}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-12 border-t border-stone-100 flex justify-between items-center text-[10px] text-stone-400 font-bold">
                  <p>تم إنشاء هذا التقرير إلكترونياً عبر نظام الحسني هوم سنتر</p>
                  <p>{new Date(viewingReport.createdAt).toLocaleString('ar-EG')}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <InspectionIntelligenceDrawer
        open={intelligenceOpen}
        onClose={() => setIntelligenceOpen(false)}
        pageDepartment={department}
        canDeleteRecovery={profile?.role === 'admin'}
        canRebuildRecovery={canRebuildRecovery}
        onStartInspection={(vehicleId) => {
          setSelectedVehicleId(String(vehicleId));
          setActiveTab('damage');
        }}
        onOpenHistory={(vehicleId) => {
          setSelectedVehicleId(String(vehicleId));
          setActiveTab('history');
        }}
      />
    </div>
  );
}
