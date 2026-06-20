/** أنواع بيانات مركز التحليل الذكي */

export type ColumnDataType = 
  | 'number'
  | 'integer'
  | 'percentage'
  | 'currency'
  | 'text'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'email'
  | 'phone'
  | 'unknown';

export type ChartType = 
  | 'bar'
  | 'line'
  | 'pie'
  | 'area'
  | 'scatter'
  | 'histogram'
  | 'donut';

export interface ColumnInfo {
  name: string;
  originalName: string;
  dataType: ColumnDataType;
  sampleValues: unknown[];
  nullCount: number;
  uniqueCount: number;
  totalCount: number;
}

export interface NumericStats {
  sum: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  variance: number;
  range: number;
  q1: number;
  q3: number;
  iqr: number;
  positiveCount: number;
  negativeCount: number;
  zeroCount: number;
}

export interface TextStats {
  uniqueValues: string[];
  topValues: { value: string; count: number; percentage: number }[];
  avgLength: number;
  minLength: number;
  maxLength: number;
  emptyCount: number;
}

export interface DateStats {
  earliest: string;
  latest: string;
  range: number;
  distribution: { period: string; count: number }[];
}

export interface ColumnAnalysis extends ColumnInfo {
  numericStats?: NumericStats;
  textStats?: TextStats;
  dateStats?: DateStats;
}

export interface ChartSuggestion {
  type: ChartType;
  title: string;
  description: string;
  xAxis?: string;
  yAxis?: string;
  dataKey?: string;
  priority: number;
}

export interface ChartData {
  type: ChartType;
  title: string;
  data: Record<string, unknown>[];
  xKey: string;
  yKey?: string;
  colors?: string[];
}

export interface AIInsight {
  type: 'observation' | 'warning' | 'recommendation' | 'pattern' | 'anomaly';
  title: string;
  description: string;
  importance: 'low' | 'medium' | 'high';
  relatedColumns?: string[];
}

export interface AIAnalysisResult {
  summary: string;
  insights: AIInsight[];
  recommendations: string[];
  chartSuggestions: ChartSuggestion[];
  dataQualityScore: number;
  keyFindings: string[];
}

export interface DatasetSummary {
  fileName: string;
  fileSize: number;
  fileType: 'excel' | 'csv';
  rowCount: number;
  columnCount: number;
  uploadedAt: string;
  dateRange?: { from: string; to: string };
  numericColumnsCount: number;
  textColumnsCount: number;
  dateColumnsCount: number;
}

export interface AnalysisReport {
  id: string;
  summary: DatasetSummary;
  columns: ColumnAnalysis[];
  charts: ChartData[];
  aiAnalysis?: AIAnalysisResult;
  rawData: Record<string, unknown>[];
  createdAt: string;
}

export interface KPICard {
  id: string;
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon?: string;
  color?: 'cyan' | 'emerald' | 'purple' | 'amber' | 'red' | 'blue';
}

export const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'أعمدة',
  line: 'خطي',
  pie: 'دائري',
  area: 'مساحة',
  scatter: 'نقطي',
  histogram: 'توزيع',
  donut: 'حلقي',
};

export const DATA_TYPE_LABELS: Record<ColumnDataType, string> = {
  number: 'رقم',
  integer: 'عدد صحيح',
  percentage: 'نسبة مئوية',
  currency: 'عملة',
  text: 'نص',
  date: 'تاريخ',
  datetime: 'تاريخ ووقت',
  boolean: 'منطقي',
  email: 'بريد إلكتروني',
  phone: 'هاتف',
  unknown: 'غير معروف',
};

export const INSIGHT_TYPE_LABELS: Record<AIInsight['type'], string> = {
  observation: 'ملاحظة',
  warning: 'تحذير',
  recommendation: 'توصية',
  pattern: 'نمط',
  anomaly: 'شذوذ',
};

export function formatNumber(num: number, decimals = 2): string {
  if (Math.abs(num) >= 1_000_000) {
    return (num / 1_000_000).toFixed(decimals) + 'M';
  }
  if (Math.abs(num) >= 1_000) {
    return (num / 1_000).toFixed(decimals) + 'K';
  }
  return num.toFixed(decimals);
}

export function formatPercentage(num: number, decimals = 1): string {
  return num.toFixed(decimals) + '%';
}

