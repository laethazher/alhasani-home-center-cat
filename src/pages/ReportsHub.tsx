import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  Package,
  CircleDot,
  X,
} from 'lucide-react';
import { cn, ATTENDANCE_TYPE_COLORS } from '../lib/utils';
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
  BubblesRecord,
  BubblesRecordStatus,
  BubblesDailySnapshot,
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
import { BulkDeleteSelectedButton } from '../components/BulkDeleteSelectedButton';
import { deleteBubblesRecordsByUiIds } from '../lib/bubblesBulkDelete';
import { getDepartmentClient, getDepartmentTables } from '../data/supabaseSource';
import type { DepartmentCode } from '../data/department';
import { normalizeDepartmentStaffRole } from '../lib/staffRoleNormalize';
import { buildHubViolationStaffRows, type HubViolationStaffRow } from './reportsHubViolationsAggregate';
import { advancedFilterTags, FilterTags } from '../smart/components/FilterTags';
import type { ColumnDef } from '../smart/components/DataTableEnhanced';
import { useInspectionRecoveryStats } from '../hooks/useInspectionRecoveryStats';

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
  break: number;
  loading_delay_events: number;
  loading_delay_minutes_sum: number;
}

type ExitLoadingRow = {
  driver_id: string | number | null;
  created_at: string;
  loading_is_delay: boolean | null;
  loading_delay_minutes: number | null;
};

type ExitClampReportRow = {
  id: string;
  created_at: string;
  loading_verified: boolean | null;
  loading_issue_reason: string | null;
  status: string;
  driver_name: string | null;
  vehicle_plate: string | null;
};

const EXIT_STATUS_AR: Record<string, string> = {
  pending: 'قيد الانتظار',
  approved: 'تمت الموافقة',
  rejected: 'مرفوض',
  exited: 'غادر',
  pending_issue: 'مشكلة تحميل',
  approved_override: 'تجاوز إداري',
};

const BUBBLE_STATUS_AR: Record<BubblesRecordStatus, string> = {
  pending: 'معلق',
  completed: 'مكتمل',
  delayed: 'متأخر',
  issue: 'مشكلة',
};

function mapBubblesRecordRow(row: Record<string, unknown>): BubblesRecord {
  const st = String(row.status ?? 'pending');
  const status: BubblesRecordStatus =
    st === 'completed' || st === 'delayed' || st === 'issue' || st === 'pending' ? st : 'pending';
  const cbmRaw = row.cbm;
  return {
    id: String(row.id ?? ''),
    driver_name: String(row.driver_name ?? ''),
    customer_name: String(row.customer_name ?? ''),
    product_type: row.product_type != null && row.product_type !== '' ? String(row.product_type) : null,
    quantity: Number(row.quantity ?? 0) || 0,
    invoice_number:
      row.invoice_number != null && row.invoice_number !== '' ? String(row.invoice_number) : null,
    location: row.location != null && row.location !== '' ? String(row.location) : null,
    cbm: cbmRaw != null && cbmRaw !== '' ? Number(cbmRaw) : null,
    status,
    reason: row.reason != null && row.reason !== '' ? String(row.reason) : null,
    created_at: String(row.created_at ?? ''),
    return_time:
      row.return_time != null && row.return_time !== '' ? String(row.return_time) : null,
  };
}

function mapBubblesArchiveRow(row: Record<string, unknown>): BubblesRecord {
  const st = String(row.status ?? 'pending');
  const status: BubblesRecordStatus =
    st === 'completed' || st === 'delayed' || st === 'issue' || st === 'pending' ? st : 'pending';
  const cbmRaw = row.cbm;
  const archivedAt = String(row.archived_at ?? row.created_at ?? '');
  return {
    id: `arc-${String(row.archive_id ?? row.id ?? '')}`,
    driver_name: String(row.driver_name ?? ''),
    customer_name: String(row.customer_name ?? ''),
    product_type: row.product_type != null && row.product_type !== '' ? String(row.product_type) : null,
    quantity: Number(row.quantity ?? 0) || 0,
    invoice_number:
      row.invoice_number != null && row.invoice_number !== '' ? String(row.invoice_number) : null,
    location: row.location != null && row.location !== '' ? String(row.location) : null,
    cbm: cbmRaw != null && cbmRaw !== '' ? Number(cbmRaw) : null,
    status,
    reason: row.reason != null && row.reason !== '' ? String(row.reason) : null,
    created_at: archivedAt,
    return_time:
      row.return_time != null && row.return_time !== '' ? String(row.return_time) : null,
  };
}

function bubbleRowSearchBlob(r: BubblesRecord): string {
  return [
    r.driver_name,
    r.customer_name,
    r.product_type,
    r.invoice_number,
    r.location,
    BUBBLE_STATUS_AR[r.status],
    r.reason,
  ]
    .filter(Boolean)
    .join(' ');
}

type SortKey = 'name' | 'late' | 'absent' | 'present' | 'loading_delay';
type VehicleSortKey = 'plate' | 'status' | 'odometer';
type ViolationSortKey = 'name' | 'violations' | 'delay';
type BubbleDrillKey =
  | 'drivers'
  | 'total'
  | 'completed'
  | 'delayed'
  | 'issues_pending'
  | 'compliance'
  | 'follow_up';

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
    { k: 'break', v: s.break },
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

function pickRowsByKeySet<T>(rows: T[], keys: Set<string>, getKey: (row: T) => string): T[] {
  if (keys.size === 0) return rows;
  return rows.filter((r) => keys.has(getKey(r)));
}

interface Props {
  profile: UserProfile | null;
  department?: DepartmentCode;
}

