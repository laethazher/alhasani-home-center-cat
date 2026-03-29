import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Download,
  FileText,
  Loader2,
  SlidersHorizontal,
  ArrowUpDown,
  Users,
  Truck,
  Shield,
  LayoutGrid,
} from 'lucide-react';
import { cn, ATTENDANCE_TYPE_COLORS } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import { exportHtmlToPdf } from '../lib/pdfExport';
import { buildHubChartsPreviewPng } from '../lib/chartPreviewPng';
import { exportSheetsToExcelWithOptionalChartImage } from '../lib/excelSheetsWithImage';
import { logAttendanceActivity } from '../lib/attendanceActivity';
import { getBaghdadDateKey } from '../lib/loadingTime';
import type {
  UserProfile,
  StaffMember,
  AttendanceArchive,
  Vehicle,
  ExitRequest,
  Violation,
} from '../lib/supabaseClient';
import {
  SmartSearchBar,
  HighlightText,
  InsightsPanel,
  ExportMenu,
  SavedViews,
  useAutoRefresh,
  insightsFromAttendanceRows,
  useAdvancedFilters,
  parseSearchQuery,
  useDebouncedValue,
  applyStructuredFilters,
  insightsFromVehicles,
  getCatalogForReportsHubDomain,
  rowMatchesHubQuery,
  type ReportsHubDomain,
  type StructuredSearchFilters,
} from '../smart';
import { buildHubViolationStaffRows, type HubViolationStaffRow } from './reportsHubViolationsAggregate';
import { advancedFilterTags, FilterTags } from '../smart/components/FilterTags';
import type { ColumnDef } from '../smart/components/DataTableEnhanced';

const AdvancedFilterPanel = lazy(() =>
  import('../smart/components/AdvancedFilterPanel').then((m) => ({ default: m.AdvancedFilterPanel }))
);
const ChartsPanel = lazy(() =>
  import('../smart/components/ChartsPanel').then((m) => ({ default: m.ChartsPanel }))
);
const DataTableEnhanced = lazy(() =>
  import('../smart/components/DataTableEnhanced').then((m) => ({ default: m.DataTableEnhanced }))
);

interface StaffStats {
  staff_id: number;
  full_name: string;
  role: 'driver' | 'assistant';
  present: number;
  late: number;
  absent: number;
  full_leave: number;
  time_leave: number;
  loading_delay_events: number;
  loading_delay_minutes_sum: number;
}

type ExitLoadingRow = {
  driver_id: string | number | null;
  created_at: string;
  loading_is_delay: boolean | null;
  loading_delay_minutes: number | null;
};

type SortKey = 'name' | 'late' | 'absent' | 'present' | 'loading_delay';
type VehicleSortKey = 'plate' | 'status' | 'odometer';
type ViolationSortKey = 'name' | 'violations' | 'delay';

const VEHICLE_STATUS_AR: Record<string, string> = {
  available: 'متاحة',
  maintenance: 'صيانة',
  broken: 'معطلة',
  reserved: 'محجوزة',
};

export interface VehicleHubRow {
  id: number;
  plate_number: string;
  status: string;
  statusLabel: string;
  model: string | null;
  vehicle_type: string | null;
  driver_name: string;
  odometer_km: number;
  notes: string;
  searchBlob: string;
}

function getDominantType(s: StaffStats): string {
  const types = [
    { k: 'present', v: s.present },
    { k: 'late', v: s.late },
    { k: 'absent', v: s.absent },
    { k: 'full_leave', v: s.full_leave },
    { k: 'time_leave', v: s.time_leave },
  ];
  const max = types.reduce((a, b) => (b.v > a.v ? b : a), { k: 'present', v: 0 });
  return max.v > 0 ? max.k : 'present';
}

