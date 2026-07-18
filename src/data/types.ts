export interface DepartmentVehicle {
  id: number;
  vehicle_number?: string;
  plate_number?: string;
  vehicle_type: string | null;
  location?: string | null;
  responsible_staff_id?: number | null;
  assigned_driver_id?: string | null;
  status: string;
  created_at: string;
}

export interface DepartmentExitRequest {
  id: number | string;
  status: string;
  created_at: string;
  vehicle_id: number | null;
}

export interface DepartmentAttendanceRecord {
  id: number;
  staff_id: number;
  attendance_date: string;
  attendance_type: string;
}

export interface DepartmentMaintenanceRequest {
  id: number;
  vehicle_id: number;
  status: string;
  maintenance_type: string;
  created_at: string;
}
