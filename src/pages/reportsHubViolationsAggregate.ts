import type { ExitRequest, StaffMember, Violation } from '../lib/supabaseClient';

/** صف مجمّع لمخالفات الخروج المؤقت (نفس منطق صفحة Violations — دالة pure) */
export interface HubViolationStaffRow {
  staffId: string;
  staffName: string;
  staffRole: 'driver' | 'assistant';
  totalViolations: number;
  totalDelayMinutes: number;
}

type Agg = {
  staffId: string;
  staffName: string;
  staffRole: 'driver' | 'assistant';
  totalViolations: number;
  totalDelayMinutes: number;
};

/**
 * يبني قائمة موظفين مع عدد المخالفات ومجموع دقائق التأخير من طلبات الخروج المؤقت + المخالفات اليدوية.
 */
export function buildHubViolationStaffRows(
  requests: ExitRequest[],
  staff: StaffMember[],
  manualViolations: Violation[]
): HubViolationStaffRow[] {
  const map = new Map<string, Agg>();
  const staffMap = new Map<string, StaffMember>(staff.map((s) => [String(s.id), s]));
  const now = new Date();

  for (const req of requests) {
    if (!req.exited_at || !req.exit_duration_minutes) continue;
    const exitedTime = new Date(req.exited_at).getTime();
    const allowedMs = req.exit_duration_minutes * 60 * 1000;
    const deadline = exitedTime + allowedMs;

    for (let i = 0; i < req.assistant_ids.length; i++) {
      const aId = String(req.assistant_ids[i]);
      const aName = req.assistant_names[i] || 'مساعد';
      const returns = req.assistant_returns || {};
      const returnedAt = returns[aId];

      let delayMs = 0;
      let isViolation = false;

      if (returnedAt) {
        const returnTime = new Date(returnedAt).getTime();
        delayMs = returnTime - deadline;
        isViolation = delayMs > 0;
      } else {
        delayMs = now.getTime() - deadline;
        isViolation = delayMs > 0;
      }

      if (isViolation) {
        const delayMinutes = Math.floor(delayMs / (1000 * 60));
        if (!map.has(aId)) {
          map.set(aId, {
            staffId: aId,
            staffName: staffMap.get(aId)?.full_name || aName,
            staffRole: 'assistant',
            totalViolations: 0,
            totalDelayMinutes: 0,
          });
        }
        const entry = map.get(aId)!;
        entry.totalViolations++;
        entry.totalDelayMinutes += delayMinutes;
      }
    }

    if (req.driver_id) {
      const dId = String(req.driver_id);
      const dName = req.driver_name || 'سائق';
      const returns = req.assistant_returns || {};
      const driverReturnedAt = returns[dId];

      let driverDelayMs = 0;
      let driverIsViolation = false;

      if (driverReturnedAt) {
        const returnTime = new Date(driverReturnedAt).getTime();
        driverDelayMs = returnTime - deadline;
        driverIsViolation = driverDelayMs > 0;
      } else {
        driverDelayMs = now.getTime() - deadline;
        driverIsViolation = driverDelayMs > 0;
      }

      if (driverIsViolation) {
        const delayMinutes = Math.floor(driverDelayMs / (1000 * 60));
        if (!map.has(dId)) {
          map.set(dId, {
            staffId: dId,
            staffName: staffMap.get(dId)?.full_name || dName,
            staffRole: 'driver',
            totalViolations: 0,
            totalDelayMinutes: 0,
          });
        }
        const entry = map.get(dId)!;
        entry.totalViolations++;
        entry.totalDelayMinutes += delayMinutes;
      }
    }
  }

  for (const violation of manualViolations) {
    const staffId = String(violation.staff_id);
    const staffMember = staffMap.get(staffId);
    if (!staffMember) continue;

    if (!map.has(staffId)) {
      map.set(staffId, {
        staffId,
        staffName: staffMember.full_name,
        staffRole: staffMember.role as 'driver' | 'assistant',
        totalViolations: 0,
        totalDelayMinutes: 0,
      });
    }
    const entry = map.get(staffId)!;
    entry.totalViolations++;
  }

  return Array.from(map.values());
}
