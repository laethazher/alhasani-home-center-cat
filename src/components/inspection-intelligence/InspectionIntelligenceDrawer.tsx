import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Brain, CalendarCheck2, History, Loader2, Play, QrCode, RefreshCw, Sparkles, X } from 'lucide-react';
import QRCode from 'react-qr-code';
import type { DepartmentCode } from '../../data/department';
import { getDepartmentClient, getDepartmentTables } from '../../data/supabaseSource';
import { useInspectionIntelligence } from '../../hooks/useInspectionIntelligence';
import { buildInspectionDeepLink, type IntelligenceFilterKey } from '../../lib/inspectionIntelligence';
import { cn } from '../../lib/utils';
import { TOOL_INVENTORY_ITEMS, WEEKLY_INSPECTION_ITEMS } from '../../constants';

const WEEKDAY_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

interface DeficitItem {
  itemId: number;
  itemName: string;
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
  status: RecoveryStatus;
  scheduled_date: string | null;
  resolved_at: string | null;
  reason: string | null;
  created_at: string;
  source_type?: 'stored' | 'derived';
}

interface RecoveryGroupedCard {
  key: string;
  vehicleId: number;
  vehicleLabel: string;
  userId: string | null;
  userLabel: string;
  rows: InspectionRecoveryRow[];
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
}