// ==================== التقرير الاحترافي ====================

export interface TOCItem {
  id: string;
  title: string;
  pageNumber: number;
  level: 1 | 2 | 3;
  children?: TOCItem[];
}

export interface ExecutiveSummaryKPI {
  id: string;
  title: string;
  value: string | number;
  percentage?: number;
  trend?: 'up' | 'down' | 'neutral';
  color: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'cyan';
  description?: string;
}

export interface ExecutiveSummaryData {
  title: string;
  subtitle: string;
  date: string;
  kpis: ExecutiveSummaryKPI[];
  summary: string;
  highlights: string[];
}

export interface ColumnRelationship {
  columnName: string;
  description: string;
  dataType: string;
  example?: string;
}

export interface ClassificationRule {
  category: string;
  condition: string;
  count: number;
  percentage?: number;
}

export interface DataUnderstandingSection {
  title: string;
  description: string;
  columns: ColumnRelationship[];
  classificationRules: ClassificationRule[];
}

export interface AnalysisTableRow {
  indicator: string;
  value: string | number;
  percentage?: string;
  status?: 'success' | 'warning' | 'danger' | 'info';
}

export interface AnalysisSection {
  id: string;
  title: string;
  description?: string;
  tableTitle?: string;
  tableHeaders: string[];
  tableRows: AnalysisTableRow[];
  analysis?: string;
  insights?: string[];
}

export interface CriticalCase {
  id: string;
  type: 'conflict' | 'warning' | 'critical' | 'info';
  title: string;
  description: string;
  affectedCount: number;
  details?: { label: string; value: string }[];
  items?: { name: string; status: string; info?: string }[];
}

export interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  category: 'immediate' | 'short-term' | 'long-term';
  impact?: string;
}

export interface ConclusionData {
  overallRating: 'excellent' | 'good' | 'fair' | 'poor';
  ratingScore: number;
  summary: string;
  keyMetrics: { label: string; value: string; status: 'success' | 'warning' | 'danger' }[];
  finalNotes: string[];
}

export interface ProfessionalReportData {
  id: string;
  title: string;
  subtitle: string;
  generatedAt: string;
  tableOfContents: TOCItem[];
  executiveSummary: ExecutiveSummaryData;
  dataUnderstanding: DataUnderstandingSection;
  detailedAnalysis: AnalysisSection[];
  criticalCases: CriticalCase[];
  charts: ChartData[];
  recommendations: Recommendation[];
  conclusion: ConclusionData;
  metadata: {
    fileName: string;
    rowCount: number;
    columnCount: number;
    dateRange?: { from: string; to: string };
  };
}

// ==================== نظام المحادثة ====================

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: string;
  data?: {
    type: 'table' | 'chart' | 'text' | 'kpi';
    payload: unknown;
  };
  isLoading?: boolean;
}

export interface ChatSession {
  id: string;
  reportId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatContext {
  reportSummary: DatasetSummary;
  columns: ColumnAnalysis[];
  sampleData: Record<string, unknown>[];
  aiAnalysis?: AIAnalysisResult;
}

// ==================== تصدير PDF ====================

export interface PDFExportOptions {
  includeCharts: boolean;
  includeRawData: boolean;
  includeChat: boolean;
  language: 'ar' | 'en';
  paperSize: 'a4' | 'letter';
  orientation: 'portrait' | 'landscape';
}

export interface PDFSection {
  title: string;
  content: string | string[];
  type: 'text' | 'table' | 'chart' | 'kpi';
  pageBreakBefore?: boolean;
}

export const RATING_LABELS: Record<ConclusionData['overallRating'], string> = {
  excellent: 'ممتاز',
  good: 'جيد',
  fair: 'مقبول',
  poor: 'ضعيف',
};

export const PRIORITY_LABELS: Record<Recommendation['priority'], string> = {
  high: 'عالية',
  medium: 'متوسطة',
  low: 'منخفضة',
};

export const CATEGORY_LABELS: Record<Recommendation['category'], string> = {
  immediate: 'فوري',
  'short-term': 'قصير المدى',
  'long-term': 'طويل المدى',
};

export const CRITICAL_TYPE_LABELS: Record<CriticalCase['type'], string> = {
  conflict: 'تعارض',
  warning: 'تحذير',
  critical: 'حرج',
  info: 'معلومة',
};
