import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DepartmentCode } from '../data/department';
import { getDepartmentClient, getDepartmentTables } from '../data/supabaseSource';
import { fetchStaffNamesForIntelligence, fetchVehiclesForIntelligence } from '../lib/inspectionIntelligence/queries';

type RecoveryStatus = 'pending' | 'scheduled' | 'resolved';

interface RecoveryRow {
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
}

interface RecoveryActionRow {
  id: number;
  recovery_id: number | null;
  inspection_id: number;
  vehicle_id: number;
  next_status: RecoveryStatus;
  acted_at: string;
}

interface InspectionReportRef {
  id: number;
  created_at: string;
  vehicle_id: number | null;
}

export interface RecoveryHubRow {
  id: string;
  recoveryId: number;
  inspectionId: number;
  vehicleId: number;
  plateNumber: string;
  responsibleName: string;
  userId: string | null;
  itemName: string;
  requiredQty: number;
  actualQty: number;
  missingQty: number;
  compensatedQty: number;
  remainingQty: number;
  statusRaw: RecoveryStatus;
  statusEffective: RecoveryStatus;
  scheduledDate: string | null;
  isDueNow: boolean;
  resolvedAt: string | null;
  inspectionCreatedAt: string | null;
  detectedAt: string;
  sourceList: 'worklist' | 'archive';
  reason: string | null;
  searchBlob: string;
}

function normalizeStatus(value: unknown): RecoveryStatus {
  if (value === 'resolved' || value === 'scheduled' || value === 'pending') return value;
  return 'pending';
}

function getEffectiveStatus(row: RecoveryRow, todayIso: string): RecoveryStatus {
  if (row.status === 'scheduled' && row.scheduled_date && row.scheduled_date <= todayIso) return 'pending';
  return row.status;
}

function asIsoDay(iso: string | null): string | null {
  if (!iso) return null;
  if (iso.length >= 10) return iso.slice(0, 10);
  return null;
}

