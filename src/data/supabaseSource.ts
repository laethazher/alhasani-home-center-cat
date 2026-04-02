import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, type Vehicle } from '../lib/supabaseClient';
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
  maintenanceImages: string;
  spareParts: string;
  sparePartUsage: string;
  periodicMaintenance: string;
  maintenanceNotifications: string;
  driverIssueReports: string;
  attendance: string;
  violations: string;
  reports: string;
  inventoryTemplates: string;
  gateNotifications: string;
}

/** مراجع ثابتة — تجنب إنشاء كائن جديد كل render (كان يسبب إعادة جلب بيانات متكررة وبطء في الصيانة وغيرها). */
const INSTALLATION_TABLES: DepartmentTables = {
  staffMembers: 'installation_staff_members',
  vehicles: 'installation_vehicles',
  vehicleEvents: 'installation_vehicle_events',
  exitRequests: 'installation_exit_requests',
  maintenanceRequests: 'installation_maintenance_requests',
  maintenanceRecords: 'installation_maintenance_records',
  maintenanceImages: 'installation_maintenance_images',
  spareParts: 'installation_spare_parts',
  sparePartUsage: 'installation_spare_part_usage',
  periodicMaintenance: 'installation_periodic_maintenance',
  maintenanceNotifications: 'installation_maintenance_notifications',
  driverIssueReports: 'installation_driver_issue_reports',
  attendance: 'installation_attendance',
  violations: 'installation_violations',
  reports: 'installation_reports',
  inventoryTemplates: 'inventory_item_templates',
  gateNotifications: 'gate_notifications',
};

const TAJHIZ_TABLES: DepartmentTables = {
  staffMembers: 'staff_members',
  vehicles: 'vehicles',
  vehicleEvents: 'vehicle_events',
  exitRequests: 'exit_requests',
  maintenanceRequests: 'maintenance_requests',
  maintenanceRecords: 'maintenance_records',
  maintenanceImages: 'maintenance_images',
  spareParts: 'spare_parts',
  sparePartUsage: 'spare_part_usage',
  periodicMaintenance: 'periodic_maintenance',
  maintenanceNotifications: 'maintenance_notifications',
  driverIssueReports: 'driver_issue_reports',
  attendance: 'attendance',
  violations: 'violations',
  reports: 'reports',
  inventoryTemplates: 'inventory_item_templates',
  gateNotifications: 'gate_notifications',
};

export function getDepartmentTables(department: DepartmentCode): DepartmentTables {
  return department === 'installation' ? INSTALLATION_TABLES : TAJHIZ_TABLES;
}

/** توحيد عرض مركبات التركيب (vehicle_number) مع واجهة التجهيز (plate_number). */
export function normalizeDepartmentVehicleRow(row: Record<string, unknown>): Vehicle {
  return {
    ...row,
    plate_number: String(row.plate_number ?? row.vehicle_number ?? ''),
    assigned_driver_id:
      row.assigned_driver_id != null
        ? String(row.assigned_driver_id)
        : row.responsible_staff_id != null
          ? String(row.responsible_staff_id)
          : null,
  } as Vehicle;
}
