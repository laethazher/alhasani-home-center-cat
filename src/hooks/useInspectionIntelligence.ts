import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DepartmentCode } from '../data/department';
import type { DepartmentTables } from '../data/supabaseSource';
import {
  buildIntelligenceAnalytics,
  DEFAULT_INTELLIGENCE_CYCLE_DAYS,
  DEFAULT_PATTERN_LOOKBACK,
  DEFAULT_PATTERN_MIN_DELAYS,
  fetchReportsForIntelligence,
  fetchStaffNamesForIntelligence,
  fetchVehiclesForIntelligence,
  filterInsights,
  type IntelligenceAnalytics,
  type IntelligenceFilterKey,
  type VehicleInspectionInsight,
} from '../lib/inspectionIntelligence';

export interface UseInspectionIntelligenceParams {
  client: SupabaseClient;
  tables: DepartmentTables;
  department: DepartmentCode;
  /** يفعّل الجلب */
  enabled: boolean;
  cycleDays?: number;
}

export interface UseInspectionIntelligenceResult {
  loading: boolean;
  error: string | null;
  analytics: IntelligenceAnalytics | null;
  refetch: () => Promise<void>;
  filteredInsights: VehicleInspectionInsight[];
  setFilter: (f: IntelligenceFilterKey) => void;
  filter: IntelligenceFilterKey;
  responsibleQuery: string;
  setResponsibleQuery: (q: string) => void;
}

export function useInspectionIntelligence({
  client,
  tables,
  department,
  enabled,
  cycleDays = DEFAULT_INTELLIGENCE_CYCLE_DAYS,
}: UseInspectionIntelligenceParams): UseInspectionIntelligenceResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<IntelligenceAnalytics | null>(null);
  const [filter, setFilter] = useState<IntelligenceFilterKey>('all');
  const [responsibleQuery, setResponsibleQuery] = useState('');

  const isInstallation = department === 'installation';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vehicles, reports, staffMap] = await Promise.all([
        fetchVehiclesForIntelligence(client, tables, department),
        fetchReportsForIntelligence(client, tables, isInstallation),
        fetchStaffNamesForIntelligence(client, tables, department),
      ]);
      const built = buildIntelligenceAnalytics(vehicles, reports, staffMap, {
        today: new Date(),
        cycleDays,
        patternLookbackReports: DEFAULT_PATTERN_LOOKBACK,
        patternMinDelays: DEFAULT_PATTERN_MIN_DELAYS,
      });
      setAnalytics(built);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل تحميل بيانات الذكاء');
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [client, tables, department, isInstallation, cycleDays]);

  const loadRef = useRef(load);
  useLayoutEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  /** تحديث تلقائي عند تغيير التقارير/المركبات/الكادر أثناء فتح الدرج — لكل قسم على حدة. */
  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      void loadRef.current();
    };
    const channel = client
      .channel(`inspection-intel-drawer:${department}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tables.reports }, run)
      .on('postgres_changes', { event: '*', schema: 'public', table: tables.vehicles }, run)
      .on('postgres_changes', { event: '*', schema: 'public', table: tables.staffMembers }, run)
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [enabled, client, department, tables.reports, tables.vehicles, tables.staffMembers]);

  const filteredInsights = useMemo(() => {
    if (!analytics) return [];
    return filterInsights(analytics.insightsSorted, filter, responsibleQuery);
  }, [analytics, filter, responsibleQuery]);

  return {
    loading,
    error,
    analytics,
    refetch: load,
    filteredInsights,
    setFilter,
    filter,
    responsibleQuery,
    setResponsibleQuery,
  };
}
