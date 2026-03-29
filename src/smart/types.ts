import type { PageKey } from '../components/Layout';

export type { PageKey };

/** نافذة زمنية مستخرجة من النص */
export type TimeWindowKind = 'today' | 'yesterday' | 'this_week' | 'last_week';

export interface ParsedQuery {
  raw: string;
  normalized: string;
  tokens: string[];
  /** كلمات بعد توسيع المرادفات (للبحث) */
  expandedTokens: string[];
  timeWindow: TimeWindowKind | null;
  /** أجزاء نص قد تكون أسماء أشخاص (غير كلمات زمنية/حالة) */
  personFragments: string[];
  statusHints: ('pending' | 'approved' | 'exited' | 'rejected' | 'late' | 'absent' | 'present')[];
}

export interface SavedViewRecord<T = Record<string, unknown>> {
  id: string;
  name: string;
  pageKey: PageKey;
  createdAt: string;
  payload: T;
}

export type SortMode = 'default' | 'relevance';

/** حالات حضور للفلترة في التقارير */
export type AttendanceFilterStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'full_leave'
  | 'time_leave';

/** مخرجات parseSearchQuery — دمج مع لوحة الفلاتر */
export interface StructuredSearchFilters {
  nameContains: string | null;
  plateContains: string | null;
  vehicleNumberContains: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  quickRange: 'today' | 'this_week' | 'this_month' | null;
  delayMinMinutes: number | null;
  delayMaxMinutes: number | null;
  attendanceStatuses: AttendanceFilterStatus[];
  freeText: string | null;
}

/** حالة الفلاتر المتقدمة (نموذج النموذج) */
export interface AdvancedFilterState {
  name: string;
  plate: string;
  dateFrom: string;
  dateTo: string;
  statuses: AttendanceFilterStatus[];
  delayMin: string;
  delayMax: string;
  role: 'all' | 'driver' | 'assistant';
  nlQuery: string;
}
