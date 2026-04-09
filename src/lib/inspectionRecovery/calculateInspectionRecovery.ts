import type { SupabaseClient } from '@supabase/supabase-js';
import type { DepartmentCode } from '../../data/department';
import { TOOL_INVENTORY_ITEMS } from '../../constants';

interface InventoryTemplateRow {
  id: number;
  item_name: string;
  required_quantity: number;
}

interface RecoveryRowInsert {
  inspection_id: number;
  vehicle_id: number;
  user_id: string;
  department: 'tajhiz' | 'installation';
  item_name: string;
  required_qty: number;
  actual_qty: number;
  missing_qty: number;
  status: 'pending';
  action_type: 'auto';
}

export interface CalculateInspectionRecoveryParams {
  client: SupabaseClient;
  department: DepartmentCode;
  inspectionId: number;
  vehicleId: number;
  userId: string;
  hasToolkit: boolean;
  toolValues: Record<number, number>;
}

export interface CalculateInspectionRecoveryResult {
  skippedNoToolkit: boolean;
  insertedCount: number;
}

function normalizeDepartment(department: DepartmentCode): 'tajhiz' | 'installation' | null {
  if (department === 'installation') return 'installation';
  if (department === 'tajhiz') return 'tajhiz';
  return null;
}

export async function calculateInspectionRecovery({
  client,
  department,
  inspectionId,
  vehicleId,
  userId,
  hasToolkit,
  toolValues,
}: CalculateInspectionRecoveryParams): Promise<CalculateInspectionRecoveryResult> {
  const safeDepartment = normalizeDepartment(department);
  if (!safeDepartment) {
    return { skippedNoToolkit: false, insertedCount: 0 };
  }

  if (!hasToolkit) {
    return { skippedNoToolkit: true, insertedCount: 0 };
  }

  const { data: templates, error: templatesError } = await client
    .from('inventory_item_templates')
    .select('id,item_name,required_quantity')
    .eq('department_code', safeDepartment)
    .eq('category', 'tools')
    .eq('is_active', true);

  if (templatesError) {
    throw templatesError;
  }

  const templateRows = (templates ?? []) as InventoryTemplateRow[];
  const sourceTemplates =
    templateRows.length > 0
      ? templateRows
      : TOOL_INVENTORY_ITEMS.map((item) => ({
          id: item.id,
          item_name: item.name,
          required_quantity: item.quantity,
        }));

  const recoveryRows: RecoveryRowInsert[] = [];
  for (const item of sourceTemplates) {
    const requiredQty = Number(item.required_quantity ?? 0);
    const actualQtyRaw = Number(toolValues[Number(item.id)] ?? 0);
    const actualQty = Number.isFinite(actualQtyRaw) ? Math.max(0, actualQtyRaw) : 0;
    const missingQty = Math.max(requiredQty - actualQty, 0);
    if (missingQty < 1) continue;
    recoveryRows.push({
      inspection_id: inspectionId,
      vehicle_id: vehicleId,
      user_id: userId,
      department: safeDepartment,
      item_name: String(item.item_name ?? ''),
      required_qty: requiredQty,
      actual_qty: actualQty,
      missing_qty: missingQty,
      status: 'pending',
      action_type: 'auto',
    });
  }

  // Keep only latest computed snapshot for the same inspection.
  const { error: deleteError } = await client
    .from('inspection_recovery')
    .delete()
    .eq('inspection_id', inspectionId)
    .eq('department', safeDepartment);
  if (deleteError) {
    throw deleteError;
  }

  if (recoveryRows.length === 0) {
    return { skippedNoToolkit: false, insertedCount: 0 };
  }

  const { error: insertError } = await client.from('inspection_recovery').insert(recoveryRows);
  if (insertError) {
    throw insertError;
  }

  return { skippedNoToolkit: false, insertedCount: recoveryRows.length };
}