export function useInspectionRecoveryHubRows(department: DepartmentCode, enabled = true) {
  const [rows, setRows] = useState<RecoveryHubRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = useMemo(() => getDepartmentClient(department), [department]);
  const tables = useMemo(() => getDepartmentTables(department), [department]);
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      const [recoveryRes, actionsRes, vehicles, staffNames] = await Promise.all([
        client
          .from('inspection_recovery')
          .select(
            'id,inspection_id,vehicle_id,user_id,item_name,required_qty,actual_qty,missing_qty,compensated_qty,status,scheduled_date,resolved_at,reason,created_at',
          )
          .eq('department', department)
          .order('created_at', { ascending: false })
          .limit(4000),
        client
          .from('inspection_recovery_actions')
          .select('id,recovery_id,inspection_id,vehicle_id,next_status,acted_at')
          .eq('department', department)
          .order('acted_at', { ascending: false })
          .limit(6000),
        fetchVehiclesForIntelligence(client, tables, department),
        fetchStaffNamesForIntelligence(client, tables, department),
      ]);

      if (recoveryRes.error) throw recoveryRes.error;
      if (actionsRes.error) throw actionsRes.error;

      const recoveryRows = (recoveryRes.data ?? []) as RecoveryRow[];
      const actionRows = (actionsRes.data ?? []) as RecoveryActionRow[];
      const inspectionIds = Array.from(
        new Set(
          recoveryRows
            .map((r) => Number(r.inspection_id))
            .filter((v) => Number.isFinite(v) && v > 0),
        ),
      );
      let reports: InspectionReportRef[] = [];
      if (inspectionIds.length > 0) {
        const reportRes = await client
          .from(tables.reports)
          .select('id,created_at,vehicle_id')
          .in('id', inspectionIds)
          .limit(inspectionIds.length);
        if (reportRes.error) throw reportRes.error;
        reports = (reportRes.data ?? []) as InspectionReportRef[];
      }

      const reportById = new Map<number, InspectionReportRef>();
      for (const report of reports) reportById.set(Number(report.id), report);

      const vehicleById = new Map<number, { plate: string; assigned: string | null }>();
      for (const v of vehicles) {
        vehicleById.set(v.id, { plate: v.plate_number, assigned: v.assigned_driver_id });
      }

      const latestResolvedActionByRecovery = new Map<number, string>();
      const latestResolvedActionByInspection = new Map<number, string>();
      for (const a of actionRows) {
        if (normalizeStatus(a.next_status) !== 'resolved') continue;
        const actedAt = String(a.acted_at ?? '');
        if (!actedAt) continue;
        const recoveryId = Number(a.recovery_id ?? 0);
        if (recoveryId > 0 && !latestResolvedActionByRecovery.has(recoveryId)) {
          latestResolvedActionByRecovery.set(recoveryId, actedAt);
        }
        const inspectionId = Number(a.inspection_id ?? 0);
        if (inspectionId > 0 && !latestResolvedActionByInspection.has(inspectionId)) {
          latestResolvedActionByInspection.set(inspectionId, actedAt);
        }
      }

      const todayIso = new Date().toISOString().slice(0, 10);
      const nextRows: RecoveryHubRow[] = recoveryRows.map((row) => {
        const recoveryId = Number(row.id);
        const inspectionId = Number(row.inspection_id);
        const vehicleId = Number(row.vehicle_id);
        const vehicle = vehicleById.get(vehicleId);
        const report = reportById.get(inspectionId);
        const statusRaw = normalizeStatus(row.status);
        const statusEffective = getEffectiveStatus({ ...row, status: statusRaw }, todayIso);
        const missingQty = Number(row.missing_qty ?? 0);
        const compensatedQty = Number(row.compensated_qty ?? 0);
        const remainingQty = Math.max(missingQty - compensatedQty, 0);
        const resolvedAt =
          row.resolved_at ??
          latestResolvedActionByRecovery.get(recoveryId) ??
          latestResolvedActionByInspection.get(inspectionId) ??
          null;
        const userId = row.user_id ? String(row.user_id) : null;
        const responsibleByUser = userId ? staffNames.get(userId) : null;
        const assignedStaffName = vehicle?.assigned ? staffNames.get(vehicle.assigned) : null;
        const responsibleName = responsibleByUser || assignedStaffName || '—';
        const plateNumber = vehicle?.plate ?? `#${vehicleId}`;
        const inspectionCreatedAt = report?.created_at ?? null;
        const detectedAt = String(row.created_at ?? '');
        const isDueNow = statusRaw === 'scheduled' && !!row.scheduled_date && row.scheduled_date <= todayIso;
        const sourceList: 'worklist' | 'archive' = statusEffective === 'resolved' ? 'archive' : 'worklist';
        const statusLabel =
          statusEffective === 'resolved' ? 'تم التعويض' : statusEffective === 'scheduled' ? 'مجدول' : 'مفتوح';
        const sourceLabel = sourceList === 'archive' ? 'الأرشيف' : 'قائمة العمل';
        return {
          id: `rec-${recoveryId}`,
          recoveryId,
          inspectionId,
          vehicleId,
          plateNumber,
          responsibleName,
          userId,
          itemName: String(row.item_name ?? ''),
          requiredQty: Number(row.required_qty ?? 0),
          actualQty: Number(row.actual_qty ?? 0),
          missingQty,
          compensatedQty,
          remainingQty,
          statusRaw,
          statusEffective,
          scheduledDate: asIsoDay(row.scheduled_date),
          isDueNow,
          resolvedAt,
          inspectionCreatedAt,
          detectedAt,
          sourceList,
          reason: row.reason ?? null,
          searchBlob: [
            plateNumber,
            responsibleName,
            row.item_name,
            statusLabel,
            sourceLabel,
            asIsoDay(inspectionCreatedAt),
            asIsoDay(detectedAt),
            asIsoDay(resolvedAt),
            row.reason,
          ]
            .filter(Boolean)
            .join(' '),
        };
      });

      nextRows.sort((a, b) => {
        if (a.sourceList !== b.sourceList) return a.sourceList === 'worklist' ? -1 : 1;
        const ad = a.detectedAt ? new Date(a.detectedAt).getTime() : 0;
        const bd = b.detectedAt ? new Date(b.detectedAt).getTime() : 0;
        return bd - ad;
      });

      if (seq === loadSeq.current) setRows(nextRows);
    } catch (e) {
      if (seq === loadSeq.current) {
        setRows([]);
        setError(e instanceof Error ? e.message : 'فشل تحميل نواقص الجرد');
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [client, department, enabled, tables, loadSeq]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    error,
    rows,
    worklistRows: rows.filter((r) => r.sourceList === 'worklist'),
    archiveRows: rows.filter((r) => r.sourceList === 'archive'),
    refresh: load,
  };
}
