export type InspectionStatus = 'healthy' | 'warning' | 'critical';

export type InspectionGrade = 'A' | 'B' | 'C';

export type IntelligenceFilterKey = 'all' | 'overdue' | 'today' | 'this_week' | 'by_responsible';

/** صف خام من التقارير للتحليل — أقل أعمدة ممكنة */
export interface ReportRowForIntelligence {
  id: number;
  vehicle_id: number | null;
  created_at: string;
}

export interface VehicleRowForIntelligence {
  id: number;
  plate_number: string;
  assigned_driver_id: string | null;
}

export interface VehicleInspectionInsight {
  vehicleId: number;
  plateNumber: string;
  responsibleStaffId: string | null;
  responsibleName: string;
  lastInspectionDate: string | null;
  nextInspectionDate: string | null;
  daysLeft: number | null;
  delayDays: number | null;
  status: InspectionStatus;
  score: number;
  grade: InspectionGrade;
  /** نمط تأخير متكرر (عدة تقارير متأخرة في نافذة المراجعة) */
  delayPatternHint: boolean;
  /** عدد التقارير المتأخرة في نافذة المراجعة */
  recentDelayedReportCount: number;
}

export interface IntelligenceSummary {
  totalVehicles: number;
  healthyCount: number;
  warningCount: number;
  criticalCount: number;
  dueTodayCount: number;
  complianceRate: number;
  /** متوسط أيام التأخير للمركبات المتأخرة فقط؛ null إن لم يوجد متأخر */
  averageDelayDays: number | null;
  completedInCycleEstimate: number;
  expectedInCycleEstimate: number;
}

/** توزيع التأخير حسب يوم الأسبوع (0 = الأحد … حسب getUTCDay أو محلي — نستخدم محلي) */
export type WeekdayDelayHeatmap = Record<number, number>;

export interface IntelligenceAnalytics {
  summary: IntelligenceSummary;
  heatmap: WeekdayDelayHeatmap;
  insightsSorted: VehicleInspectionInsight[];
}

export interface BuildIntelligenceOptions {
  today: Date;
  cycleDays: number;
  /** عدد التقارير الأخيرة لكل مركبة لتحليل النمط */
  patternLookbackReports: number;
  /** عتبة عدد التأخيرات في النافذة لإظهار التنبيه */
  patternMinDelays: number;
}

export const DEFAULT_INTELLIGENCE_CYCLE_DAYS = 7;
export const DEFAULT_PATTERN_LOOKBACK = 8;
export const DEFAULT_PATTERN_MIN_DELAYS = 3;
