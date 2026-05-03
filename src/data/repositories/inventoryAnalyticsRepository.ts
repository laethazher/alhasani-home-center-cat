import type { SupabaseClient } from '@supabase/supabase-js';
import type { DepartmentCode } from '../department';
import { getDepartmentClient, getDepartmentTables } from '../supabaseSource';
import { formatInventoryLabel, splitBarcodeAndNameFromDisplay } from '../../lib/inventoryDisplay';
import { normalizeToolValuesRecord } from '../../lib/inspectionRecovery/calculateInspectionRecovery';
import type { InventoryTemplateItem } from './inventoryRepository';

/* ══════════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════════ */

export interface ItemCatalogEntry {
  templateId: number;
  itemName: string;
  barcode: string | null;
  requiredQuantityPerVehicle: number;
  sortOrder: number;
  /** تسمية موحّدة للبحث: "باركود · اسم" أو الاسم فقط. */
  displayLabel: string;
}

export interface ItemHolderRow {
  vehicleId: number;
  plate: string;
  model: string | null;
  vehicleStatus: string | null;
  driverId: number | null;
  driverName: string | null;
  driverRole: string | null;
  driverPhone: string | null;
  driverNationalId: string | null;
  requiredQty: number;
  actualQty: number;
  missingQty: number;
  recoveryStatus: 'pending' | 'scheduled' | 'resolved' | null;
  lastUpdatedAt: string | null;
  lastReportAt: string | null;
  compensationCount: number;
}

export interface ItemRecentAction {
  id: number;
  vehicleId: number;
  plate: string;
  driverName: string | null;
  actionType: 'auto' | 'manual';
  previousStatus: 'pending' | 'scheduled' | 'resolved' | null;
  nextStatus: 'pending' | 'scheduled' | 'resolved';
  compensatedQty: number | null;
  reason: string | null;
  actedAt: string;
}

export interface ItemAggregateResult {
  template: ItemCatalogEntry;
  totals: {
    totalRequired: number;
    totalActual: number;
    totalMissing: number;
    vehiclesCount: number;
    driversCount: number;
    vehiclesWithShortage: number;
  };
  holders: ItemHolderRow[];
  recentActions: ItemRecentAction[];
}

/* ══════════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════════ */

function normalizeDepartmentDbCode(
  department: DepartmentCode,
): 'tajhiz' | 'installation' | 'operations' {
  if (department === 'installation') return 'installation';
  if (department === 'operations') return 'operations';
  return 'tajhiz';
}

interface StaffExtras {
  fullName: string;
  role: string | null;
  phone: string | null;
  nationalId: string | null;
}

/**
 * محاولة جلب حقول موسّعة (هاتف/هوية) مع تراجع عن الأعمدة غير الموجودة في قاعدة أقدم.
 */
async function fetchStaffExtrasByIds(
  client: SupabaseClient,
  table: string,
  ids: number[],
): Promise<Map<number, StaffExtras>> {
  const map = new Map<number, StaffExtras>();
  if (ids.length === 0) return map;

  const trySelect = async (cols: string) => {
    return client.from(table).select(cols).in('id', ids);
  };

  let { data, error } = await trySelect('id,full_name,role,phone,national_id');
  if (error) {
    ({ data, error } = await trySelect('id,full_name,role,phone'));
  }
  if (error) {
    ({ data, error } = await trySelect('id,full_name,role'));
  }
  if (error) {
    ({ data, error } = await trySelect('id,full_name'));
  }
  if (error) throw error;

  for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
    const id = Number(row.id);
    map.set(id, {
      fullName: String(row.full_name ?? '').trim(),
      role: row.role != null ? String(row.role).trim() : null,
      phone:
        row.phone != null && String(row.phone).trim() !== '' ? String(row.phone).trim() : null,
      nationalId:
        row.national_id != null && String(row.national_id).trim() !== ''
          ? String(row.national_id).trim()
          : null,
    });
  }
  return map;
}

/** تُطابق اسم العنصر المخزّن في inspection_recovery (قد يكون ملصقاً مُنسّقاً) بمفتاح القالب الأصلي. */
function matchesTemplateItemName(
  storedItemName: string,
  template: ItemCatalogEntry,
): boolean {
  const stored = String(storedItemName ?? '').trim();
  if (!stored) return false;
  if (stored === template.displayLabel) return true;
  const parsed = splitBarcodeAndNameFromDisplay(stored);
  const parsedName = parsed.name === '—' ? '' : parsed.name;
  const parsedBarcode = parsed.barcode === '—' ? '' : parsed.barcode;
  if (parsedName && parsedName === template.itemName) return true;
  if (parsedBarcode && template.barcode && parsedBarcode === template.barcode) return true;
  if (stored === template.itemName) return true;
  return false;
}