export default function InspectionIntelligenceDrawer({
  open,
  onClose,
  pageDepartment,
  onStartInspection,
  onOpenHistory,
}: InspectionIntelligenceDrawerProps) {
  const [qrVehicleId, setQrVehicleId] = useState<number | null>(null);
  const [deficitRows, setDeficitRows] = useState<DeficitRow[]>([]);
  const [deficitLoading, setDeficitLoading] = useState(false);
  const [savingCompensationId, setSavingCompensationId] = useState<number | null>(null);
  const [compensationsByReport, setCompensationsByReport] = useState<Map<number, CompensationRecord>>(new Map());
  const [dueDatesByReport, setDueDatesByReport] = useState<Record<number, string>>({});
  const [intelTab, setIntelTab] = useState<'overview' | 'recovery'>('overview');
  const [recoveryRows, setRecoveryRows] = useState<InspectionRecoveryRow[]>([]);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [savingRecoveryId, setSavingRecoveryId] = useState<number | null>(null);
  const [backfillingRecovery, setBackfillingRecovery] = useState(false);
  const [recoveryActionNotice, setRecoveryActionNotice] = useState<string | null>(null);
  const [recoveryReasonDrafts, setRecoveryReasonDrafts] = useState<Record<number, string>>({});
  const [recoveryScheduleDrafts, setRecoveryScheduleDrafts] = useState<Record<number, string>>({});
  const [showNotCompensatedEditor, setShowNotCompensatedEditor] = useState<Record<number, boolean>>({});
  /** مرتبط بمساحة العمل الحالية فقط — لا تبديل إلى القسم الآخر (عزل تجهيز / تركيب). */
  const department = pageDepartment;

  useEffect(() => {
    if (open) setQrVehicleId(null);
  }, [open, pageDepartment]);

  useEffect(() => {
    if (!open) return;
    setIntelTab('overview');
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
          .select('id,item_name,required_quantity')
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

      // تحميل التقارير القديمة والجديدة على دفعات لضمان الشمول.
      const reportRows: Array<Record<string, unknown>> = [];
      const batchSize = 1000;
      const maxReports = 10000;
      for (let offset = 0; offset < maxReports; offset += batchSize) {
        const query =
          department === 'installation'
            ? client
                .from(tables.reports)
                .select('id,vehicle_id,payload,created_at')
                .order('created_at', { ascending: false })
                .range(offset, offset + batchSize - 1)
            : client
                .from(tables.reports)
                .select('id,vehicle_id,tool_values,inspection_values,created_at')
                .order('created_at', { ascending: false })
                .range(offset, offset + batchSize - 1);
        const { data, error } = await query;
        if (error) throw error;
        const chunk = (data ?? []) as Array<Record<string, unknown>>;
        reportRows.push(...chunk);
        if (chunk.length < batchSize) break;
      }

      const requiredMap = new Map<number, { name: string; required: number }>();
      const templateRows = (templatesRes.data ?? []) as Array<{ id: number; item_name: string; required_quantity: number }>;
      const sourceTemplates = templateRows.length > 0
        ? templateRows.map((t) => ({ id: Number(t.id), name: String(t.item_name ?? ''), required: Number(t.required_quantity ?? 0) }))
        : TOOL_INVENTORY_ITEMS.map((t) => ({ id: Number(t.id), name: t.name, required: Number(t.quantity ?? 0) }));
      for (const row of sourceTemplates) {
        requiredMap.set(Number(row.id), {
          name: String(row.name ?? ''),
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
          'id,inspection_id,vehicle_id,user_id,item_name,required_qty,actual_qty,missing_qty,status,scheduled_date,resolved_at,reason,created_at',
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
      for (const row of rows) {
        defaultDates[row.id] = row.scheduled_date ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        defaultReasons[row.id] = row.reason ?? '';
      }
      setRecoveryRows(rows);
      setRecoveryScheduleDrafts(defaultDates);
      setRecoveryReasonDrafts(defaultReasons);
    } catch (e) {
      console.error('loadRecoveryRows failed', e);
    } finally {
      setRecoveryLoading(false);
    }
  }, [client, department, open]);

  useEffect(() => {
    void loadRecoveryRows();
  }, [loadRecoveryRows]);

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
          item_name: item.itemName,
          required_qty: item.required,
          actual_qty: item.available,
          missing_qty: item.deficit,
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

  const derivedRecoveryRows = useMemo(
    () => mergedRecoveryRows.filter((row) => row.id < 0 || row.source_type === 'derived'),
    [mergedRecoveryRows],
  );

  const updateRecoveryStatus = useCallback(
    async (row: InspectionRecoveryRow, nextStatus: RecoveryStatus, options?: { reason?: string; scheduledDate?: string }) => {
      setSavingRecoveryId(row.id);
      try {
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
              status: nextStatus,
              action_type: 'manual',
              reason: options?.reason ?? row.reason ?? null,
              scheduled_date: nextStatus === 'scheduled' ? options?.scheduledDate ?? row.scheduled_date ?? null : null,
              resolved_at: nextStatus === 'resolved' ? new Date().toISOString() : null,
            })
            .select(
              'id,inspection_id,vehicle_id,user_id,item_name,required_qty,actual_qty,missing_qty,status,scheduled_date,resolved_at,reason,created_at',
            )
            .single();
          if (createError) throw createError;
          setRecoveryRows((prev) => [created as InspectionRecoveryRow, ...prev]);
          setShowNotCompensatedEditor((prev) => ({ ...prev, [row.id]: false }));
          return;
        }

        const payload: Record<string, unknown> = {
          status: nextStatus,
          action_type: 'manual',
          reason: options?.reason ?? row.reason ?? null,
          scheduled_date: nextStatus === 'scheduled' ? options?.scheduledDate ?? row.scheduled_date ?? null : null,
          resolved_at: nextStatus === 'resolved' ? new Date().toISOString() : null,
        };
        const { data, error } = await client
          .from('inspection_recovery')
          .update(payload)
          .eq('id', row.id)
          .select(
            'id,inspection_id,vehicle_id,user_id,item_name,required_qty,actual_qty,missing_qty,status,scheduled_date,resolved_at,reason,created_at',
          )
          .single();
        if (error) throw error;
        setRecoveryRows((prev) => prev.map((item) => (item.id === row.id ? ((data as InspectionRecoveryRow) ?? item) : item)));
        if (nextStatus !== 'scheduled') {
          setShowNotCompensatedEditor((prev) => ({ ...prev, [row.id]: false }));
        }
      } catch (e) {
        console.error('updateRecoveryStatus failed', e);
      } finally {
        setSavingRecoveryId(null);
      }
    },
    [client, department],
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
        status: 'pending' as const,
        action_type: 'auto' as const,
        reason: row.reason ?? 'تم ترحيل نقص تاريخي من جرد سابق',
      }));
      const { error } = await client.from('inspection_recovery').insert(payload);
      if (error) throw error;
      await loadRecoveryRows();
      setRecoveryActionNotice(`تم ترحيل ${payload.length} نقص تاريخي إلى سجل التعويض بنجاح.`);
    } catch (e) {
      console.error('backfillDerivedRecoveryRows failed', e);
      setRecoveryActionNotice('تعذر ترحيل النواقص التاريخية حالياً. حاول مرة أخرى.');
    } finally {
      setBackfillingRecovery(false);
    }
  }, [backfillingRecovery, client, department, derivedRecoveryRows, loadRecoveryRows]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="إغلاق"
            className="fixed inset-0 z-[140] bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspection-intel-title"
            className={cn(
              'fixed top-0 right-0 z-[141] h-full w-full max-w-xl shadow-2xl',
              'border-l border-stone-200/80 dark:border-stone-700/80',
              'bg-white/90 dark:bg-stone-950/95 backdrop-blur-xl',
              'flex flex-col overflow-hidden',
            )}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
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
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300"
                >
                  <X className="h-5 w-5" />
                </button>
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
                                  <div key={`${row.reportId}-${item.itemId}`}>- {item.itemName}: مطلوب {item.required} / متوفر {item.available} / نقص {item.deficit}</div>
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
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-stone-700 dark:text-stone-200">نواقص ما بعد الجرد</p>
                        <div className="flex items-center gap-2">
                          {derivedRecoveryRows.length > 0 && (
                            <button
                              type="button"
                              disabled={backfillingRecovery}
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
                            onClick={() => void loadRecoveryRows()}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-600"
                          >
                            تحديث
                          </button>
                        </div>
                      </div>
                      {recoveryLoading ? (
                        <div className="text-center py-8 text-xs font-bold text-stone-500">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                          جاري تحميل نواقص الجرد...
                        </div>
                      ) : recoveryCards.length === 0 ? (
                        <p className="text-xs text-stone-500 dark:text-stone-400">لا توجد نواقص جرد مسجلة حالياً.</p>
                      ) : (
                        <div className="space-y-3">
                          {recoveryCards.map((card) => (
                            <div key={card.key} className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-900/40 p-3 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-black">{card.vehicleLabel}</p>
                                <p className="text-[10px] font-bold text-stone-500">{staffLabel}: {card.userLabel}</p>
                              </div>
                              <div className="space-y-2">
                                {card.rows.map((row) => {
                                  const effectiveStatus = getEffectiveRecoveryStatus(row);
                                  const isEditorOpen = showNotCompensatedEditor[row.id] === true;
                                  const draftDate = recoveryScheduleDrafts[row.id] ?? '';
                                  const draftReason = recoveryReasonDrafts[row.id] ?? '';
                                  return (
                                    <div key={row.id} className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white/80 dark:bg-stone-950/40 p-2 space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-[11px] font-bold truncate">{row.item_name}</p>
                                        <span
                                          className={cn(
                                            'text-[10px] font-black px-2 py-1 rounded-md',
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
                                        <button
                                          type="button"
                                          disabled={savingRecoveryId === row.id}
                                          onClick={() => void updateRecoveryStatus(row, 'resolved')}
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
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
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
        </>
      )}
    </AnimatePresence>
  );
}
