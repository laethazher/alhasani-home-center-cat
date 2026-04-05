import { useEffect, useMemo, useRef, useState } from 'react';
import type { DepartmentCode } from '../data/department';
import { getDepartmentClient, getDepartmentTables } from '../data/supabaseSource';
import {
  buildIntelligenceAnalytics,
  DEFAULT_INTELLIGENCE_CYCLE_DAYS,
  DEFAULT_PATTERN_LOOKBACK,
  DEFAULT_PATTERN_MIN_DELAYS,
  fetchReportsForIntelligence,
  fetchStaffNamesForIntelligence,
  fetchVehiclesForIntelligence,
} from '../lib/inspectionIntelligence';

export interface UseInspectionCriticalCountResult {
  loading: boolean;
  /** عدد المركبات بحالة حرجة؛ `null` عند فشل الجلب أو عند `enabled === false` */
  criticalCount: number | null;
}

export function useInspectionCriticalCount(
  department: DepartmentCode,
  enabled: boolean,
): UseInspectionCriticalCountResult {
  const [loading, setLoading] = useState(false);
  const [criticalCount, setCriticalCount] = useState<number | null>(null);
  const client = useMemo(() => getDepartmentClient(department), [department]);
  const tables = useMemo(() => getDepartmentTables(department), [department]);
  const isInstallation = department === 'installation';
  const loadSeq = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setCriticalCount(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      const seq = ++loadSeq.current;
      setLoading(true);
      try {
        const [vehicles, reports, staffMap] = await Promise.all([
          fetchVehiclesForIntelligence(client, tables, department),
          fetchReportsForIntelligence(client, tables, isInstallation),
          fetchStaffNamesForIntelligence(client, tables, department),
        ]);
        const built = buildIntelligenceAnalytics(vehicles, reports, staffMap, {
          today: new Date(),
          cycleDays: DEFAULT_INTELLIGENCE_CYCLE_DAYS,
          patternLookbackReports: DEFAULT_PATTERN_LOOKBACK,
          patternMinDelays: DEFAULT_PATTERN_MIN_DELAYS,
        });
        if (seq === loadSeq.current) setCriticalCount(built.summary.criticalCount);
      } catch {
        if (seq === loadSeq.current) setCriticalCount(null);
      } finally {
        if (seq === loadSeq.current) setLoading(false);
      }
    };

    void load();

    const channel = client
      .channel(`inspection-critical-sync:${department}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tables.reports }, () => {
        void load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: tables.vehicles }, () => {
        void load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: tables.staffMembers }, () => {
        void load();
      })
      .subscribe();

    return () => {
      loadSeq.current += 1;
      client.removeChannel(channel);
    };
  }, [enabled, client, tables, department, isInstallation]);

  return { loading, criticalCount };
}
