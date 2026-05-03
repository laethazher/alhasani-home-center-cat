import type { SupabaseClient } from '@supabase/supabase-js';
import type { DepartmentCode } from '../../data/department';
import { getDepartmentTables } from '../../data/supabaseSource';
import { TOOL_INVENTORY_ITEMS } from '../../constants';
import { formatInventoryLabel } from '../inventoryDisplay';

export interface InventoryTemplateRow {
  id: number;
  item_name: string;
  barcode?: string | null;
  required_quantity: number;
}

interface RecoveryRowInsert {
  inspection_id: number;
  vehicle_id: number;
  user_id: string | null;
  department: 'tajhiz' | 'installation' | 'operations';
  item_name: string;
  required_qty: number;
  actual_qty: number;
  missing_qty: number;
  compensated_qty: number;
  baseline_actual_qty?: number | null;
  is_repeat_shortage?: boolean;
  delta_since_last_compensation?: number;
  status: 'pending';
  action_type: 'auto';
  /** لقطة اسم العنصر وقت إنشاء الصف — للأرشيف التاريخي (يتطلّب ترحيل snapshot). */
  item_name_snapshot?: string | null;
  item_barcode_snapshot?: string | null;
  /** مرجع القالب الحالي لقراءة الاسم/الباركود الحي في الواجهات. */
  template_id?: number | null;
}

export interface CalculateInspectionRecoveryParams {
  client: SupabaseClient;
  department: DepartmentCode;
  inspectionId: number;
  vehicleId: number;
  userId: string | null;
  hasToolkit: boolean;
  toolValues: Record<number, number>;
  /** إن وُجدت تُستخدم بدل جلب القوالب من القاعدة (لتسريع إعادة بناء السجل). */
  templatesOverride?: InventoryTemplateRow[] | null;
  /** عند التعطيل لا تتم مقارنة النقص الحالي بآخر تعويض (مفيد لإعادة البناء الضخم). */
  compareWithPreviousRecovery?: boolean;
}

export interface CalculateInspectionRecoveryResult {
  skippedNoToolkit: boolean;
  insertedCount: number;
}

function normalizeDepartment(department: DepartmentCode): 'tajhiz' | 'installation' | 'operations' | null {
  if (department === 'installation') return 'installation';
  if (department === 'tajhiz') return 'tajhiz';
  if (department === 'operations') return 'operations';
  return null;
}

/** يحوّل JSON tool_values إلى أرقام بمفاتيح رقمية (يدعم مفاتيح نصية من التخزين). */
export function normalizeToolValuesRecord(raw: unknown): Record<number, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(k);
    if (!Number.isFinite(id)) continue;
    const n = Number(v);
    out[id] = Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  return out;
}

function resolveSourceTemplates(templateRows: InventoryTemplateRow[]): InventoryTemplateRow[] {
  if (templateRows.length > 0) return templateRows;
  return TOOL_INVENTORY_ITEMS.map((item) => ({
    id: item.id,
    item_name: item.name,
    barcode: null,
    required_quantity: item.quantity,
  }));
}

async function fetchActiveInventoryTemplates(
  client: SupabaseClient,
  department: DepartmentCode,
): Promise<InventoryTemplateRow[]> {
  const inventoryTable = getDepartmentTables(department).inventoryTemplates;
  const { data: templates, error: templatesError } = await client
    .from(inventoryTable)
    .select('id,item_name,barcode,required_quantity')
    .eq('department_code', department)
    .eq('category', 'tools')
    .eq('is_active', true);

  if (templatesError) {
    throw templatesError;
  }

  return resolveSourceTemplates((templates ?? []) as InventoryTemplateRow[]);
}

function getActualQty(toolValues: Record<number, number>, itemId: number): number {
  const raw = toolValues[itemId] ?? (toolValues as Record<string, number>)[String(itemId)];
  const actualQtyRaw = Number(raw ?? 0);
  return Number.isFinite(actualQtyRaw) ? Math.max(0, actualQtyRaw) : 0;
}