export default function ReportsHub({ profile, department = 'tajhiz' }: Props) {
  const supabase = getDepartmentClient(department);
  const tables = getDepartmentTables(department);
  const attendanceArchiveTable = tables.attendanceArchive;
  const [archive, setArchive] = useState<AttendanceArchive[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [exitLoadingRows, setExitLoadingRows] = useState<ExitLoadingRow[]>([]);
  const [exitClampRows, setExitClampRows] = useState<ExitClampReportRow[]>([]);
  const [clampReportVerifiedFalseOnly, setClampReportVerifiedFalseOnly] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [violExitRequests, setViolExitRequests] = useState<ExitRequest[]>([]);
  const [manualViolations, setManualViolations] = useState<Violation[]>([]);
  const [bubblesRecords, setBubblesRecords] = useState<BubblesRecord[]>([]);
  const [bubbleSnapshots, setBubbleSnapshots] = useState<BubblesDailySnapshot[]>([]);
  const [bubbleOnlyOpenDrivers, setBubbleOnlyOpenDrivers] = useState(false);
  const [bubbleStatusFilter, setBubbleStatusFilter] = useState<'all' | BubblesRecordStatus>('all');
  const [bubbleDelayHoursMin, setBubbleDelayHoursMin] = useState('');
  const [bridgeNotice, setBridgeNotice] = useState(false);
  const [bubbleDrillModal, setBubbleDrillModal] = useState<BubbleDrillKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeDomain, setActiveDomain] = useState<ReportsHubDomain>('attendance');
  const [hubSearch, setHubSearch] = useState({
    all: '',
    attendance: '',
    vehicles: '',
    violations: '',
    bubbles: '',
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [vehSortKey, setVehSortKey] = useState<VehicleSortKey>('plate');
  const [vehSortDir, setVehSortDir] = useState<'asc' | 'desc'>('asc');
  const [violSortKey, setViolSortKey] = useState<ViolationSortKey>('violations');
  const [violSortDir, setViolSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedAttendanceKeys, setSelectedAttendanceKeys] = useState<Set<string>>(() => new Set());
  const [selectedVehicleKeys, setSelectedVehicleKeys] = useState<Set<string>>(() => new Set());
  const [selectedViolationKeys, setSelectedViolationKeys] = useState<Set<string>>(() => new Set());
  const [selectedBubbleKeys, setSelectedBubbleKeys] = useState<Set<string>>(() => new Set());
  const [bubbleBulkDeleting, setBubbleBulkDeleting] = useState(false);

  const showViolationsTab = profile?.role === 'admin';
  const showBubblesTab = (profile?.role === 'admin' || profile?.role === 'manager') && department === 'tajhiz';
  const { stats: recoveryStats } = useInspectionRecoveryStats(department, true);
  const isInstallation = department === 'installation';
  const attendanceDriverLabel = isInstallation ? 'فني' : 'سائق';
  const attendanceAssistantLabel = isInstallation ? 'مساعد فني' : 'مساعد سائق';
  const vehicleDriverHeader = isInstallation ? 'الفني' : 'السائق';
  const violationDriverLabel = isInstallation ? 'فني' : 'سائق';
  const violationAssistantLabel = isInstallation ? 'مساعد فني' : 'مساعد';
  const violationDriverPluralLabel = isInstallation ? 'فنيون' : 'سائقون';
  const violationDriverBarName = isInstallation ? 'فني' : 'سائق';
  const violationAssistantBarName = isInstallation ? 'مساعد فني' : 'مساعد';

  useEffect(() => {
    setSelectedAttendanceKeys(new Set());
    setSelectedVehicleKeys(new Set());
    setSelectedViolationKeys(new Set());
    setSelectedBubbleKeys(new Set());
  }, [activeDomain]);
  useEffect(() => {
    if (activeDomain !== 'bubbles') setBubbleDrillModal(null);
  }, [activeDomain]);
  const tableSearch =
    activeDomain === 'all'
      ? hubSearch.all
      : activeDomain === 'vehicles'
        ? hubSearch.vehicles
        : activeDomain === 'violations'
          ? hubSearch.violations
          : activeDomain === 'bubbles'
            ? hubSearch.bubbles
            : hubSearch.attendance;
  const setTableSearch = useCallback(
    (v: string) => {
      setHubSearch((prev) => {
        if (activeDomain === 'all') return { ...prev, all: v };
        if (activeDomain === 'vehicles') return { ...prev, vehicles: v };
        if (activeDomain === 'violations') return { ...prev, violations: v };
        if (activeDomain === 'bubbles') return { ...prev, bubbles: v };
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

  useEffect(() => {
    if (activeDomain === 'bubbles' && !showBubblesTab) {
      setActiveDomain('attendance');
    }
  }, [activeDomain, showBubblesTab]);

  const rangeSeed = useMemo(() => defaultDateRangeSeed(), []);
  const {
    state: filterState,
    setField,
    resetAll,
    removeKey,
    applyNaturalLanguage,
    structured,
  } = useAdvancedFilters(rangeSeed);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('bubblesArchiveBridge:v1');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      localStorage.removeItem('bubblesArchiveBridge:v1');
      setActiveDomain('bubbles');
      if (typeof parsed.search === 'string') {
        const bubblesQuery = parsed.search;
        setHubSearch((prev) => ({ ...prev, bubbles: bubblesQuery }));
      }
      if (typeof parsed.dateFrom === 'string') setField('dateFrom', parsed.dateFrom);
      if (typeof parsed.dateTo === 'string') setField('dateTo', parsed.dateTo);
      if (parsed.archiveTab === 'completed') setBubbleStatusFilter('completed');
      else if (parsed.archiveTab === 'delayed') setBubbleStatusFilter('delayed');
      else if (parsed.archiveTab === 'issues') setBubbleStatusFilter('issue');
      else setBubbleStatusFilter('all');
      setBubbleOnlyOpenDrivers(false);
      setBubbleDelayHoursMin('');
      setBridgeNotice(true);
    } catch {
      /* ignore malformed bridge payload */
    }
  }, [setField]);

  const debouncedAttendanceSearch = useDebouncedValue(hubSearch.attendance, 250);
  const debouncedVehiclesSearch = useDebouncedValue(hubSearch.vehicles, 250);
  const debouncedViolationsSearch = useDebouncedValue(hubSearch.violations, 250);
  const debouncedAllSearch = useDebouncedValue(hubSearch.all, 250);
  const debouncedBubblesSearch = useDebouncedValue(hubSearch.bubbles, 250);
  const nlAttendance = useMemo(() => parseSearchQuery(debouncedAttendanceSearch), [debouncedAttendanceSearch]);
  const nlVehicles = useMemo(() => parseSearchQuery(debouncedVehiclesSearch), [debouncedVehiclesSearch]);
  const nlViolations = useMemo(() => parseSearchQuery(debouncedViolationsSearch), [debouncedViolationsSearch]);
  const nlAll = useMemo(() => parseSearchQuery(debouncedAllSearch), [debouncedAllSearch]);
  const nlBubbles = useMemo(() => parseSearchQuery(debouncedBubblesSearch), [debouncedBubblesSearch]);

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
      exitClampRes,
      vehRes,
      exitViolRes,
      violRes,
      bubbleRes,
      bubbleArcRes,
      bubbleSnapRes,
    ] = await Promise.all([
      supabase.from(attendanceArchiveTable).select('*').order('attendance_date', { ascending: false }),
      supabase.from(tables.staffMembers).select('*').eq('is_active', true),
      supabase
        .from(tables.exitRequests)
        .select('driver_id, created_at, loading_is_delay, loading_delay_minutes')
        .eq('track_driver_loading_time', true),
      supabase
        .from(tables.exitRequests)
        .select('id, created_at, loading_verified, loading_issue_reason, status, driver_name, vehicle_plate')
        .order('created_at', { ascending: false }),
      supabase.from(tables.vehicles).select('*').order(department === 'installation' ? 'vehicle_number' : 'plate_number'),
      supabase
        .from(tables.exitRequests)
        .select('*')
        .eq('exit_type', 'temporary')
        .in('status', ['exited'])
        .order('created_at', { ascending: false }),
      supabase.from(tables.violations).select('*').order('violation_date', { ascending: false }),
      showBubblesTab
        ? supabase.from('bubbles_records').select('*').order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      showBubblesTab
        ? supabase.from('bubbles_records_archive').select('*').order('archived_at', { ascending: false }).limit(5000)
        : Promise.resolve({ data: [] }),
      showBubblesTab
        ? supabase.from('bubbles_daily_snapshots').select('*').order('day', { ascending: false }).limit(365)
        : Promise.resolve({ data: [] }),
    ]);
    if (archRes.data) setArchive(archRes.data);
    if (staffRes.data) {
      const normalizedStaff = (staffRes.data as Array<Record<string, unknown>>).map((s) => ({
        ...s,
        role: normalizeDepartmentStaffRole(s.role, department),
      })) as StaffMember[];
      setStaff(normalizedStaff);
    }
    if (exitRes.data) setExitLoadingRows(exitRes.data as ExitLoadingRow[]);
    if (exitClampRes.data) setExitClampRows(exitClampRes.data as ExitClampReportRow[]);
    if (vehRes.data) {
      const normalizedVehicles = (vehRes.data as Array<Record<string, unknown>>).map((v) => ({
        ...v,
        plate_number: String(v.plate_number ?? v.vehicle_number ?? ''),
        assigned_driver_id:
          v.assigned_driver_id != null
            ? String(v.assigned_driver_id)
            : v.responsible_staff_id != null
              ? String(v.responsible_staff_id)
              : null,
      })) as Vehicle[];
      setVehicles(normalizedVehicles);
    }
    if (exitViolRes.data) setViolExitRequests(exitViolRes.data);
    if (violRes.data) setManualViolations(violRes.data);
    const liveBubbles = (bubbleRes.data ?? []) as Record<string, unknown>[];
    const arcBubbles = (bubbleArcRes.data ?? []) as Record<string, unknown>[];
    setBubblesRecords([
      ...liveBubbles.map((row) => mapBubblesRecordRow(row)),
      ...arcBubbles.map((row) => mapBubblesArchiveRow(row)),
    ]);
    if (bubbleSnapRes.data) {
      setBubbleSnapshots((bubbleSnapRes.data ?? []) as BubblesDailySnapshot[]);
    }
    if (!silent) setLoading(false);
  }, [department, supabase, attendanceArchiveTable, tables.staffMembers, tables.exitRequests, tables.vehicles, tables.violations, showBubblesTab]);

  const fetchDataRef = useRef(fetchData);
  useLayoutEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  /** تحديث فوري عند تغيير الحضور/الكادر/المركبات/الخروج/المخالفات — بنفس أسلوب صفحات إخراج الكادر. */
  useEffect(() => {
    const silentRefresh = () => {
      void fetchDataRef.current(true);
    };
    const ch = supabase
      .channel(`reports-hub-sync:${department}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: attendanceArchiveTable }, silentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: tables.staffMembers }, silentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: tables.vehicles }, silentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: tables.exitRequests }, silentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: tables.violations }, silentRefresh);
    if (showBubblesTab) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'bubbles_records' }, silentRefresh).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bubbles_records_archive' },
        silentRefresh
      ).on('postgres_changes', { event: '*', schema: 'public', table: 'bubbles_daily_snapshots' }, silentRefresh);
    }
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [
    supabase,
    department,
    attendanceArchiveTable,
    tables.staffMembers,
    tables.vehicles,
    tables.exitRequests,
    tables.violations,
    showBubblesTab,
  ]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const selectedBubbleKeysRef = useRef(selectedBubbleKeys);
  selectedBubbleKeysRef.current = selectedBubbleKeys;

  const handleBulkDeleteBubbles = useCallback(async () => {
    if (!showBubblesTab) return;
    const ids = Array.from(selectedBubbleKeysRef.current);
    if (ids.length === 0) return;
    setBubbleBulkDeleting(true);
    try {
      const res = await deleteBubblesRecordsByUiIds(supabase, ids);
      if (!res.ok) {
        alert('تعذر حذف سجلات Bubbles: ' + res.message);
        return;
      }
      setSelectedBubbleKeys(new Set());
      await fetchData(true);
    } finally {
      setBubbleBulkDeleting(false);
    }
  }, [showBubblesTab, supabase, fetchData]);

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

  const { effBubblesFrom, effBubblesTo } = useMemo(() => {
    const nf = nlBubbles.dateFrom;
    const nt = nlBubbles.dateTo;
    const pf = dateFrom || '';
    const pt = dateTo || '';
    const effF = nf && pf ? (pf > nf ? pf : nf) : nf || pf || '';
    const effT = nt && pt ? (pt < nt ? pt : nt) : nt || pt || '';
    return { effBubblesFrom: effF, effBubblesTo: effT };
  }, [dateFrom, dateTo, nlBubbles.dateFrom, nlBubbles.dateTo]);

  const bubblesDateFiltered = useMemo(() => {
    return bubblesRecords.filter((r) => {
      if (!r.created_at) return false;
      const dk = getBaghdadDateKey(r.created_at);
      if (effBubblesFrom && dk < effBubblesFrom) return false;
      if (effBubblesTo && dk > effBubblesTo) return false;
      return true;
    });
  }, [bubblesRecords, effBubblesFrom, effBubblesTo]);

  const filteredBubbleRows = useMemo(() => {
    let rows = bubblesDateFiltered.filter((r) =>
      rowMatchesHubQuery(bubbleRowSearchBlob(r), debouncedBubblesSearch)
    );
    if (bubbleStatusFilter !== 'all') {
      rows = rows.filter((r) => r.status === bubbleStatusFilter);
    }
    if (bubbleOnlyOpenDrivers) {
      const driversWithOpen = new Set(
        bubblesDateFiltered.filter((r) => r.status !== 'completed').map((r) => r.driver_name)
      );
      rows = rows.filter((r) => driversWithOpen.has(r.driver_name));
    }
    const dh = bubbleDelayHoursMin.trim();
    if (dh !== '' && !Number.isNaN(Number(dh)) && Number(dh) > 0) {
      const ms = Number(dh) * 3600000;
      const now = Date.now();
      rows = rows.filter(
        (r) =>
          (r.status === 'pending' || r.status === 'delayed') &&
          now - new Date(r.created_at).getTime() >= ms
      );
    }
    return [...rows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [
    bubblesDateFiltered,
    debouncedBubblesSearch,
    bubbleStatusFilter,
    bubbleOnlyOpenDrivers,
    bubbleDelayHoursMin,
  ]);

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
        break: 0,
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
      else if (a.attendance_type === 'break') st.break++;
    }

    let list = Array.from(statsMap.values());
    if (filterState.role === 'driver') list = list.filter((s) => s.role === 'driver');
    else if (filterState.role === 'assistant') list = list.filter((s) => s.role === 'assistant');
    return list.sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [archive, staff, effFrom, effTo, exitLoadingRows, filterState.role]);

  const exitClampRowsInRange = useMemo(() => {
    return exitClampRows.filter((r) => {
      const dk = getBaghdadDateKey(r.created_at);
      if (effFrom && dk < effFrom) return false;
      if (effTo && dk > effTo) return false;
      return true;
    });
  }, [exitClampRows, effFrom, effTo]);

  const exitClampMetrics = useMemo(() => {
    const withoutClamps = exitClampRowsInRange.filter((r) => r.loading_verified === false).length;
    const withDecision = exitClampRowsInRange.filter(
      (r) => r.loading_verified !== null && r.loading_verified !== undefined
    );
    const verifiedTrue = withDecision.filter((r) => r.loading_verified === true).length;
    const totalDecided = withDecision.length;
    const compliancePct =
      totalDecided === 0 ? null : Math.round((verifiedTrue / totalDecided) * 1000) / 10;
    return { withoutClamps, compliancePct, totalDecided, verifiedTrue };
  }, [exitClampRowsInRange]);

  const exitClampTableRows = useMemo(() => {
    const base = exitClampRowsInRange.filter(
      (r) => r.loading_verified !== null && r.loading_verified !== undefined
    );
    if (clampReportVerifiedFalseOnly) return base.filter((r) => r.loading_verified === false);
    return base;
  }, [exitClampRowsInRange, clampReportVerifiedFalseOnly]);

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
          `${s.full_name} ${s.role} ${s.present} ${s.late} ${s.absent} ${s.full_leave} ${s.time_leave} ${s.break} ${s.loading_delay_events} ${s.loading_delay_minutes_sum}`,
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
          if (st === 'break') return s.break > 0;
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
          `${s.full_name} ${s.role} ${s.present} ${s.late} ${s.absent} ${s.full_leave} ${s.time_leave} ${s.break}`,
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
        { label: violationDriverPluralLabel, value: drivers },
        { label: 'مساعدون', value: assistants },
      ] as { label: string; value: string | number }[],
      alerts:
        list.length === 0
          ? ['لا توجد مخالفات في العرض الحالي.']
          : totalV > 20
            ? ['عدد مرتفع من المخالفات في العرض الحالي.']
            : [],
      bar: [
        { name: violationDriverBarName, value: drivers },
        { name: violationAssistantBarName, value: assistants },
      ],
      pie: [
        { name: violationDriverBarName, value: drivers },
        { name: violationAssistantBarName, value: assistants },
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

  const bubbleNameSuggestions = useMemo(
    () =>
      [
        ...new Set(
          bubblesRecords.flatMap((r) => [r.driver_name, r.customer_name].filter((x) => Boolean(x && String(x).trim())))
        ),
      ].slice(0, 50),
    [bubblesRecords]
  );

  const dataSuggestionsForDomain = useMemo(() => {
    if (activeDomain === 'all') {
      return [
        ...new Set([
          ...reportNameSuggestions,
          ...vehicleNameSuggestions,
          ...violationNameSuggestions,
          ...bubbleNameSuggestions.slice(0, 15),
        ]),
      ].slice(0, 60);
    }
    if (activeDomain === 'vehicles') return vehicleNameSuggestions;
    if (activeDomain === 'violations') return violationNameSuggestions;
    if (activeDomain === 'bubbles') return bubbleNameSuggestions;
    return reportNameSuggestions;
  }, [
    activeDomain,
    reportNameSuggestions,
    vehicleNameSuggestions,
    violationNameSuggestions,
    bubbleNameSuggestions,
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
        accessor: (s) => (s.role === 'driver' ? attendanceDriverLabel : attendanceAssistantLabel),
      },
      { id: 'present', header: 'حاضر', accessor: (s) => s.present },
      { id: 'late', header: 'متأخر', accessor: (s) => s.late },
      { id: 'absent', header: 'غائب', accessor: (s) => s.absent },
      { id: 'full_leave', header: 'إجازة كاملة', accessor: (s) => s.full_leave },
      { id: 'time_leave', header: 'إجازة زمنية', accessor: (s) => s.time_leave },
      { id: 'break', header: 'استراحه', accessor: (s) => s.break },
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
        header: vehicleDriverHeader,
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
        accessor: (v) => (v.staffRole === 'driver' ? violationDriverLabel : violationAssistantLabel),
      },
      { id: 'cnt', header: 'المخالفات', accessor: (v) => v.totalViolations },
      { id: 'delay', header: 'دقائق التأخير', accessor: (v) => v.totalDelayMinutes },
    ],
    [hubSearch.violations, hubSearch.all, activeDomain]
  );

  const bubbleHubColumns: ColumnDef<BubblesRecord>[] = useMemo(
    () => [
      {
        id: 'source',
        header: 'المصدر',
        accessor: (r) => (String(r.id).startsWith('arc-') ? 'أرشيف' : 'تشغيلي'),
      },
      {
        id: 'created',
        header: 'التاريخ',
        accessor: (r) =>
          new Date(r.created_at).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' }),
      },
      {
        id: 'driver',
        header: 'السائق',
        accessor: (r) => <HighlightText text={r.driver_name} query={hubSearch.bubbles} />,
      },
      {
        id: 'customer',
        header: 'العميل',
        accessor: (r) => <HighlightText text={r.customer_name} query={hubSearch.bubbles} />,
      },
      { id: 'product', header: 'النوع', accessor: (r) => r.product_type ?? '—' },
      { id: 'qty', header: 'الكمية', accessor: (r) => r.quantity },
      { id: 'inv', header: 'الفاتورة', accessor: (r) => r.invoice_number ?? '—' },
      { id: 'loc', header: 'الموقع', accessor: (r) => r.location ?? '—' },
      { id: 'cbm', header: 'CBM', accessor: (r) => (r.cbm != null ? r.cbm : '—') },
      { id: 'status', header: 'الحالة', accessor: (r) => BUBBLE_STATUS_AR[r.status] },
      { id: 'reason', header: 'السبب', accessor: (r) => r.reason ?? '—' },
      {
        id: 'ret',
        header: 'وقت الإرجاع',
        accessor: (r) =>
          r.return_time
            ? new Date(r.return_time).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })
            : '—',
      },
    ],
    [hubSearch.bubbles]
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

  const bubbleKpis = useMemo(() => {
    const rows = filteredBubbleRows;
    const uniqueDrivers = new Set(rows.map((r) => r.driver_name)).size;
    const completed = rows.filter((r) => r.status === 'completed').length;
    const delayed = rows.filter((r) => r.status === 'delayed').length;
    const issues = rows.filter((r) => r.status === 'issue').length;
    const pending = rows.filter((r) => r.status === 'pending').length;
    const total = rows.length;
    const compliancePct = total ? Math.round((completed / total) * 100) : 0;
    return { uniqueDrivers, completed, delayed, issues, pending, total, compliancePct };
  }, [filteredBubbleRows]);

  const bubbleKpiCards = useMemo(
    () =>
      [
        { key: 'drivers' as const, label: 'سائقون (فريدون)', value: bubbleKpis.uniqueDrivers, icon: Users },
        { key: 'total' as const, label: 'سجلات معروضة', value: bubbleKpis.total, icon: LayoutGrid },
        { key: 'completed' as const, label: 'مكتمل', value: bubbleKpis.completed, icon: Truck },
        { key: 'delayed' as const, label: 'متأخر', value: bubbleKpis.delayed, icon: ArrowUpDown },
        {
          key: 'issues_pending' as const,
          label: 'مشاكل / معلّق',
          value: `${bubbleKpis.issues} / ${bubbleKpis.pending}`,
          icon: Shield,
        },
        { key: 'compliance' as const, label: 'نسبة مكتمل (%)', value: bubbleKpis.compliancePct, icon: BarChart3 },
      ],
    [bubbleKpis]
  );

  const bubbleFollowUpDrivers = useMemo(() => {
    const byDriver = new Map<
      string,
      { driver: string; total: number; pending: number; delayed: number; issue: number; bad: number }
    >();
    for (const r of filteredBubbleRows) {
      const item = byDriver.get(r.driver_name) ?? {
        driver: r.driver_name,
        total: 0,
        pending: 0,
        delayed: 0,
        issue: 0,
        bad: 0,
      };
      item.total += 1;
      if (r.status === 'pending' || r.status === 'delayed' || r.status === 'issue') {
        item.bad += 1;
      }
      if (r.status === 'pending') item.pending += 1;
      if (r.status === 'delayed') item.delayed += 1;
      if (r.status === 'issue') item.issue += 1;
      byDriver.set(r.driver_name, item);
    }
    return [...byDriver.values()]
      .filter((x) => x.bad > 0)
      .sort((a, b) => b.bad - a.bad || b.total - a.total)
      .slice(0, 8);
  }, [filteredBubbleRows]);

  const bubbleFollowUpRows = useMemo(() => {
    if (bubbleFollowUpDrivers.length === 0) return [] as BubblesRecord[];
    const names = new Set(bubbleFollowUpDrivers.map((d) => d.driver));
    return filteredBubbleRows.filter(
      (r) => names.has(r.driver_name) && (r.status === 'pending' || r.status === 'delayed' || r.status === 'issue')
    );
  }, [bubbleFollowUpDrivers, filteredBubbleRows]);

  const bubbleDrillTitle = useMemo(() => {
    if (!bubbleDrillModal) return '';
    switch (bubbleDrillModal) {
      case 'drivers':
        return 'تفاصيل السائقين';
      case 'total':
        return 'تفاصيل كل السجلات المعروضة';
      case 'completed':
        return 'تفاصيل السجلات المكتملة';
      case 'delayed':
        return 'تفاصيل السجلات المتأخرة';
      case 'issues_pending':
        return 'تفاصيل المشاكل / المعلّق';
      case 'compliance':
        return 'تفاصيل السجلات المحتسبة في نسبة الاكتمال';
      case 'follow_up':
        return 'تفاصيل السجلات التي تحتاج متابعة';
      default:
        return 'تفاصيل';
    }
  }, [bubbleDrillModal]);

  const bubbleDrillRows = useMemo(() => {
    if (!bubbleDrillModal || bubbleDrillModal === 'drivers') return [] as BubblesRecord[];
    if (bubbleDrillModal === 'follow_up') return bubbleFollowUpRows;
    if (bubbleDrillModal === 'total') return filteredBubbleRows;
    if (bubbleDrillModal === 'completed') return filteredBubbleRows.filter((r) => r.status === 'completed');
    if (bubbleDrillModal === 'delayed') return filteredBubbleRows.filter((r) => r.status === 'delayed');
    if (bubbleDrillModal === 'issues_pending')
      return filteredBubbleRows.filter((r) => r.status === 'issue' || r.status === 'pending');
    return filteredBubbleRows.filter((r) => r.status === 'completed');
  }, [bubbleDrillModal, filteredBubbleRows, bubbleFollowUpRows]);

  const bubbleDriverSummaryRows = useMemo(() => {
    const map = new Map<
      string,
      { driver: string; total: number; pending: number; delayed: number; issue: number; completed: number }
    >();
    for (const r of filteredBubbleRows) {
      const item = map.get(r.driver_name) ?? {
        driver: r.driver_name,
        total: 0,
        pending: 0,
        delayed: 0,
        issue: 0,
        completed: 0,
      };
      item.total += 1;
      item[r.status] += 1;
      map.set(r.driver_name, item);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [filteredBubbleRows]);

  const bubbleInsights = useMemo(() => {
    const rows = filteredBubbleRows;
    const byDriver = new Map<string, number>();
    for (const r of rows) {
      byDriver.set(r.driver_name, (byDriver.get(r.driver_name) ?? 0) + 1);
    }
    const bar = [...byDriver.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, value]) => ({ name, value }));
    const sc: Record<BubblesRecordStatus, number> = {
      pending: 0,
      delayed: 0,
      issue: 0,
      completed: 0,
    };
    for (const r of rows) sc[r.status]++;
    const pie = (['pending', 'delayed', 'issue', 'completed'] as const)
      .filter((k) => sc[k] > 0)
      .map((k) => ({ name: BUBBLE_STATUS_AR[k], value: sc[k] }));
    const delayedReturns = rows.filter((r) => r.status === 'delayed').length;
    const openIssues = rows.filter((r) => r.status === 'issue').length;
    const latestSnap = bubbleSnapshots[0];
    return {
      metrics: [
        { label: 'سجلات في العرض', value: rows.length },
        { label: 'سائقون (فريدون)', value: new Set(rows.map((r) => r.driver_name)).size },
        { label: 'إرجاعات متأخرة', value: delayedReturns },
        { label: 'مشاكل', value: openIssues },
        { label: 'مكتمل في العرض', value: sc.completed },
        { label: 'معلق', value: sc.pending },
        { label: 'أيام مؤرشفة', value: bubbleSnapshots.length },
        { label: 'معلّق (آخر لقطة)', value: latestSnap?.pending_count ?? 0 },
      ] as { label: string; value: string | number }[],
      alerts:
        openIssues > 0
          ? [`${openIssues} سجل بحالة مشكلة في العرض الحالي.`]
          : delayedReturns > 5
            ? ['عدد مرتفع من السجلات المتأخرة في العرض الحالي.']
            : ([] as string[]),
      bar: bar.length ? bar : [{ name: 'لا توجد بيانات', value: 0 }],
      pie: pie.length ? pie : [{ name: 'لا توجد بيانات', value: 0 }],
    };
  }, [filteredBubbleRows, bubbleSnapshots]);

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
        alerts: [
          ...(recoveryStats.pendingCount > 0
            ? [
                `نواقص جرد مفتوحة: ${recoveryStats.pendingCount} | إجمالي النقص: ${recoveryStats.totalMissing} | مركبات معرضة: ${recoveryStats.vehicleRiskScore}`,
              ]
            : []),
          ...(recoveryStats.dueReminderCount > 0
            ? [`يوجد ${recoveryStats.dueReminderCount} حالة تعويض مجدولة حان موعدها.`]
            : []),
        ],
        bar,
        pie: pie.length ? pie : [{ name: 'لا توجد بيانات', value: 0 }],
      };
    }
    if (activeDomain === 'bubbles') return bubbleInsights;
    if (activeDomain === 'vehicles') return vehicleInsights;
    if (activeDomain === 'violations') return violationInsights;
    return reportTableInsights;
  }, [
    activeDomain,
    filteredStaffStats.length,
    filteredVehicleRows.length,
    filteredViolationRows.length,
    showViolationsTab,
    bubbleInsights,
    vehicleInsights,
    violationInsights,
    reportTableInsights,
    recoveryStats.pendingCount,
    recoveryStats.totalMissing,
    recoveryStats.vehicleRiskScore,
    recoveryStats.dueReminderCount,
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
      base.push({ label: 'total_missing', value: recoveryStats.totalMissing, icon: Package });
      base.push({ label: 'vehicle_risk_score', value: recoveryStats.vehicleRiskScore, icon: Truck });
      base.push({ label: 'user_gap_count', value: recoveryStats.userGapCount, icon: Users });
      return base;
    }
    if (activeDomain === 'vehicles') {
      return [
        { label: 'عدد المركبات', value: kpisVehicles.count, icon: Truck },
        { label: 'متاحة', value: kpisVehicles.available, icon: BarChart3 },
        { label: 'صيانة', value: kpisVehicles.maintenance, icon: SlidersHorizontal },
        { label: 'معطلة', value: kpisVehicles.broken, icon: FileText },
        { label: 'total_missing', value: recoveryStats.totalMissing, icon: Package },
        { label: 'vehicle_risk_score', value: recoveryStats.vehicleRiskScore, icon: Truck },
        { label: 'user_gap_count', value: recoveryStats.userGapCount, icon: Users },
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
    if (activeDomain === 'bubbles') {
      return [
        { label: 'سائقون (فريدون)', value: bubbleKpis.uniqueDrivers, icon: Users },
        { label: 'سجلات معروضة', value: bubbleKpis.total, icon: LayoutGrid },
        { label: 'مكتمل', value: bubbleKpis.completed, icon: Truck },
        { label: 'متأخر', value: bubbleKpis.delayed, icon: ArrowUpDown },
        { label: 'مشاكل / معلّق', value: `${bubbleKpis.issues} / ${bubbleKpis.pending}`, icon: Shield },
        { label: 'نسبة مكتمل (%)', value: bubbleKpis.compliancePct, icon: BarChart3 },
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
    bubbleKpis,
    filteredStaffStats.length,
    filteredVehicleRows.length,
    filteredViolationRows.length,
    showViolationsTab,
    recoveryStats.totalMissing,
    recoveryStats.vehicleRiskScore,
    recoveryStats.userGapCount,
  ]);

  const handleExport = async (format: 'pdf' | 'excel') => {
    const df = dateFrom || '—';
    const dt = dateTo || '—';
    const titleBase = 'التقارير الذكية';

    const staffForExport = pickRowsByKeySet(filteredStaffStats, selectedAttendanceKeys, (s) => String(s.staff_id));
    const vehicleForExport = pickRowsByKeySet(filteredVehicleRows, selectedVehicleKeys, (v) => String(v.id));
    const violForExport = pickRowsByKeySet(filteredViolationRows, selectedViolationKeys, (v) => String(v.staffId));

    let selectionNoteHtml = '';
    if (activeDomain === 'all') {
      const parts: string[] = [];
      if (selectedAttendanceKeys.size > 0) parts.push(`حضور: ${staffForExport.length} صف محدد`);
      if (selectedVehicleKeys.size > 0) parts.push(`مركبات: ${vehicleForExport.length} صف محدد`);
      if (showViolationsTab && selectedViolationKeys.size > 0) parts.push(`مخالفات: ${violForExport.length} صف محدد`);
      if (parts.length > 0) {
        selectionNoteHtml = `<p style="text-align:center;color:#0369a1;margin:6px 0 14px;font-size:13px;font-weight:600">${parts.join(' · ')}</p>`;
      }
    } else if (activeDomain === 'attendance' && selectedAttendanceKeys.size > 0) {
      selectionNoteHtml = `<p style="text-align:center;color:#0369a1;margin:6px 0 14px;font-size:13px;font-weight:600">تصدير ${staffForExport.length} صف محدد من أصل ${filteredStaffStats.length}</p>`;
    } else if (activeDomain === 'vehicles' && selectedVehicleKeys.size > 0) {
      selectionNoteHtml = `<p style="text-align:center;color:#0369a1;margin:6px 0 14px;font-size:13px;font-weight:600">تصدير ${vehicleForExport.length} صف محدد من أصل ${filteredVehicleRows.length}</p>`;
    } else if (activeDomain === 'violations' && selectedViolationKeys.size > 0) {
      selectionNoteHtml = `<p style="text-align:center;color:#0369a1;margin:6px 0 14px;font-size:13px;font-weight:600">تصدير ${violForExport.length} صف محدد من أصل ${filteredViolationRows.length}</p>`;
    }

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
      'استراحه',
      'مرات تأخير التحميل',
      'مجموع دقائق تأخير التحميل',
    ];
    const attendanceRows = staffForExport.map((s) => [
      s.full_name,
      s.role === 'driver' ? attendanceDriverLabel : attendanceAssistantLabel,
      s.present,
      s.late,
      s.absent,
      s.full_leave,
      s.time_leave,
      s.break,
      s.role === 'driver' ? s.loading_delay_events : '—',
      s.role === 'driver' ? s.loading_delay_minutes_sum : '—',
    ]);
    const vehicleHeaders = ['اللوحة', 'الحالة', 'النوع', 'الموديل', vehicleDriverHeader, 'العداد (كم)', 'ملاحظات'];
    const vehicleRows = vehicleForExport.map((v) => [
      v.plate_number,
      v.statusLabel,
      v.vehicle_type ?? '—',
      v.model ?? '—',
      v.driver_name,
      v.odometer_km,
      v.notes || '—',
    ]);
    const violHeaders = ['الموظف', 'الدور', 'عدد المخالفات', 'مجموع دقائق التأخير'];
    const violRows = violForExport.map((v) => [
      v.staffName,
      v.staffRole === 'driver' ? violationDriverLabel : violationAssistantLabel,
      v.totalViolations,
      v.totalDelayMinutes,
    ]);

    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let fileSlug = 'تقارير_ذكية';

    if (activeDomain === 'all') {
      const any =
        staffForExport.length + vehicleForExport.length + (showViolationsTab ? violForExport.length : 0);
      if (any === 0) {
        alert('لا توجد بيانات للتصدير (تحقق من الفلاتر أو من التحديد)');
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
          if (staffForExport.length)
            sheets.push({ name: 'الحضور', data: [attendanceHeaders, ...attendanceRows] });
          if (vehicleForExport.length)
            sheets.push({ name: 'المركبات', data: [vehicleHeaders, ...vehicleRows] });
          if (showViolationsTab && violForExport.length)
            sheets.push({ name: 'المخالفات', data: [violHeaders, ...violRows] });
          sheets.push({ name: 'الرسوم', data: chartRowsForExcel() });
          await exportSheetsToExcelWithOptionalChartImage(sheets, `${fileSlug}.xlsx`, chartPng);
        } else {
          const blocks: string[] = [];
          blocks.push(
            `<h1 style="text-align:center;font-size:22px;margin-bottom:8px">${titleBase} — عرض الكل</h1><p style="text-align:center;color:#666;margin-bottom:20px">من ${df} إلى ${dt}</p>${selectionNoteHtml}`
          );
          if (staffForExport.length) {
            blocks.push(
              `<h2 style="font-size:16px;margin:20px 0 10px;color:#0f172a">الكادر والحضور</h2><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#2563eb;color:#fff">${attendanceHeaders.map((h) => `<th style="padding:8px;text-align:right">${h}</th>`).join('')}</tr></thead><tbody>${attendanceRows.map((row, i) => `<tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}">${row.map((c) => `<td style="padding:6px 8px;border:1px solid #ddd">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
            );
          }
          if (vehicleForExport.length) {
            blocks.push(
              `<h2 style="font-size:16px;margin:20px 0 10px;color:#0f172a">المركبات</h2><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#0d9488;color:#fff">${vehicleHeaders.map((h) => `<th style="padding:8px;text-align:right">${h}</th>`).join('')}</tr></thead><tbody>${vehicleRows.map((row, i) => `<tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}">${row.map((c) => `<td style="padding:6px 8px;border:1px solid #ddd">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
            );
          }
          if (showViolationsTab && violForExport.length) {
            blocks.push(
              `<h2 style="font-size:16px;margin:20px 0 10px;color:#0f172a">المخالفات</h2><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#b91c1c;color:#fff">${violHeaders.map((h) => `<th style="padding:8px;text-align:right">${h}</th>`).join('')}</tr></thead><tbody>${violRows.map((row, i) => `<tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}">${row.map((c) => `<td style="padding:6px 8px;border:1px solid #ddd">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
            );
          }
          blocks.push(chartSectionPdf(chartPng));
          await exportHtmlToPdf(`<div dir="rtl">${blocks.join('')}</div>`, `${fileSlug}.pdf`);
        }
        await logAttendanceActivity('export', { type: 'reports_hub', dateFrom: df, dateTo: dt, scope: 'all' }, department);
      } catch (e) {
        console.error(e);
        alert('فشل التصدير');
      } finally {
        setExporting(false);
      }
      return;
    }

    if (activeDomain === 'attendance') {
      if (staffForExport.length === 0) {
        alert('لا توجد بيانات للتصدير (تحقق من الفلاتر أو من التحديد)');
        return;
      }
      fileSlug = `حضور_${df}_${dt}`;
      headers = attendanceHeaders;
      rows = attendanceRows;
    } else if (activeDomain === 'vehicles') {
      if (vehicleForExport.length === 0) {
        alert('لا توجد بيانات للتصدير (تحقق من الفلاتر أو من التحديد)');
        return;
      }
      fileSlug = `مركبات_${df}_${dt}`;
      headers = vehicleHeaders;
      rows = vehicleRows;
    } else if (activeDomain === 'violations') {
      if (violForExport.length === 0) {
        alert('لا توجد بيانات للتصدير (تحقق من الفلاتر أو من التحديد)');
        return;
      }
      fileSlug = `مخالفات_${df}_${dt}`;
      headers = violHeaders;
      rows = violRows;
    } else if (activeDomain === 'bubbles') {
      if (filteredBubbleRows.length === 0) {
        alert('لا توجد بيانات للتصدير (تحقق من الفلاتر أو من التحديد)');
        return;
      }
      fileSlug = `bubbles_${df}_${dt}`;
      headers = [
        'المصدر',
        'التاريخ',
        'السائق',
        'العميل',
        'النوع',
        'الكمية',
        'الفاتورة',
        'الموقع',
        'CBM',
        'الحالة',
        'السبب',
        'وقت الإرجاع',
      ];
      rows = filteredBubbleRows.map((r) => [
        String(r.id).startsWith('arc-') ? 'أرشيف' : 'تشغيلي',
        new Date(r.created_at).toLocaleString('ar-IQ'),
        r.driver_name,
        r.customer_name,
        r.product_type ?? '—',
        r.quantity,
        r.invoice_number ?? '—',
        r.location ?? '—',
        r.cbm ?? '—',
        BUBBLE_STATUS_AR[r.status],
        r.reason ?? '—',
        r.return_time ? new Date(r.return_time).toLocaleString('ar-IQ') : '—',
      ]);
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
          ${selectionNoteHtml}
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
      if (activeDomain === 'attendance' || activeDomain === 'bubbles') {
        await logAttendanceActivity('export', {
          type: 'reports_hub',
          dateFrom: df,
          dateTo: dt,
          scope: activeDomain,
        }, department);
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
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
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
      ? 'بحث موحّد: أسماء، أرقام لوحات، حالات، تواريخ، أرقام… (يطبق على الحضور والمركبات والمخالفات وBubbles)'
      : activeDomain === 'vehicles'
        ? `بحث باللوحة أو ${vehicleDriverHeader} أو الحالة أو العداد أو «متاح»…`
        : activeDomain === 'violations'
          ? 'بحث باسم الموظف أو عدد مخالفات أو دقائق تأخير…'
          : activeDomain === 'bubbles'
            ? 'بحث بالسائق أو العميل أو الحالة أو الفاتورة أو الموقع…'
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
          : activeDomain === 'bubbles'
            ? filteredBubbleRows.length
            : filteredStaffStats.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-white">التقارير الذكية</h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 max-w-3xl">
          مركز موحّد للبحث والفلترة والتصدير عبر الحضور والمركبات
          {showViolationsTab ? ' والمخالفات' : ''}
          {showBubblesTab ? ' وBubbles' : ''}. البيانات تُجلب كما في الصفحات التفصيلية دون تغيير صلاحيات
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
            ...(showBubblesTab ? ([['bubbles', 'Bubbles', CircleDot]] as const) : []),
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

      {bridgeNotice && activeDomain === 'bubbles' ? (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-blue-900 dark:text-blue-100 font-semibold">
            تم تطبيق فلاتر من أرشيف Bubbles.
          </p>
          <button
            type="button"
            onClick={() => {
              setBridgeNotice(false);
              setHubSearch((prev) => ({ ...prev, bubbles: '' }));
              setBubbleStatusFilter('all');
              setBubbleOnlyOpenDrivers(false);
              setBubbleDelayHoursMin('');
              setField('dateFrom', rangeSeed.dateFrom);
              setField('dateTo', rangeSeed.dateTo);
            }}
            className="px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40"
          >
            مسح سريع
          </button>
        </div>
      ) : null}

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
              ) : activeDomain === 'bubbles' ? (
                <span className="text-xs text-stone-500 dark:text-stone-400 px-1">
                  ترتيب: الأحدث أولاً — استخدم البحث والفلاتر أعلاه
                </span>
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
            storageScope={department}
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
              bubbleOnlyOpenDrivers,
              bubbleStatusFilter,
              bubbleDelayHoursMin,
            })}
            onApply={(p) => {
              const dom = p.activeDomain;
              if (
                dom === 'attendance' ||
                dom === 'vehicles' ||
                dom === 'violations' ||
                dom === 'all' ||
                dom === 'bubbles'
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
                  bubbles: typeof o.bubbles === 'string' ? o.bubbles : hubSearch.bubbles,
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
              if (typeof p.bubbleOnlyOpenDrivers === 'boolean')
                setBubbleOnlyOpenDrivers(p.bubbleOnlyOpenDrivers);
              if (
                p.bubbleStatusFilter === 'all' ||
                p.bubbleStatusFilter === 'pending' ||
                p.bubbleStatusFilter === 'completed' ||
                p.bubbleStatusFilter === 'delayed' ||
                p.bubbleStatusFilter === 'issue'
              ) {
                setBubbleStatusFilter(p.bubbleStatusFilter);
              }
              if (typeof p.bubbleDelayHoursMin === 'string') setBubbleDelayHoursMin(p.bubbleDelayHoursMin);
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
                activeDomain === 'bubbles'
                  ? [
                      'المصدر',
                      'التاريخ',
                      'السائق',
                      'العميل',
                      'النوع',
                      'الكمية',
                      'الفاتورة',
                      'الموقع',
                      'CBM',
                      'الحالة',
                      'السبب',
                      'وقت الإرجاع',
                    ]
                  : activeDomain === 'vehicles'
                    ? ['اللوحة', 'الحالة', 'النوع', 'الموديل', vehicleDriverHeader, 'العداد (كم)', 'ملاحظات']
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
                activeDomain === 'bubbles'
                  ? filteredBubbleRows.map((r) => [
                      String(r.id).startsWith('arc-') ? 'أرشيف' : 'تشغيلي',
                      new Date(r.created_at).toLocaleString('ar-IQ'),
                      r.driver_name,
                      r.customer_name,
                      r.product_type ?? '—',
                      r.quantity,
                      r.invoice_number ?? '—',
                      r.location ?? '—',
                      r.cbm ?? '—',
                      BUBBLE_STATUS_AR[r.status],
                      r.reason ?? '—',
                      r.return_time ? new Date(r.return_time).toLocaleString('ar-IQ') : '—',
                    ])
                  : activeDomain === 'vehicles'
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
                          v.staffRole === 'driver' ? violationDriverLabel : violationAssistantLabel,
                          v.totalViolations,
                          v.totalDelayMinutes,
                        ])
                      : filteredStaffStats.map((s) => [
                          s.full_name,
                          s.role === 'driver' ? attendanceDriverLabel : attendanceAssistantLabel,
                          s.present,
                          s.late,
                          s.absent,
                          s.full_leave,
                          s.time_leave,
                          s.break,
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
        {(activeDomain === 'bubbles' ? bubbleKpiCards : kpiItems).map((item) => {
          const { label, value, icon: Icon } = item;
          const drillKey = activeDomain === 'bubbles' ? (item as (typeof bubbleKpiCards)[number]).key : null;
          if (activeDomain === 'bubbles' && drillKey) {
            return (
              <button
                key={label}
                type="button"
                onClick={() => setBubbleDrillModal(drillKey)}
                className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-4 shadow-sm text-right transition-all hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900"
              >
                <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-2" />
                <p className="text-xs text-stone-500 dark:text-stone-400">{label}</p>
                <p className="text-2xl font-bold text-stone-900 dark:text-white">{value}</p>
                <p className="text-[11px] text-violet-600 dark:text-violet-400 mt-2 font-medium">انقر للمعاينة</p>
              </button>
            );
          }
          return (
            <div
              key={label}
              className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-4 shadow-sm"
            >
              <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-2" />
              <p className="text-xs text-stone-500 dark:text-stone-400">{label}</p>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">{value}</p>
            </div>
          );
        })}
      </div>

      {activeDomain === 'bubbles' && bubbleDrillModal ? (
        <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[1px] p-3 sm:p-6 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-6xl max-h-[92vh] rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-700 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-stone-900 dark:text-white">{bubbleDrillTitle}</h3>
              <div className="flex items-center gap-2">
                <ExportMenu
                  meta={{
                    title: bubbleDrillTitle,
                    filterDescription: 'تصدير من معاينة بطاقات Bubbles',
                    rowCount:
                      bubbleDrillModal === 'drivers' ? bubbleDriverSummaryRows.length : bubbleDrillRows.length,
                  }}
                  headerRow={
                    bubbleDrillModal === 'drivers'
                      ? ['السائق', 'الإجمالي', 'معلّق', 'متأخر', 'مشكلة', 'مكتمل']
                      : [
                          'المصدر',
                          'التاريخ',
                          'السائق',
                          'العميل',
                          'النوع',
                          'الكمية',
                          'الفاتورة',
                          'الموقع',
                          'CBM',
                          'الحالة',
                          'السبب',
                          'وقت الإرجاع',
                        ]
                  }
                  dataRows={
                    bubbleDrillModal === 'drivers'
                      ? bubbleDriverSummaryRows.map((r) => [
                          r.driver,
                          r.total,
                          r.pending,
                          r.delayed,
                          r.issue,
                          r.completed,
                        ])
                      : bubbleDrillRows.map((r) => [
                          String(r.id).startsWith('arc-') ? 'أرشيف' : 'تشغيلي',
                          new Date(r.created_at).toLocaleString('ar-IQ'),
                          r.driver_name,
                          r.customer_name,
                          r.product_type ?? '—',
                          r.quantity,
                          r.invoice_number ?? '—',
                          r.location ?? '—',
                          r.cbm ?? '—',
                          BUBBLE_STATUS_AR[r.status],
                          r.reason ?? '—',
                          r.return_time ? new Date(r.return_time).toLocaleString('ar-IQ') : '—',
                        ])
                  }
                  sheetName={
                    bubbleDrillModal === 'drivers'
                      ? 'Bubbles_Drivers'
                      : bubbleDrillModal === 'follow_up'
                        ? 'Bubbles_FollowUp'
                        : 'Bubbles_Details'
                  }
                />
                <button
                  type="button"
                  onClick={() => setBubbleDrillModal(null)}
                  className="p-2 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                  aria-label="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-3 sm:p-4 overflow-auto">
              <table className="w-full text-sm text-right min-w-[900px]">
                <thead>
                  <tr className="bg-stone-100 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300">
                    {bubbleDrillModal === 'drivers' ? (
                      <>
                        <th className="p-2">السائق</th>
                        <th className="p-2">الإجمالي</th>
                        <th className="p-2">معلّق</th>
                        <th className="p-2">متأخر</th>
                        <th className="p-2">مشكلة</th>
                        <th className="p-2">مكتمل</th>
                      </>
                    ) : (
                      <>
                        <th className="p-2">المصدر</th>
                        <th className="p-2">التاريخ</th>
                        <th className="p-2">السائق</th>
                        <th className="p-2">العميل</th>
                        <th className="p-2">الحالة</th>
                        <th className="p-2">الفاتورة</th>
                        <th className="p-2">السبب</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(bubbleDrillModal === 'drivers' ? bubbleDriverSummaryRows : bubbleDrillRows).length === 0 ? (
                    <tr>
                      <td
                        colSpan={bubbleDrillModal === 'drivers' ? 6 : 7}
                        className="p-6 text-center text-stone-500 dark:text-stone-400"
                      >
                        لا توجد بيانات للتفاصيل ضمن الفلاتر الحالية.
                      </td>
                    </tr>
                  ) : bubbleDrillModal === 'drivers' ? (
                    bubbleDriverSummaryRows.map((r) => (
                      <tr key={r.driver} className="border-t border-stone-100 dark:border-stone-800">
                        <td className="p-2 font-semibold">{r.driver}</td>
                        <td className="p-2">{r.total}</td>
                        <td className="p-2">{r.pending}</td>
                        <td className="p-2">{r.delayed}</td>
                        <td className="p-2">{r.issue}</td>
                        <td className="p-2">{r.completed}</td>
                      </tr>
                    ))
                  ) : (
                    bubbleDrillRows.map((r) => (
                      <tr key={r.id} className="border-t border-stone-100 dark:border-stone-800">
                        <td className="p-2">{String(r.id).startsWith('arc-') ? 'أرشيف' : 'تشغيلي'}</td>
                        <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString('ar-IQ')}</td>
                        <td className="p-2">{r.driver_name}</td>
                        <td className="p-2">{r.customer_name}</td>
                        <td className="p-2">{BUBBLE_STATUS_AR[r.status]}</td>
                        <td className="p-2">{r.invoice_number ?? '—'}</td>
                        <td className="p-2">{r.reason ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      ) : null}

      {activeDomain === 'bubbles' && showBubblesTab ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-violet-200 dark:border-violet-900/50 bg-violet-50/40 dark:bg-violet-950/20 p-4 shadow-sm flex flex-wrap gap-4 items-end"
        >
          <label className="flex items-center gap-2 text-sm font-medium text-stone-800 dark:text-stone-200 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-stone-300 text-violet-600 focus:ring-violet-500"
              checked={bubbleOnlyOpenDrivers}
              onChange={(e) => setBubbleOnlyOpenDrivers(e.target.checked)}
            />
            سائقون لديهم سجلات غير مكتملة ضمن النطاق الزمني
          </label>
          <div className="flex flex-col gap-1 min-w-[140px]">
            <span className="text-xs text-stone-500 dark:text-stone-400">حالة السجل</span>
            <select
              value={bubbleStatusFilter}
              onChange={(e) =>
                setBubbleStatusFilter(e.target.value as 'all' | BubblesRecordStatus)
              }
              className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm"
            >
              <option value="all">الكل</option>
              <option value="pending">معلق</option>
              <option value="delayed">متأخر</option>
              <option value="issue">مشكلة</option>
              <option value="completed">مكتمل</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 min-w-[180px]">
            <span className="text-xs text-stone-500 dark:text-stone-400">
              تأخير منذ الإنشاء (ساعات) — معلّق أو متأخر فقط
            </span>
            <input
              type="number"
              min={0}
              step={1}
              placeholder="مثال: 24"
              value={bubbleDelayHoursMin}
              onChange={(e) => setBubbleDelayHoursMin(e.target.value)}
              className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-sm"
            />
          </div>
        </motion.div>
      ) : null}

      {activeDomain === 'bubbles' && showBubblesTab ? (
        <div className="flex flex-wrap items-center justify-end gap-2 px-1">
          <BulkDeleteSelectedButton
            selectedCount={selectedBubbleKeys.size}
            deleting={bubbleBulkDeleting}
            confirmMessage={(n) =>
              `حذف ${n} سجل Bubbles من قاعدة البيانات (تشغيلي أو أرشيف)؟ لا يمكن التراجع.`
            }
            onDelete={handleBulkDeleteBubbles}
          />
        </div>
      ) : null}

      {activeDomain === 'bubbles' && showBubblesTab ? (
        <button
          type="button"
          onClick={() => setBubbleDrillModal('follow_up')}
          disabled={bubbleFollowUpDrivers.length === 0}
          className="w-full rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/20 p-4 text-right transition-all disabled:opacity-75 disabled:cursor-default enabled:hover:border-red-400 dark:enabled:hover:border-red-700 enabled:hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900"
        >
          <h3 className="font-bold text-red-800 dark:text-red-200 mb-2 flex items-center justify-between gap-2">
            يحتاج متابعة
            {bubbleFollowUpDrivers.length > 0 ? (
              <span className="text-xs font-semibold text-red-600 dark:text-red-300">معاينة التفاصيل</span>
            ) : null}
          </h3>
          <ul className="text-sm space-y-1 text-stone-700 dark:text-stone-300">
            {bubbleFollowUpDrivers.map((x) => (
              <li key={x.driver}>
                {x.driver} — يحتاج متابعة {x.bad} (معلّق {x.pending} / متأخر {x.delayed} / مشكلة {x.issue})
              </li>
            ))}
            {bubbleFollowUpDrivers.length === 0 ? <li>لا توجد حالات متابعة ضمن الفلاتر الحالية.</li> : null}
          </ul>
        </button>
      ) : null}

      {(activeDomain === 'attendance' || activeDomain === 'all') && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-teal-200 dark:border-teal-900/50 bg-teal-50/40 dark:bg-teal-950/25 p-4 shadow-sm space-y-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Package className="w-5 h-5 text-teal-700 dark:text-teal-300 shrink-0" />
            <h3 className="font-bold text-stone-900 dark:text-white">إخراج الكادر — التحقق من القواطع</h3>
            <span className="text-xs text-stone-500 dark:text-stone-400">
              (حسب تاريخ إنشاء الطلب وفلترة التواريخ أعلاه — توقيت بغداد)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4">
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">حالات بدون قواطع</p>
              <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                {exitClampMetrics.withoutClamps}
              </p>
              <p className="text-[11px] text-stone-500 mt-1">طلبات سُجّل فيها تحميل بدون قواطع ضمن النطاق</p>
            </div>
            <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4">
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">نسبة الالتزام بالقواطع</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {exitClampMetrics.compliancePct == null ? '—' : `${exitClampMetrics.compliancePct}%`}
              </p>
              <p className="text-[11px] text-stone-500 mt-1">
                من أصل {exitClampMetrics.totalDecided} طلباً تم فيها تسجيل قرار (نعم/لا)
              </p>
            </div>
            <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 flex flex-col justify-center">
              <label className="flex items-center gap-2 text-sm font-medium text-stone-800 dark:text-stone-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                  checked={clampReportVerifiedFalseOnly}
                  onChange={(e) => setClampReportVerifiedFalseOnly(e.target.checked)}
                />
                عرض حالات <span className="font-mono text-xs">loading_verified = false</span> فقط
              </label>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900">
            <table className="w-full text-sm text-right min-w-[640px]">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80">
                  <th className="p-3 font-semibold">التاريخ</th>
                  <th className="p-3 font-semibold">السائق</th>
                  <th className="p-3 font-semibold">المركبة</th>
                  <th className="p-3 font-semibold">حالة الطلب</th>
                  <th className="p-3 font-semibold">القواطع</th>
                  <th className="p-3 font-semibold">السبب</th>
                </tr>
              </thead>
              <tbody>
                {exitClampTableRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-stone-500 dark:text-stone-400">
                      لا توجد صفوف تطابق الفلتر ضمن نطاق التواريخ (أو لم يُسجَّل أي قرار تحقق بعد).
                    </td>
                  </tr>
                ) : (
                  exitClampTableRows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-stone-100 dark:border-stone-800 hover:bg-stone-50/80 dark:hover:bg-stone-800/40"
                    >
                      <td className="p-3 whitespace-nowrap text-stone-600 dark:text-stone-300">
                        {new Date(r.created_at).toLocaleString('ar-IQ', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="p-3">{r.driver_name || '—'}</td>
                      <td className="p-3">{r.vehicle_plate || '—'}</td>
                      <td className="p-3">{EXIT_STATUS_AR[r.status] ?? r.status}</td>
                      <td className="p-3">
                        {r.loading_verified === true ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">نعم</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400 font-medium">لا</span>
                        )}
                      </td>
                      <td className="p-3 max-w-xs text-stone-600 dark:text-stone-400 break-words">
                        {r.loading_issue_reason || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

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
                    : activeDomain === 'bubbles'
                      ? 'جدول Bubbles (بعد الفلاتر)'
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
                  selectionEnabled
                  selectedKeys={selectedAttendanceKeys}
                  onSelectedKeysChange={setSelectedAttendanceKeys}
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
                  selectionEnabled
                  selectedKeys={selectedVehicleKeys}
                  onSelectedKeysChange={setSelectedVehicleKeys}
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
                    selectionEnabled
                    selectedKeys={selectedViolationKeys}
                    onSelectedKeysChange={setSelectedViolationKeys}
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
              selectionEnabled
              selectedKeys={selectedVehicleKeys}
              onSelectedKeysChange={setSelectedVehicleKeys}
            />
          ) : activeDomain === 'bubbles' ? (
            <DataTableEnhanced
              rows={filteredBubbleRows as unknown as Record<string, unknown>[]}
              columns={bubbleHubColumns as unknown as ColumnDef<unknown>[]}
              getRowKey={(r) => String((r as BubblesRecord).id)}
              defaultPageSize={25}
              pageSizeOptions={[10, 25, 50, 100]}
              emptyLabel="لا توجد سجلات Bubbles تطابق الفلاتر الحالية"
              className="bg-white dark:bg-stone-800 border-0 rounded-none"
              selectionEnabled={showBubblesTab}
              selectedKeys={selectedBubbleKeys}
              onSelectedKeysChange={setSelectedBubbleKeys}
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
              selectionEnabled
              selectedKeys={selectedViolationKeys}
              onSelectedKeysChange={setSelectedViolationKeys}
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
              selectionEnabled
              selectedKeys={selectedAttendanceKeys}
              onSelectedKeysChange={setSelectedAttendanceKeys}
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
