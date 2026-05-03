import type { DepartmentCode } from '../department';
import { getDepartmentClient, getDepartmentTables } from '../supabaseSource';
import type { DepartmentVehicle } from '../types';
import { normalizeToolValuesRecord } from '../../lib/inspectionRecovery/calculateInspectionRecovery';
import { splitBarcodeAndNameFromDisplay } from '../../lib/inventoryDisplay';
import type { InventoryTemplateItem } from './inventoryRepository';

/* ══════════════════════════════════════════════════════════════════
   Types — Latest Vehicle Report
   ══════════════════════════════════════════════════════════════════ */

export interface LatestInspectionInfo {
  reportId: number;
  createdAt: string;
  inspectorUserId: string | null;
  inspectorName: string | null;
  toolValues: Record<number, number>;
  damagePoints: unknown[];
  inspectionValues: Record<string, unknown>;
}

export interface VehicleRecoveryItemState {
  recoveryId: number;
  templateId: number | null;
  itemNameSnapshot: string;
  itemBarcodeSnapshot: string | null;
  itemNameLive: string;
  itemBarcodeLive: string | null;
  requiredQty: number;
  actualQty: number;
  missingQty: number;
  compensatedQty: number;
  status: 'pending' | 'scheduled' | 'resolved';
  createdAt: string;
  resolvedAt: string | null;
}

export interface VehicleLastCompensationInfo {
  actionId: number;
  actedAt: string;
  actionType: 'auto' | 'manual';
  previousStatus: 'pending' | 'scheduled' | 'resolved' | null;
  nextStatus: 'pending' | 'scheduled' | 'resolved';
  itemName: string;
  compensatedQty: number | null;
  reason: string | null;
}

export interface VehicleLatestReportView {
  vehicle: {
    id: number;
    plate: string;
    model: string | null;
    driverName: string | null;
    driverId: number | null;
    departmentLabel: string;
    hasToolkit: boolean;
  };
  lastInspection: LatestInspectionInfo | null;
  recoveryState: {
    totalRequired: number;
    totalActual: number;
    totalMissing: number;
    pendingCount: number;
    resolvedCount: number;
    items: VehicleRecoveryItemState[];
  };
  lastCompensation: VehicleLastCompensationInfo | null;
  timeline: Array<{
    id: string;
    at: string;
    type: 'inspection' | 'recovery_action';
    summary: string;
  }>;
}

/* ══════════════════════════════════════════════════════════════════
   Repository
   ══════════════════════════════════════════════════════════════════ */

function normalizeDepartmentDbCode(
  department: DepartmentCode,
): 'tajhiz' | 'installation' | 'operations' {
  if (department === 'installation') return 'installation';
  if (department === 'operations') return 'operations';
  return 'tajhiz';
}

function deriveNameBarcodeFromLegacy(storedLabel: string): { name: string; barcode: string | null } {
  const parsed = splitBarcodeAndNameFromDisplay(storedLabel);
  const name = parsed.name === '—' ? storedLabel.trim() : parsed.name;
  const barcode = parsed.barcode === '—' ? null : parsed.barcode || null;
  return { name: name || storedLabel.trim(), barcode };
}

export class VehiclesRepository {
  async list(department: DepartmentCode): Promise<DepartmentVehicle[]> {
    const client = getDepartmentClient(department);
    const tables = getDepartmentTables(department);
    const orderKey = department === 'installation' ? 'vehicle_number' : 'plate_number';
    const { data, error } = await client.from(tables.vehicles).select('*').order(orderKey);
    if (error) throw error;
    return (data ?? []) as DepartmentVehicle[];
  }

  async createEvent(
    department: DepartmentCode,
    vehicleId: number,
    eventType: string,
    description: string
  ): Promise<void> {
    const client = getDepartmentClient(department);
    const tables = getDepartmentTables(department);
    const { error } = await client.from(tables.vehicleEvents).insert({
      vehicle_id: vehicleId,
      event_type: eventType,
      description,
    });
    if (error) throw error;
  }

