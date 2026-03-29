export type InsightMetric = { label: string; value: string | number };

export interface InsightsBundle {
  metrics: InsightMetric[];
  alerts: string[];
  bar: { name: string; value: number }[];
  pie: { name: string; value: number }[];
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  approved: 'معتمد',
  exited: 'خرج',
  rejected: 'مرفوض',
};

export function insightsFromExitRows(
  rows: Array<{
    status: string;
    track_driver_loading_time?: boolean | null;
    loading_is_delay?: boolean | null;
  }>
): InsightsBundle {
  const total = rows.length;
  const byStatus = new Map<string, number>();
  let loadingTracked = 0;
  let loadingDelayed = 0;
  for (const r of rows) {
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    if (r.track_driver_loading_time) {
      loadingTracked += 1;
      if (r.loading_is_delay === true) loadingDelayed += 1;
    }
  }

  const metrics: InsightMetric[] = [
    { label: 'عدد النتائج', value: total },
    { label: 'باحتساب تحميل', value: loadingTracked },
    { label: 'تأخير تحميل (8:15)', value: loadingDelayed },
  ];

  const alerts: string[] = [];
  if (loadingTracked > 0 && loadingDelayed / loadingTracked > 0.35) {
    alerts.push('نسبة مرتفعة من طلبات التحميل المتأخرة في العرض الحالي.');
  }
  if (total === 0) {
    alerts.push('لا توجد طلبات تطابق الفلاتر الحالية.');
  }

  const bar = [...byStatus.entries()].map(([k, v]) => ({
    name: STATUS_LABELS[k] ?? k,
    value: v,
  }));

  const pie = [
    { name: 'تأخير تحميل', value: loadingDelayed },
    { name: 'بدون تأخير تحميل', value: Math.max(0, loadingTracked - loadingDelayed) },
  ].filter((p) => p.value > 0);

  return { metrics, alerts, bar, pie };
}

const ATT_LABELS: Record<string, string> = {
  present: 'حاضر',
  late: 'متأخر',
  absent: 'غائب',
  full_leave: 'إجازة كاملة',
  time_leave: 'إجازة زمنية',
};

export function insightsFromAttendanceRows(
  rows: Array<{ attendance_type: string }>,
  totalStaff: number
): InsightsBundle {
  const total = rows.length;
  const byType = new Map<string, number>();
  for (const r of rows) {
    byType.set(r.attendance_type, (byType.get(r.attendance_type) ?? 0) + 1);
  }
  const late = byType.get('late') ?? 0;
  const present = byType.get('present') ?? 0;
  const denom = total > 0 ? total : 1;
  const complianceApprox = Math.round(((present + late * 0.5) / denom) * 100);

  const metrics: InsightMetric[] = [
    { label: 'عدد النتائج (المعروض)', value: total },
    { label: 'إجمالي الكادر', value: totalStaff },
    { label: 'متأخر (في العرض)', value: late },
    { label: 'تقدير الالتزام %', value: `${Math.min(100, complianceApprox)}%` },
  ];

  const alerts: string[] = [];
  if (late > (total || 1) * 0.2 && total > 0) {
    alerts.push('عدد المتأخرين مرتفع نسبياً في القائمة المعروضة.');
  }

  const bar = [...byType.entries()].map(([k, v]) => ({
    name: ATT_LABELS[k] ?? k,
    value: v,
  }));

  const pie = [...byType.entries()].map(([k, v]) => ({
    name: ATT_LABELS[k] ?? k,
    value: v,
  }));

  return { metrics, alerts, bar, pie };
}

const VEHICLE_STATUS_AR: Record<string, string> = {
  available: 'متاحة',
  maintenance: 'صيانة',
  broken: 'معطلة',
  reserved: 'محجوزة',
};

export function insightsFromVehicles(
  rows: Array<{ status: string }>
): InsightsBundle {
  const total = rows.length;
  const by = new Map<string, number>();
  for (const r of rows) {
    by.set(r.status, (by.get(r.status) ?? 0) + 1);
  }
  const metrics: InsightMetric[] = [{ label: 'عدد النتائج', value: total }];
  const bar = [...by.entries()].map(([k, v]) => ({
    name: VEHICLE_STATUS_AR[k] ?? k,
    value: v,
  }));
  const pie = bar;
  return {
    metrics,
    alerts: total === 0 ? ['لا توجد مركبات تطابق البحث.'] : [],
    bar,
    pie,
  };
}

const MAINT_STATUS_AR: Record<string, string> = {
  pending: 'قيد الانتظار',
  approved: 'موافقة',
  rejected: 'مرفوض',
  in_progress: 'جاري التنفيذ',
  completed: 'مكتمل',
};

export function insightsFromMaintenanceRequests(
  rows: Array<{ status: string; priority?: string }>
): InsightsBundle {
  const total = rows.length;
  const byStatus = new Map<string, number>();
  for (const r of rows) {
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
  }
  const metrics: InsightMetric[] = [
    { label: 'عدد النتائج', value: total },
  ];
  const bar = [...byStatus.entries()].map(([k, v]) => ({
    name: MAINT_STATUS_AR[k] ?? k,
    value: v,
  }));
  return { metrics, alerts: [], bar, pie: bar };
}