/* ══════════════════════════════════════════════════════════════════
   Repository
   ══════════════════════════════════════════════════════════════════ */

export class InventoryAnalyticsRepository {
  /** فهرس القوالب النشطة لتبويب البحث الذكي (tools فقط كما في النواقص). */
  async getItemCatalog(department: DepartmentCode): Promise<ItemCatalogEntry[]> {
    const client = getDepartmentClient(department);
    const table = getDepartmentTables(department).inventoryTemplates;
    const { data, error } = await client
      .from(table)
      .select('id,item_name,barcode,required_quantity,sort_order,is_active,category,department_code')
      .eq('department_code', department)
      .eq('category', 'tools')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    const rows = (data ?? []) as InventoryTemplateItem[];
    return rows.map((row) => {
      const name = String(row.item_name ?? '').trim();
      const barcode = row.barcode != null && String(row.barcode).trim() ? String(row.barcode).trim() : null;
      return {
        templateId: Number(row.id),
        itemName: name,
        barcode,
        requiredQuantityPerVehicle: Math.max(0, Number(row.required_quantity ?? 0)),
        sortOrder: Number(row.sort_order ?? 0),
        displayLabel: formatInventoryLabel(name, barcode),
      };
    });
  }

  /**
   * تجميع كامل لعنصر: الإجمالي عبر الأسطول، قائمة الحاملين، وآخر الحركات.
   * يستخدم:
   *  - inventory_item_templates  (المطلوب لكل مركبة)
   *  - tables.vehicles           (قائمة المركبات + السائق المعيّن + has_toolkit)
   *  - tables.staffMembers       (أسماء السائقين/الفنيين)
   *  - tables.reports            (آخر tool_values لكل مركبة = المتوفر)
   *  - inspection_recovery       (الحالة النشطة: ناقص/مجدول/مُعوَّض)
   *  - inspection_recovery_actions (آخر الحركات — تُفلتر باسم العنصر)
   */
  async getItemAggregate(
    department: DepartmentCode,
    templateId: number,
  ): Promise<ItemAggregateResult> {
    const client = getDepartmentClient(department);
    const tables = getDepartmentTables(department);
    const dbDept = normalizeDepartmentDbCode(department);
    const isInstallation = department === 'installation';

    // 1) القالب
    const { data: templateRow, error: templateErr } = await client
      .from(tables.inventoryTemplates)
      .select('id,item_name,barcode,required_quantity,sort_order,is_active,category,department_code')
      .eq('id', templateId)
      .maybeSingle();
    if (templateErr) throw templateErr;
    if (!templateRow) {
      throw new Error('لم يتم العثور على العنصر المطلوب في قائمة القوالب.');
    }
    const tRow = templateRow as InventoryTemplateItem;
    const name = String(tRow.item_name ?? '').trim();
    const barcode = tRow.barcode != null && String(tRow.barcode).trim() ? String(tRow.barcode).trim() : null;
    const template: ItemCatalogEntry = {
      templateId: Number(tRow.id),
      itemName: name,
      barcode,
      requiredQuantityPerVehicle: Math.max(0, Number(tRow.required_quantity ?? 0)),
      sortOrder: Number(tRow.sort_order ?? 0),
      displayLabel: formatInventoryLabel(name, barcode),
    };

    // 2) المركبات + السائق المعيّن + has_toolkit + تفاصيل العرض
    const vehicleDriverColumn = isInstallation ? 'responsible_staff_id' : 'assigned_driver_id';
    const plateColumn = isInstallation ? 'vehicle_number' : 'plate_number';
    let vehicleRows: unknown[] | null | undefined;
    let extVeh = await client
      .from(tables.vehicles)
      .select(`id,${plateColumn},${vehicleDriverColumn},has_toolkit,model,status`);
    if (extVeh.error) {
      const baseVeh = await client
        .from(tables.vehicles)
        .select(`id,${plateColumn},${vehicleDriverColumn},has_toolkit`);
      if (baseVeh.error) throw baseVeh.error;
      vehicleRows = baseVeh.data as unknown[] | null | undefined;
    } else {
      vehicleRows = extVeh.data as unknown[] | null | undefined;
    }
    interface VehicleLite {
      id: number;
      plate: string;
      driverId: number | null;
      hasToolkit: boolean;
      model: string | null;
      vehicleStatus: string | null;
    }
    const vehicles: VehicleLite[] = (vehicleRows ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const driverRaw = r[vehicleDriverColumn];
      const rawModel = r.model != null ? String(r.model).trim() : '';
      const rawStatus = r.status != null ? String(r.status).trim() : '';
      return {
        id: Number(r.id),
        plate: String(r[plateColumn] ?? '').trim() || `#${r.id}`,
        driverId:
          driverRaw != null && String(driverRaw).trim() !== '' ? Number(driverRaw) : null,
        hasToolkit: r.has_toolkit !== false,
        model: rawModel || null,
        vehicleStatus: rawStatus || null,
      };
    });