function defaultDateRangeSeed() {
  const d = new Date();
  const toStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fromDate = new Date(d);
  fromDate.setMonth(fromDate.getMonth() - 1);
  const fromStr = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`;
  return { dateFrom: fromStr, dateTo: toStr };
}

interface Props {
  profile: UserProfile | null;
}

export default function ReportsHub({ profile }: Props) {
  const [archive, setArchive] = useState<AttendanceArchive[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [exitLoadingRows, setExitLoadingRows] = useState<ExitLoadingRow[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [violExitRequests, setViolExitRequests] = useState<ExitRequest[]>([]);
  const [manualViolations, setManualViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeDomain, setActiveDomain] = useState<ReportsHubDomain>('attendance');
  const [hubSearch, setHubSearch] = useState({
    all: '',
    attendance: '',
    vehicles: '',
    violations: '',
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [vehSortKey, setVehSortKey] = useState<VehicleSortKey>('plate');
  const [vehSortDir, setVehSortDir] = useState<'asc' | 'desc'>('asc');
  const [violSortKey, setViolSortKey] = useState<ViolationSortKey>('violations');
  const [violSortDir, setViolSortDir] = useState<'asc' | 'desc'>('desc');

  const showViolationsTab = profile?.role === 'admin';
  const tableSearch =
    activeDomain === 'all'
      ? hubSearch.all
      : activeDomain === 'vehicles'
        ? hubSearch.vehicles
        : activeDomain === 'violations'
          ? hubSearch.violations
          : hubSearch.attendance;
  const setTableSearch = useCallback(
    (v: string) => {
      setHubSearch((prev) => {
        if (activeDomain === 'all') return { ...prev, all: v };
        if (activeDomain === 'vehicles') return { ...prev, vehicles: v };
        if (activeDomain === 'violations') return { ...prev, violations: v };
        return { ...prev, attendance: v };
      });
    },
    [activeDomain]
  );

  useEffect(() => {
    if (activeDomain === 'violations' && !showViolationsTab) {
      setActiveDomain('attendance');
    }
  }, [activeDomain, showViolationsTab]);

  const rangeSeed = useMemo(() => defaultDateRangeSeed(), []);
  const {
    state: filterState,
    setField,
    resetAll,
    removeKey,
    applyNaturalLanguage,
    structured,
  } = useAdvancedFilters(rangeSeed);

  const debouncedAttendanceSearch = useDebouncedValue(hubSearch.attendance, 250);
  const debouncedVehiclesSearch = useDebouncedValue(hubSearch.vehicles, 250);
  const debouncedViolationsSearch = useDebouncedValue(hubSearch.violations, 250);
  const debouncedAllSearch = useDebouncedValue(hubSearch.all, 250);
  const nlAttendance = useMemo(() => parseSearchQuery(debouncedAttendanceSearch), [debouncedAttendanceSearch]);
  const nlVehicles = useMemo(() => parseSearchQuery(debouncedVehiclesSearch), [debouncedVehiclesSearch]);
  const nlViolations = useMemo(() => parseSearchQuery(debouncedViolationsSearch), [debouncedViolationsSearch]);
  const nlAll = useMemo(() => parseSearchQuery(debouncedAllSearch), [debouncedAllSearch]);

  const nlVeh = useMemo(
    () => (activeDomain === 'all' ? nlAll : nlVehicles),
    [activeDomain, nlAll, nlVehicles]
  );
  const nlViol = useMemo(
    () => (activeDomain === 'all' ? nlAll : nlViolations),
    [activeDomain, nlAll, nlViolations]
  );
  const nlForAttendance = useMemo(
    () => (activeDomain === 'all' ? nlAll : nlAttendance),
    [activeDomain, nlAll, nlAttendance]
  );

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [
      archRes,
      staffRes,
      exitRes,
      vehRes,
      exitViolRes,
      violRes,
    ] = await Promise.all([
      supabase.from('attendance_archive').select('*').order('attendance_date', { ascending: false }),
      supabase.from('staff_members').select('*').eq('is_active', true),
      supabase
        .from('exit_requests')
        .select('driver_id, created_at, loading_is_delay, loading_delay_minutes')
        .eq('track_driver_loading_time', true),
      supabase.from('vehicles').select('*').order('plate_number'),
      supabase
        .from('exit_requests')
        .select('*')
        .eq('exit_type', 'temporary')
        .in('status', ['exited'])
        .order('created_at', { ascending: false }),
      supabase.from('violations').select('*').order('violation_date', { ascending: false }),
    ]);
    if (archRes.data) setArchive(archRes.data);
    if (staffRes.data) setStaff(staffRes.data);
    if (exitRes.data) setExitLoadingRows(exitRes.data as ExitLoadingRow[]);
    if (vehRes.data) setVehicles(vehRes.data);
    if (exitViolRes.data) setViolExitRequests(exitViolRes.data);
    if (violRes.data) setManualViolations(violRes.data);
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useAutoRefresh(30_000, () => {
    void fetchData(true);
  }, true);

  const dateFrom = filterState.dateFrom;
  const dateTo = filterState.dateTo;

  const { effFrom, effTo } = useMemo(() => {
    const nf = nlForAttendance.dateFrom;
    const nt = nlForAttendance.dateTo;
    const pf = dateFrom || '';
    const pt = dateTo || '';
    const effF =
      nf && pf ? (pf > nf ? pf : nf) : nf || pf || '';
    const effT =
      nt && pt ? (pt < nt ? pt : nt) : nt || pt || '';
    return { effFrom: effF, effTo: effT };
  }, [dateFrom, dateTo, nlForAttendance.dateFrom, nlForAttendance.dateTo]);

  const staffStats = useMemo(() => {
    const filtered = archive.filter((a) => {
      const d = a.attendance_date;
      if (effFrom && d < effFrom) return false;
      if (effTo && d > effTo) return false;
      return true;
    });

    const loadingByDriver = new Map<number, { events: number; minutes: number }>();
    for (const row of exitLoadingRows) {
      if (row.driver_id == null) continue;
      const dk = getBaghdadDateKey(row.created_at);
      if (effFrom && dk < effFrom) continue;
      if (effTo && dk > effTo) continue;
      const id = Number(row.driver_id);
      if (!loadingByDriver.has(id)) loadingByDriver.set(id, { events: 0, minutes: 0 });
      const cur = loadingByDriver.get(id)!;
      if (row.loading_is_delay === true || (row.loading_delay_minutes ?? 0) > 0) cur.events += 1;
      cur.minutes += row.loading_delay_minutes ?? 0;
    }

    const statsMap = new Map<number, StaffStats>();
    for (const s of staff) {
      const id = Number(s.id);
      const load = loadingByDriver.get(id);
      statsMap.set(id, {
        staff_id: id,
        full_name: s.full_name,
        role: s.role as 'driver' | 'assistant',
        present: 0,
        late: 0,
        absent: 0,
        full_leave: 0,
        time_leave: 0,
        loading_delay_events: s.role === 'driver' ? (load?.events ?? 0) : 0,
        loading_delay_minutes_sum: s.role === 'driver' ? (load?.minutes ?? 0) : 0,
      });
    }

    for (const a of filtered) {
      const st = statsMap.get(a.staff_id);
      if (!st) continue;
      if (a.attendance_type === 'present') st.present++;
      else if (a.attendance_type === 'late') st.late++;
      else if (a.attendance_type === 'absent') st.absent++;
      else if (a.attendance_type === 'full_leave') st.full_leave++;
      else if (a.attendance_type === 'time_leave') st.time_leave++;
    }

    let list = Array.from(statsMap.values());
    if (filterState.role === 'driver') list = list.filter((s) => s.role === 'driver');
    else if (filterState.role === 'assistant') list = list.filter((s) => s.role === 'assistant');
    return list.sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [archive, staff, effFrom, effTo, exitLoadingRows, filterState.role]);

  const filteredStaffStats = useMemo(() => {
    let rows = staffStats;

    const nameNeedle = (structured.nameContains || nlForAttendance.nameContains || '').trim();
    if (nameNeedle) {
      const low = nameNeedle.toLowerCase();
      rows = rows.filter((s) => s.full_name.toLowerCase().includes(low));
    }

    const attendanceTextQ = activeDomain === 'all' ? hubSearch.all : hubSearch.attendance;
    if (attendanceTextQ.trim()) {
      rows = rows.filter((s) =>
        rowMatchesHubQuery(
          `${s.full_name} ${s.role} ${s.present} ${s.late} ${s.absent} ${s.full_leave} ${s.time_leave} ${s.loading_delay_events} ${s.loading_delay_minutes_sum}`,
          attendanceTextQ
        )
      );
    }

    const statusUnion = [
      ...new Set([...structured.attendanceStatuses, ...nlForAttendance.attendanceStatuses]),
    ];
    if (statusUnion.length > 0) {
      rows = rows.filter((s) =>
        statusUnion.some((st) => {
          if (st === 'present') return s.present > 0;
          if (st === 'late') return s.late > 0;
          if (st === 'absent') return s.absent > 0;
          if (st === 'full_leave') return s.full_leave > 0;
          if (st === 'time_leave') return s.time_leave > 0;
          return false;
        })
      );
    }

    const dmin = structured.delayMinMinutes ?? nlForAttendance.delayMinMinutes;
    const dmax = structured.delayMaxMinutes ?? nlForAttendance.delayMaxMinutes;
    if (dmin != null || dmax != null) {
      rows = rows.filter((s) => {
        const m = s.loading_delay_minutes_sum;
        if (dmin != null && m < dmin) return false;
        if (dmax != null && m > dmax) return false;
        return true;
      });
    }

    if (structured.freeText?.trim()) {
      const ft = structured.freeText.trim();
      rows = rows.filter((s) =>
        rowMatchesHubQuery(
          `${s.full_name} ${s.role} ${s.present} ${s.late} ${s.absent} ${s.full_leave} ${s.time_leave}`,
          ft
        )
      );
    }

    const sorted = [...rows];
    const dir = sortDir === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'late':
          return (a.late - b.late) * dir;
        case 'absent':
          return (a.absent - b.absent) * dir;
        case 'present':
          return (a.present - b.present) * dir;
        case 'loading_delay':
          return (a.loading_delay_minutes_sum - b.loading_delay_minutes_sum) * dir;
        default:
          return a.full_name.localeCompare(b.full_name, 'ar') * dir;
      }
    });
    return sorted;
  }, [
    staffStats,
    structured,
    nlForAttendance,
    hubSearch.attendance,
    hubSearch.all,
    activeDomain,
    sortKey,
    sortDir,
  ]);

  const lineData = useMemo(() => {
    const filtered = archive.filter((a) => {
      const d = a.attendance_date;
      if (effFrom && d < effFrom) return false;
      if (effTo && d > effTo) return false;
      return true;
    });
    const staffSet = new Set(filteredStaffStats.map((s) => s.staff_id));
    const byDay = new Map<string, number>();
    for (const a of filtered) {
      if (!staffSet.has(a.staff_id)) continue;
      if (a.attendance_type !== 'late') continue;
      const k = a.attendance_date;
      byDay.set(k, (byDay.get(k) ?? 0) + 1);
    }
    return [...byDay.entries()]
      .sort((x, y) => x[0].localeCompare(y[0]))
      .map(([name, value]) => ({ name, value }));
  }, [archive, effFrom, effTo, filteredStaffStats]);

  const reportTableInsights = useMemo(() => {
    const rows = filteredStaffStats.map((s) => ({ attendance_type: getDominantType(s) }));
    return insightsFromAttendanceRows(rows, staff.length);
  }, [filteredStaffStats, staff.length]);

  const reportNameSuggestions = useMemo(
    () => staffStats.map((s) => s.full_name).slice(0, 40),
    [staffStats]
  );

  const hubCatalog = useMemo(() => getCatalogForReportsHubDomain(activeDomain), [activeDomain]);

  const vehicleHubRows: VehicleHubRow[] = useMemo(() => {
    const byId = new Map(staff.map((s) => [String(s.id), s.full_name]));
    return vehicles.map((v) => {
      const driver_name = v.assigned_driver_id
        ? byId.get(String(v.assigned_driver_id)) ?? '—'
        : '—';
      const statusLabel = VEHICLE_STATUS_AR[v.status] ?? v.status;
      const notes = v.notes ?? '';
      const searchBlob = `${v.plate_number} ${driver_name} ${statusLabel} ${v.status} ${v.model ?? ''} ${v.vehicle_type ?? ''} ${notes} ${v.odometer_km}`;
      return {
        id: v.id,
        plate_number: v.plate_number,
        status: v.status,
        statusLabel,
        model: v.model,
        vehicle_type: v.vehicle_type,
        driver_name,
        odometer_km: v.odometer_km,
        notes,
        searchBlob,
      };
    });
  }, [vehicles, staff]);

  const structuredForVehicles = useMemo(
    (): StructuredSearchFilters => ({
      ...structured,
      delayMinMinutes: null,
      delayMaxMinutes: null,
      attendanceStatuses: [],
    }),
    [structured]
  );

  const structuredForViolations = useMemo(
    (): StructuredSearchFilters => ({
      ...structured,
      attendanceStatuses: [],
    }),
    [structured]
  );

  const mergedVehicleFilters = useMemo(
    (): StructuredSearchFilters => ({
      ...structuredForVehicles,
      nameContains: structuredForVehicles.nameContains || nlVeh.nameContains,
      plateContains: structuredForVehicles.plateContains || nlVeh.plateContains,
      vehicleNumberContains: nlVeh.vehicleNumberContains,
      dateFrom: structuredForVehicles.dateFrom || nlVeh.dateFrom,
      dateTo: structuredForVehicles.dateTo || nlVeh.dateTo,
      /** نص شريط البحث يُصفّى عبر rowMatchesHubQuery وليس كـ freeText كامل (كان يفرغ النتائج) */
      freeText: structuredForVehicles.freeText,
    }),
    [structuredForVehicles, nlVeh]
  );

  const filteredVehicleRows = useMemo(() => {
    let rows = applyStructuredFilters(vehicleHubRows, mergedVehicleFilters, {
      getName: (r) => `${r.driver_name} ${r.plate_number}`,
      getPlate: (r) => r.plate_number.replace(/\s+/g, ''),
      getSearchBlob: (r) => r.searchBlob,
    });
    const vehicleTextQ = activeDomain === 'all' ? hubSearch.all : hubSearch.vehicles;
    if (vehicleTextQ.trim()) {
      rows = rows.filter((r) => rowMatchesHubQuery(r.searchBlob, vehicleTextQ));
    }
    const dir = vehSortDir === 'asc' ? 1 : -1;
    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (vehSortKey) {
        case 'status':
          return a.statusLabel.localeCompare(b.statusLabel, 'ar') * dir;
        case 'odometer':
          return (a.odometer_km - b.odometer_km) * dir;
        default:
          return a.plate_number.localeCompare(b.plate_number, 'ar') * dir;
      }
    });
    return sorted;
  }, [
    vehicleHubRows,
    mergedVehicleFilters,
    hubSearch.vehicles,
    hubSearch.all,
    activeDomain,
    vehSortKey,
    vehSortDir,
  ]);

  const violationStaffRows = useMemo(
    () => buildHubViolationStaffRows(violExitRequests, staff, manualViolations),
    [violExitRequests, staff, manualViolations]
  );

  const mergedViolFilters = useMemo(
    (): StructuredSearchFilters => ({
      ...structuredForViolations,
      nameContains: structuredForViolations.nameContains || nlViol.nameContains,
      delayMinMinutes: structuredForViolations.delayMinMinutes ?? nlViol.delayMinMinutes,
      delayMaxMinutes: structuredForViolations.delayMaxMinutes ?? nlViol.delayMaxMinutes,
      dateFrom: structuredForViolations.dateFrom || nlViol.dateFrom,
      dateTo: structuredForViolations.dateTo || nlViol.dateTo,
      freeText: structuredForViolations.freeText,
    }),
    [structuredForViolations, nlViol]
  );

  const filteredViolationRows = useMemo(() => {
    let rows = applyStructuredFilters(violationStaffRows, mergedViolFilters, {
      getName: (r) => r.staffName,
      getDelayMinutes: (r) => r.totalDelayMinutes,
      getSearchBlob: (r) => `${r.staffName} ${r.staffRole} ${r.totalViolations} ${r.totalDelayMinutes}`,
    });
    const violTextQ = activeDomain === 'all' ? hubSearch.all : hubSearch.violations;
    if (violTextQ.trim()) {
      rows = rows.filter((r) =>
        rowMatchesHubQuery(
          `${r.staffName} ${r.staffRole} ${r.totalViolations} ${r.totalDelayMinutes}`,
          violTextQ
        )
      );
    }
    const dir = violSortDir === 'asc' ? 1 : -1;
    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (violSortKey) {
        case 'name':
          return a.staffName.localeCompare(b.staffName, 'ar') * dir;
        case 'delay':
          return (a.totalDelayMinutes - b.totalDelayMinutes) * dir;
        default:
          return (a.totalViolations - b.totalViolations) * dir;
      }
    });
    return sorted;
  }, [
    violationStaffRows,
    mergedViolFilters,
    hubSearch.violations,
    hubSearch.all,
    activeDomain,
    violSortKey,
    violSortDir,
  ]);

  const vehicleInsights = useMemo(
    () => insightsFromVehicles(filteredVehicleRows.map((r) => ({ status: r.status }))),
    [filteredVehicleRows]
  );

  const violationInsights = useMemo(() => {
    const list = filteredViolationRows;
    const drivers = list.filter((r) => r.staffRole === 'driver').length;
    const assistants = list.filter((r) => r.staffRole === 'assistant').length;
    const totalV = list.reduce((s, r) => s + r.totalViolations, 0);
    const totalM = list.reduce((s, r) => s + r.totalDelayMinutes, 0);
    return {
      metrics: [
        { label: 'عدد الموظفين', value: list.length },
        { label: 'إجمالي المخالفات', value: totalV },
        { label: 'إجمالي دقائق التأخير', value: totalM },
        { label: 'سائقون', value: drivers },
        { label: 'مساعدون', value: assistants },
      ] as { label: string; value: string | number }[],
      alerts:
        list.length === 0
          ? ['لا توجد مخالفات في العرض الحالي.']
          : totalV > 20
            ? ['عدد مرتفع من المخالفات في العرض الحالي.']
            : [],
      bar: [
        { name: 'سائق', value: drivers },
        { name: 'مساعد', value: assistants },
      ],
      pie: [
        { name: 'سائق', value: drivers },
        { name: 'مساعد', value: assistants },
      ].filter((p) => p.value > 0),
    };
  }, [filteredViolationRows]);

  const vehicleNameSuggestions = useMemo(
    () => [...new Set(vehicleHubRows.map((v) => v.plate_number).slice(0, 30))],
    [vehicleHubRows]
  );

  const violationNameSuggestions = useMemo(
    () => [...new Set(violationStaffRows.map((v) => v.staffName))].slice(0, 40),
    [violationStaffRows]
  );

  const dataSuggestionsForDomain = useMemo(() => {
    if (activeDomain === 'all') {
      return [
        ...new Set([
          ...reportNameSuggestions,
          ...vehicleNameSuggestions,
          ...violationNameSuggestions,
        ]),
      ].slice(0, 60);
    }
    if (activeDomain === 'vehicles') return vehicleNameSuggestions;
    if (activeDomain === 'violations') return violationNameSuggestions;
    return reportNameSuggestions;
  }, [
    activeDomain,
    reportNameSuggestions,
    vehicleNameSuggestions,
    violationNameSuggestions,
  ]);

  const kpis = useMemo(() => {
    const list = filteredStaffStats;
    return {
      staffCount: list.length,
      presentSum: list.reduce((s, r) => s + r.present, 0),
      lateSum: list.reduce((s, r) => s + r.late, 0),
      absentSum: list.reduce((s, r) => s + r.absent, 0),
    };
  }, [filteredStaffStats]);

  const filterTags = useMemo(() => advancedFilterTags(filterState), [filterState]);

  const attendanceHubColumns: ColumnDef<StaffStats>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'الموظف',
        accessor: (s) => (
          <span className="flex items-center gap-2">
            <span
              className={cn(
                'w-2.5 h-2.5 rounded-full shrink-0',
                ATTENDANCE_TYPE_COLORS[getDominantType(s)]?.dot ?? 'bg-stone-300'
              )}
            />
            <HighlightText text={s.full_name} query={activeDomain === 'all' ? hubSearch.all : hubSearch.attendance} />
          </span>
        ),
      },
      {
        id: 'role',
        header: 'الدور',
        accessor: (s) => (s.role === 'driver' ? 'سائق' : 'مساعد سائق'),
      },
      { id: 'present', header: 'حاضر', accessor: (s) => s.present },
      { id: 'late', header: 'متأخر', accessor: (s) => s.late },
      { id: 'absent', header: 'غائب', accessor: (s) => s.absent },
      { id: 'full_leave', header: 'إجازة كاملة', accessor: (s) => s.full_leave },
      { id: 'time_leave', header: 'إجازة زمنية', accessor: (s) => s.time_leave },
      {
        id: 'ld_ev',
        header: 'تأخير تحميل (مرات)',
        accessor: (s) => (s.role === 'driver' ? s.loading_delay_events : '—'),
      },
      {
        id: 'ld_min',
        header: 'دقائق التحميل',
        accessor: (s) => (s.role === 'driver' ? s.loading_delay_minutes_sum : '—'),
      },
    ],
    [hubSearch.attendance, hubSearch.all, activeDomain]
  );

  const vehicleHubColumns: ColumnDef<VehicleHubRow>[] = useMemo(
    () => [
      {
        id: 'plate',
        header: 'اللوحة',
        accessor: (v) => (
          <HighlightText text={v.plate_number} query={activeDomain === 'all' ? hubSearch.all : hubSearch.vehicles} />
        ),
      },
      { id: 'status', header: 'الحالة', accessor: (v) => v.statusLabel },
      { id: 'type', header: 'النوع', accessor: (v) => v.vehicle_type ?? '—' },
      { id: 'model', header: 'الموديل', accessor: (v) => v.model ?? '—' },
      {
        id: 'driver',
        header: 'السائق',
        accessor: (v) => (
          <HighlightText text={v.driver_name} query={activeDomain === 'all' ? hubSearch.all : hubSearch.vehicles} />
        ),
      },
      { id: 'odo', header: 'العداد', accessor: (v) => v.odometer_km },
    ],
    [hubSearch.vehicles, hubSearch.all, activeDomain]
  );

  const violationHubColumns: ColumnDef<HubViolationStaffRow>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'الموظف',
        accessor: (v) => (
          <HighlightText text={v.staffName} query={activeDomain === 'all' ? hubSearch.all : hubSearch.violations} />
        ),
      },
      {
        id: 'role',
        header: 'الدور',
        accessor: (v) => (v.staffRole === 'driver' ? 'سائق' : 'مساعد'),
      },
      { id: 'cnt', header: 'المخالفات', accessor: (v) => v.totalViolations },
      { id: 'delay', header: 'دقائق التأخير', accessor: (v) => v.totalDelayMinutes },
    ],
    [hubSearch.violations, hubSearch.all, activeDomain]
  );

  const kpisVehicles = useMemo(() => {
    const list = filteredVehicleRows;
    return {
      count: list.length,
      available: list.filter((v) => v.status === 'available').length,
      maintenance: list.filter((v) => v.status === 'maintenance').length,
      broken: list.filter((v) => v.status === 'broken').length,
    };
  }, [filteredVehicleRows]);

  const kpisViolations = useMemo(() => {
    const list = filteredViolationRows;
    return {
      staff: list.length,
      violations: list.reduce((s, r) => s + r.totalViolations, 0),
      minutes: list.reduce((s, r) => s + r.totalDelayMinutes, 0),
      maxDelay: list.length ? Math.max(...list.map((r) => r.totalDelayMinutes)) : 0,
    };
  }, [filteredViolationRows]);

  const panelInsights = useMemo(() => {
    if (activeDomain === 'all') {
      const bar = [
        { name: 'كادر وحضور', value: filteredStaffStats.length },
        { name: 'مركبات', value: filteredVehicleRows.length },
      ];
      if (showViolationsTab) bar.push({ name: 'مخالفات', value: filteredViolationRows.length });
      const pie = bar.filter((b) => b.value > 0);
      return {
        metrics: [
          { label: 'صفوف جدول الحضور', value: filteredStaffStats.length },
          { label: 'صفوف جدول المركبات', value: filteredVehicleRows.length },
          ...(showViolationsTab
            ? [{ label: 'صفوف جدول المخالفات', value: filteredViolationRows.length }]
            : []),
        ],
        alerts: [] as string[],
        bar,
        pie: pie.length ? pie : [{ name: 'لا توجد بيانات', value: 0 }],
      };
    }
    if (activeDomain === 'vehicles') return vehicleInsights;
    if (activeDomain === 'violations') return violationInsights;
    return reportTableInsights;
  }, [
    activeDomain,
    filteredStaffStats.length,
    filteredVehicleRows.length,
    filteredViolationRows.length,
    showViolationsTab,
    vehicleInsights,
    violationInsights,
    reportTableInsights,
  ]);

  const kpiItems = useMemo(() => {
    if (activeDomain === 'all') {
      const total =
        filteredStaffStats.length +
        filteredVehicleRows.length +
        (showViolationsTab ? filteredViolationRows.length : 0);
      const base = [
        { label: 'الحضور (صفوف معروضة)', value: filteredStaffStats.length, icon: Users },
        { label: 'المركبات (صفوف معروضة)', value: filteredVehicleRows.length, icon: Truck },
      ] as { label: string; value: string | number; icon: typeof Users }[];
      if (showViolationsTab) {
        base.push({
          label: 'المخالفات (صفوف معروضة)',
          value: filteredViolationRows.length,
          icon: Shield,
        });
      }
      base.push({ label: 'إجمالي صفوف الجداول', value: total, icon: LayoutGrid });
      return base;
    }
    if (activeDomain === 'vehicles') {
      return [
        { label: 'عدد المركبات', value: kpisVehicles.count, icon: Truck },
        { label: 'متاحة', value: kpisVehicles.available, icon: BarChart3 },
        { label: 'صيانة', value: kpisVehicles.maintenance, icon: SlidersHorizontal },
        { label: 'معطلة', value: kpisVehicles.broken, icon: FileText },
      ] as const;
    }
    if (activeDomain === 'violations') {
      return [
        { label: 'موظفون في العرض', value: kpisViolations.staff, icon: Users },
        { label: 'إجمالي المخالفات', value: kpisViolations.violations, icon: Shield },
        { label: 'دقائق التأخير (مجموع)', value: kpisViolations.minutes, icon: BarChart3 },
        { label: 'أقصى تأخير (دقيقة)', value: kpisViolations.maxDelay, icon: ArrowUpDown },
      ] as const;
    }
    return [
      { label: 'موظفون (بعد الفلتر)', value: kpis.staffCount, icon: Users },
      { label: 'مجموع أيام حاضر', value: kpis.presentSum, icon: BarChart3 },
      { label: 'مجموع أيام متأخر', value: kpis.lateSum, icon: Truck },
      { label: 'مجموع أيام غائب', value: kpis.absentSum, icon: Users },
    ] as const;
  }, [
    activeDomain,
    kpis,
    kpisVehicles,
    kpisViolations,
    filteredStaffStats.length,
    filteredVehicleRows.length,
    filteredViolationRows.length,
    showViolationsTab,
  ]);

  const handleExport = async (format: 'pdf' | 'excel') => {
    const df = dateFrom || '—';
    const dt = dateTo || '—';
    const titleBase = 'التقارير الذكية';

    const ins = panelInsights;
    const lineForExport = activeDomain === 'attendance' || activeDomain === 'all' ? lineData : [];

    const chartRowsForExcel = (): unknown[][] => {
      const out: unknown[][] = [
        ['ملخص الرسوم البيانية (نفس أرقام الشاشة)'],
        [],
        ['نوع الرسم', 'التصنيف', 'القيمة'],
      ];
      for (const b of ins.bar) out.push(['أعمدة', b.name, b.value]);
      out.push([], ['نوع الرسم', 'التصنيف', 'القيمة']);
      for (const p of ins.pie) out.push(['دائري', p.name, p.value]);
      if (lineForExport.length) {
        out.push([], ['نوع الرسم', 'اليوم / الفترة', 'القيمة']);
        for (const l of lineForExport) out.push(['خط زمني', l.name, l.value]);
      }
      return out;
    };

    const chartSectionPdf = (previewPng: string | null): string => {
      const barRows = ins.bar
        .map(
          (b, i) =>
            `<tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}"><td style="padding:8px;border:1px solid #e2e8f0;text-align:right">${b.name}</td><td style="padding:8px;border:1px solid #e2e8f0;text-align:right;font-weight:600">${b.value}</td></tr>`
        )
        .join('');
      const pieRows = ins.pie
        .map(
          (p, i) =>
            `<tr style="${i % 2 === 0 ? 'background:#f1f5f9' : ''}"><td style="padding:8px;border:1px solid #e2e8f0;text-align:right">${p.name}</td><td style="padding:8px;border:1px solid #e2e8f0;text-align:right;font-weight:600">${p.value}</td></tr>`
        )
        .join('');
      const lineRows = lineForExport
        .map(
          (l, i) =>
            `<tr style="${i % 2 === 0 ? 'background:#faf5ff' : ''}"><td style="padding:8px;border:1px solid #e2e8f0;text-align:right">${l.name}</td><td style="padding:8px;border:1px solid #e2e8f0;text-align:right;font-weight:600">${l.value}</td></tr>`
        )
        .join('');
      return `
        <h2 style="margin-top:28px;font-size:17px;border-bottom:2px solid #2563eb;padding-bottom:8px;color:#0f172a">الرسوم البيانية — جداول واضحة للطباعة</h2>
        <h3 style="font-size:14px;margin:14px 0 6px;color:#334155">رسم الأعمدة</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px"><thead><tr style="background:#2563eb;color:#fff"><th style="padding:10px;text-align:right">التصنيف</th><th style="padding:10px;text-align:right">القيمة</th></tr></thead><tbody>${barRows}</tbody></table>
        <h3 style="font-size:14px;margin:14px 0 6px;color:#334155">التوزيع (دائري)</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px"><thead><tr style="background:#0d9488;color:#fff"><th style="padding:10px;text-align:right">التصنيف</th><th style="padding:10px;text-align:right">القيمة</th></tr></thead><tbody>${pieRows}</tbody></table>
        ${
          lineForExport.length
            ? `<h3 style="font-size:14px;margin:14px 0 6px;color:#334155">اتجاه زمني (متأخر)</h3><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#7c3aed;color:#fff"><th style="padding:10px;text-align:right">التاريخ</th><th style="padding:10px;text-align:right">العدد</th></tr></thead><tbody>${lineRows}</tbody></table>`
            : ''
        }
        ${
          previewPng
            ? `<div style="margin-top:24px;page-break-inside:avoid;text-align:center"><h3 style="font-size:14px;margin-bottom:10px;color:#0f172a">معاينة بصرية للرسوم</h3><img src="${previewPng}" style="max-width:100%;height:auto;border:1px solid #cbd5e1;border-radius:8px" alt="" /></div>`
            : ''
        }
      `;
    };

    const attendanceHeaders = [
      'الموظف',
      'الدور',
      'حاضر',
      'متأخر',
      'غائب',
      'إجازة كاملة',
      'إجازة زمنية',
      'مرات تأخير التحميل',
      'مجموع دقائق تأخير التحميل',
    ];
    const attendanceRows = filteredStaffStats.map((s) => [
      s.full_name,
      s.role === 'driver' ? 'سائق' : 'مساعد سائق',
      s.present,
      s.late,
      s.absent,
      s.full_leave,
      s.time_leave,
      s.role === 'driver' ? s.loading_delay_events : '—',
      s.role === 'driver' ? s.loading_delay_minutes_sum : '—',
    ]);
    const vehicleHeaders = ['اللوحة', 'الحالة', 'النوع', 'الموديل', 'السائق', 'العداد (كم)', 'ملاحظات'];
    const vehicleRows = filteredVehicleRows.map((v) => [
      v.plate_number,
      v.statusLabel,
      v.vehicle_type ?? '—',
      v.model ?? '—',
      v.driver_name,
      v.odometer_km,
      v.notes || '—',
    ]);
    const violHeaders = ['الموظف', 'الدور', 'عدد المخالفات', 'مجموع دقائق التأخير'];
    const violRows = filteredViolationRows.map((v) => [
      v.staffName,
      v.staffRole === 'driver' ? 'سائق' : 'مساعد',
      v.totalViolations,
      v.totalDelayMinutes,
    ]);

    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let fileSlug = 'تقارير_ذكية';

    if (activeDomain === 'all') {
      const any =
        filteredStaffStats.length +
        filteredVehicleRows.length +
        (showViolationsTab ? filteredViolationRows.length : 0);
      if (any === 0) {
        alert('لا توجد بيانات للتصدير');
        return;
      }
      fileSlug = `الكل_${df}_${dt}`;
      setExporting(true);
      try {
        const chartPng = await buildHubChartsPreviewPng({
          bar: ins.bar,
          pie: ins.pie,
          line: lineForExport,
        });
        if (format === 'excel') {
          const sheets: { name: string; data: unknown[][] }[] = [];
          if (filteredStaffStats.length)
            sheets.push({ name: 'الحضور', data: [attendanceHeaders, ...attendanceRows] });
          if (filteredVehicleRows.length)
            sheets.push({ name: 'المركبات', data: [vehicleHeaders, ...vehicleRows] });
          if (showViolationsTab && filteredViolationRows.length)
            sheets.push({ name: 'المخالفات', data: [violHeaders, ...violRows] });
          sheets.push({ name: 'الرسوم', data: chartRowsForExcel() });
          await exportSheetsToExcelWithOptionalChartImage(sheets, `${fileSlug}.xlsx`, chartPng);
        } else {
          const blocks: string[] = [];
          blocks.push(
            `<h1 style="text-align:center;font-size:22px;margin-bottom:8px">${titleBase} — عرض الكل</h1><p style="text-align:center;color:#666;margin-bottom:20px">من ${df} إلى ${dt}</p>`
          );
          if (filteredStaffStats.length) {
            blocks.push(
              `<h2 style="font-size:16px;margin:20px 0 10px;color:#0f172a">الكادر والحضور</h2><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#2563eb;color:#fff">${attendanceHeaders.map((h) => `<th style="padding:8px;text-align:right">${h}</th>`).join('')}</tr></thead><tbody>${attendanceRows.map((row, i) => `<tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}">${row.map((c) => `<td style="padding:6px 8px;border:1px solid #ddd">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
            );
          }
          if (filteredVehicleRows.length) {
            blocks.push(
              `<h2 style="font-size:16px;margin:20px 0 10px;color:#0f172a">المركبات</h2><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#0d9488;color:#fff">${vehicleHeaders.map((h) => `<th style="padding:8px;text-align:right">${h}</th>`).join('')}</tr></thead><tbody>${vehicleRows.map((row, i) => `<tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}">${row.map((c) => `<td style="padding:6px 8px;border:1px solid #ddd">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
            );
          }
          if (showViolationsTab && filteredViolationRows.length) {
            blocks.push(
              `<h2 style="font-size:16px;margin:20px 0 10px;color:#0f172a">المخالفات</h2><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#b91c1c;color:#fff">${violHeaders.map((h) => `<th style="padding:8px;text-align:right">${h}</th>`).join('')}</tr></thead><tbody>${violRows.map((row, i) => `<tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}">${row.map((c) => `<td style="padding:6px 8px;border:1px solid #ddd">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
            );
          }
          blocks.push(chartSectionPdf(chartPng));
          await exportHtmlToPdf(`<div dir="rtl">${blocks.join('')}</div>`, `${fileSlug}.pdf`);
        }
        await logAttendanceActivity('export', { type: 'reports_hub', dateFrom: df, dateTo: dt, scope: 'all' });
      } catch (e) {
        console.error(e);
        alert('فشل التصدير');
      } finally {
        setExporting(false);
      }
      return;
    }

    if (activeDomain === 'attendance') {
      if (filteredStaffStats.length === 0) {
        alert('لا توجد بيانات للتصدير');
        return;
      }
      fileSlug = `حضور_${df}_${dt}`;
      headers = attendanceHeaders;
      rows = attendanceRows;
    } else if (activeDomain === 'vehicles') {
      if (filteredVehicleRows.length === 0) {
        alert('لا توجد بيانات للتصدير');
        return;
      }
      fileSlug = `مركبات_${df}_${dt}`;
      headers = vehicleHeaders;
      rows = vehicleRows;
    } else if (activeDomain === 'violations') {
      if (filteredViolationRows.length === 0) {
        alert('لا توجد بيانات للتصدير');
        return;
      }
      fileSlug = `مخالفات_${df}_${dt}`;
      headers = violHeaders;
      rows = violRows;
    } else {
      return;
    }

    setExporting(true);
    try {
      const chartPng = await buildHubChartsPreviewPng({
        bar: ins.bar,
        pie: ins.pie,
        line: lineForExport,
      });
      if (format === 'excel') {
        await exportSheetsToExcelWithOptionalChartImage(
          [
            { name: 'البيانات', data: [headers, ...rows] },
            { name: 'الرسوم', data: chartRowsForExcel() },
          ],
          `${fileSlug}.xlsx`,
          chartPng
        );
      } else {
        const tableHtml = `
          <h1 style="text-align:center;font-size:22px;margin-bottom:16px">${titleBase} — ${activeDomain}</h1>
          <p style="text-align:center;color:#666;margin-bottom:20px">من ${df} إلى ${dt}</p>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:#3b82f6;color:#fff">
              ${headers.map((h) => `<th style="padding:8px;text-align:right">${h}</th>`).join('')}
            </tr></thead>
            <tbody>
              ${rows.map((row, i) => `
                <tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}">
                  ${row.map((c) => `<td style="padding:6px 8px;border:1px solid #ddd">${c}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
        await exportHtmlToPdf(`<div dir="rtl">${tableHtml}${chartSectionPdf(chartPng)}</div>`, `${fileSlug}.pdf`);
      }
      if (activeDomain === 'attendance') {
        await logAttendanceActivity('export', { type: 'reports_hub', dateFrom: df, dateTo: dt });
      }
    } catch (e) {
      console.error(e);
      alert('فشل التصدير');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const suspenseFallback = (
    <div className="flex justify-center py-8 text-stone-500">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  );

  const searchPlaceholder =
    activeDomain === 'all'
      ? 'بحث موحّد: أسماء، أرقام لوحات، حالات، تواريخ، أرقام… (يطبق على الحضور والمركبات والمخالفات)'
      : activeDomain === 'vehicles'
        ? 'بحث باللوحة أو السائق أو الحالة أو العداد أو «متاح»…'
        : activeDomain === 'violations'
          ? 'بحث باسم الموظف أو عدد مخالفات أو دقائق تأخير…'
          : 'بحث بالاسم أو الأرقام أو عبارات مثل «متأخر هذا الأسبوع»…';

  const exportRowCount =
    activeDomain === 'all'
      ? filteredStaffStats.length +
        filteredVehicleRows.length +
        (showViolationsTab ? filteredViolationRows.length : 0)
      : activeDomain === 'vehicles'
        ? filteredVehicleRows.length
        : activeDomain === 'violations'
          ? filteredViolationRows.length
          : filteredStaffStats.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-white">التقارير الذكية</h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 max-w-3xl">
          مركز موحّد للبحث والفلترة والتصدير عبر الحضور والمركبات
          {showViolationsTab ? ' والمخالفات' : ''}. البيانات تُجلب كما في الصفحات التفصيلية دون تغيير صلاحيات
          الخادم.
        </p>
        {profile?.full_name ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">المستخدم: {profile.full_name}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-stone-200 dark:border-stone-700 pb-2">
        {(
          [
            ['all', 'الكل', LayoutGrid],
            ['attendance', 'الكادر والحضور', Users],
            ['vehicles', 'المركبات', Truck],
            ...(showViolationsTab ? ([['violations', 'المخالفات', Shield]] as const) : []),
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveDomain(key as ReportsHubDomain)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors',
              activeDomain === key
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200'
                : 'border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-4 shadow-sm space-y-4"
      >
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
          <div className="flex-1 min-w-0">
            <SmartSearchBar
              pageKey="reports-hub"
              value={tableSearch}
              onChange={setTableSearch}
              placeholder={searchPlaceholder}
              dataSuggestions={dataSuggestionsForDomain}
              suggestionCatalogOverride={hubCatalog}
              showPredictiveChips
              debounceMs={250}
              onApplyParsedFilters={({ searchText, dateRange }) => {
                setTableSearch(searchText);
                if (dateRange) {
                  setField('dateFrom', dateRange.from);
                  setField('dateTo', dateRange.to);
                }
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border transition-colors',
                'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40',
                'text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/40'
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
              فلاتر متقدمة
            </button>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-stone-400 shrink-0" />
              {activeDomain === 'attendance' || activeDomain === 'all' ? (
                <>
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm"
                  >
                    <option value="name">ترتيب: الاسم</option>
                    <option value="present">ترتيب: حاضر</option>
                    <option value="late">ترتيب: متأخر</option>
                    <option value="absent">ترتيب: غائب</option>
                    <option value="loading_delay">ترتيب: دقائق تأخير التحميل</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                    className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 text-sm font-medium"
                  >
                    {sortDir === 'asc' ? 'تصاعدي' : 'تنازلي'}
                  </button>
                </>
              ) : activeDomain === 'vehicles' ? (
                <>
                  <select
                    value={vehSortKey}
                    onChange={(e) => setVehSortKey(e.target.value as VehicleSortKey)}
                    className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm"
                  >
                    <option value="plate">ترتيب: اللوحة</option>
                    <option value="status">ترتيب: الحالة</option>
                    <option value="odometer">ترتيب: العداد</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setVehSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                    className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 text-sm font-medium"
                  >
                    {vehSortDir === 'asc' ? 'تصاعدي' : 'تنازلي'}
                  </button>
                </>
              ) : (
                <>
                  <select
                    value={violSortKey}
                    onChange={(e) => setViolSortKey(e.target.value as ViolationSortKey)}
                    className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm"
                  >
                    <option value="violations">ترتيب: عدد المخالفات</option>
                    <option value="delay">ترتيب: دقائق التأخير</option>
                    <option value="name">ترتيب: الاسم</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setViolSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                    className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 text-sm font-medium"
                  >
                    {violSortDir === 'asc' ? 'تصاعدي' : 'تنازلي'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <FilterTags tags={filterTags} onRemove={removeKey} onClearAll={resetAll} />

        <div className="flex flex-wrap gap-2 items-center">
          <SavedViews<Record<string, unknown>>
            pageKey="reports-hub"
            getCurrentPayload={() => ({
              activeDomain,
              hubSearch: { ...hubSearch },
              dateFrom: filterState.dateFrom,
              dateTo: filterState.dateTo,
              role: filterState.role,
              sortKey,
              sortDir,
              vehSortKey,
              vehSortDir,
              violSortKey,
              violSortDir,
              name: filterState.name,
              plate: filterState.plate,
              statuses: filterState.statuses,
              delayMin: filterState.delayMin,
              delayMax: filterState.delayMax,
            })}
            onApply={(p) => {
              const dom = p.activeDomain;
              if (
                dom === 'attendance' ||
                dom === 'vehicles' ||
                dom === 'violations' ||
                dom === 'all'
              ) {
                setActiveDomain(dom);
              }
              const hs = p.hubSearch;
              if (hs && typeof hs === 'object' && hs !== null) {
                const o = hs as Record<string, unknown>;
                setHubSearch({
                  all: typeof o.all === 'string' ? o.all : hubSearch.all,
                  attendance: typeof o.attendance === 'string' ? o.attendance : hubSearch.attendance,
                  vehicles: typeof o.vehicles === 'string' ? o.vehicles : hubSearch.vehicles,
                  violations: typeof o.violations === 'string' ? o.violations : hubSearch.violations,
                });
              } else if (typeof p.tableSearch === 'string') {
                setHubSearch((prev) => ({ ...prev, attendance: p.tableSearch as string }));
              }
              if (typeof p.dateFrom === 'string') setField('dateFrom', p.dateFrom);
              if (typeof p.dateTo === 'string') setField('dateTo', p.dateTo);
              if (p.role === 'all' || p.role === 'driver' || p.role === 'assistant') setField('role', p.role);
              if (p.sortKey === 'name' || p.sortKey === 'late' || p.sortKey === 'absent' || p.sortKey === 'present' || p.sortKey === 'loading_delay') setSortKey(p.sortKey);
              if (p.sortDir === 'asc' || p.sortDir === 'desc') setSortDir(p.sortDir);
              if (p.vehSortKey === 'plate' || p.vehSortKey === 'status' || p.vehSortKey === 'odometer') setVehSortKey(p.vehSortKey);
              if (p.vehSortDir === 'asc' || p.vehSortDir === 'desc') setVehSortDir(p.vehSortDir);
              if (p.violSortKey === 'name' || p.violSortKey === 'violations' || p.violSortKey === 'delay') setViolSortKey(p.violSortKey);
              if (p.violSortDir === 'asc' || p.violSortDir === 'desc') setViolSortDir(p.violSortDir);
              if (typeof p.name === 'string') setField('name', p.name);
              if (typeof p.plate === 'string') setField('plate', p.plate);
              if (Array.isArray(p.statuses)) setField('statuses', p.statuses as typeof filterState.statuses);
              if (typeof p.delayMin === 'string') setField('delayMin', p.delayMin);
              if (typeof p.delayMax === 'string') setField('delayMax', p.delayMax);
            }}
          />
          <span
            title={
              activeDomain === 'all'
                ? 'في تبويب «الكل» استخدم أزرار Excel أو PDF أسفل القائمة لتصدير كل الجداول مع ملخص الرسوم.'
                : undefined
            }
            className="inline-block"
          >
            <ExportMenu
              disabled={activeDomain === 'all'}
              meta={{
                title: `التقارير الذكية [${activeDomain}] ${dateFrom} — ${dateTo}`,
                filterDescription:
                  [
                    filterTags.map((t) => t.label).join(' | '),
                    tableSearch && `بحث: ${tableSearch}`,
                    activeDomain === 'all' ? '(تصدير ذكي معطّل — استخدم Excel/PDF)' : '',
                  ]
                    .filter(Boolean)
                    .join(' ') || '—',
                rowCount: exportRowCount,
              }}
              headerRow={
                activeDomain === 'vehicles'
                  ? ['اللوحة', 'الحالة', 'النوع', 'الموديل', 'السائق', 'العداد (كم)', 'ملاحظات']
                  : activeDomain === 'violations'
                    ? ['الموظف', 'الدور', 'عدد المخالفات', 'مجموع دقائق التأخير']
                    : [
                        'الموظف',
                        'الدور',
                        'حاضر',
                        'متأخر',
                        'غائب',
                        'إجازة كاملة',
                        'إجازة زمنية',
                        'مرات تأخير التحميل',
                        'مجموع دقائق تأخير التحميل',
                      ]
              }
              dataRows={
                activeDomain === 'vehicles'
                  ? filteredVehicleRows.map((v) => [
                      v.plate_number,
                      v.statusLabel,
                      v.vehicle_type ?? '—',
                      v.model ?? '—',
                      v.driver_name,
                      v.odometer_km,
                      v.notes || '—',
                    ])
                  : activeDomain === 'violations'
                    ? filteredViolationRows.map((v) => [
                        v.staffName,
                        v.staffRole === 'driver' ? 'سائق' : 'مساعد',
                        v.totalViolations,
                        v.totalDelayMinutes,
                      ])
                    : filteredStaffStats.map((s) => [
                        s.full_name,
                        s.role === 'driver' ? 'سائق' : 'مساعد سائق',
                        s.present,
                        s.late,
                        s.absent,
                        s.full_leave,
                        s.time_leave,
                        s.role === 'driver' ? s.loading_delay_events : '—',
                        s.role === 'driver' ? s.loading_delay_minutes_sum : '—',
                      ])
              }
              sheetName="تقارير"
            />
          </span>
          <button
            type="button"
            onClick={() => handleExport('excel')}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Excel
          </button>
          <button
            type="button"
            onClick={() => handleExport('pdf')}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            PDF
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiItems.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-4 shadow-sm"
          >
            <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-2" />
            <p className="text-xs text-stone-500 dark:text-stone-400">{label}</p>
            <p className="text-2xl font-bold text-stone-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      <Suspense fallback={suspenseFallback}>
        <ChartsPanel
          barData={panelInsights.bar}
          pieData={panelInsights.pie}
          lineData={activeDomain === 'attendance' || activeDomain === 'all' ? lineData : undefined}
          minLineItems={2}
        />
      </Suspense>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 shadow-sm overflow-visible"
      >
        <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-700 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-stone-500" />
            <h3 className="font-semibold">
              {activeDomain === 'all'
                ? 'جداول مجمّعة — عرض الكل'
                : activeDomain === 'vehicles'
                  ? 'جدول المركبات (بعد الفلاتر)'
                  : activeDomain === 'violations'
                    ? 'جدول المخالفات المجمّع (بعد الفلاتر)'
                    : 'جدول مجمّع — الكادر والحضور'}
            </h3>
          </div>
          <InsightsPanel metrics={panelInsights.metrics} alerts={panelInsights.alerts} />
        </div>
        <Suspense fallback={suspenseFallback}>
          {activeDomain === 'all' ? (
            <div className="space-y-8 p-2 sm:p-4 overflow-visible">
              <section className="space-y-2">
                <h4 className="text-sm font-bold text-stone-700 dark:text-stone-200 px-1">
                  الكادر والحضور
                </h4>
                <DataTableEnhanced
                  rows={filteredStaffStats as unknown as Record<string, unknown>[]}
                  columns={attendanceHubColumns as unknown as ColumnDef<unknown>[]}
                  getRowKey={(s) => String((s as StaffStats).staff_id)}
                  defaultPageSize={15}
                  pageSizeOptions={[10, 15, 25, 50]}
                  emptyLabel="لا توجد صفوف حضور تطابق البحث"
                  className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl"
                />
              </section>
              <section className="space-y-2">
                <h4 className="text-sm font-bold text-stone-700 dark:text-stone-200 px-1">المركبات</h4>
                <DataTableEnhanced
                  rows={filteredVehicleRows as unknown as Record<string, unknown>[]}
                  columns={vehicleHubColumns as unknown as ColumnDef<unknown>[]}
                  getRowKey={(r) => String((r as VehicleHubRow).id)}
                  defaultPageSize={15}
                  pageSizeOptions={[10, 15, 25, 50]}
                  emptyLabel="لا توجد مركبات تطابق البحث"
                  className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl"
                />
              </section>
              {showViolationsTab ? (
                <section className="space-y-2">
                  <h4 className="text-sm font-bold text-stone-700 dark:text-stone-200 px-1">المخالفات</h4>
                  <DataTableEnhanced
                    rows={filteredViolationRows as unknown as Record<string, unknown>[]}
                    columns={violationHubColumns as unknown as ColumnDef<unknown>[]}
                    getRowKey={(r) => String((r as HubViolationStaffRow).staffId)}
                    defaultPageSize={15}
                    pageSizeOptions={[10, 15, 25, 50]}
                    emptyLabel="لا توجد مخالفات تطابق البحث"
                    className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl"
                  />
                </section>
              ) : null}
            </div>
          ) : activeDomain === 'vehicles' ? (
            <DataTableEnhanced
              rows={filteredVehicleRows as unknown as Record<string, unknown>[]}
              columns={vehicleHubColumns as unknown as ColumnDef<unknown>[]}
              getRowKey={(r) => String((r as VehicleHubRow).id)}
              defaultPageSize={25}
              pageSizeOptions={[10, 25, 50, 100]}
              emptyLabel="لا توجد مركبات تطابق الفلاتر الحالية"
              className="bg-white dark:bg-stone-800 border-0 rounded-none"
            />
          ) : activeDomain === 'violations' ? (
            <DataTableEnhanced
              rows={filteredViolationRows as unknown as Record<string, unknown>[]}
              columns={violationHubColumns as unknown as ColumnDef<unknown>[]}
              getRowKey={(r) => String((r as HubViolationStaffRow).staffId)}
              defaultPageSize={25}
              pageSizeOptions={[10, 25, 50, 100]}
              emptyLabel="لا توجد مخالفات في العرض الحالي"
              className="bg-white dark:bg-stone-800 border-0 rounded-none"
            />
          ) : (
            <DataTableEnhanced
              rows={filteredStaffStats as unknown as Record<string, unknown>[]}
              columns={attendanceHubColumns as unknown as ColumnDef<unknown>[]}
              getRowKey={(s) => String((s as StaffStats).staff_id)}
              defaultPageSize={25}
              pageSizeOptions={[10, 25, 50, 100]}
              emptyLabel="لا توجد صفوف تطابق الفلاتر الحالية"
              className="bg-white dark:bg-stone-800 border-0 rounded-none"
            />
          )}
        </Suspense>
      </motion.div>

      <Suspense fallback={null}>
        {filterOpen ? (
          <AdvancedFilterPanel
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            state={filterState}
            setField={setField}
            onApplyNaturalLanguage={applyNaturalLanguage}
          />
        ) : null}
      </Suspense>
    </div>
  );
}
