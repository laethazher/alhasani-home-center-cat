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

export type UserRole = 'admin' | 'driver' | 'manager' | 'warehouse' | 'logistics' | 'gate_guard';

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

export type ExitRequestStatus = 'pending' | 'approved' | 'rejected' | 'exited';

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
  assistant_returns: Record<string, string> | null;
  created_by: string;
  approved_at: string | null;
  approved_by: string | null;
  exited_at: string | null;
  gate_guard_id: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface Vehicle {
  id: number;
  plate_number: string;
  model: string | null;
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