    // 3) بيانات السائقين/الفنيين (اسم، دور، هاتف، هوية حيث تتوفر الأعمدة)
    const driverIds = Array.from(
      new Set(vehicles.map((v) => v.driverId).filter((id): id is number => id != null && Number.isFinite(id))),
    );
    const staffExtrasById = await fetchStaffExtrasByIds(client, tables.staffMembers, driverIds);
    const driverNameById = new Map<number, string>();
    for (const [id, s] of staffExtrasById) {
      driverNameById.set(id, s.fullName);
    }

    // 4) آخر تقرير لكل مركبة (لأخذ actual_qty من tool_values + تاريخ آخر جرد)
    const reportColumns = isInstallation
      ? 'id,vehicle_id,created_at,tool_values,payload'
      : 'id,vehicle_id,created_at,tool_values';
    const { data: reportRows, error: repErr } = await client
      .from(tables.reports)
      .select(reportColumns as unknown as string)
      .order('created_at', { ascending: false })
      .limit(2500);
    if (repErr) throw repErr;
    const latestToolValuesByVehicle = new Map<number, Record<number, number>>();
    const latestReportAtByVehicle = new Map<number, string>();
    for (const row of (reportRows ?? []) as unknown as Array<Record<string, unknown>>) {
      const vid = Number(row.vehicle_id);
      if (!Number.isFinite(vid) || latestToolValuesByVehicle.has(vid)) continue;
      let tv: unknown = row.tool_values;
      if (isInstallation && !tv) {
        const payload =
          row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : {};
        tv = payload.tool_values;
      }
      latestToolValuesByVehicle.set(vid, normalizeToolValuesRecord(tv));
      latestReportAtByVehicle.set(vid, String(row.created_at ?? ''));
    }

    // 5) الحالة النشطة من inspection_recovery — نأخذ آخر صف لكل (vehicle, item)
    const { data: recoveryRows, error: recErr } = await client
      .from('inspection_recovery')
      .select(
        'id,vehicle_id,item_name,required_qty,actual_qty,missing_qty,compensated_qty,status,created_at,resolved_at',
      )
      .eq('department', dbDept)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (recErr) throw recErr;
    interface RecoveryLite {
      vehicleId: number;
      requiredQty: number;
      actualQty: number;
      missingQty: number;
      status: 'pending' | 'scheduled' | 'resolved';
      createdAt: string;
      resolvedAt: string | null;
    }
    const latestRecoveryByVehicle = new Map<number, RecoveryLite>();
    for (const row of (recoveryRows ?? []) as Array<Record<string, unknown>>) {
      if (!matchesTemplateItemName(String(row.item_name ?? ''), template)) continue;
      const vid = Number(row.vehicle_id);
      if (!Number.isFinite(vid) || latestRecoveryByVehicle.has(vid)) continue;
      const statusRaw = String(row.status ?? 'pending');
      const status: 'pending' | 'scheduled' | 'resolved' =
        statusRaw === 'resolved' || statusRaw === 'scheduled' ? statusRaw : 'pending';
      latestRecoveryByVehicle.set(vid, {
        vehicleId: vid,
        requiredQty: Number(row.required_qty ?? 0),
        actualQty: Number(row.actual_qty ?? 0),
        missingQty: Number(row.missing_qty ?? 0),
        status,
        createdAt: String(row.created_at ?? ''),
        resolvedAt: row.resolved_at != null ? String(row.resolved_at) : null,
      });
    }

