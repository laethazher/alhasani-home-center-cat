import type {
  BuildIntelligenceOptions,
  InspectionGrade,
  InspectionStatus,
  IntelligenceAnalytics,
  IntelligenceFilterKey,
  IntelligenceSummary,
  ReportRowForIntelligence,
  VehicleInspectionInsight,
  VehicleRowForIntelligence,
  WeekdayDelayHeatmap,
} from './types';
import { DEFAULT_PATTERN_LOOKBACK, DEFAULT_PATTERN_MIN_DELAYS } from './types';

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(base: Date, days: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + days);
  return startOfLocalDay(x);
}

/** فرق بالأيام: dateA - dateB (تاريخ تقويمي محلي) */
function calendarDaysDiff(dateA: Date, dateB: Date): number {
  const a = startOfLocalDay(dateA).getTime();
  const b = startOfLocalDay(dateB).getTime();
  return Math.round((a - b) / 86400000);
}

function parseDate(iso: string): Date {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? startOfLocalDay(new Date()) : d;
}

function toISODate(d: Date): string {
  return startOfLocalDay(d).toISOString().slice(0, 10);
}

function statusFromSchedule(
  lastInspection: Date | null,
  today: Date,
  cycleDays: number,
): {
  lastInspectionDate: string | null;
  nextInspectionDate: string | null;
  daysLeft: number | null;
  delayDays: number | null;
  status: InspectionStatus;
} {
  const t0 = startOfLocalDay(today);
  if (!lastInspection) {
    return {
      lastInspectionDate: null,
      nextInspectionDate: null,
      daysLeft: null,
      delayDays: null,
      status: 'critical',
    };
  }
  const last = startOfLocalDay(lastInspection);
  const nextDue = addDays(last, cycleDays);
  const diff = calendarDaysDiff(nextDue, t0);

  if (diff < 0) {
    const delayDays = -diff;
    return {
      lastInspectionDate: toISODate(last),
      nextInspectionDate: toISODate(nextDue),
      daysLeft: null,
      delayDays,
      status: 'critical',
    };
  }
  if (diff === 0) {
    return {
      lastInspectionDate: toISODate(last),
      nextInspectionDate: toISODate(nextDue),
      daysLeft: 0,
      delayDays: null,
      status: 'warning',
    };
  }
  if (diff <= 3) {
    return {
      lastInspectionDate: toISODate(last),
      nextInspectionDate: toISODate(nextDue),
      daysLeft: diff,
      delayDays: null,
      status: 'warning',
    };
  }
  return {
    lastInspectionDate: toISODate(last),
    nextInspectionDate: toISODate(nextDue),
    daysLeft: diff,
    delayDays: null,
    status: 'healthy',
  };
}

function gradeFromScore(score: number): InspectionGrade {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  return 'C';
}

function scoreVehicle(
  status: InspectionStatus,
  delayDays: number | null,
  recentDelayedIntervals: number,
): number {
  let s = 100;
  if (status === 'critical') {
    const d = delayDays ?? 30;
    s -= Math.min(45, d * 4);
  } else if (status === 'warning') {
    s -= 12;
  }
  s -= Math.min(25, recentDelayedIntervals * 8);
  return Math.max(0, Math.min(100, Math.round(s)));
}

/**
 * تحليل سلسلة التقارير زمنياً: عدد الفترات المتأخرة في آخر lookback أزواج.
 */
function analyzeDelayPattern(
  createdAsc: string[],
  cycleDays: number,
  lookbackPairs: number,
  minDelaysForHint: number,
): { recentDelayedReportCount: number; delayPatternHint: boolean } {
  if (createdAsc.length < 2) {
    return { recentDelayedReportCount: 0, delayPatternHint: false };
  }
  const delays: boolean[] = [];
  for (let i = 1; i < createdAsc.length; i++) {
    const prev = startOfLocalDay(parseDate(createdAsc[i - 1]!));
    const next = startOfLocalDay(parseDate(createdAsc[i]!));
    const expected = addDays(prev, cycleDays);
    delays.push(next.getTime() > expected.getTime());
  }
  const tail = delays.slice(-lookbackPairs);
  const recentDelayedReportCount = tail.filter(Boolean).length;
  return {
    recentDelayedReportCount,
    delayPatternHint: recentDelayedReportCount >= minDelaysForHint,
  };
}

function buildHeatmap(
  reports: ReportRowForIntelligence[],
  vehicles: VehicleRowForIntelligence[],
  cycleDays: number,
): WeekdayDelayHeatmap {
  const heat: WeekdayDelayHeatmap = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const byVehicle = new Map<number, string[]>();
  for (const r of reports) {
    if (r.vehicle_id == null) continue;
    const arr = byVehicle.get(r.vehicle_id) ?? [];
    arr.push(r.created_at);
    byVehicle.set(r.vehicle_id, arr);
  }
  const vehicleIds = new Set(vehicles.map((v) => v.id));
  for (const vid of vehicleIds) {
    const dates = (byVehicle.get(vid) ?? []).sort(
      (a, b) => parseDate(a).getTime() - parseDate(b).getTime(),
    );
    for (let i = 1; i < dates.length; i++) {
      const prev = startOfLocalDay(parseDate(dates[i - 1]!));
      const next = startOfLocalDay(parseDate(dates[i]!));
      const expected = addDays(prev, cycleDays);
      if (next.getTime() > expected.getTime()) {
        const wd = next.getDay();
        heat[wd] = (heat[wd] ?? 0) + 1;
      }
    }
  }
  return heat;
}