  /**
   * يجلب صورة كاملة لآخر حالة للمركبة:
   *  - آخر تقرير فحص (reports)
   *  - نواقص الجرد النشطة (inspection_recovery) — باستخدام snapshot + live من القوالب
   *  - آخر حركة تعويض (inspection_recovery_actions)
   *  - timeline موحّد مرتّب تنازلياً
   */
  async getLatestVehicleReport(
    department: DepartmentCode,
    vehicleId: number,
  ): Promise<VehicleLatestReportView> {
    const client = getDepartmentClient(department);
    const tables = getDepartmentTables(department);
    const isInstallation = department === 'installation';
    const dbDept = normalizeDepartmentDbCode(department);
    const plateColumn = isInstallation ? 'vehicle_number' : 'plate_number';
    const driverColumn = isInstallation ? 'responsible_staff_id' : 'assigned_driver_id';

    // 1) المركبة
    const { data: vehRow, error: vehErr } = await client
      .from(tables.vehicles)
      .select(`id,${plateColumn},model,${driverColumn},has_toolkit`)
      .eq('id', vehicleId)
      .maybeSingle();
    if (vehErr) throw vehErr;
    if (!vehRow) throw new Error('المركبة غير موجودة.');
    const v = vehRow as Record<string, unknown>;
    const driverIdRaw = v[driverColumn];
    const driverId =
      driverIdRaw != null && String(driverIdRaw).trim() !== '' ? Number(driverIdRaw) : null;

    // 2) السائق
    let driverName: string | null = null;
    if (driverId != null) {
      const { data: staffRow } = await client
        .from(tables.staffMembers)
        .select('id,full_name')
        .eq('id', driverId)
        .maybeSingle();
      if (staffRow) driverName = String((staffRow as Record<string, unknown>).full_name ?? '').trim() || null;
    }

    // 3) آخر تقرير
    const reportColumns = isInstallation
      ? 'id,vehicle_id,user_id,created_at,tool_values,inspection_values,damage_points,payload'
      : 'id,vehicle_id,user_id,created_at,tool_values,inspection_values,damage_points';
    const { data: reportRow, error: repErr } = await client
      .from(tables.reports)
      .select(reportColumns as unknown as string)
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (repErr) throw repErr;

    let lastInspection: LatestInspectionInfo | null = null;
    if (reportRow) {
      const r = reportRow as unknown as Record<string, unknown>;
      let toolValuesRaw: unknown = r.tool_values;
      let damageRaw: unknown = r.damage_points;
      let inspectionRaw: unknown = r.inspection_values;
      if (isInstallation && !toolValuesRaw) {
        const payload = r.payload && typeof r.payload === 'object' ? (r.payload as Record<string, unknown>) : {};
        toolValuesRaw = r.tool_values ?? payload.tool_values;
        damageRaw = r.damage_points ?? payload.damage_points;
        inspectionRaw = r.inspection_values ?? payload.inspection_values;
      }
      const userId = r.user_id != null && String(r.user_id).trim() !== '' ? String(r.user_id) : null;
      let inspectorName: string | null = null;
      if (userId) {
        const { data: userRow } = await client
          .from(tables.staffMembers)
          .select('full_name')
          .eq('auth_user_id', userId)
          .maybeSingle();
        if (userRow) inspectorName = String((userRow as Record<string, unknown>).full_name ?? '').trim() || null;
      }
      lastInspection = {
        reportId: Number(r.id),
        createdAt: String(r.created_at ?? ''),
        inspectorUserId: userId,
        inspectorName,
        toolValues: normalizeToolValuesRecord(toolValuesRaw),
        damagePoints: Array.isArray(damageRaw) ? damageRaw : [],
        inspectionValues:
          inspectionRaw && typeof inspectionRaw === 'object' ? (inspectionRaw as Record<string, unknown>) : {},
      };
    }

    // 4) القوالب (للخرائط الحية للأسماء والباركود)
    const { data: templateRows, error: tplErr } = await client
      .from(tables.inventoryTemplates)
      .select('id,item_name,barcode,required_quantity,sort_order,is_active,category,department_code')
      .eq('department_code', department)
      .eq('is_active', true);
    if (tplErr) throw tplErr;
    const templates = (templateRows ?? []) as InventoryTemplateItem[];
    const templateById = new Map<number, InventoryTemplateItem>();
    const templateByLabel = new Map<string, InventoryTemplateItem>();
    for (const t of templates) {
      templateById.set(Number(t.id), t);
      templateByLabel.set(String(t.item_name ?? '').trim(), t);
    }

    // 5) نواقص نشطة للمركبة (آخر صف لكل (item_name))
    const { data: recoveryRows, error: recErr } = await client
      .from('inspection_recovery')
      .select(
        'id,item_name,required_qty,actual_qty,missing_qty,compensated_qty,status,created_at,resolved_at',
      )
      .eq('department', dbDept)
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (recErr) throw recErr;

    const seenItemKeys = new Set<string>();
    const items: VehicleRecoveryItemState[] = [];
    for (const row of (recoveryRows ?? []) as Array<Record<string, unknown>>) {
      const storedLabel = String(row.item_name ?? '').trim();
      if (!storedLabel || seenItemKeys.has(storedLabel)) continue;
      seenItemKeys.add(storedLabel);
      const statusRaw = String(row.status ?? 'pending');
      const status: 'pending' | 'scheduled' | 'resolved' =
        statusRaw === 'resolved' || statusRaw === 'scheduled' ? statusRaw : 'pending';
      // snapshot: خُذ من الحقول الخام (قد لا تكون موجودة في المخطط حالياً)
      const snapshotName =
        row.item_name_snapshot != null && String(row.item_name_snapshot).trim() !== ''
          ? String(row.item_name_snapshot).trim()
          : storedLabel;
      const snapshotBarcode =
        row.item_barcode_snapshot != null && String(row.item_barcode_snapshot).trim() !== ''
          ? String(row.item_barcode_snapshot).trim()
          : null;

      const templateIdRaw = row.template_id;
      const templateIdNum = templateIdRaw != null ? Number(templateIdRaw) : NaN;
      const liveTpl = Number.isFinite(templateIdNum)
        ? templateById.get(templateIdNum)
        : templateByLabel.get(String(row.item_name ?? ''));
      const snapshotParsed = deriveNameBarcodeFromLegacy(snapshotName);
      const liveName = liveTpl ? String(liveTpl.item_name ?? '').trim() : snapshotParsed.name;
      const liveBarcode =
        liveTpl?.barcode != null && String(liveTpl.barcode).trim() ? String(liveTpl.barcode).trim() : null;

      items.push({
        recoveryId: Number(row.id),
        templateId: Number.isFinite(templateIdNum) ? templateIdNum : liveTpl ? Number(liveTpl.id) : null,
        itemNameSnapshot: snapshotParsed.name,
        itemBarcodeSnapshot: snapshotBarcode ?? snapshotParsed.barcode,
        itemNameLive: liveName,
        itemBarcodeLive: liveBarcode,
        requiredQty: Number(row.required_qty ?? 0),
        actualQty: Number(row.actual_qty ?? 0),
        missingQty: Number(row.missing_qty ?? 0),
        compensatedQty: Number(row.compensated_qty ?? 0),
        status,
        createdAt: String(row.created_at ?? ''),
        resolvedAt: row.resolved_at != null ? String(row.resolved_at) : null,
      });
    }

    const totalRequired = items.reduce((s, i) => s + i.requiredQty, 0);
    const totalActual = items.reduce((s, i) => s + i.actualQty, 0);
    const totalMissing = items.reduce((s, i) => s + i.missingQty, 0);
    const pendingCount = items.filter((i) => i.status !== 'resolved').length;
    const resolvedCount = items.filter((i) => i.status === 'resolved').length;

    // 6) آخر حركة تعويض
    const { data: actionRows, error: actErr } = await client
      .from('inspection_recovery_actions')
      .select('id,item_name,previous_status,next_status,action_type,compensated_qty,reason,acted_at')
      .eq('department', dbDept)
      .eq('vehicle_id', vehicleId)
      .order('acted_at', { ascending: false })
      .limit(20);
    if (actErr) throw actErr;
    const allActions = (actionRows ?? []) as Array<Record<string, unknown>>;
    let lastCompensation: VehicleLastCompensationInfo | null = null;
    if (allActions.length > 0) {
      const a = allActions[0];
      const prev = String(a.previous_status ?? '');
      const next = String(a.next_status ?? 'pending');
      lastCompensation = {
        actionId: Number(a.id),
        actedAt: String(a.acted_at ?? ''),
        actionType: a.action_type === 'manual' ? 'manual' : 'auto',
        previousStatus:
          prev === 'resolved' || prev === 'scheduled' || prev === 'pending'
            ? (prev as 'pending' | 'scheduled' | 'resolved')
            : null,
        nextStatus:
          next === 'resolved' || next === 'scheduled' ? (next as 'scheduled' | 'resolved') : 'pending',
        itemName: String(a.item_name ?? '').trim(),
        compensatedQty: a.compensated_qty != null ? Number(a.compensated_qty) : null,
        reason: a.reason != null ? String(a.reason) : null,
      };
    }

    // 7) Timeline
    const timeline: VehicleLatestReportView['timeline'] = [];
    if (lastInspection) {
      timeline.push({
        id: `inspection-${lastInspection.reportId}`,
        at: lastInspection.createdAt,
        type: 'inspection',
        summary: 'آخر تقرير جرد محفوظ',
      });
    }
    for (const a of allActions.slice(0, 10)) {
      timeline.push({
        id: `action-${a.id}`,
        at: String(a.acted_at ?? ''),
        type: 'recovery_action',
        summary: `${
          a.action_type === 'manual' ? 'حركة يدوية' : 'حركة آلية'
        }: ${String(a.item_name ?? '—')} → ${
          a.next_status === 'resolved' ? 'مُعوَّض' : a.next_status === 'scheduled' ? 'مجدول' : 'ناقص'
        }`,
      });
    }
    timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return {
      vehicle: {
        id: Number(v.id),
        plate: String(v[plateColumn] ?? '').trim() || `#${v.id}`,
        model: v.model != null ? String(v.model) : null,
        driverName,
        driverId,
        departmentLabel:
          department === 'installation' ? 'قسم التركيب' : department === 'operations' ? 'قسم العمليات' : 'قسم التجهيز',
        hasToolkit: v.has_toolkit !== false,
      },
      lastInspection,
      recoveryState: {
        totalRequired,
        totalActual,
        totalMissing,
        pendingCount,
        resolvedCount,
        items,
      },
      lastCompensation,
      timeline,
    };
  }
}
