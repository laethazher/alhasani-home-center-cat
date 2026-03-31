import React, { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import {
  CircleDot,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Package,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import type {
  UserProfile,
  BubblesRecord,
  BubblesRecordStatus,
  BubblesArchiveRecord,
  BubblesDailySnapshot,
} from '../lib/supabaseClient';
import { parseBubblesExcelBuffer } from '../lib/bubblesExcelParse';
import { groupByDriverThenCustomer } from '../lib/bubblesGrouping';
import {
  SmartSearchBar,
  ChartsPanel,
  ExportMenu,
  useDebouncedValue,
  useAutoRefresh,
  HighlightText,
} from '../smart';
import { rowMatchesHubQuery } from '../smart/utils/hubSearchMatch';
import { getBaghdadDateKey } from '../lib/loadingTime';

const ChartsPanelLazy = lazy(() =>
  import('../smart/components/ChartsPanel').then((m) => ({ default: m.ChartsPanel }))
);

const BATCH = 250;

function mapRow(r: Record<string, unknown>): BubblesRecord {
  return {
    id: String(r.id),
    driver_name: String(r.driver_name ?? ''),
    customer_name: String(r.customer_name ?? ''),
    product_type: r.product_type != null ? String(r.product_type) : null,
    quantity: Number(r.quantity ?? 0),
    invoice_number: r.invoice_number != null ? String(r.invoice_number) : null,
    location: r.location != null ? String(r.location) : null,
    cbm: r.cbm != null && r.cbm !== '' ? Number(r.cbm) : null,
    status: r.status as BubblesRecordStatus,
    reason: r.reason != null ? String(r.reason) : null,
    created_at: String(r.created_at),
    return_time: r.return_time != null ? String(r.return_time) : null,
  };
}

const STATUS_AR: Record<BubblesRecordStatus, string> = {
  pending: 'معلّق',
  delayed: 'متأخر',
  issue: 'مشكلة',
  completed: 'مكتمل',
};

function statusBadgeClass(s: BubblesRecordStatus): string {
  if (s === 'completed') return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200';
  if (s === 'delayed') return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
  if (s === 'issue') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100';
  return 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300';
}

type TabKey = 'active' | 'delayed' | 'issues' | 'completed';
type SourceTab = 'live' | 'archive';
type ArchiveTabKey = 'all' | 'completed' | 'delayed' | 'issues';

const TAB_LABEL_AR: Record<TabKey, string> = {
  active: 'نشط',
  delayed: 'متأخر',
  issues: 'مشاكل',
  completed: 'مكتمل',
};

const ARCHIVE_TAB_LABEL_AR: Record<ArchiveTabKey, string> = {
  all: 'كل الأرشيف',
  completed: 'مكتمل',
  delayed: 'متأخر',
  issues: 'مشاكل',
};

/** أسباب عدم الإرجاع (قائمة الحارس / الإدارة) */
const BUBBLES_ISSUE_REASON_OPTIONS = [
  'كارتون ( صيني )',
  'بطلب من الزبون',
  'تم الارجاع جزئياً',
] as const;

type KpiDrillKey = 'drivers' | 'completed' | 'delayed' | 'issues' | 'avgReturn' | 'total';

type BubblesDetailModalState =
  | { kind: 'kpi'; kpi: KpiDrillKey }
  | { kind: 'followUp' };

type DriverKpiSummaryRow = {
  name: string;
  total: number;
  pending: number;
  delayed: number;
  issue: number;
  completed: number;
};

function buildDriverKpiSummaries(list: BubblesRecord[]): DriverKpiSummaryRow[] {
  const m = new Map<string, { pending: number; delayed: number; issue: number; completed: number; total: number }>();
  for (const r of list) {
    const name = r.driver_name.trim() || '—';
    if (!m.has(name)) {
      m.set(name, { pending: 0, delayed: 0, issue: 0, completed: 0, total: 0 });
    }
    const x = m.get(name)!;
    x.total += 1;
    if (r.status === 'pending') x.pending += 1;
    else if (r.status === 'delayed') x.delayed += 1;
    else if (r.status === 'issue') x.issue += 1;
    else if (r.status === 'completed') x.completed += 1;
  }
  return [...m.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

const KPI_MODAL_TITLE: Record<KpiDrillKey, string> = {
  drivers: 'تفاصيل السائقين',
  completed: 'السجلات المكتملة',
  delayed: 'السجلات المتأخرة',
  issues: 'سجلات المشاكل',
  avgReturn: 'أسس حساب متوسط الإرجاع',
  total: 'جميع السجلات',
};

function bubblesRecordReturnHours(r: BubblesRecord): number | null {
  if (r.status !== 'completed' || !r.return_time) return null;
  const ms = new Date(r.return_time).getTime() - new Date(r.created_at).getTime();
  if (ms < 0) return null;
  return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
}

interface Props {
  profile: UserProfile;
  userId: string;
  onOpenReportsHub?: () => void;
}

function mapArchiveRow(r: Record<string, unknown>): BubblesArchiveRecord {
  const base = mapRow(r);
  return {
    ...base,
    id: `arc-${String(r.archive_id ?? base.id)}`,
    source_id: r.source_id != null ? String(r.source_id) : null,
    archived_at: String(r.archived_at ?? r.created_at ?? ''),
    archived_day: String(r.archived_day ?? ''),
    archived_reason: String(r.archived_reason ?? 'daily_9am'),
  };
}

export default function Bubbles({ profile, userId: _userId, onOpenReportsHub }: Props) {
  const role = profile.role;
  const isAdmin = role === 'admin';
  const isGate = role === 'gate_guard';
  const canGate = isAdmin || isGate;
  const gateMinimalUi = role === 'gate_guard';

  const [records, setRecords] = useState<BubblesRecord[]>([]);
  const [archiveRecords, setArchiveRecords] = useState<BubblesArchiveRecord[]>([]);
  const [dailySnapshots, setDailySnapshots] = useState<BubblesDailySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceTab, setSourceTab] = useState<SourceTab>('live');
  const [tab, setTab] = useState<TabKey>('active');
  const [archiveTab, setArchiveTab] = useState<ArchiveTabKey>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [gateDriver, setGateDriver] = useState<string | null>(null);
  const [gateIssueReason, setGateIssueReason] = useState('');
  const [gateBusy, setGateBusy] = useState(false);
  const [detailModal, setDetailModal] = useState<BubblesDetailModalState | null>(null);

  const debouncedSearch = useDebouncedValue(search, 250);

  const fetchRecords = useCallback(async () => {
    const { data, error } = await supabase
      .from('bubbles_records')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setRecords((data ?? []).map((r) => mapRow(r as Record<string, unknown>)));
  }, []);

  const fetchArchiveData = useCallback(async () => {
    const [arcRes, snapRes] = await Promise.all([
      supabase.from('bubbles_records_archive').select('*').order('archived_at', { ascending: false }),
      supabase.from('bubbles_daily_snapshots').select('*').order('day', { ascending: false }),
    ]);
    if (arcRes.error) {
      console.error(arcRes.error);
    } else {
      setArchiveRecords((arcRes.data ?? []).map((r) => mapArchiveRow(r as Record<string, unknown>)));
    }
    if (snapRes.error) {
      console.error(snapRes.error);
    } else {
      setDailySnapshots((snapRes.data ?? []) as BubblesDailySnapshot[]);
    }
  }, []);

  const applyPendingToDelayed = useCallback(async () => {
    if (!isAdmin) return;
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('bubbles_records')
      .update({ status: 'delayed' })
      .eq('status', 'pending')
      .lt('created_at', cutoff);
    if (error) console.warn('bubbles delayed sweep:', error.message);
  }, [isAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    await applyPendingToDelayed();
    await Promise.all([fetchRecords(), fetchArchiveData()]);
    setLoading(false);
  }, [applyPendingToDelayed, fetchRecords, fetchArchiveData]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel('bubbles_records_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bubbles_records' }, () => {
        void fetchRecords();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [fetchRecords]);

  useAutoRefresh(60_000, () => {
    void applyPendingToDelayed();
    void fetchRecords();
    void fetchArchiveData();
  }, true);

  useEffect(() => {
    if (gateMinimalUi && sourceTab === 'archive') {
      setSourceTab('live');
    }
  }, [gateMinimalUi, sourceTab]);

  useEffect(() => {
    if (gateMinimalUi && tab === 'delayed') {
      setTab('active');
    }
  }, [gateMinimalUi, tab]);

  useEffect(() => {
    if (!detailModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailModal]);

  useEffect(() => {
    if (sourceTab !== 'live') {
      setDetailModal(null);
    }
  }, [sourceTab]);

  const filteredByTab = useMemo(() => {
    return records.filter((r) => {
      if (tab === 'active') return r.status === 'pending' || r.status === 'delayed';
      if (tab === 'delayed') return r.status === 'delayed';
      if (tab === 'issues') return r.status === 'issue';
      if (tab === 'completed') return r.status === 'completed';
      return true;
    });
  }, [records, tab]);

  const filteredByDate = useMemo(() => {
    if (gateMinimalUi) {
      const todayKey = getBaghdadDateKey(new Date());
      return filteredByTab.filter((r) => {
        if (tab === 'active') {
          return (
            (r.status === 'pending' || r.status === 'delayed') &&
            getBaghdadDateKey(r.created_at) === todayKey
          );
        }
        if (tab === 'issues') {
          return r.status === 'issue' && getBaghdadDateKey(r.created_at) === todayKey;
        }
        if (tab === 'completed') {
          if (r.status !== 'completed') return false;
          if (r.return_time) return getBaghdadDateKey(r.return_time) === todayKey;
          return getBaghdadDateKey(r.created_at) === todayKey;
        }
        return true;
      });
    }
    return filteredByTab.filter((r) => {
      const d = r.created_at.slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [filteredByTab, dateFrom, dateTo, gateMinimalUi, tab]);

  const filteredDisplay = useMemo(() => {
    const q = debouncedSearch.trim();
    if (!q) return filteredByDate;
    return filteredByDate.filter((r) =>
      rowMatchesHubQuery(
        [
          r.driver_name,
          r.customer_name,
          r.product_type ?? '',
          r.invoice_number ?? '',
          r.location ?? '',
          STATUS_AR[r.status],
        ].join(' '),
        q
      )
    );
  }, [filteredByDate, debouncedSearch]);

  const archiveFilteredByTab = useMemo(() => {
    return archiveRecords.filter((r) => {
      if (archiveTab === 'completed') return r.status === 'completed';
      if (archiveTab === 'delayed') return r.status === 'delayed';
      if (archiveTab === 'issues') return r.status === 'issue';
      return true;
    });
  }, [archiveRecords, archiveTab]);

  const archiveFilteredByDate = useMemo(() => {
    return archiveFilteredByTab.filter((r) => {
      const d = r.archived_day || getBaghdadDateKey(r.archived_at || r.created_at);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [archiveFilteredByTab, dateFrom, dateTo]);

  const archiveFilteredDisplay = useMemo(() => {
    const q = debouncedSearch.trim();
    if (!q) return archiveFilteredByDate;
    return archiveFilteredByDate.filter((r) =>
      rowMatchesHubQuery(
        [
          r.driver_name,
          r.customer_name,
          r.product_type ?? '',
          r.invoice_number ?? '',
          r.location ?? '',
          STATUS_AR[r.status],
          r.archived_reason,
          r.archived_day,
        ].join(' '),
        q
      )
    );
  }, [archiveFilteredByDate, debouncedSearch]);

  const archiveGrouped = useMemo(
    () => groupByDriverThenCustomer(archiveFilteredDisplay as BubblesRecord[]),
    [archiveFilteredDisplay]
  );

  const grouped = useMemo(() => groupByDriverThenCustomer(filteredDisplay), [filteredDisplay]);

  const kpis = useMemo(() => {
    const drivers = new Set(records.map((r) => r.driver_name.trim()).filter(Boolean));
    const total = records.length;
    const comp = records.filter((r) => r.status === 'completed').length;
    const del = records.filter((r) => r.status === 'delayed').length;
    const iss = records.filter((r) => r.status === 'issue').length;
    const completedPct = total ? Math.round((comp / total) * 1000) / 10 : 0;
    const delayedPct = total ? Math.round((del / total) * 1000) / 10 : 0;
    let sumH = 0;
    let nH = 0;
    for (const r of records) {
      if (r.status !== 'completed' || !r.return_time) continue;
      const ms = new Date(r.return_time).getTime() - new Date(r.created_at).getTime();
      if (ms >= 0) {
        sumH += ms / (1000 * 60 * 60);
        nH += 1;
      }
    }
    const avgReturnH = nH ? Math.round((sumH / nH) * 10) / 10 : null;
    return {
      driverCount: drivers.size,
      completedPct,
      delayedPct,
      issuesCount: iss,
      avgReturnH,
      total,
    };
  }, [records]);

  const archiveKpis = useMemo(() => {
    const list = archiveFilteredDisplay;
    const drivers = new Set(list.map((r) => r.driver_name.trim()).filter(Boolean));
    const total = list.length;
    const comp = list.filter((r) => r.status === 'completed').length;
    const del = list.filter((r) => r.status === 'delayed').length;
    const iss = list.filter((r) => r.status === 'issue').length;
    const completedPct = total ? Math.round((comp / total) * 1000) / 10 : 0;
    const delayedPct = total ? Math.round((del / total) * 1000) / 10 : 0;
    let sumH = 0;
    let nH = 0;
    for (const r of list) {
      const h = bubblesRecordReturnHours(r);
      if (h == null) continue;
      sumH += h;
      nH += 1;
    }
    const avgReturnH = nH ? Math.round((sumH / nH) * 10) / 10 : null;
    return {
      driverCount: drivers.size,
      completedPct,
      delayedPct,
      issuesCount: iss,
      avgReturnH,
      total,
    };
  }, [archiveFilteredDisplay]);

  const pieData = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filteredDisplay) {
      m.set(STATUS_AR[r.status], (m.get(STATUS_AR[r.status]) ?? 0) + 1);
    }
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [filteredDisplay]);

  const archivePieData = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of archiveFilteredDisplay) {
      m.set(STATUS_AR[r.status], (m.get(STATUS_AR[r.status]) ?? 0) + 1);
    }
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [archiveFilteredDisplay]);

  const barData = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filteredDisplay) {
      const d = r.driver_name.trim() || '—';
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    const arr = [...m.entries()].map(([name, value]) => ({ name, value }));
    arr.sort((a, b) => b.value - a.value);
    return arr.slice(0, 12);
  }, [filteredDisplay]);

  const archiveBarData = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of archiveFilteredDisplay) {
      const d = r.driver_name.trim() || '—';
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    const arr = [...m.entries()].map(([name, value]) => ({ name, value }));
    arr.sort((a, b) => b.value - a.value);
    return arr.slice(0, 12);
  }, [archiveFilteredDisplay]);

  const lineData = useMemo(() => {
    const days = 14;
    const now = new Date();
    const keys: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      keys.push(d.toISOString().slice(0, 10));
    }
    const counts = new Map<string, number>();
    keys.forEach((k) => counts.set(k, 0));
    for (const r of records) {
      if (r.status !== 'completed' || !r.return_time) continue;
      const k = r.return_time.slice(0, 10);
      if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return keys.map((k) => ({
      name: k.slice(5),
      value: counts.get(k) ?? 0,
    }));
  }, [records]);

  const archiveLineData = useMemo(() => {
    const list = [...dailySnapshots]
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-14)
      .map((s) => ({ name: s.day.slice(5), value: s.total_records }));
    return list;
  }, [dailySnapshots]);

  const driverScores = useMemo(() => {
    const m = new Map<string, { completed: number; bad: number }>();
    for (const r of records) {
      const d = r.driver_name.trim() || '—';
      if (!m.has(d)) m.set(d, { completed: 0, bad: 0 });
      const x = m.get(d)!;
      if (r.status === 'completed') x.completed += 1;
      if (r.status === 'delayed' || r.status === 'issue') x.bad += 1;
    }
    const list = [...m.entries()].map(([name, v]) => ({
      name,
      score: v.completed - v.bad,
      completed: v.completed,
      bad: v.bad,
    }));
    const best = [...list].filter((x) => x.completed > 0).sort((a, b) => b.score - a.score).slice(0, 5);
    const worst = [...list].filter((x) => x.bad > 0).sort((a, b) => a.score - b.score).slice(0, 5);
    return { best, worst };
  }, [records]);

  const driverKpiSummaries = useMemo(() => buildDriverKpiSummaries(records), [records]);

  const worstDriverNameSet = useMemo(
    () => new Set(driverScores.worst.map((x) => x.name)),
    [driverScores.worst]
  );

  const followUpDetailRecords = useMemo(
    () =>
      records.filter(
        (r) =>
          (r.status === 'delayed' || r.status === 'issue') &&
          worstDriverNameSet.has(r.driver_name.trim() || '—')
      ),
    [records, worstDriverNameSet]
  );

  const avgReturnDetailRecords = useMemo(
    () => records.filter((r) => bubblesRecordReturnHours(r) != null),
    [records]
  );

  const detailKpiRows = useMemo((): BubblesRecord[] => {
    if (!detailModal || detailModal.kind !== 'kpi') return [];
    switch (detailModal.kpi) {
      case 'drivers':
        return [];
      case 'completed':
        return records.filter((r) => r.status === 'completed');
      case 'delayed':
        return records.filter((r) => r.status === 'delayed');
      case 'issues':
        return records.filter((r) => r.status === 'issue');
      case 'avgReturn':
        return avgReturnDetailRecords;
      case 'total':
        return records;
      default:
        return [];
    }
  }, [detailModal, records, avgReturnDetailRecords]);

  const detailModalExport = useMemo(() => {
    if (!detailModal || sourceTab !== 'live') return null;
    if (detailModal.kind === 'kpi' && detailModal.kpi === 'drivers') {
      return {
        title: 'تفاصيل السائقين',
        sheetName: 'Bubbles_Drivers',
        headers: ['السائق', 'الإجمالي', 'معلّق', 'متأخر', 'مشكلة', 'مكتمل'],
        rows: driverKpiSummaries.map((r) => [
          r.name,
          r.total,
          r.pending,
          r.delayed,
          r.issue,
          r.completed,
        ]),
      };
    }
    const rows = detailModal.kind === 'followUp' ? followUpDetailRecords : detailKpiRows;
    return {
      title: detailModal.kind === 'followUp' ? 'سجلات تحتاج متابعة' : KPI_MODAL_TITLE[detailModal.kpi],
      sheetName: detailModal.kind === 'followUp' ? 'Bubbles_FollowUp' : `Bubbles_${detailModal.kpi}`,
      headers: [
        'السائق',
        'العميل',
        'المنتج',
        'الكمية',
        'الفاتورة',
        'الموقع',
        'CBM',
        'الحالة',
        ...(detailModal.kind === 'kpi' && detailModal.kpi === 'avgReturn' ? ['مدة الإرجاع (س)'] : []),
        'السبب',
        'تاريخ الإنشاء',
        'وقت الإرجاع',
      ],
      rows: rows.map((r) => [
        r.driver_name,
        r.customer_name,
        r.product_type ?? '—',
        r.quantity,
        r.invoice_number ?? '—',
        r.location ?? '—',
        r.cbm ?? '—',
        STATUS_AR[r.status],
        ...(detailModal.kind === 'kpi' && detailModal.kpi === 'avgReturn'
          ? [bubblesRecordReturnHours(r) ?? '—']
          : []),
        r.reason ?? '—',
        new Date(r.created_at).toLocaleString('ar-IQ'),
        r.return_time ? new Date(r.return_time).toLocaleString('ar-IQ') : '—',
      ]),
    };
  }, [detailModal, sourceTab, driverKpiSummaries, followUpDetailRecords, detailKpiRows]);

  const gateDrivers = useMemo(() => {
    const todayKey = getBaghdadDateKey(new Date());
    const set = new Set<string>();
    for (const r of records) {
      if (r.status !== 'pending' && r.status !== 'delayed') continue;
      if (gateMinimalUi && getBaghdadDateKey(r.created_at) !== todayKey) continue;
      set.add(r.driver_name.trim() || '—');
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'ar'));
  }, [records, gateMinimalUi]);

  const adminAlertCounts = useMemo(() => {
    if (!isAdmin) return { delayed: 0, issue: 0 };
    return {
      delayed: records.filter((r) => r.status === 'delayed').length,
      issue: records.filter((r) => r.status === 'issue').length,
    };
  }, [records, isAdmin]);

  const pendingCount = useMemo(() => records.filter((r) => r.status === 'pending').length, [records]);
  const displayGrouped = sourceTab === 'archive' ? archiveGrouped : grouped;
  const displayKpis = sourceTab === 'archive' ? archiveKpis : kpis;
  const displayPieData = sourceTab === 'archive' ? archivePieData : pieData;
  const displayBarData = sourceTab === 'archive' ? archiveBarData : barData;
  const displayLineData = sourceTab === 'archive' ? archiveLineData : lineData;
  const displayRows = sourceTab === 'archive' ? archiveFilteredDisplay : filteredDisplay;

  const onUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isAdmin) return;
    setUploadBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const { rows, errors } = parseBubblesExcelBuffer(buf);
      if (errors.length && rows.length === 0) {
        alert(errors.join('\n'));
        return;
      }
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH);
        const { error } = await supabase.from('bubbles_records').insert(chunk);
        if (error) {
          alert('فشل الإدراج: ' + error.message);
          return;
        }
      }
      await applyPendingToDelayed();
      await fetchRecords();
      if (errors.length) alert('تحذير:\n' + errors.join('\n'));
    } finally {
      setUploadBusy(false);
    }
  };

  const markDriverReturned = async (driver: string) => {
    setGateBusy(true);
    const todayKey = getBaghdadDateKey(new Date());
    if (gateMinimalUi) {
      const ids = records
        .filter(
          (r) =>
            (r.driver_name.trim() || '—') === (driver.trim() || '—') &&
            (r.status === 'pending' || r.status === 'delayed') &&
            getBaghdadDateKey(r.created_at) === todayKey
        )
        .map((r) => r.id);
      if (ids.length === 0) {
        setGateBusy(false);
        return;
      }
      const { error } = await supabase
        .from('bubbles_records')
        .update({
          status: 'completed',
          return_time: new Date().toISOString(),
        })
        .in('id', ids);
      setGateBusy(false);
      if (error) {
        alert(error.message);
        return;
      }
      await fetchRecords();
      return;
    }
    const { error } = await supabase
      .from('bubbles_records')
      .update({
        status: 'completed',
        return_time: new Date().toISOString(),
      })
      .eq('driver_name', driver)
      .in('status', ['pending', 'delayed']);
    setGateBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    await fetchRecords();
  };

  const submitDriverIssue = async () => {
    if (!gateDriver) return;
    const reason = gateIssueReason.trim();
    const validReasons: readonly string[] = BUBBLES_ISSUE_REASON_OPTIONS;
    if (!reason || !validReasons.includes(reason)) {
      alert('يرجى اختيار سبب من القائمة.');
      return;
    }
    setGateBusy(true);
    const todayKey = getBaghdadDateKey(new Date());
    if (gateMinimalUi) {
      const ids = records
        .filter(
          (r) =>
            (r.driver_name.trim() || '—') === (gateDriver.trim() || '—') &&
            (r.status === 'pending' || r.status === 'delayed') &&
            getBaghdadDateKey(r.created_at) === todayKey
        )
        .map((r) => r.id);
      if (ids.length === 0) {
        setGateBusy(false);
        setGateDriver(null);
        return;
      }
      const { error } = await supabase
        .from('bubbles_records')
        .update({ status: 'issue', reason })
        .in('id', ids);
      setGateBusy(false);
      if (error) {
        alert(error.message);
        return;
      }
      setGateDriver(null);
      setGateIssueReason('');
      await fetchRecords();
      return;
    }
    const { error } = await supabase
      .from('bubbles_records')
      .update({ status: 'issue', reason })
      .eq('driver_name', gateDriver)
      .in('status', ['pending', 'delayed']);
    setGateBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    setGateDriver(null);
    setGateIssueReason('');
    await fetchRecords();
  };

  const exportHeaders =
    sourceTab === 'archive'
      ? [
          'اليوم المؤرشف',
          'سبب الأرشفة',
          'السائق',
          'العميل',
          'المنتج',
          'الكمية',
          'الفاتورة',
          'الموقع',
          'CBM',
          'الحالة',
          'السبب',
          'تاريخ الإنشاء',
          'وقت الإرجاع',
          'وقت الأرشفة',
        ]
      : [
          'السائق',
          'العميل',
          'المنتج',
          'الكمية',
          'الفاتورة',
          'الموقع',
          'CBM',
          'الحالة',
          'السبب',
          'تاريخ الإنشاء',
          'وقت الإرجاع',
        ];

  const exportRows = displayRows.map((r) => {
    if (sourceTab === 'archive') {
      const arc = r as BubblesArchiveRecord;
      return [
        arc.archived_day || '—',
        arc.archived_reason || '—',
        arc.driver_name,
        arc.customer_name,
        arc.product_type ?? '—',
        String(arc.quantity),
        arc.invoice_number ?? '—',
        arc.location ?? '—',
        arc.cbm != null ? String(arc.cbm) : '—',
        STATUS_AR[arc.status],
        arc.reason ?? '—',
        new Date(arc.created_at).toLocaleString('ar-IQ'),
        arc.return_time ? new Date(arc.return_time).toLocaleString('ar-IQ') : '—',
        arc.archived_at ? new Date(arc.archived_at).toLocaleString('ar-IQ') : '—',
      ];
    }
    return [
      r.driver_name,
      r.customer_name,
      r.product_type ?? '—',
      String(r.quantity),
      r.invoice_number ?? '—',
      r.location ?? '—',
      r.cbm != null ? String(r.cbm) : '—',
      STATUS_AR[r.status],
      r.reason ?? '—',
      new Date(r.created_at).toLocaleString('ar-IQ'),
      r.return_time ? new Date(r.return_time).toLocaleString('ar-IQ') : '—',
    ];
  });

  const openArchiveInReportsHub = () => {
    if (!onOpenReportsHub) return;
    if (sourceTab !== 'archive') return;
    try {
      localStorage.setItem(
        'bubblesArchiveBridge:v1',
        JSON.stringify({
          activeDomain: 'bubbles',
          search,
          dateFrom,
          dateTo,
          archiveTab,
        })
      );
    } catch {
      /* ignore localStorage write failures */
    }
    onOpenReportsHub();
  };

  const suspenseCharts = (
    <div className="flex items-center justify-center py-16 text-stone-500">
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
              <CircleDot className="w-5 h-5 text-white" />
            </span>
            Bubbles Tracking
          </h1>
          <p className="text-stone-500 dark:text-stone-400 mt-1 text-sm">
            متابعة تحميل الببلز، الخروج، الرجوع، والإرجاع — مع لوحة تحكم وتنبيهات.
          </p>
        </div>
        {isAdmin && (
          <label className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-semibold shadow-lg cursor-pointer hover:opacity-95 disabled:opacity-50">
            {uploadBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            Upload Excel
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => void onUploadExcel(e)} disabled={uploadBusy} />
          </label>
        )}
      </div>

      {isAdmin && (adminAlertCounts.delayed > 0 || adminAlertCounts.issue > 0) && (
        <div className="flex flex-wrap gap-3">
          {adminAlertCounts.delayed > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 text-sm font-bold">
              <span className="min-w-[1.5rem] h-7 flex items-center justify-center rounded-full bg-red-600 text-white text-xs">
                {adminAlertCounts.delayed}
              </span>
              سجلات متأخرة
            </div>
          )}
          {adminAlertCounts.issue > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100 text-sm font-bold">
              <AlertTriangle className="w-5 h-5" />
              {adminAlertCounts.issue} مشكلة إرجاع
            </div>
          )}
        </div>
      )}

      {!gateMinimalUi && sourceTab === 'live' && pendingCount > 0 && (
        <div className="rounded-2xl border border-violet-200 dark:border-violet-900/50 bg-violet-50/40 dark:bg-violet-950/20 px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-violet-900 dark:text-violet-100">تنبيه المتعلّقات</p>
            <p className="text-xs text-violet-800/80 dark:text-violet-200/80">
              لديك متعلّقات (قيد الانتظار) عدد: <span className="font-black">{pendingCount}</span>
            </p>
          </div>
          <span className="shrink-0 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-sm font-black">
            {pendingCount}
          </span>
        </div>
      )}

      {!gateMinimalUi && (
        <div className="flex flex-wrap gap-2">
          {([
            ['live', 'التشغيل الحالي'],
            ['archive', 'الأرشيف'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSourceTab(k)}
              className={cn(
                'px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all',
                sourceTab === k
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                  : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {sourceTab === 'live' ? (
      <div className="flex flex-wrap gap-2">
        {(gateMinimalUi
          ? (['active', 'issues', 'completed'] as const)
          : (['active', 'delayed', 'issues', 'completed'] as const)
        ).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              'px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all',
              tab === k
                ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
            )}
          >
            {gateMinimalUi ? `${TAB_LABEL_AR[k]} · اليوم` : TAB_LABEL_AR[k]}
          </button>
        ))}
      </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(['all', 'completed', 'delayed', 'issues'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setArchiveTab(k)}
              className={cn(
                'px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all',
                archiveTab === k
                  ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                  : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
              )}
            >
              {ARCHIVE_TAB_LABEL_AR[k]}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 space-y-3">
        <SmartSearchBar
          pageKey="bubbles"
          value={search}
          onChange={setSearch}
          placeholder="بحث: سائق، عميل، فاتورة، منتج، موقع..."
          onApplyParsedFilters={({ searchText, dateRange }) => {
            setSearch(searchText);
            if (!gateMinimalUi && dateRange) {
              setDateFrom(dateRange.from);
              setDateTo(dateRange.to);
            }
          }}
        />
        {!gateMinimalUi && (
          <div className="flex flex-wrap gap-3 items-center text-sm">
            <label className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
              من
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800"
              />
            </label>
            <label className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
              إلى
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800"
              />
            </label>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                className="text-violet-600 dark:text-violet-400 text-xs font-medium underline"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                مسح التواريخ
              </button>
            )}
          </div>
        )}
      </div>

      {!gateMinimalUi && (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {(
          [
            { kpi: 'drivers' as const, label: 'عدد السائقين', value: displayKpis.driverCount, icon: Package },
            { kpi: 'completed' as const, label: 'مكتمل %', value: `${displayKpis.completedPct}%`, icon: CheckCircle2 },
            { kpi: 'delayed' as const, label: 'متأخر %', value: `${displayKpis.delayedPct}%`, icon: Clock },
            { kpi: 'issues' as const, label: 'مشاكل', value: displayKpis.issuesCount, icon: AlertTriangle },
            { kpi: 'avgReturn' as const, label: 'متوسط إرجاع (س)', value: displayKpis.avgReturnH ?? '—', icon: CircleDot },
            { kpi: 'total' as const, label: 'إجمالي السجلات', value: displayKpis.total, icon: CircleDot },
          ] as const
        ).map(({ kpi, label, value, icon: Icon }) => (
          <button
            key={kpi}
            type="button"
            onClick={() => sourceTab === 'live' && setDetailModal({ kind: 'kpi', kpi })}
            aria-label={`عرض تفاصيل: ${label}`}
            disabled={sourceTab !== 'live'}
            className={cn(
              'rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 shadow-sm',
              'text-right w-full transition-all',
              sourceTab === 'live' ? 'cursor-pointer hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md' : 'cursor-default',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900'
            )}
          >
            <Icon className="w-5 h-5 text-violet-500 mb-2" />
            <p className="text-xs text-stone-500 dark:text-stone-400">{label}</p>
            <p className="text-xl font-bold text-stone-900 dark:text-white">{value}</p>
            {sourceTab === 'live' ? (
              <p className="text-[11px] text-violet-600 dark:text-violet-400 mt-2 font-medium">انقر للمعاينة</p>
            ) : (
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-2 font-medium">ملخص الأرشيف</p>
            )}
          </button>
        ))}
      </div>
      )}

      {!gateMinimalUi && (
      <Suspense fallback={suspenseCharts}>
        <ChartsPanelLazy barData={displayBarData} pieData={displayPieData} lineData={displayLineData} minLineItems={1} />
      </Suspense>
      )}

      {!gateMinimalUi && sourceTab === 'archive' && (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 shadow-sm">
          <h3 className="font-bold text-stone-900 dark:text-white mb-3">ملخص الأرشفة اليومية</h3>
          <div className="overflow-x-auto rounded-xl border border-stone-100 dark:border-stone-800">
            <table className="w-full text-sm text-right min-w-[820px]">
              <thead>
                <tr className="bg-stone-100 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300">
                  <th className="p-2">اليوم</th>
                  <th className="p-2">إجمالي مؤرشف</th>
                  <th className="p-2">معلّق متبقٍ</th>
                  <th className="p-2">مكتمل</th>
                  <th className="p-2">متأخر</th>
                  <th className="p-2">مشاكل</th>
                  <th className="p-2">سائقين</th>
                  <th className="p-2">متوسط إرجاع (س)</th>
                </tr>
              </thead>
              <tbody>
                {dailySnapshots.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-stone-500 dark:text-stone-400">
                      لا توجد لقطات يومية بعد.
                    </td>
                  </tr>
                ) : (
                  dailySnapshots.slice(0, 20).map((s) => (
                    <tr key={s.day} className="border-t border-stone-100 dark:border-stone-800">
                      <td className="p-2 font-semibold">{s.day}</td>
                      <td className="p-2">{s.total_records}</td>
                      <td className="p-2">{s.pending_count}</td>
                      <td className="p-2">{s.completed_count}</td>
                      <td className="p-2">{s.delayed_count}</td>
                      <td className="p-2">{s.issue_count}</td>
                      <td className="p-2">{s.drivers_count}</td>
                      <td className="p-2">{s.avg_return_hours ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!gateMinimalUi && sourceTab === 'live' && (driverScores.best.length > 0 || driverScores.worst.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 p-4">
            <h3 className="font-bold text-emerald-800 dark:text-emerald-200 mb-2">أفضل التزام (تقديري)</h3>
            <ul className="text-sm space-y-1 text-stone-700 dark:text-stone-300">
              {driverScores.best.map((x) => (
                <li key={x.name}>
                  {x.name} — مكتمل {x.completed} / مشاكل {x.bad}
                </li>
              ))}
              {driverScores.best.length === 0 && <li>لا بيانات كافية</li>}
            </ul>
          </div>
          <button
            type="button"
            disabled={driverScores.worst.length === 0}
            onClick={() => driverScores.worst.length > 0 && setDetailModal({ kind: 'followUp' })}
            aria-label="عرض تفاصيل السجلات التي تحتاج متابعة"
            className={cn(
              'rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/20 p-4 text-right w-full transition-all',
              driverScores.worst.length > 0 &&
                'cursor-pointer hover:border-red-400 dark:hover:border-red-700 hover:shadow-md',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900',
              driverScores.worst.length === 0 && 'opacity-80 cursor-default'
            )}
          >
            <h3 className="font-bold text-red-800 dark:text-red-200 mb-2 flex items-center justify-between gap-2">
              يحتاج متابعة
              {driverScores.worst.length > 0 ? (
                <span className="text-xs font-semibold text-red-600 dark:text-red-300">معاينة التفاصيل</span>
              ) : null}
            </h3>
            <ul className="text-sm space-y-1 text-stone-700 dark:text-stone-300">
              {driverScores.worst.map((x) => (
                <li key={x.name}>
                  {x.name} — متأخر/مشكلة {x.bad}، مكتمل {x.completed}
                </li>
              ))}
              {driverScores.worst.length === 0 && <li>لا مشاكل مسجّلة</li>}
            </ul>
          </button>
        </div>
      )}

      {canGate && sourceTab === 'live' && gateDrivers.length > 0 && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/30 p-4 space-y-3">
          <h3 className="font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
            <Package className="w-5 h-5" />
            وصول السائق — إرجاع الببلز
          </h3>
          <p className="text-sm text-blue-800/90 dark:text-blue-200/90">
            السائقون التاليون لديهم ببلز لم تُسجَّل كمُرجَعة بعد.
          </p>
          <div className="space-y-2">
            {gateDrivers.map((d) => (
              <div
                key={d}
                className="flex flex-wrap items-center gap-2 justify-between p-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
              >
                <span className="font-semibold text-stone-900 dark:text-white">{d}</span>
                <div className="flex gap-2">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    disabled={gateBusy}
                    onClick={() => void markDriverReturned(d)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50"
                  >
                    تم الإرجاع
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    disabled={gateBusy}
                    onClick={() => {
                      setGateDriver(d);
                      setGateIssueReason('');
                    }}
                    className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-50"
                  >
                    لم يتم الإرجاع
                  </motion.button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!gateMinimalUi && (
      <div className="flex flex-wrap items-center justify-between gap-3">
        {sourceTab === 'archive' ? (
          <button
            type="button"
            onClick={openArchiveInReportsHub}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          >
            فتح أرشيف الببلز في التقارير الذكية
          </button>
        ) : null}
        <ExportMenu
          meta={{
            title: sourceTab === 'archive' ? 'Bubbles Archive' : 'Bubbles Tracking',
            filterDescription: [sourceTab === 'archive' ? `المصدر: أرشيف` : `المصدر: تشغيل`, sourceTab === 'archive' ? `تبويب: ${archiveTab}` : tab && `تبويب: ${tab}`, search && `بحث: ${search}`, dateFrom && `من ${dateFrom}`, dateTo && `إلى ${dateTo}`]
              .filter(Boolean)
              .join(' | ') || 'الكل',
            rowCount: displayRows.length,
          }}
          headerRow={exportHeaders}
          dataRows={exportRows}
          sheetName={sourceTab === 'archive' ? 'Bubbles_Archive' : 'Bubbles'}
          disabled={displayRows.length === 0}
        />
      </div>
      )}

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-10 h-10 animate-spin text-violet-600" />
        </div>
      ) : displayGrouped.length === 0 ? (
        <div className="text-center py-20 text-stone-500 dark:text-stone-400">لا توجد بيانات ضمن الفلاتر الحالية.</div>
      ) : (
        <div className="space-y-4">
          {displayGrouped.map((g) => (
            <motion.div
              key={g.driver_name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm overflow-hidden"
            >
              <div className="px-4 py-3 bg-stone-50 dark:bg-stone-800/80 border-b border-stone-200 dark:border-stone-700 font-bold text-stone-900 dark:text-white">
                <HighlightText text={g.driver_name} query={debouncedSearch} />
                {sourceTab === 'archive' ? (
                  <span className="mr-2 text-xs text-violet-600 dark:text-violet-400 font-semibold">أرشيف</span>
                ) : null}
              </div>
              <div className="p-3 space-y-4">
                {g.customers.map((c) => (
                  <div key={`${g.driver_name}-${c.customer_name}`}>
                    <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2">
                      عميل: <HighlightText text={c.customer_name} query={debouncedSearch} />
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-stone-100 dark:border-stone-800">
                      <table className="w-full text-sm text-right min-w-[720px]">
                        <thead>
                          <tr className="bg-stone-100 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300">
                            <th className="p-2">العميل</th>
                            <th className="p-2">المنتج</th>
                            <th className="p-2">الكمية</th>
                            <th className="p-2">الفاتورة</th>
                            <th className="p-2">الموقع</th>
                            <th className="p-2">CBM</th>
                            <th className="p-2">الحالة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.items.map((r) => (
                            <tr key={r.id} className="border-t border-stone-100 dark:border-stone-800">
                              <td className="p-2">
                                <HighlightText text={r.customer_name} query={debouncedSearch} />
                              </td>
                              <td className="p-2">{r.product_type ?? '—'}</td>
                              <td className="p-2">{r.quantity}</td>
                              <td className="p-2">{r.invoice_number ?? '—'}</td>
                              <td className="p-2">{r.location ?? '—'}</td>
                              <td className="p-2">{r.cbm ?? '—'}</td>
                              <td className="p-2">
                                <span className={cn('px-2 py-0.5 rounded-lg text-xs font-semibold', statusBadgeClass(r.status))}>
                                  {STATUS_AR[r.status]}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {sourceTab === 'live' && detailModal && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bubbles-detail-modal-title"
          onClick={() => setDetailModal(null)}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-stone-700 dark:bg-stone-900"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-stone-200 p-4 dark:border-stone-700">
              <div className="min-w-0 space-y-1">
                <h3
                  id="bubbles-detail-modal-title"
                  className="text-lg font-bold text-stone-900 dark:text-white"
                >
                  {detailModal.kind === 'followUp'
                    ? 'سجلات تحتاج متابعة — التفاصيل'
                    : KPI_MODAL_TITLE[detailModal.kpi]}
                </h3>
                {detailModal.kind === 'kpi' && detailModal.kpi === 'completed' ? (
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    {detailKpiRows.length} من {records.length} سجل (نسبة المكتمل من إجمالي البيانات المحمّلة)
                  </p>
                ) : null}
                {detailModal.kind === 'kpi' && detailModal.kpi === 'delayed' ? (
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    {detailKpiRows.length} سجل متأخر من إجمالي {records.length} سجل
                  </p>
                ) : null}
                {detailModal.kind === 'kpi' && detailModal.kpi === 'drivers' ? (
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    ملخّص حسب السائق — يطابق عدد السائقين الفريدين في النظام
                  </p>
                ) : null}
                {detailModal.kind === 'followUp' ? (
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    {followUpDetailRecords.length} سجل (متأخر أو مشكلة لسائقي قائمة «يحتاج متابعة»)
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="shrink-0 rounded-xl border border-stone-200 p-2 text-stone-600 transition-colors hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {detailModal.kind === 'kpi' && detailModal.kpi === 'drivers' ? (
                <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-700">
                  <table className="w-full min-w-[720px] text-right text-sm">
                    <thead>
                      <tr className="bg-stone-100 text-stone-600 dark:bg-stone-800/80 dark:text-stone-300">
                        <th className="p-3 font-semibold">السائق</th>
                        <th className="p-3 font-semibold">الإجمالي</th>
                        <th className="p-3 font-semibold">معلّق</th>
                        <th className="p-3 font-semibold">متأخر</th>
                        <th className="p-3 font-semibold">مشكلة</th>
                        <th className="p-3 font-semibold">مكتمل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driverKpiSummaries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-stone-500 dark:text-stone-400">
                            لا توجد بيانات
                          </td>
                        </tr>
                      ) : (
                        driverKpiSummaries.map((row) => (
                          <tr
                            key={row.name}
                            className="border-t border-stone-100 dark:border-stone-800 hover:bg-stone-50/80 dark:hover:bg-stone-800/40"
                          >
                            <td className="p-3 font-medium text-stone-900 dark:text-white">{row.name}</td>
                            <td className="p-3">{row.total}</td>
                            <td className="p-3">{row.pending}</td>
                            <td className="p-3">{row.delayed}</td>
                            <td className="p-3">{row.issue}</td>
                            <td className="p-3">{row.completed}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : detailModal.kind === 'kpi' && detailModal.kpi === 'avgReturn' && avgReturnDetailRecords.length === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 text-center text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                  لا توجد سجلات مكتملة بوقت إرجاع صالح لحساب المتوسط.
                </p>
              ) : (
                (() => {
                  const rows: BubblesRecord[] =
                    detailModal.kind === 'followUp' ? followUpDetailRecords : detailKpiRows;
                  const showReturnHoursCol =
                    detailModal.kind === 'kpi' && detailModal.kpi === 'avgReturn';
                  if (rows.length === 0) {
                    return (
                      <p className="text-center text-stone-500 dark:text-stone-400 py-12">لا توجد صفوف للعرض.</p>
                    );
                  }
                  return (
                    <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-700">
                      <table className="w-full min-w-[960px] text-right text-sm">
                        <thead>
                          <tr className="bg-stone-100 text-stone-600 dark:bg-stone-800/80 dark:text-stone-300">
                            <th className="p-2 font-semibold">السائق</th>
                            <th className="p-2 font-semibold">العميل</th>
                            <th className="p-2 font-semibold">المنتج</th>
                            <th className="p-2 font-semibold">الكمية</th>
                            <th className="p-2 font-semibold">الفاتورة</th>
                            <th className="p-2 font-semibold">الموقع</th>
                            <th className="p-2 font-semibold">CBM</th>
                            <th className="p-2 font-semibold">الحالة</th>
                            {showReturnHoursCol ? (
                              <th className="p-2 font-semibold whitespace-nowrap">مدة الإرجاع (س)</th>
                            ) : null}
                            <th className="p-2 font-semibold">السبب</th>
                            <th className="p-2 font-semibold whitespace-nowrap">الإنشاء</th>
                            <th className="p-2 font-semibold whitespace-nowrap">الإرجاع</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr
                              key={r.id}
                              className="border-t border-stone-100 dark:border-stone-800 hover:bg-stone-50/80 dark:hover:bg-stone-800/40"
                            >
                              <td className="p-2 text-stone-900 dark:text-white">{r.driver_name}</td>
                              <td className="p-2">{r.customer_name}</td>
                              <td className="p-2">{r.product_type ?? '—'}</td>
                              <td className="p-2">{r.quantity}</td>
                              <td className="p-2">{r.invoice_number ?? '—'}</td>
                              <td className="p-2">{r.location ?? '—'}</td>
                              <td className="p-2">{r.cbm ?? '—'}</td>
                              <td className="p-2">
                                <span
                                  className={cn(
                                    'rounded-lg px-2 py-0.5 text-xs font-semibold',
                                    statusBadgeClass(r.status)
                                  )}
                                >
                                  {STATUS_AR[r.status]}
                                </span>
                              </td>
                              {showReturnHoursCol ? (
                                <td className="p-2 font-mono tabular-nums">
                                  {bubblesRecordReturnHours(r) ?? '—'}
                                </td>
                              ) : null}
                              <td className="p-2 max-w-[140px] break-words text-stone-600 dark:text-stone-400">
                                {r.reason ?? '—'}
                              </td>
                              <td className="p-2 whitespace-nowrap text-xs text-stone-600 dark:text-stone-400">
                                {new Date(r.created_at).toLocaleString('ar-IQ', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}
                              </td>
                              <td className="p-2 whitespace-nowrap text-xs text-stone-600 dark:text-stone-400">
                                {r.return_time
                                  ? new Date(r.return_time).toLocaleString('ar-IQ', {
                                      dateStyle: 'short',
                                      timeStyle: 'short',
                                    })
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()
              )}
            </div>

            <div className="shrink-0 border-t border-stone-200 p-4 dark:border-stone-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {detailModalExport ? (
                  <ExportMenu
                    meta={{
                      title: detailModalExport.title,
                      filterDescription: 'تصدير من نافذة التفاصيل',
                      rowCount: detailModalExport.rows.length,
                    }}
                    headerRow={detailModalExport.headers}
                    dataRows={detailModalExport.rows}
                    sheetName={detailModalExport.sheetName}
                    disabled={detailModalExport.rows.length === 0}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => setDetailModal(null)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 py-3 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700 sm:w-auto sm:px-6"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {gateDriver && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50" role="dialog">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-stone-900 dark:text-white">سبب عدم الإرجاع — {gateDriver}</h3>
            <div className="space-y-1">
              <label htmlFor="bubbles-issue-reason" className="text-sm font-medium text-stone-700 dark:text-stone-300">
                اختر السبب
              </label>
              <select
                id="bubbles-issue-reason"
                value={gateIssueReason}
                onChange={(e) => setGateIssueReason(e.target.value)}
                className="w-full rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 p-3 text-sm text-stone-900 dark:text-stone-100"
              >
                <option value="">— اختر السبب —</option>
                {BUBBLES_ISSUE_REASON_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-600"
                onClick={() => {
                  setGateDriver(null);
                  setGateIssueReason('');
                }}
                disabled={gateBusy}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold disabled:opacity-50"
                onClick={() => void submitDriverIssue()}
                disabled={gateBusy}
              >
                {gateBusy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'حفظ'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