function buildRecoveryRowInserts(params: {
  safeDepartment: 'tajhiz' | 'installation' | 'operations';
  inspectionId: number;
  vehicleId: number;
  userId: string | null;
  sourceTemplates: InventoryTemplateRow[];
  toolValues: Record<number, number>;
  previousByItemName: Map<
    string,
    {
      required_qty: number;
      actual_qty: number;
      compensated_qty: number;
      status: 'pending' | 'scheduled' | 'resolved';
    }
  >;
}): RecoveryRowInsert[] {
  const { safeDepartment, inspectionId, vehicleId, userId, sourceTemplates, toolValues, previousByItemName } = params;
  const recoveryRows: RecoveryRowInsert[] = [];
  for (const item of sourceTemplates) {
    const requiredQty = Number(item.required_quantity ?? 0);
    const actualQty = getActualQty(toolValues, Number(item.id));
    const missingQty = Math.max(requiredQty - actualQty, 0);
    if (missingQty < 1) continue;
    const itemLabel = formatInventoryLabel(String(item.item_name ?? ''), item.barcode);
    const previous = previousByItemName.get(itemLabel);
    const previousEffectiveActual = previous
      ? Math.min(
          Math.max(Number(previous.required_qty ?? requiredQty), 0),
          Math.max(Number(previous.actual_qty ?? 0), 0) + Math.max(Number(previous.compensated_qty ?? 0), 0),
        )
      : null;
    const deltaSinceLastCompensation =
      previousEffectiveActual != null ? Math.max(previousEffectiveActual - actualQty, 0) : 0;
    const isRepeatShortage = previous?.status === 'resolved' && deltaSinceLastCompensation > 0 && missingQty > 0;

    const itemNameRaw = String(item.item_name ?? '').trim();
    const itemBarcodeRaw =
      item.barcode != null && String(item.barcode).trim() ? String(item.barcode).trim() : null;
    recoveryRows.push({
      inspection_id: inspectionId,
      vehicle_id: vehicleId,
      user_id: userId,
      department: safeDepartment,
      item_name: itemLabel,
      required_qty: requiredQty,
      actual_qty: actualQty,
      missing_qty: missingQty,
      compensated_qty: 0,
      baseline_actual_qty: previousEffectiveActual,
      is_repeat_shortage: isRepeatShortage,
      delta_since_last_compensation: deltaSinceLastCompensation,
      status: 'pending',
      action_type: 'auto',
      item_name_snapshot: itemNameRaw || itemLabel,
      item_barcode_snapshot: itemBarcodeRaw,
      template_id: Number.isFinite(Number(item.id)) ? Number(item.id) : null,
    });
  }
  return recoveryRows;
}

async function fetchLatestRecoveryByItemName(
  client: SupabaseClient,
  safeDepartment: 'tajhiz' | 'installation' | 'operations',
  vehicleId: number,
): Promise<
  Map<
    string,
    {
      required_qty: number;
      actual_qty: number;
      compensated_qty: number;
      status: 'pending' | 'scheduled' | 'resolved';
    }
  >
> {
  const { data, error } = await client
    .from('inspection_recovery')
    .select('item_name,required_qty,actual_qty,compensated_qty,status,created_at')
    .eq('department', safeDepartment)
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false })
    .limit(1500);
  if (error) throw error;
  const map = new Map<
    string,
    {
      required_qty: number;
      actual_qty: number;
      compensated_qty: number;
      status: 'pending' | 'scheduled' | 'resolved';
    }
  >();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const itemName = String(row.item_name ?? '').trim();
    if (!itemName || map.has(itemName)) continue;
    const statusRaw = String(row.status ?? 'pending');
    const status: 'pending' | 'scheduled' | 'resolved' =
      statusRaw === 'resolved' || statusRaw === 'scheduled' ? statusRaw : 'pending';
    map.set(itemName, {
      required_qty: Number(row.required_qty ?? 0),
      actual_qty: Number(row.actual_qty ?? 0),
      compensated_qty: Number(row.compensated_qty ?? 0),
      status,
    });
  }
  return map;
}

async function deleteInspectionRecoveryForInspection(
  client: SupabaseClient,
  safeDepartment: 'tajhiz' | 'installation' | 'operations',
  inspectionId: number,
): Promise<void> {
  const { error: deleteError } = await client
    .from('inspection_recovery')
    .delete()
    .eq('inspection_id', inspectionId)
    .eq('department', safeDepartment);
  if (deleteError) {
    throw deleteError;
  }
}

/** رسالة خطأ Postgres/PostgREST تدل على غياب عمود في الجدول. */
function isUnknownColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string };
  const code = String(err.code ?? '');
  const msg = String(err.message ?? '').toLowerCase();
  if (code === '42703' || code === 'PGRST204') return true;
  return (
    msg.includes('item_name_snapshot') ||
    msg.includes('item_barcode_snapshot') ||
    msg.includes('template_id') ||
    msg.includes('unknown column') ||
    msg.includes('does not exist')
  );
}

