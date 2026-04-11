import type { DepartmentCode } from '../department';
import { getDepartmentClient, getDepartmentTables } from '../supabaseSource';

export interface InventoryTemplateItem {
  id: number;
  department_code: DepartmentCode;
  category: string;
  item_name: string;
  barcode?: string | null;
  required_quantity: number;
  sort_order: number;
  is_active: boolean;
}

export class InventoryRepository {
  async listTemplates(department: DepartmentCode): Promise<InventoryTemplateItem[]> {
    const client = getDepartmentClient(department);
    const table = getDepartmentTables(department).inventoryTemplates;
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('department_code', department)
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return (data ?? []) as InventoryTemplateItem[];
  }

  async upsertTemplate(
    department: DepartmentCode,
    item: Omit<InventoryTemplateItem, 'id' | 'department_code'>
  ): Promise<void> {
    const client = getDepartmentClient(department);
    const table = getDepartmentTables(department).inventoryTemplates;
    const { error } = await client.from(table).upsert(
      {
        department_code: department,
        category: item.category,
        item_name: item.item_name,
        barcode: item.barcode ?? null,
        required_quantity: item.required_quantity,
        sort_order: item.sort_order,
        is_active: item.is_active,
      },
      { onConflict: 'department_code,category,item_name' }
    );
    if (error) throw error;
  }
}
