import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Brain,
  CalendarCheck2,
  ChevronDown,
  Download,
  History,
  KeyRound,
  Loader2,
  Play,
  QrCode,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import type { DepartmentCode } from '../../data/department';
import { getDepartmentClient, getDepartmentTables } from '../../data/supabaseSource';
import { useInspectionIntelligence } from '../../hooks/useInspectionIntelligence';
import { buildInspectionDeepLink, type IntelligenceFilterKey } from '../../lib/inspectionIntelligence';
import { cn } from '../../lib/utils';
import {
  enrichStoredInventoryLabel,
  escapeHtmlForPdf,
  formatInventoryLabel,
  splitBarcodeAndNameFromDisplay,
} from '../../lib/inventoryDisplay';
import { exportHtmlToPdf, wrapReportHtmlForPdf } from '../../lib/pdfExport';
import { TOOL_INVENTORY_ITEMS, WEEKLY_INSPECTION_ITEMS } from '../../constants';
import {
  dateInputsToCreatedAtRange,
  rebuildInspectionRecoveryForAllReports,
} from '../../lib/inspectionRecovery/calculateInspectionRecovery';
import {
  RecoveryReasonsRepository,
  type RecoveryCompensationReason,
  type RecoveryReasonCategory,
} from '../../data/repositories/recoveryReasonsRepository';

const WEEKDAY_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** رمز واجهة فقط — لا يغني عن سياسات RLS في Supabase. */
const REBUILD_GUARD_PIN = '0000';
const recoveryReasonCategoryLabel: Record<RecoveryReasonCategory, string> = {
  customer_compensation: 'تعويض لدى زبون',
  sale: 'صرف/بيع',
  damage: 'تالف',
  loss: 'مفقود',
  other: 'أخرى',
};

function defaultRebuildDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function buildDefaultCompensationReasonDraft(): RecoveryCompensationReasonDraft {
  return {
    category: '',
    details: '',
    customerName: '',
    invoiceNumber: '',
    compensatedItemName: '',
    compensatedItemBarcode: '',
  };
}

function buildSuggestedCompensationReasonDraft(row: InspectionRecoveryRow): RecoveryCompensationReasonDraft {
  const draft = buildDefaultCompensationReasonDraft();
  const parsed = splitBarcodeAndNameFromDisplay(row.item_name);
  draft.compensatedItemName = parsed.name || row.item_name;
  draft.compensatedItemBarcode = parsed.barcode || '';
  const delta = Number(row.delta_since_last_compensation ?? 0);
  if (row.is_repeat_shortage) {
    draft.category = 'other';
    draft.details = `مقارنة آلية: نقص متكرر بعد تعويض سابق${delta > 0 ? ` (فرق: ${delta})` : ''}.`;
    return draft;
  }
  if (delta > 0) {
    draft.category = 'other';
    draft.details = `مقارنة آلية: انخفاض عن آخر حالة بعد التعويض بمقدار ${delta}.`;
    return draft;
  }
  if (row.reason && row.reason.trim()) {
    draft.details = row.reason.trim();
  }
  return draft;
}

interface DeficitItem {
  itemId: number;
  itemName: string;
  barcode?: string | null;
  required: number;
  available: number;
  deficit: number;
}

interface DeficitRow {
  vehicleId: number;
  reportId: number;
  plateNumber: string;
  responsibleName: string;
  totalDeficit: number;
  items: DeficitItem[];
  nonCompliantItems: string[];
}

interface CompensationRecord {
  id: number;
  vehicle_id: number;
  report_id: number;
  status: 'pending' | 'compensated' | 'not_compensated';
  compensation_due_date: string | null;
  notes: string | null;
}

type RecoveryStatus = 'pending' | 'scheduled' | 'resolved';

interface InspectionRecoveryRow {
  id: number;
  inspection_id: number;
  vehicle_id: number;
  user_id: string | null;
  item_name: string;
  required_qty: number;
  actual_qty: number;
  missing_qty: number;
  compensated_qty: number;
  status: RecoveryStatus;
  scheduled_date: string | null;
  resolved_at: string | null;
  reason: string | null;
  created_at: string;
  baseline_actual_qty?: number | null;
  is_repeat_shortage?: boolean;
  delta_since_last_compensation?: number;
  source_type?: 'stored' | 'derived';
}

interface RecoveryCompensationReasonDraft {
  category: RecoveryReasonCategory | '';
  details: string;
  customerName: string;
  invoiceNumber: string;
  compensatedItemName: string;
  compensatedItemBarcode: string;
}

interface RecoveryGroupedCard {
  key: string;
  vehicleId: number;
  vehicleLabel: string;
  userId: string | null;
  userLabel: string;
  rows: InspectionRecoveryRow[];
}

interface StaffRecoveryGroup {
  staffKey: string;
  userLabel: string;
  cards: RecoveryGroupedCard[];
}

/** تجميع حسب اسم السائق المعروض؛ احتياط: userId ثم مركبة. */
function staffGroupKeyFromCard(card: RecoveryGroupedCard): string {
  const raw = String(card.userLabel ?? '').trim();
  if (raw && raw !== '—') return `name:${raw}`;
  if (card.userId != null && String(card.userId).trim() !== '') return `uid:${String(card.userId)}`;
  return `veh:${card.vehicleId}`;
}

function groupRecoveryCardsByStaff(cards: RecoveryGroupedCard[]): StaffRecoveryGroup[] {
  const map = new Map<string, { userLabel: string; cards: RecoveryGroupedCard[] }>();
  for (const card of cards) {
    const staffKey = staffGroupKeyFromCard(card);
    const cur = map.get(staffKey);
    if (cur) {
      cur.cards.push(card);
    } else {
      map.set(staffKey, { userLabel: card.userLabel, cards: [card] });
    }
  }
  return Array.from(map.entries())
    .map(([staffKey, v]) => ({ staffKey, userLabel: v.userLabel, cards: v.cards }))
    .sort((a, b) => a.userLabel.localeCompare(b.userLabel, 'ar'));
}

interface InspectionRecoveryAction {
  id: number;
  recovery_id: number | null;
  inspection_id: number;
  vehicle_id: number;
  user_id: string | null;
  department: 'tajhiz' | 'installation' | 'operations';
  item_name: string;
  previous_status: RecoveryStatus | null;
  next_status: RecoveryStatus;
  action_type: 'manual' | 'auto';
  compensated_qty: number | null;
  reason: string | null;
  scheduled_date: string | null;
  acted_at: string;
}

function statusStyle(status: 'healthy' | 'warning' | 'critical') {
  if (status === 'critical') return 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40';
  if (status === 'warning') return 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/40';
  return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/40';
}

function statusLabel(status: 'healthy' | 'warning' | 'critical') {
  if (status === 'critical') return 'حرج';
  if (status === 'warning') return 'تنبيه';
  return 'سليم';
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function parseBooleanLike(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes' || v === 'نعم') return true;
    if (v === 'false' || v === '0' || v === 'no' || v === 'لا') return false;
  }
  return null;
}

export interface InspectionIntelligenceDrawerProps {
  open: boolean;
  onClose: () => void;
  /** قسم الصفحة الحالي — يُستخدم كقيمة افتراضية لمبدّل الذكاء */
  pageDepartment: DepartmentCode;
  onStartInspection: (vehicleId: number) => void;
  onOpenHistory: (vehicleId: number) => void;
  canDeleteRecovery?: boolean;
  /** إعادة احتساب سجل التعويض من كل التقارير المحفوظة (صلاحيات مطابقة لسياسات insert على inspection_recovery). */
  canRebuildRecovery?: boolean;
  initialTab?: 'overview' | 'recovery';
  initialRecoverySubTab?: 'worklist' | 'archive';
  /** وضع العرض: درج جانبي (افتراضي) أو مساحة صفحة كاملة مدمجة. */
  variant?: 'drawer' | 'page';
}