async function insertInspectionRecoveryRows(client: SupabaseClient, recoveryRows: RecoveryRowInsert[]): Promise<void> {
  if (recoveryRows.length === 0) return;
  const { error: insertError } = await client.from('inspection_recovery').insert(recoveryRows);
  if (!insertError) return;

  // Fallback: في حال لم يُطبَّق ترحيل snapshot/template_id بعد،
  // أعد الإدراج بدون الأعمدة الجديدة حتى لا ينكسر تدفق حفظ التقرير.
  if (!isUnknownColumnError(insertError)) {
    throw insertError;
  }
  const degraded = recoveryRows.map((row) => {
    const {
      item_name_snapshot: _omitSnapshot,
      item_barcode_snapshot: _omitBarcode,
      template_id: _omitTemplateId,
      ...rest
    } = row;
    void _omitSnapshot;
    void _omitBarcode;
    void _omitTemplateId;
    return rest;
  });
  const { error: retryError } = await client.from('inspection_recovery').insert(degraded);
  if (retryError) {
    throw retryError;
  }
  // eslint-disable-next-line no-console
  console.warn(
    'inspection_recovery: أُدرجت الصفوف بدون snapshot/template_id لعدم وجود الأعمدة. شغّل ترحيل snapshot: npm run db:apply-recovery-snapshot',
  );
}

export async function calculateInspectionRecovery({
  client,
  department,
  inspectionId,
  vehicleId,
  userId,
  hasToolkit,
  toolValues,
  templatesOverride,
  compareWithPreviousRecovery = true,
}: CalculateInspectionRecoveryParams): Promise<CalculateInspectionRecoveryResult> {
  const safeDepartment = normalizeDepartment(department);
  if (!safeDepartment) {
    return { skippedNoToolkit: false, insertedCount: 0 };
  }

  if (!hasToolkit) {
    await deleteInspectionRecoveryForInspection(client, safeDepartment, inspectionId);
    return { skippedNoToolkit: true, insertedCount: 0 };
  }

  const sourceTemplates =
    templatesOverride !== undefined && templatesOverride !== null
      ? resolveSourceTemplates(templatesOverride)
      : await fetchActiveInventoryTemplates(client, department);

  const toolValuesNorm = normalizeToolValuesRecord(toolValues as unknown);
  const previousByItemName = compareWithPreviousRecovery
    ? await fetchLatestRecoveryByItemName(client, safeDepartment, vehicleId)
    : new Map<
        string,
        {
          required_qty: number;
          actual_qty: number;
          compensated_qty: number;
          status: 'pending' | 'scheduled' | 'resolved';
        }
      >();

  const recoveryRows = buildRecoveryRowInserts({
    safeDepartment,
    inspectionId,
    vehicleId,
    userId: userId != null && String(userId).trim() !== '' ? String(userId) : null,
    sourceTemplates,
    toolValues: toolValuesNorm,
    previousByItemName,
  });

  await deleteInspectionRecoveryForInspection(client, safeDepartment, inspectionId);

  if (recoveryRows.length === 0) {
    return { skippedNoToolkit: false, insertedCount: 0 };
  }

  await insertInspectionRecoveryRows(client, recoveryRows);

  return { skippedNoToolkit: false, insertedCount: recoveryRows.length };
}

export interface RebuildInspectionRecoverySummary {
  processed: number;
  totalReports: number;
  skippedNoToolkit: number;
  insertedRows: number;
  errors: Array<{ reportId: number; message: string }>;
}

export interface RebuildInspectionRecoveryOptions {
  client: SupabaseClient;
  department: DepartmentCode;
  batchSize?: number;
  onProgress?: (processed: number, totalEstimate: number) => void;
  signal?: AbortSignal;
  /** تصفية حسب `created_at` (شامل طرفي اليوم عند استخدام dateInputsToCreatedAtRange). */
  createdAtBetween?: { startIso: string; endIso: string } | null;
}

