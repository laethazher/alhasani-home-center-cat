import type { DepartmentCode } from '../department';

export interface GateNotificationPayload {
  sourceDepartment: DepartmentCode;
  sourceModule: string;
  requestRef: string;
  title: string;
  message?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  targetRole?: 'gate_guard' | 'admin' | 'manager';
  metadata?: Record<string, unknown>;
}

export interface GateNotificationRecord extends GateNotificationPayload {
  id: number;
  isRead: boolean;
  createdAt: string;
}

export function toGateNotificationInsert(payload: GateNotificationPayload) {
  return {
    source_department: payload.sourceDepartment,
    source_module: payload.sourceModule,
    request_ref: payload.requestRef,
    title: payload.title,
    message: payload.message ?? null,
    created_by: payload.createdBy ?? null,
    created_by_name: payload.createdByName ?? null,
    target_role: payload.targetRole ?? 'gate_guard',
    metadata: payload.metadata ?? {},
  };
}
