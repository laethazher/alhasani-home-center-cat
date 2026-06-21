import { supabase } from '../../lib/supabaseClient';

export type OpsTaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type OpsTaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type OpsFieldTeamStatus = 'idle' | 'deployed' | 'returning' | 'offline';
export type OpsIncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type OpsIncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';
export type OpsScheduleType = 'shift' | 'deployment' | 'maintenance_window' | 'meeting';
export type OpsIntegrationStatus = 'inactive' | 'active' | 'error';

export interface OpsTask {
  id: number;
  title: string;
  description: string | null;
  status: OpsTaskStatus;
  priority: OpsTaskPriority;
  assignee_name: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpsFieldTeam {
  id: number;
  name: string;
  leader_name: string | null;
  location: string | null;
  status: OpsFieldTeamStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpsIncident {
  id: number;
  title: string;
  description: string | null;
  severity: OpsIncidentSeverity;
  status: OpsIncidentStatus;
  location: string | null;
  reported_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpsSchedule {
  id: number;
  title: string;
  schedule_type: OpsScheduleType;
  start_at: string;
  end_at: string;
  team_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpsEquipment {
  id: number;
  name: string;
  sku: string | null;
  category: string | null;
  quantity: number;
  min_stock: number;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpsIntegration {
  id: number;
  name: string;
  provider: string;
  status: OpsIntegrationStatus;
  config: Record<string, unknown>;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpsDashboardStats {
  tasksOpen: number;
  tasksUrgent: number;
  teamsDeployed: number;
  incidentsOpen: number;
  schedulesToday: number;
  equipmentLowStock: number;
  integrationsActive: number;
  lettersUnsigned: number;
}

class OperationsModulesRepository {
  async getDashboardStats(): Promise<OpsDashboardStats> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      tasksRes,
      urgentRes,
      teamsRes,
      incidentsRes,
      schedulesRes,
      equipmentRes,
      integrationsRes,
      lettersUnsignedRes,
    ] = await Promise.all([
      supabase.from('operations_tasks').select('id', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
      supabase.from('operations_tasks').select('id', { count: 'exact', head: true }).eq('priority', 'urgent').in('status', ['pending', 'in_progress']),
      supabase.from('operations_field_teams').select('id', { count: 'exact', head: true }).eq('status', 'deployed'),
      supabase.from('operations_incidents').select('id', { count: 'exact', head: true }).in('status', ['open', 'investigating']),
      supabase.from('operations_schedules').select('id', { count: 'exact', head: true }).gte('start_at', todayStart.toISOString()).lte('start_at', todayEnd.toISOString()),
      supabase.from('operations_equipment').select('id, quantity, min_stock'),
      supabase.from('operations_integrations').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase
        .from('operations_admin_letters')
        .select('id', { count: 'exact', head: true })
        .eq('is_signed', false)
        .eq('archive_status', 'active'),
    ]);

    const equipmentRows = (equipmentRes.data ?? []) as Pick<OpsEquipment, 'quantity' | 'min_stock'>[];
    const lowStock = equipmentRows.filter((r) => r.quantity <= r.min_stock).length;

    let lettersUnsigned = 0;
    if (lettersUnsignedRes.error) {
      console.warn('operations_admin_letters not available:', lettersUnsignedRes.error.message);
    } else {
      lettersUnsigned = lettersUnsignedRes.count ?? 0;
    }

    return {
      tasksOpen: tasksRes.count ?? 0,
      tasksUrgent: urgentRes.count ?? 0,
      teamsDeployed: teamsRes.count ?? 0,
      incidentsOpen: incidentsRes.count ?? 0,
      schedulesToday: schedulesRes.count ?? 0,
      equipmentLowStock: lowStock,
      integrationsActive: integrationsRes.count ?? 0,
      lettersUnsigned,
    };
  }

  async listTasks(): Promise<OpsTask[]> {
    const { data, error } = await supabase.from('operations_tasks').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as OpsTask[];
  }

  async createTask(payload: Pick<OpsTask, 'title' | 'description' | 'priority' | 'assignee_name' | 'due_date'>): Promise<OpsTask> {
    const { data, error } = await supabase.from('operations_tasks').insert(payload).select('*').single();
    if (error) throw error;
    return data as OpsTask;
  }

  async updateTaskStatus(id: number, status: OpsTaskStatus): Promise<void> {
    const { error } = await supabase.from('operations_tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }

  async listFieldTeams(): Promise<OpsFieldTeam[]> {
    const { data, error } = await supabase.from('operations_field_teams').select('*').order('name');
    if (error) throw error;
    return (data ?? []) as OpsFieldTeam[];
  }

  async createFieldTeam(payload: Pick<OpsFieldTeam, 'name' | 'leader_name' | 'location' | 'status' | 'notes'>): Promise<OpsFieldTeam> {
    const { data, error } = await supabase.from('operations_field_teams').insert(payload).select('*').single();
    if (error) throw error;
    return data as OpsFieldTeam;
  }

  async updateFieldTeamStatus(id: number, status: OpsFieldTeamStatus): Promise<void> {
    const { error } = await supabase.from('operations_field_teams').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }

  async listIncidents(): Promise<OpsIncident[]> {
    const { data, error } = await supabase.from('operations_incidents').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as OpsIncident[];
  }

  async createIncident(payload: Pick<OpsIncident, 'title' | 'description' | 'severity' | 'location' | 'reported_by'>): Promise<OpsIncident> {
    const { data, error } = await supabase.from('operations_incidents').insert(payload).select('*').single();
    if (error) throw error;
    return data as OpsIncident;
  }

  async updateIncidentStatus(id: number, status: OpsIncidentStatus): Promise<void> {
    const patch: { status: OpsIncidentStatus; updated_at: string; resolved_at?: string | null } = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'resolved' || status === 'closed') patch.resolved_at = new Date().toISOString();
    const { error } = await supabase.from('operations_incidents').update(patch).eq('id', id);
    if (error) throw error;
  }

  async listSchedules(): Promise<OpsSchedule[]> {
    const { data, error } = await supabase.from('operations_schedules').select('*').order('start_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as OpsSchedule[];
  }

  async createSchedule(payload: Pick<OpsSchedule, 'title' | 'schedule_type' | 'start_at' | 'end_at' | 'team_name' | 'notes'>): Promise<OpsSchedule> {
    const { data, error } = await supabase.from('operations_schedules').insert(payload).select('*').single();
    if (error) throw error;
    return data as OpsSchedule;
  }

  async listEquipment(): Promise<OpsEquipment[]> {
    const { data, error } = await supabase.from('operations_equipment').select('*').order('name');
    if (error) throw error;
    return (data ?? []) as OpsEquipment[];
  }

  async createEquipment(payload: Pick<OpsEquipment, 'name' | 'sku' | 'category' | 'quantity' | 'min_stock' | 'location' | 'notes'>): Promise<OpsEquipment> {
    const { data, error } = await supabase.from('operations_equipment').insert(payload).select('*').single();
    if (error) throw error;
    return data as OpsEquipment;
  }

  async listIntegrations(): Promise<OpsIntegration[]> {
    const { data, error } = await supabase.from('operations_integrations').select('*').order('name');
    if (error) throw error;
    return (data ?? []) as OpsIntegration[];
  }

  async createIntegration(payload: Pick<OpsIntegration, 'name' | 'provider' | 'status'>): Promise<OpsIntegration> {
    const { data, error } = await supabase.from('operations_integrations').insert(payload).select('*').single();
    if (error) throw error;
    return data as OpsIntegration;
  }

  async updateIntegrationStatus(id: number, status: OpsIntegrationStatus): Promise<void> {
    const patch: { status: OpsIntegrationStatus; updated_at: string; last_sync_at?: string } = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'active') patch.last_sync_at = new Date().toISOString();
    const { error } = await supabase.from('operations_integrations').update(patch).eq('id', id);
    if (error) throw error;
  }
}

export const operationsModulesRepository = new OperationsModulesRepository();
