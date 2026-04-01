import type { DepartmentCode } from '../department';
import { getDepartmentClient, getDepartmentTables } from '../supabaseSource';
import type { DepartmentVehicle } from '../types';

export class VehiclesRepository {
  async list(department: DepartmentCode): Promise<DepartmentVehicle[]> {
    const client = getDepartmentClient(department);
    const tables = getDepartmentTables(department);
    const orderKey = department === 'installation' ? 'vehicle_number' : 'plate_number';
    const { data, error } = await client.from(tables.vehicles).select('*').order(orderKey);
    if (error) throw error;
    return (data ?? []) as DepartmentVehicle[];
  }

  async createEvent(
    department: DepartmentCode,
    vehicleId: number,
    eventType: string,
    description: string
  ): Promise<void> {
    const client = getDepartmentClient(department);
    const tables = getDepartmentTables(department);
    const { error } = await client.from(tables.vehicleEvents).insert({
      vehicle_id: vehicleId,
      event_type: eventType,
      description,
    });
    if (error) throw error;
  }
}