export default function InspectionIntelligenceDrawer({
  open,
  onClose,
  pageDepartment,
  onStartInspection,
  onOpenHistory,
  canDeleteRecovery = false,
  canRebuildRecovery = false,
  initialTab = 'overview',
  initialRecoverySubTab = 'worklist',
  variant = 'drawer',
}: InspectionIntelligenceDrawerProps) {
  const isPageVariant = variant === 'page';
  const [qrVehicleId, setQrVehicleId] = useState<number | null>(null);
  const [deficitRows, setDeficitRows] = useState<DeficitRow[]>([]);
  const [deficitLoading, setDeficitLoading] = useState(false);
  const [savingCompensationId, setSavingCompensationId] = useState<number | null>(null);
  const [compensationsByReport, setCompensationsByReport] = useState<Map<number, CompensationRecord>>(new Map());
  const [dueDatesByReport, setDueDatesByReport] = useState<Record<number, string>>({});
  const [intelTab, setIntelTab] = useState<'overview' | 'recovery'>('overview');
  const [recoveryRows, setRecoveryRows] = useState<InspectionRecoveryRow[]>([]);
  const [recoveryActions, setRecoveryActions] = useState<InspectionRecoveryAction[]>([]);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryActionsLoading, setRecoveryActionsLoading] = useState(false);
  const [savingRecoveryId, setSavingRecoveryId] = useState<number | null>(null);
  const [backfillingRecovery, setBackfillingRecovery] = useState(false);
  const [rebuildingAllRecovery, setRebuildingAllRecovery] = useState(false);
  const [rebuildAllProgress, setRebuildAllProgress] = useState<{ processed: number; total: number } | null>(null);
  const [rebuildWizardOpen, setRebuildWizardOpen] = useState(false);
  const [rebuildWizardStep, setRebuildWizardStep] = useState<'dates' | 'pin' | 'confirm'>('dates');
  const [rebuildDateFrom, setRebuildDateFrom] = useState('');
  const [rebuildDateTo, setRebuildDateTo] = useState('');
  const [rebuildFullLog, setRebuildFullLog] = useState(false);
  const [rebuildPin, setRebuildPin] = useState('');
  const [recoveryActionNotice, setRecoveryActionNotice] = useState<string | null>(null);
  const [recoverySubTab, setRecoverySubTab] = useState<'worklist' | 'archive' | 'reasons'>('worklist');
  const [recoverySelectionMode, setRecoverySelectionMode] = useState(false);
  const [selectedRecoveryIds, setSelectedRecoveryIds] = useState<Set<number>>(new Set());
  const [recoveryReasonDrafts, setRecoveryReasonDrafts] = useState<Record<number, string>>({});
  const [recoveryScheduleDrafts, setRecoveryScheduleDrafts] = useState<Record<number, string>>({});
  const [recoveryCompensatedDrafts, setRecoveryCompensatedDrafts] = useState<Record<number, string>>({});
  const [showNotCompensatedEditor, setShowNotCompensatedEditor] = useState<Record<number, boolean>>({});
  const [recoveryReasonDetailDrafts, setRecoveryReasonDetailDrafts] = useState<
    Record<number, RecoveryCompensationReasonDraft>
  >({});
  const [recoveryReasons, setRecoveryReasons] = useState<RecoveryCompensationReason[]>([]);
  const [recoveryReasonsLoading, setRecoveryReasonsLoading] = useState(false);
  const [reasonFilterDriver, setReasonFilterDriver] = useState('');
  const [reasonFilterItem, setReasonFilterItem] = useState('');
  const [reasonFilterCategory, setReasonFilterCategory] = useState<RecoveryReasonCategory | 'all'>('all');
  const [reasonDateFrom, setReasonDateFrom] = useState('');
  const [reasonDateTo, setReasonDateTo] = useState('');
  const [inventoryNameBarcodeMap, setInventoryNameBarcodeMap] = useState<Map<string, string | null>>(
    () => new Map(),
  );
  const [exportingArchivePdf, setExportingArchivePdf] = useState(false);
  /** مفتاح موحّد لقائمة العمل والأرشيف (نفس السائق يبقى مفتوحاً عند تبديل التبويب). */
  const [expandedRecoveryStaffKeys, setExpandedRecoveryStaffKeys] = useState<Set<string>>(new Set());
  /** مرتبط بمساحة العمل الحالية فقط — لا تبديل إلى القسم الآخر (عزل تجهيز / تركيب). */
  const department = pageDepartment;
  const reasonsRepository = useMemo(() => new RecoveryReasonsRepository(), []);

  useEffect(() => {
    if (open) setQrVehicleId(null);
  }, [open, pageDepartment]);

  useEffect(() => {
    if (!open) return;
    setIntelTab(initialTab);
    setRecoverySubTab(initialRecoverySubTab);
    setRecoverySelectionMode(false);
    setSelectedRecoveryIds(new Set());
    setExpandedRecoveryStaffKeys(new Set());
  }, [initialRecoverySubTab, initialTab, open]);

  useEffect(() => {
    if (!open) setRebuildWizardOpen(false);
  }, [open]);

  const client = useMemo(() => getDepartmentClient(department), [department]);
  const tables = useMemo(() => getDepartmentTables(department), [department]);

  const {
    loading,
    error,
    analytics,
    refetch,
    filteredInsights,
    setFilter,
    filter,
    responsibleQuery,
    setResponsibleQuery,
  } = useInspectionIntelligence({
    client,
    tables,
    department,
    enabled: open,
  });

  const staffLabel = department === 'installation' ? 'فني' : 'سائق';

  const loadInventoryBarcodeMap = useCallback(async () => {
    if (!open) return;
    try {
      const { data, error } = await client
        .from(tables.inventoryTemplates)
        .select('item_name, barcode')
        .eq('department_code', department)
        .eq('category', 'tools')
        .eq('is_active', true);
      if (error) throw error;
      const m = new Map<string, string | null>();
      for (const row of (data ?? []) as Array<{ item_name?: string; barcode?: string | null }>) {
        const name = String(row.item_name ?? '').trim();
        if (!name) continue;
        const bc = row.barcode != null && String(row.barcode).trim() ? String(row.barcode).trim() : null;
        m.set(name, bc);
      }
      setInventoryNameBarcodeMap(m);
    } catch (e) {
      console.warn('loadInventoryBarcodeMap failed', e);
    }
  }, [open, client, tables.inventoryTemplates, department]);

  useEffect(() => {
    void loadInventoryBarcodeMap();
  }, [loadInventoryBarcodeMap]);

  const formatRecoveryItemDisplay = useCallback(
    (storedName: string) => enrichStoredInventoryLabel(storedName, inventoryNameBarcodeMap),
    [inventoryNameBarcodeMap],
  );

  const heatMax = useMemo(() => {
    if (!analytics) return 1;
    return Math.max(1, ...Object.values(analytics.heatmap));
  }, [analytics]);

  const loadDeficits = useCallback(async () => {
    if (!open) return;
    setDeficitLoading(true);
    try {
      const [templatesRes, vehiclesRes, compensationRes] = await Promise.all([
        client
          .from(tables.inventoryTemplates)
          .select('id,item_name,barcode,required_quantity')
          .eq('department_code', department)
          .eq('category', 'tools')
          .eq('is_active', true),
        client.from(tables.vehicles).select('id,plate_number,vehicle_number,has_toolkit,assigned_driver_id,responsible_staff_id'),
        client
          .from('inventory_deficit_compensations')
          .select('id,vehicle_id,report_id,status,compensation_due_date,notes')
          .eq('department_code', department)
          .order('created_at', { ascending: false })
          .limit(1000),
      ]);

      if (templatesRes.error) throw templatesRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (compensationRes.error) {
        // Do not block deficit rendering when compensation status read is not permitted.
        console.warn('inventory_deficit_compensations read failed; continuing without status map', compensationRes.error);
      }

      const reportLimit = 4000;
      const reportQuery =
        department === 'installation'
          ? client
              .from(tables.reports)
              .select('id,vehicle_id,payload,created_at')
              .order('created_at', { ascending: false })
              .limit(reportLimit)
          : client
              .from(tables.reports)
              .select('id,vehicle_id,tool_values,inspection_values,created_at')
              .order('created_at', { ascending: false })
              .limit(reportLimit);
      const { data: reportData, error: reportError } = await reportQuery;
      if (reportError) throw reportError;
      const reportRows = (reportData ?? []) as Array<Record<string, unknown>>;

      const requiredMap = new Map<number, { name: string; barcode: string | null; required: number }>();
      const templateRows = (templatesRes.data ?? []) as Array<{
        id: number;
        item_name: string;
        barcode?: string | null;
        required_quantity: number;
      }>;
      const sourceTemplates = templateRows.length > 0
        ? templateRows.map((t) => ({
            id: Number(t.id),
            name: String(t.item_name ?? ''),
            barcode: t.barcode != null && String(t.barcode).trim() ? String(t.barcode).trim() : null,
            required: Number(t.required_quantity ?? 0),
          }))
        : TOOL_INVENTORY_ITEMS.map((t) => ({
            id: Number(t.id),
            name: t.name,
            barcode: null as string | null,
            required: Number(t.quantity ?? 0),
          }));
      for (const row of sourceTemplates) {
        requiredMap.set(Number(row.id), {
          name: String(row.name ?? ''),
          barcode: row.barcode,
          required: Number(row.required ?? 0),
        });
      }

      const vehicleMap = new Map<number, { plate: string; hasToolkit: boolean }>();
      for (const row of (vehiclesRes.data ?? []) as Array<Record<string, unknown>>) {
        const id = Number(row.id);
        if (!Number.isFinite(id)) continue;
        vehicleMap.set(id, {
          plate: String(row.plate_number ?? row.vehicle_number ?? `#${id}`),
          hasToolkit: row.has_toolkit !== false,
        });
      }

      const responsibleByVehicle = new Map<number, string>();
      for (const row of (analytics?.insightsSorted ?? [])) {
        responsibleByVehicle.set(row.vehicleId, row.responsibleName);
      }

      const nextRows: DeficitRow[] = [];
      for (const reportRow of reportRows) {
        const vehicleId = Number(reportRow.vehicle_id);
        if (!Number.isFinite(vehicleId)) continue;
        const vMeta = vehicleMap.get(vehicleId);
        if (!vMeta?.hasToolkit) continue;

        const payload = normalizeRecord(reportRow.payload);
        const toolValues = normalizeRecord(department === 'installation' ? payload.tool_values : reportRow.tool_values);
        const inspectionValues = normalizeRecord(
          department === 'installation' ? payload.inspection_values : reportRow.inspection_values,
        );

        const items: DeficitItem[] = [];
        let totalDeficit = 0;
        const nonCompliantItems = WEEKLY_INSPECTION_ITEMS
          .filter((item) => {
            const byId = parseBooleanLike(inspectionValues[String(item.id)]);
            const byLabel = parseBooleanLike(inspectionValues[item.label]);
            const normalized = byId ?? byLabel;
            return normalized === false;
          })
          .map((item) => item.label);

        requiredMap.forEach((cfg, itemId) => {
          const rawAvailableById = toolValues[String(itemId)];
          const rawAvailableByName = toolValues[cfg.name];
          const rawAvailable = rawAvailableById ?? rawAvailableByName;
          const available = Number(rawAvailable ?? 0);
          const safeAvailable = Number.isFinite(available) ? available : 0;
          const deficit = Math.max(cfg.required - safeAvailable, 0);
          if (deficit > 0) {
            totalDeficit += deficit;
            items.push({
              itemId,
              itemName: cfg.name,
              barcode: cfg.barcode,
              required: cfg.required,
              available: safeAvailable,
              deficit,
            });
          }
        });

        if (totalDeficit > 0 || nonCompliantItems.length > 0) {
          nextRows.push({
            vehicleId,
            reportId: Number(reportRow.id),
            plateNumber: vMeta.plate,
            responsibleName: responsibleByVehicle.get(vehicleId) ?? '—',
            totalDeficit,
            items,
            nonCompliantItems,
          });
        }
      }

      // إظهار أحدث تقرير لكل مركبة أولاً ثم حجم النقص.
      nextRows.sort((a, b) => {
        if (a.vehicleId !== b.vehicleId) return b.reportId - a.reportId;
        return b.totalDeficit - a.totalDeficit;
      });
      setDeficitRows(nextRows);

      const compMap = new Map<number, CompensationRecord>();
      const dueDefaults: Record<number, string> = {};
      for (const row of ((compensationRes.data ?? []) as CompensationRecord[])) {
        compMap.set(Number(row.report_id), row);
      }
      for (const row of nextRows) {
        const existing = compMap.get(row.reportId);
        dueDefaults[row.reportId] =
          existing?.compensation_due_date ??
          new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      }
      setCompensationsByReport(compMap);
      setDueDatesByReport(dueDefaults);
    } catch (e) {
      console.error('loadDeficits failed', e);
    } finally {
      setDeficitLoading(false);
    }
  }, [analytics?.insightsSorted, client, department, open, tables.inventoryTemplates, tables.reports, tables.vehicles]);

  useEffect(() => {
    void loadDeficits();
  }, [loadDeficits]);

  const loadRecoveryRows = useCallback(async () => {
    if (!open) return;
    setRecoveryLoading(true);
    try {
      const { data, error } = await client
        .from('inspection_recovery')
        .select(
          'id,inspection_id,vehicle_id,user_id,item_name,required_qty,actual_qty,missing_qty,compensated_qty,status,scheduled_date,resolved_at,reason,created_at,baseline_actual_qty,is_repeat_shortage,delta_since_last_compensation',
        )
        .eq('department', department)
        .order('created_at', { ascending: false })
        .limit(3000);
      if (error) throw error;
      const rows = ((data ?? []) as InspectionRecoveryRow[]).map((row) => ({
        ...row,
        status: (row.status ?? 'pending') as RecoveryStatus,
      }));
      const defaultDates: Record<number, string> = {};
      const defaultReasons: Record<number, string> = {};
      const defaultCompensated: Record<number, string> = {};
      const defaultReasonDetails: Record<number, RecoveryCompensationReasonDraft> = {};
      for (const row of rows) {
        defaultDates[row.id] = row.scheduled_date ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        defaultReasons[row.id] = row.reason ?? '';
        const remaining = Math.max(Number(row.missing_qty ?? 0) - Number(row.compensated_qty ?? 0), 0);
        defaultCompensated[row.id] = String(Math.max(1, remaining));
        defaultReasonDetails[row.id] = buildSuggestedCompensationReasonDraft(row);
      }
      setRecoveryRows(rows);
      setRecoveryScheduleDrafts(defaultDates);
      setRecoveryReasonDrafts(defaultReasons);
      setRecoveryCompensatedDrafts((prev) => ({ ...prev, ...defaultCompensated }));
      setRecoveryReasonDetailDrafts((prev) => ({ ...defaultReasonDetails, ...prev }));
    } catch (e) {
      console.error('loadRecoveryRows failed', e);
    } finally {
      setRecoveryLoading(false);
    }
  }, [client, department, open]);

  useEffect(() => {
    void loadRecoveryRows();
  }, [loadRecoveryRows]);

  const loadRecoveryActions = useCallback(async () => {
    if (!open) return;
    setRecoveryActionsLoading(true);
    try {
      const { data, error } = await client
        .from('inspection_recovery_actions')
        .select(
          'id,recovery_id,inspection_id,vehicle_id,user_id,department,item_name,previous_status,next_status,action_type,compensated_qty,reason,scheduled_date,acted_at',
        )
        .eq('department', department)
        .order('acted_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      setRecoveryActions((data ?? []) as InspectionRecoveryAction[]);
    } catch (e) {
      console.error('loadRecoveryActions failed', e);
    } finally {
      setRecoveryActionsLoading(false);
    }
  }, [client, department, open]);

  useEffect(() => {
    void loadRecoveryActions();
  }, [loadRecoveryActions]);

  const loadRecoveryReasons = useCallback(async () => {
    if (!open) return;
    setRecoveryReasonsLoading(true);
    try {
      const rows = await reasonsRepository.listByDepartment(department, 6000);
      setRecoveryReasons(rows);
    } catch (e) {
      console.error('loadRecoveryReasons failed', e);
    } finally {
      setRecoveryReasonsLoading(false);
    }
  }, [department, open, reasonsRepository]);

  useEffect(() => {
    void loadRecoveryReasons();
  }, [loadRecoveryReasons]);

  const updateCompensationStatus = useCallback(
    async (row: DeficitRow, status: 'compensated' | 'not_compensated') => {
      const dueDate = dueDatesByReport[row.reportId] || null;
      setSavingCompensationId(row.reportId);
      try {
        const payload = {
          department_code: department,
          vehicle_id: row.vehicleId,
          report_id: row.reportId,
          plate_number: row.plateNumber,
          responsible_name: row.responsibleName,
          deficit_items: row.items,
          total_deficit: row.totalDeficit,
          status,
          compensation_due_date: dueDate || null,
          compensated_at: status === 'compensated' ? new Date().toISOString() : null,
          notes: status === 'compensated' ? 'تم التعويض' : 'لم يتم التعويض',
        };
        const { data, error } = await client
          .from('inventory_deficit_compensations')
          .upsert(payload, { onConflict: 'department_code,report_id' })
          .select('id,vehicle_id,report_id,status,compensation_due_date,notes')
          .single();
        if (error) throw error;
        setCompensationsByReport((prev) => {
          const next = new Map(prev);
          next.set(row.reportId, data as CompensationRecord);
          return next;
        });
      } catch (e) {
        console.error('updateCompensationStatus failed', e);
      } finally {
        setSavingCompensationId(null);
      }
    },
    [client, department, dueDatesByReport],
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const getEffectiveRecoveryStatus = useCallback(
    (row: InspectionRecoveryRow): RecoveryStatus => {
      if (row.status === 'scheduled' && row.scheduled_date && row.scheduled_date <= todayIso) {
        return 'pending';
      }
      return row.status;
    },
    [todayIso],
  );

  const mergedRecoveryRows = useMemo<InspectionRecoveryRow[]>(() => {
    const rows = [...recoveryRows];
    const existingInspectionIds = new Set(rows.map((r) => Number(r.inspection_id)));
    for (const deficit of deficitRows) {
      const inspectionId = Number(deficit.reportId);
      if (existingInspectionIds.has(inspectionId)) continue;
      for (const item of deficit.items) {
        rows.push({
          id: -1 * (inspectionId * 1000 + item.itemId),
          inspection_id: inspectionId,
          vehicle_id: deficit.vehicleId,
          user_id: null,
          item_name: formatInventoryLabel(item.itemName, item.barcode),
          required_qty: item.required,
          actual_qty: item.available,
          missing_qty: item.deficit,
          compensated_qty: 0,
          status: 'pending',
          scheduled_date: null,
          resolved_at: null,
          reason: 'مسترجع تلقائياً من جرد سابق',
          created_at: new Date().toISOString(),
          source_type: 'derived',
        });
      }
    }
    return rows.sort((a, b) => Number(b.inspection_id) - Number(a.inspection_id));
  }, [deficitRows, recoveryRows]);

  const pendingReminderCount = useMemo(
    () =>
      mergedRecoveryRows.filter(
        (row) => row.status === 'scheduled' && row.scheduled_date != null && row.scheduled_date <= todayIso,
      ).length,
    [mergedRecoveryRows, todayIso],
  );

  const recoveryCards = useMemo<RecoveryGroupedCard[]>(() => {
    const vehicleMeta = new Map<number, { plateNumber: string; responsibleName: string }>();
    for (const row of analytics?.insightsSorted ?? []) {
      vehicleMeta.set(row.vehicleId, {
        plateNumber: row.plateNumber,
        responsibleName: row.responsibleName,
      });
    }

    const grouped = new Map<string, RecoveryGroupedCard>();
    for (const row of mergedRecoveryRows) {
      const userId = row.user_id ?? 'no-user';
      const key = `${row.vehicle_id}-${userId}`;
      if (!grouped.has(key)) {
        const meta = vehicleMeta.get(row.vehicle_id);
        grouped.set(key, {
          key,
          vehicleId: row.vehicle_id,
          vehicleLabel: meta?.plateNumber ?? `#${row.vehicle_id}`,
          userId: row.user_id,
          userLabel: meta?.responsibleName ?? '—',
          rows: [],
        });
      }
      grouped.get(key)?.rows.push(row);
    }
    return Array.from(grouped.values()).sort((a, b) => b.vehicleId - a.vehicleId);
  }, [analytics?.insightsSorted, mergedRecoveryRows]);

  const worklistCards = useMemo<RecoveryGroupedCard[]>(
    () =>
      recoveryCards
        .map((card) => ({
          ...card,
          rows: card.rows.filter((row) => getEffectiveRecoveryStatus(row) === 'pending'),
        }))
        .filter((card) => card.rows.length > 0),
    [getEffectiveRecoveryStatus, recoveryCards],
  );

  const archiveCards = useMemo<RecoveryGroupedCard[]>(
    () =>
      recoveryCards
        .map((card) => ({
          ...card,
          rows: card.rows.filter((row) => getEffectiveRecoveryStatus(row) !== 'pending'),
        }))
        .filter((card) => card.rows.length > 0),
    [getEffectiveRecoveryStatus, recoveryCards],
  );

  const worklistByStaff = useMemo(() => groupRecoveryCardsByStaff(worklistCards), [worklistCards]);
  const archiveByStaff = useMemo(() => groupRecoveryCardsByStaff(archiveCards), [archiveCards]);

  const toggleRecoveryStaff = useCallback((staffKey: string) => {
    setExpandedRecoveryStaffKeys((prev) => {
      const next = new Set(prev);
      if (next.has(staffKey)) next.delete(staffKey);
      else next.add(staffKey);
      return next;
    });
  }, []);

  /** صفوف التبويب الحالي ضمن مجموعات السائق/الفني المفتوحة فقط (لـ «تحديد الكل» التراكمي). */
  const expandedTabRecoveryRowIds = useMemo(() => {
    const groups = recoverySubTab === 'worklist' ? worklistByStaff : archiveByStaff;
    const ids: number[] = [];
    for (const group of groups) {
      if (!expandedRecoveryStaffKeys.has(group.staffKey)) continue;
      for (const card of group.cards) {
        for (const row of card.rows) {
          if (row.id > 0) ids.push(row.id);
        }
      }
    }
    return ids;
  }, [archiveByStaff, expandedRecoveryStaffKeys, recoverySubTab, worklistByStaff]);

  const actionTimelineByCard = useMemo(() => {
    const grouped = new Map<string, InspectionRecoveryAction[]>();
    for (const action of recoveryActions) {
      const userId = action.user_id ?? 'no-user';
      const key = `${action.vehicle_id}-${userId}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(action);
    }
    return grouped;
  }, [recoveryActions]);

  const currentRecoveryRows = useMemo(
    () =>
      (recoverySubTab === 'worklist'
        ? worklistCards
        : recoverySubTab === 'archive'
          ? archiveCards
          : [])
        .flatMap((card) => card.rows)
        .filter((row) => row.id > 0),
    [archiveCards, recoverySubTab, worklistCards],
  );

  const allCurrentRecoveryIds = useMemo(
    () => currentRecoveryRows.map((row) => row.id),
    [currentRecoveryRows],
  );

  const currentTabRowIdSet = useMemo(
    () => new Set(allCurrentRecoveryIds),
    [allCurrentRecoveryIds],
  );

  const selectedRecoveryIdsInCurrentTab = useMemo(() => {
    const next = new Set<number>();
    selectedRecoveryIds.forEach((id) => {
      if (currentTabRowIdSet.has(id)) next.add(id);
    });
    return next;
  }, [selectedRecoveryIds, currentTabRowIdSet]);

  const selectedRecoveryCount = selectedRecoveryIds.size;
  const selectedRecoveryCountInCurrentTab = selectedRecoveryIdsInCurrentTab.size;

  const compensatedTotalCount = useMemo(
    () => mergedRecoveryRows.filter((row) => getEffectiveRecoveryStatus(row) === 'resolved').length,
    [getEffectiveRecoveryStatus, mergedRecoveryRows],
  );

  const derivedRecoveryRows = useMemo(
    () => mergedRecoveryRows.filter((row) => row.id < 0 || row.source_type === 'derived'),
    [mergedRecoveryRows],
  );

  const getRemainingMissingQty = useCallback((row: InspectionRecoveryRow) => {
    const missing = Number(row.missing_qty ?? 0);
    const compensated = Number(row.compensated_qty ?? 0);
    return Math.max(missing - compensated, 0);
  }, []);

  const filteredRecoveryReasons = useMemo(() => {
    const driverQ = reasonFilterDriver.trim();
    const itemQ = reasonFilterItem.trim();
    return recoveryReasons.filter((row) => {
      if (reasonFilterCategory !== 'all' && row.reason_category !== reasonFilterCategory) return false;
      if (driverQ && !String(row.driver_name ?? '').includes(driverQ)) return false;
      if (itemQ && !String(row.item_name ?? '').includes(itemQ)) return false;
      const occurredDay = String(row.occurred_at ?? '').slice(0, 10);
      if (reasonDateFrom && occurredDay < reasonDateFrom) return false;
      if (reasonDateTo && occurredDay > reasonDateTo) return false;
      return true;
    });
  }, [reasonDateFrom, reasonDateTo, reasonFilterCategory, reasonFilterDriver, reasonFilterItem, recoveryReasons]);

  const recoveryReasonMetrics = useMemo(() => {
    let compensatedQty = 0;
    let remainingQty = 0;
    for (const row of filteredRecoveryReasons) {
      compensatedQty += Number(row.compensated_qty ?? 0);
      remainingQty += Number(row.remaining_qty_after_action ?? 0);
    }
    const totalTracked = compensatedQty + remainingQty;
    const compensationRate = totalTracked > 0 ? Math.round((compensatedQty / totalTracked) * 100) : 0;
    return { compensatedQty, remainingQty, totalTracked, compensationRate };
  }, [filteredRecoveryReasons]);

  const exportRecoveryReasonsPdf = useCallback(async () => {
    setExportingArchivePdf(true);
    try {
      if (filteredRecoveryReasons.length === 0) {
        window.alert('لا توجد أسباب تعويض ضمن الفلاتر الحالية.');
        return;
      }
      const deptTitle =
        department === 'installation' ? 'تركيب' : department === 'operations' ? 'عمليات' : 'تجهيز';
      const rowsHtml = filteredRecoveryReasons
        .map((row) => {
          const cat = recoveryReasonCategoryLabel[row.reason_category] ?? row.reason_category;
          const occurred = String(row.occurred_at ?? '').slice(0, 10);
          return `<tr>
            <td>${escapeHtmlForPdf(occurred || '—')}</td>
            <td>${escapeHtmlForPdf(String(row.driver_name ?? '—'))}</td>
            <td>${escapeHtmlForPdf(String(row.item_name ?? '—'))}</td>
            <td>${escapeHtmlForPdf(cat)}</td>
            <td>${row.compensated_qty ?? 0}</td>
            <td>${row.remaining_qty_after_action ?? 0}</td>
            <td>${escapeHtmlForPdf(String(row.customer_name ?? '—'))}</td>
            <td>${escapeHtmlForPdf(String(row.invoice_number ?? '—'))}</td>
            <td>${escapeHtmlForPdf(String(row.reason_details ?? '—'))}</td>
          </tr>`;
        })
        .join('');
      const html = `
        <h1>تقرير أسباب تعويض النواقص — ${escapeHtmlForPdf(deptTitle)}</h1>
        <p>الإجمالي: ${filteredRecoveryReasons.length} | كمية التعويض: ${recoveryReasonMetrics.compensatedQty} | المتبقي: ${recoveryReasonMetrics.remainingQty} | نسبة التعويض: ${recoveryReasonMetrics.compensationRate}%</p>
        <table>
          <thead>
            <tr><th>التاريخ</th><th>${escapeHtmlForPdf(staffLabel)}</th><th>العنصر</th><th>فئة السبب</th><th>تم تعويض</th><th>متبقي</th><th>الزبون</th><th>الفاتورة</th><th>التفاصيل</th></tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `;
      await exportHtmlToPdf(
        wrapReportHtmlForPdf(html, window.location.origin),
        `recovery-reasons-${deptTitle}-${Date.now()}.pdf`,
        {},
      );
    } finally {
      setExportingArchivePdf(false);
    }
  }, [department, filteredRecoveryReasons, recoveryReasonMetrics, staffLabel]);

  const exportRecoveryTabToPdf = useCallback(
    async (tab: 'worklist' | 'archive') => {
      setExportingArchivePdf(true);
      try {
        const deptTitle =
          department === 'installation' ? 'تركيب' : department === 'operations' ? 'عمليات' : 'تجهيز';
        const sourceCards = tab === 'worklist' ? worklistCards : archiveCards;
        const tabRowIds = new Set(
          sourceCards.flatMap((c) => c.rows.map((r) => r.id)).filter((id) => id > 0),
        );
        const selectedForThisTab = new Set(
          [...selectedRecoveryIds].filter((id) => tabRowIds.has(id)),
        );
        /** تصدير جزئي فقط عند وضع التحديد ووجود صفوف محددة ضمن نفس التبويب المُصدَّر */
        const selectionActive = recoverySelectionMode && selectedForThisTab.size > 0;

        if (recoverySelectionMode && selectedRecoveryIds.size > 0 && selectedForThisTab.size === 0) {
          window.alert(
            'لا توجد صفوف محددة في هذا التبويب. حدّد صفوفاً في قائمة العمل أو الأرشيف (حسب التبويب الذي تريد تصديره) ثم أعد المحاولة.',
          );
          return;
        }

        const flatRows: Array<{ card: RecoveryGroupedCard; row: InspectionRecoveryRow }> = [];
        for (const card of sourceCards) {
          for (const row of card.rows) {
            if (selectionActive) {
              if (row.id <= 0 || !selectedForThisTab.has(row.id)) continue;
            }
            flatRows.push({ card, row });
          }
        }

        const worklistRecoveryIdSet = new Set(
          worklistCards.flatMap((c) => c.rows.map((r) => r.id)).filter((id) => id > 0),
        );
        const archiveRecoveryIdSet = new Set(
          archiveCards.flatMap((c) => c.rows.map((r) => r.id)).filter((id) => id > 0),
        );

        const actionsForPdf = recoveryActions.filter((a) => {
          const rid = a.recovery_id != null ? Number(a.recovery_id) : null;
          if (selectionActive) {
            return rid != null && selectedForThisTab.has(rid);
          }
          if (tab === 'worklist') {
            return rid != null && worklistRecoveryIdSet.has(rid);
          }
          return rid != null && archiveRecoveryIdSet.has(rid);
        });

        const tabLabel = tab === 'worklist' ? 'قائمة العمل' : 'الأرشيف والحركات';
        const emptyMsg =
          tab === 'worklist'
            ? selectionActive
              ? 'لا توجد صفوف ضمن التحديد في قائمة العمل. ألغِ التحديد أو حدّد صفوفاً من القائمة.'
              : 'لا توجد بيانات في قائمة العمل للتصدير.'
            : selectionActive
              ? 'لا توجد صفوف ضمن التحديد في الأرشيف. ألغِ التحديد أو حدّد صفوفاً من الأرشيف.'
              : 'لا توجد بيانات أرشيف للتصدير.';

        if (flatRows.length === 0 && actionsForPdf.length === 0) {
          window.alert(emptyMsg);
          return;
        }

        const statusLabel = (row: InspectionRecoveryRow) => {
          const eff = getEffectiveRecoveryStatus(row);
          if (eff === 'resolved') return 'تم التعويض';
          if (eff === 'scheduled') return 'مجدول أو لاحق';
          return 'قيد الانتظار';
        };

        const rowsHtml = flatRows
          .map(({ card, row }) => {
            const display = formatRecoveryItemDisplay(row.item_name);
            const { barcode, name } = splitBarcodeAndNameFromDisplay(display);
            const rem = getRemainingMissingQty(row);
            return `<tr>
          <td>${escapeHtmlForPdf(card.vehicleLabel)}</td>
          <td>${escapeHtmlForPdf(card.userLabel)}</td>
          <td>${escapeHtmlForPdf(barcode)}</td>
          <td>${escapeHtmlForPdf(name)}</td>
          <td>${escapeHtmlForPdf(statusLabel(row))}</td>
          <td>${row.required_qty}</td>
          <td>${row.actual_qty}</td>
          <td>${row.missing_qty}</td>
          <td>${Number(row.compensated_qty ?? 0)}</td>
          <td>${rem}</td>
          <td>${escapeHtmlForPdf(row.reason ?? '—')}</td>
        </tr>`;
          })
          .join('');

        const actionsHtml = actionsForPdf
          .slice(0, 500)
          .map((a) => {
            const display = formatRecoveryItemDisplay(a.item_name);
            return `<tr>
          <td>${escapeHtmlForPdf(String(a.acted_at).slice(0, 19))}</td>
          <td>${a.vehicle_id}</td>
          <td>${escapeHtmlForPdf(display)}</td>
          <td>${escapeHtmlForPdf(String(a.previous_status ?? '—'))}</td>
          <td>${escapeHtmlForPdf(String(a.next_status))}</td>
          <td>${a.compensated_qty ?? '—'}</td>
          <td>${escapeHtmlForPdf(a.reason ?? '—')}</td>
        </tr>`;
          })
          .join('');

        const totals = flatRows.reduce(
          (acc, item) => {
            const row = item.row;
            acc.missing += Number(row.missing_qty ?? 0);
            acc.compensated += Number(row.compensated_qty ?? 0);
            acc.remaining += getRemainingMissingQty(row);
            return acc;
          },
          { missing: 0, compensated: 0, remaining: 0 },
        );
        const compensationRate = totals.missing > 0 ? Math.round((totals.compensated / totals.missing) * 100) : 0;
        const spendRate = totals.missing > 0 ? Math.round(((totals.missing - totals.remaining) / totals.missing) * 100) : 0;

        const title = `نواقص الجرد — ${tabLabel} — ${deptTitle}`;
        const meta = `${new Date().toLocaleString('ar-EG')}${
          selectionActive
            ? ` · تصدير ${selectedForThisTab.size} صف محدد فقط (هذا التبويب)`
            : ' · تصدير كامل التبويب الحالي'
        } · نسبة التعويض ${compensationRate}% · نسبة الصرف ${spendRate}%`;

        const itemsSectionTitle = tab === 'worklist' ? 'العناصر (قائمة العمل — مفتوحة)' : 'العناصر (الأرشيف)';

        const html = `
      <h1>${escapeHtmlForPdf(title)}</h1>
      <p>${escapeHtmlForPdf(meta)}</p>
      <h2>${escapeHtmlForPdf(itemsSectionTitle)}</h2>
      <table>
        <thead><tr>
          <th>المركبة</th><th>${escapeHtmlForPdf(staffLabel)}</th><th>الباركود</th><th>اسم العنصر</th>
          <th>حالة التعويض</th><th>مطلوب</th><th>موجود</th><th>نقص</th><th>تم تعويض</th><th>متبقي</th><th>ملاحظة</th>
        </tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="11">—</td></tr>`}</tbody>
      </table>
      <h2>سجل الحركات (ذات الصلة)</h2>
      <table>
        <thead><tr>
          <th>التاريخ</th><th>مركبة</th><th>العنصر</th><th>من</th><th>إلى</th><th>كمية تعويض</th><th>سبب</th>
        </tr></thead>
        <tbody>${actionsHtml || `<tr><td colspan="7">—</td></tr>`}</tbody>
      </table>
    `;

        const fileSlug = tab === 'worklist' ? 'worklist' : 'archive';
        await exportHtmlToPdf(
          wrapReportHtmlForPdf(html, window.location.origin),
          `jard-${fileSlug}-${deptTitle}-${Date.now()}.pdf`,
          {},
        );
      } finally {
        setExportingArchivePdf(false);
      }
    },
    [
      archiveCards,
      worklistCards,
      recoveryActions,
      recoverySelectionMode,
      selectedRecoveryIds,
      formatRecoveryItemDisplay,
      getEffectiveRecoveryStatus,
      getRemainingMissingQty,
      department,
      staffLabel,
    ],
  );

  const logRecoveryAction = useCallback(
    async (
      row: InspectionRecoveryRow,
      nextStatus: RecoveryStatus,
      options?: { reason?: string; scheduledDate?: string; recoveryId?: number | null; compensatedQty?: number },
    ): Promise<number | null> => {
      const payload = {
        recovery_id: options?.recoveryId ?? (row.id > 0 ? row.id : null),
        inspection_id: row.inspection_id,
        vehicle_id: row.vehicle_id,
        user_id: row.user_id,
        department: department as 'tajhiz' | 'installation' | 'operations',
        item_name: row.item_name,
        previous_status: row.status,
        next_status: nextStatus,
        action_type: 'manual',
        compensated_qty: options?.compensatedQty ?? null,
        reason: options?.reason ?? row.reason ?? null,
        scheduled_date: nextStatus === 'scheduled' ? options?.scheduledDate ?? row.scheduled_date ?? null : null,
      };
      const { data, error } = await client
        .from('inspection_recovery_actions')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      return Number((data as { id?: unknown })?.id ?? 0) || null;
    },
    [client, department],
  );

  const saveCompensationReason = useCallback(
    async (params: {
      row: InspectionRecoveryRow;
      actionId: number | null;
      draft: RecoveryCompensationReasonDraft;
      compensatedQty: number;
      remainingAfterAction: number;
      driverName?: string;
    }) => {
      const { row, actionId, draft, compensatedQty, remainingAfterAction, driverName } = params;
      if (!draft.category) return;
      const parsed = splitBarcodeAndNameFromDisplay(row.item_name);
      await reasonsRepository.insert(department, {
        recovery_id: row.id > 0 ? row.id : null,
        recovery_action_id: actionId,
        inspection_id: Number(row.inspection_id),
        vehicle_id: Number(row.vehicle_id),
        user_id: row.user_id,
        department: department as 'tajhiz' | 'installation' | 'operations',
        driver_name: driverName?.trim() || null,
        item_name: parsed.name || row.item_name,
        item_barcode: parsed.barcode || null,
        compensated_qty: Math.max(0, Number(compensatedQty || 0)),
        remaining_qty_after_action: Math.max(0, Number(remainingAfterAction || 0)),
        reason_category: draft.category,
        reason_details: draft.details.trim() || null,
        customer_name: draft.customerName.trim() || null,
        invoice_number: draft.invoiceNumber.trim() || null,
        compensated_item_name: draft.compensatedItemName.trim() || null,
        compensated_item_barcode: draft.compensatedItemBarcode.trim() || null,
        occurred_at: new Date().toISOString(),
        created_by: row.user_id,
      });
    },
    [department, reasonsRepository],
  );

  const updateRecoveryStatus = useCallback(
    async (
      row: InspectionRecoveryRow,
      nextStatus: RecoveryStatus,
      options?: {
        reason?: string;
        scheduledDate?: string;
        compensatedQty?: number;
        compensationReasonDraft?: RecoveryCompensationReasonDraft;
        driverName?: string;
      },
    ) => {
      const remainingBeforeAction = getRemainingMissingQty(row);
      const compensationQty = Math.max(0, Number(options?.compensatedQty ?? 0));
      const isPartialCompensation = compensationQty > 0 && compensationQty < remainingBeforeAction;
      const compensationReasonDraft = options?.compensationReasonDraft ?? buildDefaultCompensationReasonDraft();
      if (isPartialCompensation) {
        if (!compensationReasonDraft.category) {
          window.alert('للتعويض الجزئي يجب اختيار سبب التعويض.');
          return;
        }
      }
      if (compensationReasonDraft.category === 'customer_compensation') {
        if (!compensationReasonDraft.customerName.trim()) {
          window.alert('يرجى إدخال اسم الزبون عند اختيار سبب: تعويض لدى زبون.');
          return;
        }
        if (!compensationReasonDraft.invoiceNumber.trim()) {
          window.alert('يرجى إدخال رقم الفاتورة عند اختيار سبب: تعويض لدى زبون.');
          return;
        }
      }
      setSavingRecoveryId(row.id);
      try {
        const nowIso = new Date().toISOString();
        const optimisticRow: InspectionRecoveryRow = {
          ...row,
          compensated_qty: Math.min(
            Number(row.missing_qty ?? 0),
            Number(row.compensated_qty ?? 0) + compensationQty,
          ),
          status: nextStatus,
          reason: options?.reason ?? row.reason ?? null,
          scheduled_date: nextStatus === 'scheduled' ? options?.scheduledDate ?? row.scheduled_date ?? null : null,
          resolved_at: nextStatus === 'resolved' ? nowIso : null,
        };

        // Optimistic move between Worklist/Archive without waiting refresh.
        setRecoveryRows((prev) => {
          const hasStored = prev.some((item) => item.id === row.id);
          if (hasStored) {
            return prev.map((item) => (item.id === row.id ? optimisticRow : item));
          }
          if (row.id < 0) {
            return [optimisticRow, ...prev];
          }
          return prev;
        });
        if (nextStatus === 'resolved') {
          const nextCount = mergedRecoveryRows.filter((item) => getEffectiveRecoveryStatus(item) === 'resolved').length + 1;
          setRecoveryActionNotice(`تم التعويض بنجاح. إجمالي العناصر المعوّضة: ${nextCount}`);
        }

        if (row.id < 0) {
          const { data: created, error: createError } = await client
            .from('inspection_recovery')
            .insert({
              inspection_id: row.inspection_id,
              vehicle_id: row.vehicle_id,
              user_id: row.user_id,
              department,
              item_name: row.item_name,
              required_qty: row.required_qty,
              actual_qty: row.actual_qty,
              missing_qty: row.missing_qty,
              compensated_qty: Math.min(
                Number(row.missing_qty ?? 0),
                Number(row.compensated_qty ?? 0) + compensationQty,
              ),
              status: nextStatus,
              action_type: 'manual',
              reason: optimisticRow.reason,
              scheduled_date: optimisticRow.scheduled_date,
              resolved_at: optimisticRow.resolved_at,
            })
            .select(
              'id,inspection_id,vehicle_id,user_id,item_name,required_qty,actual_qty,missing_qty,compensated_qty,status,scheduled_date,resolved_at,reason,created_at,baseline_actual_qty,is_repeat_shortage,delta_since_last_compensation',
            )
            .single();
          if (createError) throw createError;
          const actionId = await logRecoveryAction(row, nextStatus, {
            reason: options?.reason ?? row.reason ?? undefined,
            scheduledDate: nextStatus === 'scheduled' ? options?.scheduledDate ?? row.scheduled_date ?? undefined : undefined,
            recoveryId: Number((created as InspectionRecoveryRow)?.id ?? null),
            compensatedQty: compensationQty,
          });
          const remainingAfterAction = Math.max(
            Number(row.missing_qty ?? 0) - (Number(row.compensated_qty ?? 0) + compensationQty),
            0,
          );
          if (compensationQty > 0 && compensationReasonDraft.category) {
            await saveCompensationReason({
              row: created as InspectionRecoveryRow,
              actionId,
              draft: compensationReasonDraft,
              compensatedQty: compensationQty,
              remainingAfterAction,
              driverName: options?.driverName,
            });
          }
          setRecoveryRows((prev) => {
            const withoutTemp = prev.filter((item) => item.id !== row.id);
            return [created as InspectionRecoveryRow, ...withoutTemp];
          });
          await loadRecoveryActions();
          await loadRecoveryReasons();
          setShowNotCompensatedEditor((prev) => ({ ...prev, [row.id]: false }));
          return;
        }

        const payload: Record<string, unknown> = {
          status: nextStatus,
          action_type: 'manual',
          reason: optimisticRow.reason,
          scheduled_date: optimisticRow.scheduled_date,
          resolved_at: optimisticRow.resolved_at,
          compensated_qty: optimisticRow.compensated_qty,
        };
        const { data, error } = await client
          .from('inspection_recovery')
          .update(payload)
          .eq('id', row.id)
          .select(
            'id,inspection_id,vehicle_id,user_id,item_name,required_qty,actual_qty,missing_qty,compensated_qty,status,scheduled_date,resolved_at,reason,created_at,baseline_actual_qty,is_repeat_shortage,delta_since_last_compensation',
          )
          .single();
        if (error) throw error;
        const actionId = await logRecoveryAction(row, nextStatus, {
          reason: options?.reason ?? row.reason ?? undefined,
          scheduledDate: nextStatus === 'scheduled' ? options?.scheduledDate ?? row.scheduled_date ?? undefined : undefined,
          recoveryId: row.id,
          compensatedQty: compensationQty,
        });
        const remainingAfterAction = Math.max(
          Number(row.missing_qty ?? 0) - (Number(row.compensated_qty ?? 0) + compensationQty),
          0,
        );
        if (compensationQty > 0 && compensationReasonDraft.category) {
          await saveCompensationReason({
            row,
            actionId,
            draft: compensationReasonDraft,
            compensatedQty: compensationQty,
            remainingAfterAction,
            driverName: options?.driverName,
          });
        }
        setRecoveryRows((prev) => prev.map((item) => (item.id === row.id ? ((data as InspectionRecoveryRow) ?? item) : item)));
        await loadRecoveryActions();
        await loadRecoveryReasons();
        if (nextStatus !== 'scheduled') {
          setShowNotCompensatedEditor((prev) => ({ ...prev, [row.id]: false }));
        }
      } catch (e) {
        console.error('updateRecoveryStatus failed', e);
        // Rollback optimistic change by reloading the source of truth.
        await loadRecoveryRows();
      } finally {
        setSavingRecoveryId(null);
      }
    },
    [
      client,
      department,
      getEffectiveRecoveryStatus,
      getRemainingMissingQty,
      loadRecoveryActions,
      loadRecoveryReasons,
      loadRecoveryRows,
      logRecoveryAction,
      mergedRecoveryRows,
      saveCompensationReason,
    ],
  );

  const backfillDerivedRecoveryRows = useCallback(async () => {
    if (derivedRecoveryRows.length === 0 || backfillingRecovery) return;
    setBackfillingRecovery(true);
    setRecoveryActionNotice(null);
    try {
      const payload = derivedRecoveryRows.map((row) => ({
        inspection_id: row.inspection_id,
        vehicle_id: row.vehicle_id,
        user_id: row.user_id,
        department,
        item_name: row.item_name,
        required_qty: row.required_qty,
        actual_qty: row.actual_qty,
        missing_qty: row.missing_qty,
        compensated_qty: row.compensated_qty ?? 0,
        status: 'pending' as const,
        action_type: 'auto' as const,
        reason: row.reason ?? 'تم ترحيل نقص تاريخي من جرد سابق',
      }));
      const { data: insertedRows, error } = await client
        .from('inspection_recovery')
        .insert(payload)
        .select('id,inspection_id,vehicle_id,user_id,item_name,status,scheduled_date,reason');
      if (error) throw error;
      const actionPayload = ((insertedRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
        recovery_id: Number(row.id),
        inspection_id: Number(row.inspection_id),
        vehicle_id: Number(row.vehicle_id),
        user_id: row.user_id == null ? null : String(row.user_id),
        department,
        item_name: String(row.item_name ?? ''),
        previous_status: null,
        next_status: 'pending',
        action_type: 'auto',
        compensated_qty: row.compensated_qty ?? 0,
        reason: row.reason == null ? null : String(row.reason),
        scheduled_date: row.scheduled_date == null ? null : String(row.scheduled_date),
      }));
      if (actionPayload.length > 0) {
        const { error: actionError } = await client.from('inspection_recovery_actions').insert(actionPayload);
        if (actionError) throw actionError;
      }
      await loadRecoveryRows();
      await loadRecoveryActions();
      setRecoveryActionNotice(`تم ترحيل ${payload.length} نقص تاريخي إلى سجل التعويض بنجاح.`);
    } catch (e) {
      console.error('backfillDerivedRecoveryRows failed', e);
      setRecoveryActionNotice('تعذر ترحيل النواقص التاريخية حالياً. حاول مرة أخرى.');
    } finally {
      setBackfillingRecovery(false);
    }
  }, [backfillingRecovery, client, department, derivedRecoveryRows, loadRecoveryActions, loadRecoveryRows]);

  const openRebuildWizard = useCallback(() => {
    const d = defaultRebuildDateRange();
    setRebuildDateFrom(d.from);
    setRebuildDateTo(d.to);
    setRebuildFullLog(false);
    setRebuildPin('');
    setRebuildWizardStep('dates');
    setRebuildWizardOpen(true);
  }, []);

  const executeRebuildAllRecovery = useCallback(
    async (createdAtBetween: { startIso: string; endIso: string } | null) => {
      if (!canRebuildRecovery || rebuildingAllRecovery) return;
      setRebuildWizardOpen(false);
      setRebuildingAllRecovery(true);
      setRebuildAllProgress({ processed: 0, total: 0 });
      setRecoveryActionNotice(null);
      try {
        const summary = await rebuildInspectionRecoveryForAllReports({
          client,
          department,
          batchSize: 500,
          createdAtBetween,
          onProgress: (processed, total) => {
            setRebuildAllProgress({ processed, total });
          },
        });
        const errPart =
          summary.errors.length > 0
            ? ` — تنبيه: تعذر معالجة ${summary.errors.length} تقرير (تفاصيل في وحدة التحكم).`
            : '';
        setRecoveryActionNotice(
          `تمت إعادة الاحتساب: عُالج ${summary.processed} تقرير، صفوف مدرجة بالتعويض ${summary.insertedRows}، تخطي بدون عدة ${summary.skippedNoToolkit}.${errPart}`,
        );
        await loadRecoveryRows();
        await loadRecoveryActions();
        await loadDeficits();
        if (summary.errors.length > 0) {
          console.warn('rebuildInspectionRecovery partial errors', summary.errors);
        }
      } catch (e) {
        console.error('executeRebuildAllRecovery', e);
        setRecoveryActionNotice('تعذر إعادة احتساب السجل. تحقق من الصلاحيات أو الشبكة.');
      } finally {
        setRebuildingAllRecovery(false);
        setRebuildAllProgress(null);
      }
    },
    [
      canRebuildRecovery,
      client,
      department,
      loadDeficits,
      loadRecoveryActions,
      loadRecoveryRows,
      rebuildingAllRecovery,
    ],
  );

  const onRebuildWizardContinueToPin = useCallback(() => {
    if (rebuildFullLog) {
      setRebuildWizardStep('pin');
      setRebuildPin('');
      return;
    }
    if (!rebuildDateFrom.trim() || !rebuildDateTo.trim()) {
      window.alert('يرجى تحديد تاريخي البداية والنهاية، أو تفعيل «كامل السجل».');
      return;
    }
    if (rebuildDateFrom > rebuildDateTo) {
      window.alert('تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية.');
      return;
    }
    setRebuildWizardStep('pin');
    setRebuildPin('');
  }, [rebuildDateFrom, rebuildDateTo, rebuildFullLog]);

  const onRebuildWizardPinNext = useCallback(() => {
    if (rebuildPin !== REBUILD_GUARD_PIN) {
      window.alert('رمز التأكيد غير صحيح. يجب إدخال: 0000');
      return;
    }
    setRebuildWizardStep('confirm');
  }, [rebuildPin]);

  const toggleRecoveryRowSelection = useCallback((rowId: number) => {
    setSelectedRecoveryIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const toggleSelectAllRecoveryRows = useCallback(() => {
    const scopeIds = expandedTabRecoveryRowIds;
    if (scopeIds.length === 0) {
      window.alert('افتح قائمة سائق/فني على الأقل ثم أعد المحاولة.');
      return;
    }
    setSelectedRecoveryIds((prev) => {
      const allSelected = scopeIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        scopeIds.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      scopeIds.forEach((id) => next.add(id));
      return next;
    });
  }, [expandedTabRecoveryRowIds]);

  const deleteSelectedRecoveryRows = useCallback(async () => {
    if (!canDeleteRecovery || selectedRecoveryIds.size === 0) return;
    const ids = Array.from(selectedRecoveryIds);
    const approved = window.confirm(`سيتم حذف ${ids.length} عنصر من نواقص الجرد وسجل حركاته. هل تريد المتابعة؟`);
    if (!approved) return;
    try {
      const { error: deleteActionsError } = await client.from('inspection_recovery_actions').delete().in('recovery_id', ids);
      if (deleteActionsError) throw deleteActionsError;
      const { error: deleteRecoveryError } = await client.from('inspection_recovery').delete().in('id', ids);
      if (deleteRecoveryError) throw deleteRecoveryError;
      setSelectedRecoveryIds(new Set());
      setRecoverySelectionMode(false);
      await Promise.all([loadRecoveryRows(), loadRecoveryActions()]);
      setRecoveryActionNotice(`تم حذف ${ids.length} عنصر من القائمة بنجاح.`);
    } catch (e) {
      console.error('deleteSelectedRecoveryRows failed', e);
      setRecoveryActionNotice('تعذر حذف العناصر المحددة حالياً.');
    }
  }, [canDeleteRecovery, client, loadRecoveryActions, loadRecoveryRows, selectedRecoveryIds]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {!isPageVariant && (
            <motion.button
              type="button"
              aria-label="إغلاق"
              className="fixed inset-0 z-[140] bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
          )}
          <motion.aside
            role={isPageVariant ? 'region' : 'dialog'}
            aria-modal={isPageVariant ? undefined : 'true'}
            aria-labelledby="inspection-intel-title"
            className={cn(
              isPageVariant
                ? 'relative z-0 w-full mx-auto rounded-2xl border border-stone-200/80 dark:border-stone-700/80 shadow-xl h-[calc(100vh-7rem)] min-h-[720px]'
                : 'fixed top-0 right-0 z-[141] h-full w-full max-w-xl shadow-2xl border-l border-stone-200/80 dark:border-stone-700/80',
              'bg-white/90 dark:bg-stone-950/95 backdrop-blur-xl',
              'flex flex-col overflow-hidden',
            )}
            initial={isPageVariant ? { opacity: 0, y: 8 } : { x: '100%' }}
            animate={isPageVariant ? { opacity: 1, y: 0 } : { x: 0 }}
            exit={isPageVariant ? { opacity: 0, y: 8 } : { x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-stone-200/80 dark:border-stone-700/80">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg">
                  <Brain className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 id="inspection-intel-title" className="text-sm font-black text-stone-900 dark:text-stone-100 truncate">
                    Inspection Intelligence
                  </h2>
                  <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400 truncate">
                    مركز تحليل الجرد الذكي
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300"
                  title="تحديث"
                >
                  <RefreshCw className={cn('h-5 w-5', loading && 'animate-spin')} />
                </button>
                {!isPageVariant && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300"
                    aria-label="إغلاق"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </header>

            <div className="shrink-0 px-4 py-2 border-b border-stone-200/60 dark:border-stone-800">
              <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400 mb-1.5">القسم (مساحة العمل الحالية)</p>
              <div
                className={cn(
                  'flex items-center justify-center rounded-xl px-3 py-2.5 text-xs font-black border',
                  department === 'installation'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                    : 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-200',
                )}
              >
                {department === 'installation' ? 'تركيب — بيانات معزولة' : 'تجهيز — بيانات معزولة'}
              </div>
              <p className="text-[9px] text-stone-400 dark:text-stone-500 mt-1.5 leading-relaxed">
                لا يمكن عرض أو جلب بيانات القسم الآخر من هذه الصفحة؛ يُفتح الذكاء حسب القسم الذي تعمل منه.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {loading && !analytics && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-stone-500">
                  <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
                  <p className="text-sm font-bold">جاري تحليل البيانات…</p>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-800 dark:text-red-200">
                  {error}
                </div>
              )}

              {analytics && (
                <>
                  <div className="flex items-center gap-2 p-1 rounded-xl bg-stone-100 dark:bg-stone-800">
                    <button
                      type="button"
                      onClick={() => setIntelTab('overview')}
                      className={cn(
                        'flex-1 rounded-lg px-3 py-2 text-[11px] font-black',
                        intelTab === 'overview'
                          ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100'
                          : 'text-stone-500 dark:text-stone-300',
                      )}
                    >
                      لوحة الذكاء
                    </button>
                    <button
                      type="button"
                      onClick={() => setIntelTab('recovery')}
                      className={cn(
                        'flex-1 rounded-lg px-3 py-2 text-[11px] font-black',
                        intelTab === 'recovery'
                          ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100'
                          : 'text-stone-500 dark:text-stone-300',
                      )}
                    >
                      نواقص الجرد
                    </button>
                  </div>

                  {intelTab === 'overview' && (
                  <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-stone-50/80 dark:bg-stone-900/50 p-3">
                      <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400">التزام</p>
                      <p className="text-2xl font-black text-stone-900 dark:text-stone-50">{analytics.summary.complianceRate}%</p>
                    </div>
                    <div className="rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-stone-50/80 dark:bg-stone-900/50 p-3">
                      <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400">متوسط التأخير</p>
                      <p className="text-2xl font-black text-stone-900 dark:text-stone-50">
                        {analytics.summary.averageDelayDays != null ? analytics.summary.averageDelayDays : '—'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-stone-50/80 dark:bg-stone-900/50 p-3">
                      <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400">جرد بالدورة</p>
                      <p className="text-lg font-black text-stone-900 dark:text-stone-50">
                        {analytics.summary.completedInCycleEstimate}/{analytics.summary.expectedInCycleEstimate}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-stone-50/80 dark:bg-stone-900/50 p-3">
                      <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400">استحق اليوم</p>
                      <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{analytics.summary.dueTodayCount}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black border',
                        statusStyle('critical'),
                      )}
                    >
                      حرج {analytics.summary.criticalCount}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black border',
                        statusStyle('warning'),
                      )}
                    >
                      تنبيه {analytics.summary.warningCount}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black border',
                        statusStyle('healthy'),
                      )}
                    >
                      سليم {analytics.summary.healthyCount}
                    </span>
                  </div>

                  {(analytics.summary.criticalCount > 0 || analytics.summary.dueTodayCount > 0) && (
                    <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 dark:bg-amber-950/30 px-3 py-2.5 space-y-1">
                      <p className="text-xs font-black text-amber-900 dark:text-amber-100 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        تنبيهات ذكية
                      </p>
                      <ul className="text-[11px] font-semibold text-amber-900/90 dark:text-amber-100/90 space-y-0.5 list-disc list-inside">
                        {analytics.summary.dueTodayCount > 0 && (
                          <li>{analytics.summary.dueTodayCount} مركبة يُنصح بجردها اليوم</li>
                        )}
                        {analytics.summary.criticalCount > 0 && (
                          <li>{analytics.summary.criticalCount} مركبة متأخرة عن دورة الجرد</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {deficitRows.length > 0 && (
                    <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 dark:bg-rose-950/30 px-3 py-2.5">
                      <p className="text-xs font-black text-rose-800 dark:text-rose-200">
                        تنبيه نواقص العُدّة: {deficitRows.length} تقرير يحتاج تعويض/متابعة.
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] font-black text-stone-500 dark:text-stone-400 mb-2">توزيع التأخير (أيام الأسبوع)</p>
                    <div className="flex items-end justify-between gap-1 h-28 px-1">
                      {WEEKDAY_AR.map((label, idx) => {
                        const v = analytics.heatmap[idx] ?? 0;
                        const px = Math.round(Math.max(6, (v / heatMax) * 72));
                        return (
                          <div key={label} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0 h-full">
                            <div
                              className="w-full max-w-[28px] mx-auto rounded-t-md bg-gradient-to-t from-violet-600/80 to-fuchsia-500/70 dark:from-violet-500/60 dark:to-fuchsia-400/50"
                              style={{ height: `${px}px` }}
                              title={`${label}: ${v}`}
                            />
                            <span className="text-[8px] font-bold text-stone-500 dark:text-stone-400 truncate w-full text-center">
                              {label.slice(0, 3)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-stone-200/80 dark:border-stone-700/80 p-3 space-y-3 bg-stone-50/80 dark:bg-stone-900/40">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-stone-800 dark:text-stone-100">فرق آخر جرد (المطلوب مقابل المتوفر)</p>
                      <button
                        type="button"
                        onClick={() => void loadDeficits()}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-600"
                      >
                        تحديث
                      </button>
                    </div>
                    {deficitLoading ? (
                      <div className="text-center py-4 text-xs font-bold text-stone-500">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                        جاري حساب النواقص...
                      </div>
                    ) : deficitRows.length === 0 ? (
                      <p className="text-xs text-stone-500 dark:text-stone-400">لا توجد نواقص عُدّة أو عناصر فحص غير سليمة حالياً.</p>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {deficitRows.map((row) => {
                          const comp = compensationsByReport.get(row.reportId);
                          const status = comp?.status ?? 'pending';
                          return (
                            <div key={row.reportId} className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white/80 dark:bg-stone-950/50 p-2.5 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-black truncate">{row.plateNumber}</p>
                                  <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate">{staffLabel}: {row.responsibleName}</p>
                                </div>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                  نقص {row.totalDeficit} {row.nonCompliantItems.length > 0 ? `· فحص غير سليم ${row.nonCompliantItems.length}` : ''}
                                </span>
                              </div>
                              <div className="text-[10px] text-stone-600 dark:text-stone-300 leading-5">
                                {row.items.slice(0, 3).map((item) => (
                                  <div key={`${row.reportId}-${item.itemId}`}>
                                    - {formatRecoveryItemDisplay(item.itemName)}: مطلوب {item.required} / متوفر {item.available} / نقص{' '}
                                    {item.deficit}
                                  </div>
                                ))}
                                {row.items.length > 3 && <div>... +{row.items.length - 3} عناصر أخرى</div>}
                                {row.nonCompliantItems.length > 0 && (
                                  <div className="mt-1 text-amber-700 dark:text-amber-300">
                                    عناصر الفحص غير السليمة: {row.nonCompliantItems.slice(0, 3).join('، ')}
                                    {row.nonCompliantItems.length > 3 ? ` ... +${row.nonCompliantItems.length - 3}` : ''}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <label className="text-[10px] font-bold text-stone-500">تاريخ التعويض:</label>
                                <input
                                  type="date"
                                  value={dueDatesByReport[row.reportId] ?? ''}
                                  onChange={(e) =>
                                    setDueDatesByReport((prev) => ({ ...prev, [row.reportId]: e.target.value }))
                                  }
                                  className="rounded-lg border border-stone-300 dark:border-stone-600 px-2 py-1 text-[10px] bg-white dark:bg-stone-900"
                                />
                                <span
                                  className={cn(
                                    'text-[10px] font-black px-2 py-1 rounded-md',
                                    status === 'compensated'
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                      : status === 'not_compensated'
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                  )}
                                >
                                  {status === 'compensated' ? 'تم التعويض' : status === 'not_compensated' ? 'لم يتم التعويض' : 'بانتظار التعويض'}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={savingCompensationId === row.reportId}
                                  onClick={() => void updateCompensationStatus(row, 'compensated')}
                                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-2 py-1.5 disabled:opacity-60"
                                >
                                  <CalendarCheck2 className="h-3.5 w-3.5" />
                                  تم التعويض
                                </button>
                                <button
                                  type="button"
                                  disabled={savingCompensationId === row.reportId}
                                  onClick={() => void updateCompensationStatus(row, 'not_compensated')}
                                  className="flex-1 rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-[10px] font-black px-2 py-1.5 disabled:opacity-60"
                                >
                                  لم يتم التعويض
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-stone-500 dark:text-stone-400">فلترة</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          ['all', 'الكل'],
                          ['overdue', 'متأخر'],
                          ['today', 'اليوم'],
                          ['this_week', 'هذا الأسبوع'],
                          ['by_responsible', 'بحث مسؤول'],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setFilter(key as IntelligenceFilterKey)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[10px] font-black transition-all border',
                            filter === key
                              ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-transparent'
                              : 'bg-stone-100/80 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 border-stone-200/80 dark:border-stone-700',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="search"
                      placeholder={`بحث لوحة / ${staffLabel}…`}
                      value={responsibleQuery}
                      onChange={(e) => setResponsibleQuery(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white/80 dark:bg-stone-900/60 px-3 py-2 text-sm font-semibold text-stone-900 dark:text-stone-100"
                    />
                  </div>

                  <div className="space-y-3 pb-8">
                    {filteredInsights.map((row) => (
                      <div
                        key={row.vehicleId}
                        className={cn(
                          'rounded-2xl border p-3 space-y-2 shadow-sm',
                          statusStyle(row.status),
                          row.delayPatternHint && 'ring-2 ring-orange-400/60',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-stone-900 dark:text-stone-50 truncate">{row.plateNumber}</p>
                            <p className="text-[10px] font-bold text-stone-600 dark:text-stone-300">
                              {staffLabel}: {row.responsibleName}
                            </p>
                            <p className="text-[10px] font-mono text-stone-500 dark:text-stone-400 mt-0.5">
                              {statusLabel(row.status)} · درجة {row.grade} · {row.score}/100
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] font-black px-2 py-0.5 rounded-md bg-white/50 dark:bg-black/20">
                            #{row.vehicleId}
                          </span>
                        </div>
                        {row.delayPatternHint && (
                          <p className="text-[10px] font-bold text-orange-800 dark:text-orange-200 flex items-start gap-1">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            نمط تأخير متكرر في آخر التقارير ({row.recentDelayedReportCount})
                          </p>
                        )}
                        <p className="text-[10px] font-semibold text-stone-600 dark:text-stone-300 leading-relaxed">
                          آخر جرد: {row.lastInspectionDate ?? '—'} · التالي: {row.nextInspectionDate ?? '—'}
                          {row.daysLeft != null && ` · متبقي ${row.daysLeft} يوم`}
                          {row.delayDays != null && ` · تأخير ${row.delayDays} يوم`}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              onStartInspection(row.vehicleId);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-[10px] font-black"
                          >
                            <Play className="h-3.5 w-3.5" />
                            ابدأ الجرد
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onOpenHistory(row.vehicleId);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-stone-300 dark:border-stone-600 bg-white/60 dark:bg-stone-900/40 px-3 py-1.5 text-[10px] font-black text-stone-800 dark:text-stone-100"
                          >
                            <History className="h-3.5 w-3.5" />
                            السجل
                          </button>
                          <button
                            type="button"
                            onClick={() => setQrVehicleId(qrVehicleId === row.vehicleId ? null : row.vehicleId)}
                            className="inline-flex items-center gap-1 rounded-xl border border-stone-300 dark:border-stone-600 bg-white/60 dark:bg-stone-900/40 px-3 py-1.5 text-[10px] font-black text-stone-800 dark:text-stone-100"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            QR
                          </button>
                        </div>
                        {qrVehicleId === row.vehicleId && (
                          <div className="flex flex-col items-center gap-2 pt-2 bg-white/70 dark:bg-black/20 rounded-xl p-3">
                            <QRCode
                              value={buildInspectionDeepLink(department, row.vehicleId)}
                              size={140}
                              level="M"
                              className="rounded-lg"
                            />
                            <p className="text-[9px] font-bold text-stone-500 dark:text-stone-400 text-center max-w-[220px] leading-snug">
                              الرابط ثابت لهذه المركبة والقسم؛ يصلح للطباعة على المركبة عند استخدام نطاق إنتاج ثابت
                              {import.meta.env.VITE_INSPECTION_QR_BASE_URL ? ' (مفعّل VITE_INSPECTION_QR_BASE_URL).' : '.'}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                    {filteredInsights.length === 0 && (
                      <p className="text-center text-sm font-bold text-stone-400 py-8">لا توجد نتائج للفلتر الحالي</p>
                    )}
                  </div>
                  </>
                  )}

                  {intelTab === 'recovery' && (
                    <div className="space-y-3 pb-8">
                      {recoveryActionNotice && (
                        <div className="rounded-2xl border border-violet-400/35 bg-violet-500/10 dark:bg-violet-950/30 px-3 py-2.5">
                          <p className="text-xs font-black text-violet-800 dark:text-violet-200">{recoveryActionNotice}</p>
                        </div>
                      )}
                      {pendingReminderCount > 0 && (
                        <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 dark:bg-amber-950/30 px-3 py-2.5">
                          <p className="text-xs font-black text-amber-800 dark:text-amber-200">
                            تنبيه متابعة: {pendingReminderCount} حالة مجدولة حان موعدها وعادت لحالة انتظار.
                          </p>
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-xs font-black text-stone-700 dark:text-stone-200">نواقص ما بعد الجرد</p>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            <span className="text-[10px] font-black px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                              المعوّض: {compensatedTotalCount}
                            </span>
                            {canRebuildRecovery && (
                              <button
                                type="button"
                                disabled={rebuildingAllRecovery || backfillingRecovery}
                                onClick={openRebuildWizard}
                                className="text-[10px] font-bold px-2 py-1 rounded-lg border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 disabled:opacity-60"
                              >
                                {rebuildingAllRecovery
                                  ? 'جاري إعادة الاحتساب...'
                                  : 'إعادة احتساب السجل من التقارير'}
                              </button>
                            )}
                            {derivedRecoveryRows.length > 0 && (
                              <button
                                type="button"
                                disabled={backfillingRecovery || rebuildingAllRecovery}
                                onClick={() => {
                                  const approved = window.confirm(
                                    `سيتم تثبيت ${derivedRecoveryRows.length} نقص تاريخي داخل سجل التعويض. هل تريد المتابعة؟`,
                                  );
                                  if (!approved) return;
                                  void backfillDerivedRecoveryRows();
                                }}
                                className="text-[10px] font-bold px-2 py-1 rounded-lg border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 disabled:opacity-60"
                              >
                                {backfillingRecovery ? 'جاري الترحيل...' : `تثبيت التاريخي (${derivedRecoveryRows.length})`}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={rebuildingAllRecovery}
                              onClick={() => {
                                void loadRecoveryRows();
                                void loadRecoveryActions();
                                void loadRecoveryReasons();
                                void loadInventoryBarcodeMap();
                              }}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-600 disabled:opacity-60"
                            >
                              تحديث
                            </button>
                          </div>
                        </div>
                        {rebuildingAllRecovery && rebuildAllProgress && rebuildAllProgress.total > 0 && (
                          <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400">
                            جاري المعالجة: {rebuildAllProgress.processed} / {rebuildAllProgress.total} تقرير
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 p-1 rounded-xl bg-stone-100 dark:bg-stone-800">
                        <button
                          type="button"
                          onClick={() => setRecoverySubTab('worklist')}
                          className={cn(
                            'flex-1 rounded-lg px-3 py-2 text-[11px] font-black',
                            recoverySubTab === 'worklist'
                              ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100'
                              : 'text-stone-500 dark:text-stone-300',
                          )}
                        >
                          قائمة العمل
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecoverySubTab('archive')}
                          className={cn(
                            'flex-1 rounded-lg px-3 py-2 text-[11px] font-black',
                            recoverySubTab === 'archive'
                              ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100'
                              : 'text-stone-500 dark:text-stone-300',
                          )}
                        >
                          الأرشيف / الحركات
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecoverySubTab('reasons')}
                          className={cn(
                            'flex-1 rounded-lg px-3 py-2 text-[11px] font-black',
                            recoverySubTab === 'reasons'
                              ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100'
                              : 'text-stone-500 dark:text-stone-300',
                          )}
                        >
                          أسباب التعويض
                        </button>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          {recoverySubTab !== 'reasons' && (
                            <>
                          <button
                            type="button"
                            onClick={() => {
                              setRecoverySelectionMode((prev) => !prev);
                              setSelectedRecoveryIds(new Set());
                            }}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-600"
                          >
                            {recoverySelectionMode ? 'إلغاء التحديد' : 'تحديد'}
                          </button>
                          {recoverySelectionMode && (
                            <>
                              <button
                                type="button"
                                onClick={toggleSelectAllRecoveryRows}
                                className="text-[10px] font-bold px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-600"
                                title="يحدد صفوف القوائم المفتوحة فقط؛ يمكن الجمع بين أكثر من سائق/فني عند فتح عدة قوائم."
                              >
                                تحديد الكل — القوائم المفتوحة (
                                {recoverySubTab === 'worklist' ? 'قائمة العمل' : 'الأرشيف'})
                              </button>
                              {selectedRecoveryCountInCurrentTab > 0 && (
                                <span className="text-[10px] font-bold text-violet-700 dark:text-violet-300">
                                  محدد في {recoverySubTab === 'worklist' ? 'قائمة العمل' : 'الأرشيف'}:{' '}
                                  {selectedRecoveryCountInCurrentTab} — التصدير يشمل المحدد فقط في هذا التبويب
                                </span>
                              )}
                            </>
                          )}
                          {canDeleteRecovery && recoverySelectionMode && (
                            <button
                              type="button"
                              disabled={selectedRecoveryCount === 0}
                              onClick={() => void deleteSelectedRecoveryRows()}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 disabled:opacity-60"
                            >
                              حذف المحدد ({selectedRecoveryCount})
                            </button>
                          )}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          {recoverySubTab === 'reasons' ? (
                            <button
                              type="button"
                              disabled={exportingArchivePdf || filteredRecoveryReasons.length === 0}
                              onClick={() => void exportRecoveryReasonsPdf()}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-3 py-2 text-[11px] font-black text-stone-800 dark:text-stone-100 disabled:opacity-50"
                            >
                              {exportingArchivePdf ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                              تصدير PDF (أسباب التعويض)
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={
                                exportingArchivePdf ||
                                (recoverySubTab === 'worklist'
                                  ? worklistCards.length === 0
                                  : archiveCards.length === 0 && recoveryActions.length === 0)
                              }
                              onClick={() => void exportRecoveryTabToPdf(recoverySubTab)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-3 py-2 text-[11px] font-black text-stone-800 dark:text-stone-100 disabled:opacity-50"
                            >
                              {exportingArchivePdf ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                              تصدير PDF ({recoverySubTab === 'worklist' ? 'قائمة العمل' : 'الأرشيف'})
                            </button>
                          )}
                        </div>
                      </div>
                      {recoveryLoading ? (
                        <div className="text-center py-8 text-xs font-bold text-stone-500">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                          جاري تحميل نواقص الجرد...
                        </div>
                      ) : recoverySubTab === 'worklist' && worklistCards.length === 0 ? (
                        <p className="text-xs text-stone-500 dark:text-stone-400">لا توجد نواقص جرد مسجلة حالياً.</p>
                      ) : recoverySubTab === 'worklist' ? (
                        <div className="space-y-2">
                          {worklistByStaff.map((staffGroup) => {
                            const rowCount = staffGroup.cards.reduce((acc, c) => acc + c.rows.length, 0);
                            const workOpen = expandedRecoveryStaffKeys.has(staffGroup.staffKey);
                            return (
                              <div
                                key={staffGroup.staffKey}
                                className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-900/40 overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleRecoveryStaff(staffGroup.staffKey)}
                                  className="flex w-full items-center justify-between gap-2 px-3 py-3 text-right hover:bg-stone-100/80 dark:hover:bg-stone-800/50 transition-colors"
                                >
                                  <ChevronDown
                                    className={cn(
                                      'h-4 w-4 shrink-0 text-stone-500 transition-transform',
                                      workOpen && 'rotate-180',
                                    )}
                                  />
                                  <div className="flex min-w-0 flex-1 flex-col items-end gap-0.5">
                                    <span className="text-sm font-black text-stone-900 dark:text-stone-100 truncate">
                                      {staffGroup.userLabel}
                                    </span>
                                    <span className="text-[10px] font-bold text-stone-500">
                                      {rowCount} بند · {staffGroup.cards.length} مركبة
                                    </span>
                                  </div>
                                </button>
                                {workOpen && (
                                  <div className="space-y-3 border-t border-stone-200 dark:border-stone-700 p-3">
                                    {staffGroup.cards.map((card) => (
                                      <div key={card.key} className="space-y-2">
                                        <p className="text-[11px] font-black text-stone-700 dark:text-stone-200 border-b border-stone-100 dark:border-stone-700 pb-1">
                                          {card.vehicleLabel}
                                        </p>
                                        <div className="space-y-2">
                                {card.rows.map((row) => {
                                  const effectiveStatus = getEffectiveRecoveryStatus(row);
                                  const isEditorOpen = showNotCompensatedEditor[row.id] === true;
                                  const draftDate = recoveryScheduleDrafts[row.id] ?? '';
                                  const draftReason = recoveryReasonDrafts[row.id] ?? '';
                                  const reasonDraft =
                                    recoveryReasonDetailDrafts[row.id] ?? buildSuggestedCompensationReasonDraft(row);
                                  const remainingMissing = getRemainingMissingQty(row);
                                  const draftCompensatedRaw = Number(recoveryCompensatedDrafts[row.id] ?? remainingMissing);
                                  const draftCompensated = Number.isFinite(draftCompensatedRaw)
                                    ? Math.max(1, Math.min(remainingMissing, Math.floor(draftCompensatedRaw)))
                                    : 1;
                                  const requiresReasonNow = draftCompensated < remainingMissing;
                                  const requiresCustomerFields = reasonDraft.category === 'customer_compensation';
                                  return (
                                    <div key={row.id} className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white/80 dark:bg-stone-950/40 p-2 space-y-2">
                                      {recoverySelectionMode && row.id > 0 && (
                                        <label className="inline-flex items-center gap-1 text-[10px] font-bold text-stone-500">
                                          <input
                                            type="checkbox"
                                            checked={selectedRecoveryIds.has(row.id)}
                                            onChange={() => toggleRecoveryRowSelection(row.id)}
                                          />
                                          تحديد
                                        </label>
                                      )}
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-[11px] font-bold truncate" title={formatRecoveryItemDisplay(row.item_name)}>
                                          {formatRecoveryItemDisplay(row.item_name)}
                                        </p>
                                        <span
                                          className={cn(
                                            'text-[10px] font-black px-2 py-1 rounded-md shrink-0',
                                            effectiveStatus === 'resolved'
                                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                              : effectiveStatus === 'scheduled'
                                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
                                          )}
                                        >
                                          {effectiveStatus === 'resolved' ? 'resolved' : effectiveStatus === 'scheduled' ? 'scheduled' : 'pending'}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-stone-600 dark:text-stone-300">
                                        مطلوب {row.required_qty} / موجود {row.actual_qty} / نقص {row.missing_qty}
                                      </p>
                                      {(row.baseline_actual_qty != null || row.is_repeat_shortage || Number(row.delta_since_last_compensation ?? 0) > 0) && (
                                        <p className="text-[10px] text-violet-700 dark:text-violet-300">
                                          مقارنة مع آخر جرد بعد التعويض: أساس {Number(row.baseline_actual_qty ?? 0)} · فرق النقص{' '}
                                          {Number(row.delta_since_last_compensation ?? 0)}
                                          {row.is_repeat_shortage ? ' · نقص متكرر' : ''}
                                        </p>
                                      )}
                                      {reasonDraft.details.trim() && (
                                        <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                                          مقترح سبب: {reasonDraft.details}
                                        </p>
                                      )}
                                      <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400">
                                        تم تعويض {Number(row.compensated_qty ?? 0)} من {row.missing_qty} · المتبقي {remainingMissing}
                                      </p>
                                      {row.source_type === 'derived' && (
                                        <p className="text-[10px] font-bold text-violet-700 dark:text-violet-300">
                                          مسترجع من جرد سابق (غير محفوظ مسبقاً في سجل التعويض)
                                        </p>
                                      )}
                                      {isEditorOpen && (
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                          <input
                                            type="text"
                                            value={draftReason}
                                            onChange={(e) =>
                                              setRecoveryReasonDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))
                                            }
                                            placeholder="سبب عدم التعويض"
                                            className="rounded-lg border border-stone-300 dark:border-stone-600 px-2 py-1 text-[10px] bg-white dark:bg-stone-900"
                                          />
                                          <input
                                            type="date"
                                            value={draftDate}
                                            onChange={(e) =>
                                              setRecoveryScheduleDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))
                                            }
                                            className="rounded-lg border border-stone-300 dark:border-stone-600 px-2 py-1 text-[10px] bg-white dark:bg-stone-900"
                                          />
                                        </div>
                                      )}
                                      <div className="flex flex-wrap gap-2">
                                        <input
                                          type="number"
                                          min={1}
                                          max={Math.max(1, remainingMissing)}
                                          value={recoveryCompensatedDrafts[row.id] ?? String(Math.max(1, remainingMissing))}
                                          onChange={(e) =>
                                            setRecoveryCompensatedDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))
                                          }
                                          className="w-24 rounded-lg border border-stone-300 dark:border-stone-600 px-2 py-1.5 text-[10px] bg-white dark:bg-stone-900"
                                          title="كمية التعويض"
                                        />
                                        <select
                                          value={reasonDraft.category}
                                          onChange={(e) =>
                                            setRecoveryReasonDetailDrafts((prev) => ({
                                              ...prev,
                                              [row.id]: { ...reasonDraft, category: e.target.value as RecoveryReasonCategory | '' },
                                            }))
                                          }
                                          className="rounded-lg border border-stone-300 dark:border-stone-600 px-2 py-1.5 text-[10px] bg-white dark:bg-stone-900"
                                          title="سبب التعويض"
                                        >
                                          <option value="">سبب التعويض{requiresReasonNow ? ' (إلزامي)' : ' (اختياري)'}</option>
                                          {Object.entries(recoveryReasonCategoryLabel).map(([value, label]) => (
                                            <option key={`${row.id}-${value}`} value={value}>
                                              {label}
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          type="button"
                                          disabled={savingRecoveryId === row.id || remainingMissing < 1}
                                          onClick={() =>
                                            void updateRecoveryStatus(
                                              row,
                                              draftCompensated >= remainingMissing ? 'resolved' : 'pending',
                                              {
                                                reason:
                                                  draftCompensated >= remainingMissing
                                                    ? `تم التعويض الكامل (${Number(row.compensated_qty ?? 0) + draftCompensated}/${row.missing_qty})`
                                                    : `تم التعويض الجزئي (${Number(row.compensated_qty ?? 0) + draftCompensated}/${row.missing_qty})`,
                                                compensatedQty: draftCompensated,
                                                compensationReasonDraft: reasonDraft,
                                                driverName: staffGroup.userLabel,
                                              },
                                            )
                                          }
                                          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-2 py-1.5 disabled:opacity-60"
                                        >
                                          تم التعويض
                                        </button>
                                        <button
                                          type="button"
                                          disabled={savingRecoveryId === row.id}
                                          onClick={() =>
                                            setShowNotCompensatedEditor((prev) => ({ ...prev, [row.id]: !prev[row.id] }))
                                          }
                                          className="rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-[10px] font-black px-2 py-1.5 disabled:opacity-60"
                                        >
                                          لم يتم التعويض
                                        </button>
                                        <button
                                          type="button"
                                          disabled={savingRecoveryId === row.id}
                                          onClick={() =>
                                            void updateRecoveryStatus(row, 'scheduled', {
                                              reason: draftReason || row.reason || 'تعويض لاحق',
                                              scheduledDate: draftDate || row.scheduled_date || todayIso,
                                            })
                                          }
                                          className="rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-[10px] font-black px-2 py-1.5 disabled:opacity-60"
                                        >
                                          تعويض لاحق
                                        </button>
                                        {isEditorOpen && (
                                          <button
                                            type="button"
                                            disabled={savingRecoveryId === row.id || !draftDate}
                                            onClick={() =>
                                              void updateRecoveryStatus(row, 'scheduled', {
                                                reason: draftReason,
                                                scheduledDate: draftDate,
                                              })
                                            }
                                            className="rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-[10px] font-black px-2 py-1.5 disabled:opacity-60"
                                          >
                                            حفظ الجدولة
                                          </button>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        <input
                                          type="text"
                                          value={reasonDraft.customerName}
                                          onChange={(e) =>
                                            setRecoveryReasonDetailDrafts((prev) => ({
                                              ...prev,
                                              [row.id]: { ...reasonDraft, customerName: e.target.value },
                                            }))
                                          }
                                          placeholder="اسم الزبون (عند التعويض لدى زبون)"
                                          required={requiresCustomerFields}
                                          className={cn(
                                            'rounded-lg border px-2 py-1 text-[10px] bg-white dark:bg-stone-900',
                                            requiresCustomerFields
                                              ? 'border-amber-400 dark:border-amber-600'
                                              : 'border-stone-300 dark:border-stone-600',
                                          )}
                                        />
                                        <input
                                          type="text"
                                          value={reasonDraft.invoiceNumber}
                                          onChange={(e) =>
                                            setRecoveryReasonDetailDrafts((prev) => ({
                                              ...prev,
                                              [row.id]: { ...reasonDraft, invoiceNumber: e.target.value },
                                            }))
                                          }
                                          placeholder="رقم الفاتورة"
                                          required={requiresCustomerFields}
                                          className={cn(
                                            'rounded-lg border px-2 py-1 text-[10px] bg-white dark:bg-stone-900',
                                            requiresCustomerFields
                                              ? 'border-amber-400 dark:border-amber-600'
                                              : 'border-stone-300 dark:border-stone-600',
                                          )}
                                        />
                                        <input
                                          type="text"
                                          value={reasonDraft.compensatedItemName}
                                          readOnly
                                          placeholder="العنصر المعوض"
                                          className="rounded-lg border border-stone-200 dark:border-stone-700 px-2 py-1 text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                                        />
                                        <input
                                          type="text"
                                          value={reasonDraft.compensatedItemBarcode}
                                          readOnly
                                          placeholder="باركود العنصر المعوض"
                                          className="rounded-lg border border-stone-200 dark:border-stone-700 px-2 py-1 text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                                        />
                                        <p className="sm:col-span-2 text-[10px] font-bold text-stone-500 dark:text-stone-400">
                                          اسم العنصر المعوض والباركود يتم جلبهما تلقائياً من نفس عنصر النقص ومقفّلان لتقليل الخطأ البشري.
                                        </p>
                                        <textarea
                                          value={reasonDraft.details}
                                          onChange={(e) =>
                                            setRecoveryReasonDetailDrafts((prev) => ({
                                              ...prev,
                                              [row.id]: { ...reasonDraft, details: e.target.value },
                                            }))
                                          }
                                          placeholder="تفاصيل السبب"
                                          className="sm:col-span-2 rounded-lg border border-stone-300 dark:border-stone-600 px-2 py-1 text-[10px] bg-white dark:bg-stone-900"
                                          rows={2}
                                        />
                                        {requiresCustomerFields && (
                                          <p className="sm:col-span-2 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                            عند اختيار (تعويض لدى زبون) يجب إدخال اسم الزبون ورقم الفاتورة.
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : recoverySubTab === 'reasons' ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <input
                              type="text"
                              value={reasonFilterDriver}
                              onChange={(e) => setReasonFilterDriver(e.target.value)}
                              placeholder={`فلترة حسب ${staffLabel}`}
                              className="rounded-lg border border-stone-300 dark:border-stone-600 px-2 py-1.5 text-[10px] bg-white dark:bg-stone-900"
                            />
                            <input
                              type="text"
                              value={reasonFilterItem}
                              onChange={(e) => setReasonFilterItem(e.target.value)}
                              placeholder="فلترة حسب العنصر"
                              className="rounded-lg border border-stone-300 dark:border-stone-600 px-2 py-1.5 text-[10px] bg-white dark:bg-stone-900"
                            />
                            <select
                              value={reasonFilterCategory}
                              onChange={(e) => setReasonFilterCategory(e.target.value as RecoveryReasonCategory | 'all')}
                              className="rounded-lg border border-stone-300 dark:border-stone-600 px-2 py-1.5 text-[10px] bg-white dark:bg-stone-900"
                            >
                              <option value="all">كل الأسباب</option>
                              {Object.entries(recoveryReasonCategoryLabel).map(([value, label]) => (
                                <option key={`reason-filter-${value}`} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="date"
                                value={reasonDateFrom}
                                onChange={(e) => setReasonDateFrom(e.target.value)}
                                className="rounded-lg border border-stone-300 dark:border-stone-600 px-2 py-1.5 text-[10px] bg-white dark:bg-stone-900"
                              />
                              <input
                                type="date"
                                value={reasonDateTo}
                                onChange={(e) => setReasonDateTo(e.target.value)}
                                className="rounded-lg border border-stone-300 dark:border-stone-600 px-2 py-1.5 text-[10px] bg-white dark:bg-stone-900"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/80 dark:bg-stone-900/50 p-3">
                              <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400">إجمالي التعويض</p>
                              <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{recoveryReasonMetrics.compensatedQty}</p>
                            </div>
                            <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/80 dark:bg-stone-900/50 p-3">
                              <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400">نسبة التعويض</p>
                              <p className="text-lg font-black text-violet-700 dark:text-violet-300">{recoveryReasonMetrics.compensationRate}%</p>
                            </div>
                          </div>

                          {recoveryReasonsLoading ? (
                            <div className="text-center py-8 text-xs font-bold text-stone-500">
                              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                              جاري تحميل الأسباب...
                            </div>
                          ) : filteredRecoveryReasons.length === 0 ? (
                            <p className="text-xs text-stone-500 dark:text-stone-400">لا توجد أسباب مطابقة للفلاتر الحالية.</p>
                          ) : (
                            <div className="space-y-2 max-h-[480px] overflow-y-auto">
                              {filteredRecoveryReasons.map((reason) => (
                                <div
                                  key={`reason-row-${reason.id}`}
                                  className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white/80 dark:bg-stone-950/40 p-2.5 space-y-1.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] font-black truncate">{reason.driver_name || '—'}</p>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                                      {recoveryReasonCategoryLabel[reason.reason_category] ?? reason.reason_category}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-stone-700 dark:text-stone-200">
                                    {reason.item_name} · تم تعويض {reason.compensated_qty} · متبقي {reason.remaining_qty_after_action}
                                  </p>
                                  <p className="text-[10px] text-stone-500 dark:text-stone-400">
                                    التاريخ: {String(reason.occurred_at ?? '').slice(0, 10)} · الزبون: {reason.customer_name || '—'} ·
                                    الفاتورة: {reason.invoice_number || '—'}
                                  </p>
                                  {(reason.compensated_item_name || reason.compensated_item_barcode) && (
                                    <p className="text-[10px] text-stone-500 dark:text-stone-400">
                                      العنصر المعوض: {reason.compensated_item_name || '—'} · باركود: {reason.compensated_item_barcode || '—'}
                                    </p>
                                  )}
                                  {reason.reason_details && (
                                    <p className="text-[10px] text-stone-500 dark:text-stone-400">السبب: {reason.reason_details}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(archiveCards.length === 0 && recoveryActions.length === 0) ? (
                            <p className="text-xs text-stone-500 dark:text-stone-400">لا توجد حركات مؤرشفة حالياً.</p>
                          ) : (
                            archiveByStaff.map((staffGroup) => {
                              const archRowCount = staffGroup.cards.reduce((acc, c) => acc + c.rows.length, 0);
                              const archOpen = expandedRecoveryStaffKeys.has(staffGroup.staffKey);
                              return (
                                <div
                                  key={`arch-staff-${staffGroup.staffKey}`}
                                  className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-900/40 overflow-hidden"
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleRecoveryStaff(staffGroup.staffKey)}
                                    className="flex w-full items-center justify-between gap-2 px-3 py-3 text-right hover:bg-stone-100/80 dark:hover:bg-stone-800/50 transition-colors"
                                  >
                                    <ChevronDown
                                      className={cn(
                                        'h-4 w-4 shrink-0 text-stone-500 transition-transform',
                                        archOpen && 'rotate-180',
                                      )}
                                    />
                                    <div className="flex min-w-0 flex-1 flex-col items-end gap-0.5">
                                      <span className="text-sm font-black text-stone-900 dark:text-stone-100 truncate">
                                        {staffGroup.userLabel}
                                      </span>
                                      <span className="text-[10px] font-bold text-stone-500">
                                        {archRowCount} بند · {staffGroup.cards.length} مركبة
                                      </span>
                                    </div>
                                  </button>
                                  {archOpen && (
                                    <div className="space-y-3 border-t border-stone-200 dark:border-stone-700 p-3">
                                      {staffGroup.cards.map((card) => {
                              const timeline = actionTimelineByCard.get(card.key) ?? [];
                              return (
                                <div key={`archive-${card.key}`} className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white/50 dark:bg-stone-950/30 p-3 space-y-2">
                                  <p className="text-[11px] font-black text-stone-800 dark:text-stone-100 border-b border-stone-100 dark:border-stone-700 pb-1">
                                    {card.vehicleLabel}
                                  </p>
                                  <div className="space-y-2">
                                    {card.rows.map((row) => {
                                      const effectiveStatus = getEffectiveRecoveryStatus(row);
                                      return (
                                        <div key={`arch-row-${row.id}`} className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white/80 dark:bg-stone-950/40 p-2 space-y-1.5">
                                          {recoverySelectionMode && row.id > 0 && (
                                            <label className="inline-flex items-center gap-1 text-[10px] font-bold text-stone-500">
                                              <input
                                                type="checkbox"
                                                checked={selectedRecoveryIds.has(row.id)}
                                                onChange={() => toggleRecoveryRowSelection(row.id)}
                                              />
                                              تحديد
                                            </label>
                                          )}
                                          <p className="text-[11px] font-bold truncate" title={formatRecoveryItemDisplay(row.item_name)}>
                                            {formatRecoveryItemDisplay(row.item_name)}
                                          </p>
                                          <p className="text-[10px] text-stone-600 dark:text-stone-300">
                                            مطلوب {row.required_qty} / موجود {row.actual_qty} / نقص {row.missing_qty}
                                          </p>
                                          <p className="text-[10px] font-bold text-stone-500">
                                            الحالة: {effectiveStatus} · آخر تحديث: {String(row.resolved_at ?? row.scheduled_date ?? row.created_at).slice(0, 10)}
                                          </p>
                                          {row.reason && (
                                            <p className="text-[10px] text-stone-500 dark:text-stone-400">السبب: {row.reason}</p>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="rounded-xl border border-dashed border-stone-300 dark:border-stone-600 p-2">
                                    <p className="text-[10px] font-black text-stone-600 dark:text-stone-300 mb-1">سجل الحركات</p>
                                    {recoveryActionsLoading ? (
                                      <p className="text-[10px] text-stone-400">جاري تحميل السجل...</p>
                                    ) : timeline.length === 0 ? (
                                      <p className="text-[10px] text-stone-400">لا توجد حركات مسجلة بعد.</p>
                                    ) : (
                                      <div className="space-y-1">
                                        {timeline.slice(0, 8).map((action) => (
                                          <p key={action.id} className="text-[10px] text-stone-600 dark:text-stone-300">
                                            {String(action.acted_at).slice(0, 10)} · {formatRecoveryItemDisplay(action.item_name)} ·{' '}
                                            {action.previous_status ?? '—'} ← {action.next_status}
                                            {action.reason ? ` · ${action.reason}` : ''}
                                          </p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <footer className="shrink-0 border-t border-stone-200/80 dark:border-stone-700/80 px-4 py-2 text-[9px] font-bold text-stone-400 text-center">
              دورة الجرد الافتراضية: 7 أيام · تحليل محلي بدون AI خارجي
            </footer>
          </motion.aside>

          {rebuildWizardOpen && (
            <div
              className="fixed inset-0 z-[142] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="rebuild-wizard-title"
              dir="rtl"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                aria-label="إغلاق"
                onClick={() => setRebuildWizardOpen(false)}
              />
              <div className="relative w-full max-w-md rounded-2xl border border-stone-200/80 dark:border-stone-700/80 bg-white dark:bg-stone-900 shadow-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 id="rebuild-wizard-title" className="text-sm font-black text-stone-900 dark:text-stone-100">
                      إعادة احتساب نواقص الجرد
                    </h3>
                    <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400 mt-1">
                      {rebuildWizardStep === 'dates' && 'اختر نطاق التاريخ أو كامل السجل.'}
                      {rebuildWizardStep === 'pin' && 'أدخل رمز التأكيد للمتابعة.'}
                      {rebuildWizardStep === 'confirm' && 'راجع النطاق ثم أكّد التشغيل.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRebuildWizardOpen(false)}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500"
                    aria-label="إغلاق"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {rebuildWizardStep === 'dates' && (
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-stone-700 dark:text-stone-300">
                      <input
                        type="checkbox"
                        checked={rebuildFullLog}
                        onChange={(e) => setRebuildFullLog(e.target.checked)}
                        className="rounded border-stone-300"
                      />
                      كامل السجل (جميع التقارير المحفوظة في هذا القسم)
                    </label>
                    {!rebuildFullLog && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-stone-500 mb-1">من تاريخ</label>
                          <input
                            type="date"
                            value={rebuildDateFrom}
                            onChange={(e) => setRebuildDateFrom(e.target.value)}
                            className="w-full rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-950 px-2 py-1.5 text-[11px]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-500 mb-1">إلى تاريخ</label>
                          <input
                            type="date"
                            value={rebuildDateTo}
                            onChange={(e) => setRebuildDateTo(e.target.value)}
                            className="w-full rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-950 px-2 py-1.5 text-[11px]"
                          />
                        </div>
                      </div>
                    )}
                    {rebuildFullLog && (
                      <p className="text-[10px] text-amber-800 dark:text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1.5">
                        سيتم معالجة كل التقارير حسب صلاحياتك؛ قد يستغرق ذلك وقتاً.
                      </p>
                    )}
                  </div>
                )}

                {rebuildWizardStep === 'pin' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
                      <KeyRound className="h-4 w-4 shrink-0" />
                      <span className="text-[11px] font-bold">رمز التأكيد (واجهة فقط — لا يغني عن سياسات الخادم)</span>
                    </div>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      value={rebuildPin}
                      onChange={(e) => setRebuildPin(e.target.value)}
                      placeholder="0000"
                      className="w-full rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-950 px-3 py-2 text-sm font-mono tracking-widest text-center"
                    />
                  </div>
                )}

                {rebuildWizardStep === 'confirm' && (
                  <div className="rounded-xl border border-rose-200/80 dark:border-rose-800/80 bg-rose-500/5 p-3 space-y-2">
                    <p className="text-[11px] font-bold text-stone-800 dark:text-stone-200">
                      {rebuildFullLog
                        ? 'سيتم إعادة احتساب نواقص الجرد من جميع التقارير في هذا القسم وحفظها في سجل التعويض.'
                        : `سيتم إعادة الاحتساب للتقارير التي تاريخ إنشائها بين ${rebuildDateFrom} و ${rebuildDateTo} (شامل).`}
                    </p>
                    <p className="text-[10px] text-stone-600 dark:text-stone-400">
                      لا يُحذف سجل التعويض تلقائياً بالكامل؛ تُعاد معالجة التقارير المطابقة للنطاق. تأكد من الشبكة والصلاحيات.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setRebuildWizardOpen(false)}
                    className="text-[11px] font-bold px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300"
                  >
                    إلغاء
                  </button>
                  <div className="flex gap-2">
                    {rebuildWizardStep !== 'dates' && (
                      <button
                        type="button"
                        onClick={() =>
                          setRebuildWizardStep((s) => (s === 'confirm' ? 'pin' : 'dates'))
                        }
                        className="text-[11px] font-bold px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-600"
                      >
                        رجوع
                      </button>
                    )}
                    {rebuildWizardStep === 'dates' && (
                      <button
                        type="button"
                        onClick={onRebuildWizardContinueToPin}
                        className="text-[11px] font-bold px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
                      >
                        التالي
                      </button>
                    )}
                    {rebuildWizardStep === 'pin' && (
                      <button
                        type="button"
                        onClick={onRebuildWizardPinNext}
                        className="text-[11px] font-bold px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
                      >
                        التالي
                      </button>
                    )}
                    {rebuildWizardStep === 'confirm' && (
                      <button
                        type="button"
                        disabled={rebuildingAllRecovery}
                        onClick={() =>
                          void executeRebuildAllRecovery(
                            rebuildFullLog ? null : dateInputsToCreatedAtRange(rebuildDateFrom, rebuildDateTo),
                          )
                        }
                        className="text-[11px] font-bold px-3 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
                      >
                        تأكيد وتشغيل
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