function statusOrder(s: InspectionStatus): number {
  if (s === 'critical') return 0;
  if (s === 'warning') return 1;
  return 2;
}

export function buildIntelligenceAnalytics(
  vehicles: VehicleRowForIntelligence[],
  reports: ReportRowForIntelligence[],
  staffNameById: Map<string, string>,
  options: BuildIntelligenceOptions,
): IntelligenceAnalytics {
  const today = startOfLocalDay(options.today);
  const cycleDays = options.cycleDays;
  const lookback = options.patternLookbackReports ?? DEFAULT_PATTERN_LOOKBACK;
  const minDelays = options.patternMinDelays ?? DEFAULT_PATTERN_MIN_DELAYS;

  const byVehicle = new Map<number, ReportRowForIntelligence[]>();
  for (const r of reports) {
    if (r.vehicle_id == null) continue;
    const list = byVehicle.get(r.vehicle_id) ?? [];
    list.push(r);
    byVehicle.set(r.vehicle_id, list);
  }

  const insights: VehicleInspectionInsight[] = [];

  for (const v of vehicles) {
    const list = (byVehicle.get(v.id) ?? []).slice();
    list.sort((a, b) => parseDate(a.created_at).getTime() - parseDate(b.created_at).getTime());
    const createdAsc = list.map((x) => x.created_at);
    const lastIso = createdAsc.length ? createdAsc[createdAsc.length - 1]! : null;
    const lastDate = lastIso ? parseDate(lastIso) : null;

    const sched = statusFromSchedule(lastDate, today, cycleDays);
    const pattern = analyzeDelayPattern(createdAsc, cycleDays, lookback, minDelays);
    const score = scoreVehicle(sched.status, sched.delayDays, pattern.recentDelayedReportCount);
    const grade = gradeFromScore(score);

    const name = v.assigned_driver_id
      ? staffNameById.get(String(v.assigned_driver_id)) || '—'
      : '—';

    insights.push({
      vehicleId: v.id,
      plateNumber: v.plate_number,
      responsibleStaffId: v.assigned_driver_id,
      responsibleName: name,
      lastInspectionDate: sched.lastInspectionDate,
      nextInspectionDate: sched.nextInspectionDate,
      daysLeft: sched.daysLeft,
      delayDays: sched.delayDays,
      status: sched.status,
      score,
      grade,
      delayPatternHint: pattern.delayPatternHint,
      recentDelayedReportCount: pattern.recentDelayedReportCount,
    });
  }

  insights.sort((a, b) => {
    const o = statusOrder(a.status) - statusOrder(b.status);
    if (o !== 0) return o;
    const da = a.delayDays ?? 0;
    const db = b.delayDays ?? 0;
    if (da !== db) return db - da;
    const la = a.daysLeft ?? 999;
    const lb = b.daysLeft ?? 999;
    return la - lb;
  });

  const totalVehicles = vehicles.length;
  const healthyCount = insights.filter((i) => i.status === 'healthy').length;
  const warningCount = insights.filter((i) => i.status === 'warning').length;
  const criticalCount = insights.filter((i) => i.status === 'critical').length;
  const dueTodayCount = insights.filter((i) => i.daysLeft === 0 && i.delayDays == null).length;

  const compliant = healthyCount + warningCount;
  const complianceRate =
    totalVehicles > 0 ? Math.round((compliant / totalVehicles) * 1000) / 10 : 100;

  const overdueDelays = insights.filter((i) => i.delayDays != null && i.delayDays > 0).map((i) => i.delayDays!);
  const averageDelayDays =
    overdueDelays.length > 0
      ? Math.round((overdueDelays.reduce((s, x) => s + x, 0) / overdueDelays.length) * 10) / 10
      : null;

  const windowStart = addDays(today, -cycleDays);
  const reportedVehicleIds = new Set<number>();
  for (const r of reports) {
    if (r.vehicle_id == null) continue;
    const d = parseDate(r.created_at);
    if (d.getTime() >= windowStart.getTime() && d.getTime() <= today.getTime() + 86400000) {
      reportedVehicleIds.add(r.vehicle_id);
    }
  }

  const summary: IntelligenceSummary = {
    totalVehicles,
    healthyCount,
    warningCount,
    criticalCount,
    dueTodayCount,
    complianceRate,
    averageDelayDays,
    completedInCycleEstimate: reportedVehicleIds.size,
    expectedInCycleEstimate: totalVehicles,
  };

  const heatmap = buildHeatmap(reports, vehicles, cycleDays);

  return { summary, heatmap, insightsSorted: insights };
}

export function filterInsights(
  insights: VehicleInspectionInsight[],
  filter: IntelligenceFilterKey,
  responsibleQuery: string,
): VehicleInspectionInsight[] {
  const q = responsibleQuery.trim().toLowerCase();
  let out = insights;
  if (filter === 'overdue') {
    out = out.filter((i) => i.status === 'critical');
  } else if (filter === 'today') {
    out = out.filter((i) => i.daysLeft === 0 && i.delayDays == null);
  } else if (filter === 'this_week') {
    out = out.filter((i) => i.daysLeft != null && i.daysLeft >= 0 && i.daysLeft <= 7);
  }
  if (q) {
    out = out.filter(
      (i) =>
        i.plateNumber.toLowerCase().includes(q) ||
        i.responsibleName.toLowerCase().includes(q) ||
        (i.responsibleStaffId && String(i.responsibleStaffId).includes(q)),
    );
  }
  return out;
}