    // 6) أحدث حركات التعويض (inspection_recovery_actions) للعنصر
    const { data: actionRows, error: actErr } = await client
      .from('inspection_recovery_actions')
      .select(
        'id,vehicle_id,user_id,item_name,previous_status,next_status,action_type,compensated_qty,reason,acted_at',
      )
      .eq('department', dbDept)
      .order('acted_at', { ascending: false })
      .limit(500);
    if (actErr) throw actErr;

    const compensationCountByVehicle = new Map<number, number>();
    for (const row of actionRows ?? []) {
      const r = row as Record<string, unknown>;
      if (!matchesTemplateItemName(String(r.item_name ?? ''), template)) continue;
      const vid = Number(r.vehicle_id);
      if (!Number.isFinite(vid)) continue;
      compensationCountByVehicle.set(vid, (compensationCountByVehicle.get(vid) ?? 0) + 1);
    }

    const holders: ItemHolderRow[] = vehicles
      .filter((v) => v.hasToolkit)
      .map((v) => {
        const recovery = latestRecoveryByVehicle.get(v.id);
        const toolValues = latestToolValuesByVehicle.get(v.id);
        const actualFromReport =
          toolValues != null ? Math.max(0, Number(toolValues[template.templateId] ?? 0)) : null;
        const requiredQty = template.requiredQuantityPerVehicle;
        const actualQty = recovery
          ? Number(recovery.actualQty)
          : actualFromReport ?? requiredQty; // افتراضياً: لا نقص مسجّل ⇒ اعتبار المتوفر = المطلوب
        const missingQty = Math.max(0, requiredQty - actualQty);
        const staff = v.driverId != null ? staffExtrasById.get(v.driverId) : undefined;
        return {
          vehicleId: v.id,
          plate: v.plate,
          model: v.model,
          vehicleStatus: v.vehicleStatus,
          driverId: v.driverId,
          driverName: staff?.fullName ?? null,
          driverRole: staff?.role ?? null,
          driverPhone: staff?.phone ?? null,
          driverNationalId: staff?.nationalId ?? null,
          requiredQty,
          actualQty,
          missingQty,
          recoveryStatus: recovery?.status ?? null,
          lastUpdatedAt: recovery?.createdAt ?? null,
          lastReportAt: latestReportAtByVehicle.get(v.id) ?? null,
          compensationCount: compensationCountByVehicle.get(v.id) ?? 0,
        };
      })
      .sort((a, b) => b.missingQty - a.missingQty || a.plate.localeCompare(b.plate, 'ar'));

    const recentActions: ItemRecentAction[] = (actionRows ?? [])
      .filter((row) =>
        matchesTemplateItemName(String((row as Record<string, unknown>).item_name ?? ''), template),
      )
      .slice(0, 50)
      .map((row) => {
        const r = row as Record<string, unknown>;
        const vid = Number(r.vehicle_id);
        const vehicleRef = vehicles.find((v) => v.id === vid);
        const driverName =
          vehicleRef?.driverId != null ? driverNameById.get(vehicleRef.driverId) ?? null : null;
        const prev = String(r.previous_status ?? '');
        const next = String(r.next_status ?? 'pending');
        return {
          id: Number(r.id),
          vehicleId: vid,
          plate: vehicleRef?.plate ?? `#${vid}`,
          driverName,
          actionType: r.action_type === 'manual' ? 'manual' : 'auto',
          previousStatus:
            prev === 'resolved' || prev === 'scheduled' || prev === 'pending'
              ? (prev as 'pending' | 'scheduled' | 'resolved')
              : null,
          nextStatus:
            next === 'resolved' || next === 'scheduled' ? (next as 'scheduled' | 'resolved') : 'pending',
          compensatedQty:
            r.compensated_qty != null ? Number(r.compensated_qty) : null,
          reason: r.reason != null ? String(r.reason) : null,
          actedAt: String(r.acted_at ?? ''),
        };
      });

    const totalRequired = holders.reduce((s, h) => s + h.requiredQty, 0);
    const totalActual = holders.reduce((s, h) => s + h.actualQty, 0);
    const totalMissing = holders.reduce((s, h) => s + h.missingQty, 0);
    const vehiclesWithShortage = holders.filter((h) => h.missingQty > 0).length;
    const driversCount = new Set(
      holders.map((h) => h.driverId).filter((id): id is number => id != null && Number.isFinite(id)),
    ).size;

    return {
      template,
      totals: {
        totalRequired,
        totalActual,
        totalMissing,
        vehiclesCount: holders.length,
        driversCount,
        vehiclesWithShortage,
      },
      holders,
      recentActions,
    };
  }
}