/** من حقول `yyyy-mm-dd` (محلي) إلى نطاق ISO لاستعلام Supabase. */
export function dateInputsToCreatedAtRange(fromYmd: string, toYmd: string): { startIso: string; endIso: string } {
  const start = new Date(`${fromYmd.trim()}T00:00:00.000`);
  const end = new Date(`${toYmd.trim()}T23:59:59.999`);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/**
 * يعيد احتساب صفوف inspection_recovery لكل تقارير القسم من بيانات التقرير المحفوظة (نفس منطق الحفظ).
 */
export async function rebuildInspectionRecoveryForAllReports(
  options: RebuildInspectionRecoveryOptions,
): Promise<RebuildInspectionRecoverySummary> {
  const { client, department, batchSize = 500, onProgress, signal, createdAtBetween } = options;
  const safeDepartment = normalizeDepartment(department);
  const summary: RebuildInspectionRecoverySummary = {
    processed: 0,
    totalReports: 0,
    skippedNoToolkit: 0,
    insertedRows: 0,
    errors: [],
  };

  if (!safeDepartment) {
    return summary;
  }

  const tables = getDepartmentTables(department);
  const isInstallation = department === 'installation';

  const templates = await fetchActiveInventoryTemplates(client, department);

  const { data: vehicleRows, error: vehError } = await client
    .from(tables.vehicles)
    .select('id,has_toolkit');
  if (vehError) {
    throw vehError;
  }
  const vehicleToolkit = new Map<number, boolean>();
  for (const row of (vehicleRows ?? []) as Array<{ id?: unknown; has_toolkit?: unknown }>) {
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    vehicleToolkit.set(id, row.has_toolkit !== false);
  }

  let countQuery = client.from(tables.reports).select('id', { count: 'exact', head: true });
  if (createdAtBetween) {
    countQuery = countQuery
      .gte('created_at', createdAtBetween.startIso)
      .lte('created_at', createdAtBetween.endIso);
  }
  const countRes = await countQuery;
  if (countRes.error) {
    throw countRes.error;
  }
  summary.totalReports = countRes.count ?? 0;

  let from = 0;
  for (;;) {
    if (signal?.aborted) break;
    const batchRes = isInstallation
      ? await (() => {
          let q = client
            .from(tables.reports)
            .select('id,vehicle_id,user_id,tool_values,payload')
            .order('id', { ascending: true });
          if (createdAtBetween) {
            q = q.gte('created_at', createdAtBetween.startIso).lte('created_at', createdAtBetween.endIso);
          }
          return q.range(from, from + batchSize - 1);
        })()
      : await (() => {
          let q = client
            .from(tables.reports)
            .select('id,vehicle_id,user_id,tool_values')
            .order('id', { ascending: true });
          if (createdAtBetween) {
            q = q.gte('created_at', createdAtBetween.startIso).lte('created_at', createdAtBetween.endIso);
          }
          return q.range(from, from + batchSize - 1);
        })();
    const batch = batchRes.data;
    const batchError = batchRes.error;

    if (batchError) {
      throw batchError;
    }
    const rows = (batch ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) break;

    for (const row of rows) {
      if (signal?.aborted) break;
      const reportId = Number(row.id);
      const vehicleId = Number(row.vehicle_id);
      if (!Number.isFinite(reportId) || !Number.isFinite(vehicleId)) {
        summary.errors.push({
          reportId: Number.isFinite(reportId) ? reportId : -1,
          message: 'معرف تقرير أو مركبة غير صالح',
        });
        summary.processed += 1;
        onProgress?.(summary.processed, summary.totalReports);
        continue;
      }

      const userRaw = row.user_id;
      const userId =
        userRaw != null && String(userRaw).trim() !== '' ? String(userRaw) : null;

      let toolValuesRaw: unknown = row.tool_values;
      if (isInstallation) {
        const payload =
          row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : {};
        toolValuesRaw = row.tool_values ?? payload.tool_values;
      }
      const toolValues = normalizeToolValuesRecord(toolValuesRaw);

      const hasToolkit = vehicleToolkit.get(vehicleId) ?? true;

      try {
        const result = await calculateInspectionRecovery({
          client,
          department,
          inspectionId: reportId,
          vehicleId,
          userId,
          hasToolkit,
          toolValues,
          templatesOverride: templates,
          compareWithPreviousRecovery: false,
        });
        summary.processed += 1;
        if (result.skippedNoToolkit) {
          summary.skippedNoToolkit += 1;
        } else {
          summary.insertedRows += result.insertedCount;
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        summary.errors.push({ reportId, message });
        summary.processed += 1;
      }

      onProgress?.(summary.processed, summary.totalReports);
    }

    from += rows.length;
    if (rows.length < batchSize) break;
  }

  return summary;
}
