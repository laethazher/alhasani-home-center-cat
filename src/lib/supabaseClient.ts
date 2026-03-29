import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,   // internal app — no OAuth redirects
  },
});

/* ── Types ── */

export type UserRole = 'admin' | 'driver' | 'manager' | 'warehouse' | 'logistics' | 'gate_guard' | 'maintenance_manager';

/* ── Staff Exit Types ── */

export type StaffRole = 'driver' | 'assistant';

export interface StaffMember {
  id: string;
  full_name: string;
  role: StaffRole;
  city: string | null;
  is_active: boolean;
  created_at: string;
}

export type ExitRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'exited'
  | 'pending_issue'
  | 'approved_override';

export type ExitType = 'permanent' | 'temporary';

export interface ExitRequest {
  id: string;
  driver_id: string | null;
  driver_name: string;
  assistant_ids: string[];
  assistant_names: string[];
  status: ExitRequestStatus;
  notes: string | null;
  exit_reason: string | null;
  exit_type: ExitType;
  exit_duration_minutes: number | null;
  vehicle_id: number | null;
  vehicle_plate: string | null;
  /** حجم المركبة (م³) */
  vehicle_cbm?: number | null;
  /** تحقق القواطع عند البوابة؛ null/undefined = لم يُسجَّل بعد */
  loading_verified?: boolean | null;
  loading_issue_reason?: string | null;
  assistant_returns: Record<string, string> | null;
  created_by: string;
  approved_at: string | null;
  approved_by: string | null;
  exited_at: string | null;
  /** قد تُضاف من قاعدة البيانات لاحقاً */
  returned_at?: string | null;
  gate_guard_id: string | null;
  created_at: string;
  /** Present when column exists (migration); treat missing as false */
  track_driver_loading_time?: boolean;
  loading_minutes_from_shift_start: number | null;
  loading_delay_minutes: number | null;
  loading_is_delay: boolean | null;
}

/* ── Bubbles Tracking ── */

export type BubblesRecordStatus = 'pending' | 'completed' | 'delayed' | 'issue';

export interface BubblesRecord {
  id: string;
  driver_name: string;
  customer_name: string;
  product_type: string | null;
  quantity: number;
  invoice_number: string | null;
  location: string | null;
  cbm: number | null;
  status: BubblesRecordStatus;
  reason: string | null;
  created_at: string;
  return_time: string | null;
}

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export type VehicleStatus = 'available' | 'maintenance' | 'broken' | 'reserved';

export interface Vehicle {
  id: number;
  plate_number: string;
  model: string | null;
  vehicle_type: string | null;
  color: string | null;
  year: number | null;
  chassis_number: string | null;
  fuel_type: string | null;
  odometer_km: number;
  status: VehicleStatus;
  license_expiry: string | null;
  insurance_expiry: string | null;
  image_url: string | null;
  notes: string | null;
  assigned_driver_id: string | null;
  has_logo: boolean;
  created_at: string;
  updated_at: string;
}

export interface VehicleMaintenance {
  id: number;
  vehicle_id: number;
  maintenance_type: string;
  description: string | null;
  cost: number;
  odometer_at: number | null;
  performed_at: string;
  next_maintenance_date: string | null;
  next_maintenance_km: number | null;
  performed_by: string | null;
  notes: string | null;
  created_at: string;
}

export type VehicleEventType = 'driver_assigned' | 'driver_removed' | 'status_changed' | 'license_renewed' | 'insurance_renewed' | 'odometer_updated' | 'note_added' | 'created' | 'vehicle_exit' | 'report_created';

export interface VehicleEvent {
  id: number;
  vehicle_id: number;
  event_type: VehicleEventType;
  description: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface Report {
  id: number;
  user_id: string;
  vehicle_id: number | null;
  driver_name: string | null;
  truck_number: string | null;
  date: string | null;
  damage_points: Record<string, unknown> | null;
  inspection_values: Record<string, unknown> | null;
  tool_values: Record<string, unknown> | null;
  tool_images: Record<string, unknown> | null;
  driver_signature: string | null;
  equipment_manager: string | null;
  logistics_manager: string | null;
  warehouse_manager: string | null;
  created_at: string;
}

export interface Violation {
  id: number;
  staff_id: number;
  violation_type: string;
  violation_reason: string;
  violation_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

/* ── Maintenance System Types ── */

export type MaintenanceRequestStatus = 'pending' | 'approved' | 'rejected' | 'in_progress' | 'completed';
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';
export type MaintenanceImageType = 'before' | 'during' | 'after' | 'invoice' | 'issue';
export type PeriodicMaintenanceStatus = 'good' | 'approaching' | 'overdue';
export type DriverIssueStatus = 'pending' | 'reviewed' | 'converted';

export interface MaintenanceRequest {
  id: number;
  vehicle_id: number;
  driver_id: number | null;
  maintenance_type: string;
  description: string | null;
  priority: MaintenancePriority;
  admin_notes: string | null;
  status: MaintenanceRequestStatus;
  images: string[];
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface MaintenanceRecord {
  id: number;
  request_id: number | null;
  vehicle_id: number;
  maintenance_type: string | null;
  fault_description: string | null;
  work_done: string | null;
  inspection_only: boolean;
  parts_replaced: string | null;
  technician_name: string | null;
  cost: number;
  duration_minutes: number | null;
  odometer_at: number | null;
  notes: string | null;
  created_at: string;
}

export interface MaintenanceImage {
  id: number;
  request_id: number | null;
  record_id: number | null;
  image_url: string;
  image_type: MaintenanceImageType;
  uploaded_by: string | null;
  created_at: string;
}

export interface SparePart {
  id: number;
  name: string;
  part_number: string | null;
  supplier: string | null;
  price: number;
  quantity: number;
  notes: string | null;
  created_at: string;
}

export interface SparePartUsage {
  id: number;
  record_id: number;
  part_id: number;
  quantity_used: number;
  unit_cost: number | null;
  created_at: string;
}

export interface DriverIssueReport {
  id: number;
  vehicle_id: number;
  driver_id: number | null;
  description: string;
  images: string[];
  status: DriverIssueStatus;
  created_at: string;
}

export interface PeriodicMaintenance {
  id: number;
  vehicle_id: number;
  maintenance_type: string;
  last_performed_at: string | null;
  next_due_date: string | null;
  next_due_km: number | null;
  interval_days: number | null;
  interval_km: number | null;
  status: PeriodicMaintenanceStatus;
  created_at: string;
}

export interface MaintenanceNotification {
  id: number;
  vehicle_id: number | null;
  notification_type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  due_date: string | null;
  target_role: string | null;
  created_at: string;
}

/* ── Crew Attendance Types ── */

export type AttendanceType = 'present' | 'late' | 'absent' | 'full_leave' | 'time_leave';

export interface Attendance {
  id: number;
  staff_id: number;
  attendance_date: string;
  attendance_type: AttendanceType;
  check_in_time: string | null;
  check_out_time: string | null;
  notes: string | null;
  vehicle_id: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceArchive {
  id: number;
  staff_id: number;
  attendance_date: string;
  attendance_type: AttendanceType;
  check_in_time: string | null;
  check_out_time: string | null;
  notes: string | null;
  vehicle_id: number | null;
  created_by: string | null;
  archived_by: string | null;
  archived_at: string;
}

export interface AttendanceActivityLog {
  id: number;
  action_type: 'add' | 'edit' | 'archive' | 'export';
  entity_type: string;
  metadata: Record<string, unknown>;
  user_id: string | null;
  created_at: string;
}
