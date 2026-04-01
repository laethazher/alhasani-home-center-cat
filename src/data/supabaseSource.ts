import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { getInstallationSupabaseClient, hasInstallationSupabaseClient } from '../lib/supabaseInstallationClient';
import type { DepartmentCode } from './department';

export function getDepartmentClient(department: DepartmentCode): SupabaseClient {
  if (department !== 'installation') return supabase;
  // If dedicated installation keys are not provided, use the same Supabase project
  // while keeping data isolated by table names.
  return hasInstallationSupabaseClient() ? getInstallationSupabaseClient() : supabase;
}

export interface DepartmentTables {
  staffMembers: string;
  vehicles: string;
  vehicleEvents: string;
  exitRequests: string;
  maintenanceRequests: string;
  maintenanceRecords: string;
  attendance: string;
  violations: string;
  reports: string;
  inventoryTemplates: string;
  gateNotifications: string;
}

export function getDepartmentTables(department: DepartmentCode): DepartmentTables {
  if (department === 'installation') {
    return {
      staffMembers: 'installation_staff_members',
      vehicles: 'installation_vehicles',
      vehicleEvents: 'installation_vehicle_events',
      exitRequests: 'installation_exit_requests',
      maintenanceRequests: 'installation_maintenance_requests',
      maintenanceRecords: 'installation_maintenance_records',
      attendance: 'installation_attendance',
      violations: 'installation_violations',
      reports: 'installation_reports',
      inventoryTemplates: 'inventory_item_templates',
      gateNotifications: 'gate_notifications',
    };
  }

  return {
    staffMembers: 'staff_members',
    vehicles: 'vehicles',
    vehicleEvents: 'vehicle_events',
    exitRequests: 'exit_requests',
    maintenanceRequests: 'maintenance_requests',
    maintenanceRecords: 'maintenance_records',
    attendance: 'attendance',
    violations: 'violations',
    reports: 'reports',
    inventoryTemplates: 'inventory_item_templates',
    gateNotifications: 'gate_notifications',
  };
}
