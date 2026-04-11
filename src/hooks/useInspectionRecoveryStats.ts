import { useEffect, useMemo, useRef, useState } from 'react';
import type { DepartmentCode } from '../data/department';
import { getDepartmentClient } from '../data/supabaseSource';

type RecoveryStatus = 'pending' | 'scheduled' | 'resolved';

interface RecoveryRow {
  vehicle_id: number;
  user_id: string | null;
  missing_qty: number;
  status: RecoveryStatus;
  scheduled_date: string | null;
}

export interface InspectionRecoveryStats {
  totalMissing: number;
  vehicleRiskScore: number;
  userGapCount: number;
  pendingCount: number;
  dueReminderCount: number;
}

const EMPTY_STATS: InspectionRecoveryStats = {
  totalMissing: 0,
  vehicleRiskScore: 0,
  userGapCount: 0,
  pendingCount: 0,
  dueReminderCount: 0,
};

export function useInspectionRecoveryStats(department: DepartmentCode, enabled = true) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<InspectionRecoveryStats>(EMPTY_STATS);
  const client = useMemo(() => getDepartmentClient(department), [department]);
  const loadSeq = useRef(0);

  useEffect(() => {
    if (
      !enabled ||
      (department !== 'tajhiz' && department !== 'installation' && department !== 'operations')
    ) {
      setStats(EMPTY_STATS);
      setLoading(false);
      return;
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const load = async () => {
      const seq = ++loadSeq.current;
      setLoading(true);
      try {
        const { data, error } = await client
          .from('inspection_recovery')
          .select('vehicle_id,user_id,missing_qty,status,scheduled_date')
          .eq('department', department)
          .order('created_at', { ascending: false })
          .limit(4000);
        if (error) throw error;

        const rows = (data ?? []) as RecoveryRow[];
        let totalMissing = 0;
        let pendingCount = 0;
        let dueReminderCount = 0;
        const riskyVehicles = new Set<number>();
        const usersWithGap = new Set<string>();
        for (const row of rows) {
          const missing = Number(row.missing_qty ?? 0);
          totalMissing += missing;
          const effectivePending = row.status === 'pending' || (row.status === 'scheduled' && !!row.scheduled_date && row.scheduled_date <= todayIso);
          if (effectivePending) {
            pendingCount += 1;
            riskyVehicles.add(Number(row.vehicle_id));
            if (row.user_id) usersWithGap.add(String(row.user_id));
          }
          if (row.status === 'scheduled' && !!row.scheduled_date && row.scheduled_date <= todayIso) {
            dueReminderCount += 1;
          }
        }
        if (seq === loadSeq.current) {
          setStats({
            totalMissing,
            vehicleRiskScore: riskyVehicles.size,
            userGapCount: usersWithGap.size,
            pendingCount,
            dueReminderCount,
          });
        }
      } catch {
        if (seq === loadSeq.current) setStats(EMPTY_STATS);
      } finally {
        if (seq === loadSeq.current) setLoading(false);
      }
    };

    void load();
    const channel = client
      .channel(`inspection-recovery-stats:${department}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inspection_recovery' }, () => {
        void load();
      })
      .subscribe();

    return () => {
      loadSeq.current += 1;
      client.removeChannel(channel);
    };
  }, [client, department, enabled]);

  return { loading, stats };
}
