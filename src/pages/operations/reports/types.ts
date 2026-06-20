/** أنواع بيانات تقارير العمليات */

export type ReportType = 'daily' | 'weekly' | 'monthly';

export type RegionType = 'baghdad' | 'provinces' | 'all';

export interface StaffTimingRecord {
  id: string;
  staffName: string;
  region: RegionType;
  province?: string;
  date: string;
  entryTime: string | null;
  exitTime: string | null;
  notes?: string;
}

export interface DailyStaffSummary {
  date: string;
  region: RegionType;
  province?: string;
  firstEntry: string | null;
  firstEntryStaff: string | null;
  lastExit: string | null;
  lastExitStaff: string | null;
  totalStaff: number;
  onTimeCount: number;
  lateCount: number;
}

export interface ComparisonData {
  label: string;
  expected: string;
  actual: string;
  difference: number;
  percentage: number;
  status: 'good' | 'warning' | 'bad';
}

export interface RegionSettings {
  region: RegionType;
  province?: string;
  expectedEntryTime: string;
  expectedExitTime: string;
}

export interface ColumnMapping {
  staffName: string | null;
  entryTime: string | null;
  exitTime: string | null;
  region: string | null;
  province: string | null;
  date: string | null;
}

export interface ParsedFileData {
  headers: string[];
  rows: Record<string, string>[];
  fileName: string;
  fileType: 'excel' | 'csv';
}

export interface UploadedReportData {
  id: string;
  fileName: string;
  uploadedAt: string;
  recordCount: number;
  dateRange: { from: string; to: string };
  records: StaffTimingRecord[];
}

export const IRAQI_PROVINCES = [
  'بغداد',
  'البصرة',
  'نينوى',
  'أربيل',
  'النجف',
  'كربلاء',
  'الأنبار',
  'ذي قار',
  'ديالى',
  'كركوك',
  'صلاح الدين',
  'بابل',
  'واسط',
  'المثنى',
  'القادسية',
  'ميسان',
  'دهوك',
  'السليمانية',
] as const;

export type IraqiProvince = typeof IRAQI_PROVINCES[number];

export function isValidTime(time: string): boolean {
  const regex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  return regex.test(time);
}

export function parseTimeToMinutes(time: string): number {
  if (!time || !isValidTime(time)) return -1;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  if (minutes < 0) return '--:--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function compareTime(time1: string, time2: string): number {
  return parseTimeToMinutes(time1) - parseTimeToMinutes(time2);
}

export function getTimeDifferenceMinutes(time1: string, time2: string): number {
  const m1 = parseTimeToMinutes(time1);
  const m2 = parseTimeToMinutes(time2);
  if (m1 < 0 || m2 < 0) return 0;
  return Math.abs(m1 - m2);
}

export function categorizeRegion(province: string): RegionType {
  const normalized = province.trim();
  if (normalized === 'بغداد' || normalized.toLowerCase() === 'baghdad') {
    return 'baghdad';
  }
  return 'provinces';
}

export const DEFAULT_EXPECTED_TIMES: Record<RegionType, { entry: string; exit: string }> = {
  baghdad: { entry: '08:00', exit: '16:00' },
  provinces: { entry: '08:00', exit: '16:00' },
  all: { entry: '08:00', exit: '16:00' },
};

export const REGION_LABELS: Record<RegionType, string> = {
  baghdad: 'بغداد',
  provinces: 'المحافظات',
  all: 'الكل',
};
