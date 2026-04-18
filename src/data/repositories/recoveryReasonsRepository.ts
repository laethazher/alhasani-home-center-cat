import type { DepartmentCode } from '../department';
import { getDepartmentClient } from '../supabaseSource';

export type RecoveryReasonCategory = 'customer_compensation' | 'sale' | 'damage' | 'loss' | 'other';

export interface RecoveryCompensationReason {
  id: number;
  recovery_id: number | null;
  recovery_action_id: number | null;
  inspection_id: number;
  vehicle_id: number;
  user_id: string | null;
  department: 'tajhiz' | 'installation' | 'operations';
  driver_name: string | null;
  item_name: string;
  item_barcode: string | null;
  compensated_qty: number;
  remaining_qty_after_action: number;
  reason_category: RecoveryReasonCategory;
  reason_details: string | null;
  customer_name: string | null;
  invoice_number: string | null;
  compensated_item_name: string | null;
  compensated_item_barcode: string | null;
  occurred_at: string;
  created_at: string;
  created_by: string | null;
}

export interface RecoveryCompensationReasonInsert {
  recovery_id: number | null;
  recovery_action_id: number | null;
  inspection_id: number;
  vehicle_id: number;
  user_id: string | null;
  department: 'tajhiz' | 'installation' | 'operations';
  driver_name?: string | null;
  item_name: string;
  item_barcode?: string | null;
  compensated_qty: number;
  remaining_qty_after_action: number;
  reason_category: RecoveryReasonCategory;
  reason_details?: string | null;
  customer_name?: string | null;
  invoice_number?: string | null;
  compensated_item_name?: string | null;
  compensated_item_barcode?: string | null;
  occurred_at?: string;
  created_by?: string | null;
}

export class RecoveryReasonsRepository {
  async listByDepartment(department: DepartmentCode, limit = 5000): Promise<RecoveryCompensationReason[]> {
    const client = getDepartmentClient(department);
    const { data, error } = await client
      .from('inspection_recovery_compensation_reasons')
      .select('*')
      .eq('department', department)
      .order('occurred_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as RecoveryCompensationReason[];
  }

  async insert(department: DepartmentCode, payload: RecoveryCompensationReasonInsert): Promise<RecoveryCompensationReason> {
    const client = getDepartmentClient(department);
    const { data, error } = await client
      .from('inspection_recovery_compensation_reasons')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return data as RecoveryCompensationReason;
  }
}
