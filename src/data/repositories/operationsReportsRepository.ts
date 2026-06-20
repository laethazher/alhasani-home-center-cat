import type {
  StaffTimingRecord,
  DailyStaffSummary,
  UploadedReportData,
  RegionType,
  RegionSettings,
  ComparisonData,
} from '../../pages/operations/reports/types';
import {
  parseTimeToMinutes,
  compareTime,
  getTimeDifferenceMinutes,
  categorizeRegion,
  DEFAULT_EXPECTED_TIMES,
  REGION_LABELS,
} from '../../pages/operations/reports/types';

const STORAGE_KEY = 'ops_reports_data';
const SETTINGS_KEY = 'ops_reports_settings';

class OperationsReportsRepository {
  private getStoredData(): UploadedReportData[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveData(data: UploadedReportData[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  getSettings(): Record<string, RegionSettings> {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  saveSettings(settings: Record<string, RegionSettings>): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  getExpectedTime(region: RegionType, province?: string): { entry: string; exit: string } {
    const settings = this.getSettings();
    const key = province ? `${region}_${province}` : region;
    if (settings[key]) {
      return {
        entry: settings[key].expectedEntryTime,
        exit: settings[key].expectedExitTime,
      };
    }
    return DEFAULT_EXPECTED_TIMES[region] || DEFAULT_EXPECTED_TIMES.all;
  }

  saveReport(report: UploadedReportData): void {
    const data = this.getStoredData();
    data.unshift(report);
    if (data.length > 50) data.pop();
    this.saveData(data);
  }

  getReports(): UploadedReportData[] {
    return this.getStoredData();
  }

  getReportById(id: string): UploadedReportData | null {
    const data = this.getStoredData();
    return data.find((r) => r.id === id) || null;
  }

  deleteReport(id: string): void {
    const data = this.getStoredData().filter((r) => r.id !== id);
    this.saveData(data);
  }

  getAllRecords(): StaffTimingRecord[] {
    const data = this.getStoredData();
    return data.flatMap((r) => r.records);
  }

  getRecordsByDate(date: string): StaffTimingRecord[] {
    return this.getAllRecords().filter((r) => r.date === date);
  }

  getRecordsByDateRange(from: string, to: string): StaffTimingRecord[] {
    return this.getAllRecords().filter((r) => r.date >= from && r.date <= to);
  }

  calculateDailySummary(records: StaffTimingRecord[], region?: RegionType): DailyStaffSummary[] {
    const grouped = new Map<string, StaffTimingRecord[]>();

    for (const record of records) {
      if (region && region !== 'all' && record.region !== region) continue;
      const key = `${record.date}_${record.region}_${record.province || ''}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(record);
    }

    const summaries: DailyStaffSummary[] = [];

    for (const [key, group] of grouped) {
      const [date, regionVal, province] = key.split('_');
      const regionType = regionVal as RegionType;

      let firstEntry: string | null = null;
      let firstEntryStaff: string | null = null;
      let lastExit: string | null = null;
      let lastExitStaff: string | null = null;

      const expected = this.getExpectedTime(regionType, province);
      let onTimeCount = 0;
      let lateCount = 0;

      for (const r of group) {
        if (r.entryTime) {
          if (!firstEntry || compareTime(r.entryTime, firstEntry) < 0) {
            firstEntry = r.entryTime;
            firstEntryStaff = r.staffName;
          }
          if (compareTime(r.entryTime, expected.entry) <= 0) {
            onTimeCount++;
          } else {
            lateCount++;
          }
        }
        if (r.exitTime) {
          if (!lastExit || compareTime(r.exitTime, lastExit) > 0) {
            lastExit = r.exitTime;
            lastExitStaff = r.staffName;
          }
        }
      }

      summaries.push({
        date,
        region: regionType,
        province: province || undefined,
        firstEntry,
        firstEntryStaff,
        lastExit,
        lastExitStaff,
        totalStaff: group.length,
        onTimeCount,
        lateCount,
      });
    }

    return summaries.sort((a, b) => b.date.localeCompare(a.date));
  }

  calculateComparisons(records: StaffTimingRecord[], date: string): ComparisonData[] {
    const comparisons: ComparisonData[] = [];
    const regions: RegionType[] = ['baghdad', 'provinces'];

    for (const region of regions) {
      const regionRecords = records.filter(
        (r) => r.date === date && r.region === region
      );
      if (regionRecords.length === 0) continue;

      const expected = this.getExpectedTime(region);

      let firstEntry: string | null = null;
      for (const r of regionRecords) {
        if (r.entryTime && (!firstEntry || compareTime(r.entryTime, firstEntry) < 0)) {
          firstEntry = r.entryTime;
        }
      }

      if (firstEntry) {
        const diff = getTimeDifferenceMinutes(expected.entry, firstEntry);
        const isEarly = compareTime(firstEntry, expected.entry) <= 0;
        const percentage = isEarly ? 100 : Math.max(0, 100 - (diff / 60) * 20);

        comparisons.push({
          label: `أول دخول - ${REGION_LABELS[region]}`,
          expected: expected.entry,
          actual: firstEntry,
          difference: isEarly ? -diff : diff,
          percentage: Math.round(percentage),
          status: isEarly ? 'good' : diff <= 15 ? 'warning' : 'bad',
        });
      }

      let lastExit: string | null = null;
      for (const r of regionRecords) {
        if (r.exitTime && (!lastExit || compareTime(r.exitTime, lastExit) > 0)) {
          lastExit = r.exitTime;
        }
      }

      if (lastExit) {
        const diff = getTimeDifferenceMinutes(expected.exit, lastExit);
        const isLate = compareTime(lastExit, expected.exit) >= 0;
        const percentage = isLate ? 100 : Math.max(0, 100 - (diff / 60) * 20);

        comparisons.push({
          label: `آخر خروج - ${REGION_LABELS[region]}`,
          expected: expected.exit,
          actual: lastExit,
          difference: isLate ? diff : -diff,
          percentage: Math.round(percentage),
          status: isLate ? 'good' : diff <= 15 ? 'warning' : 'bad',
        });
      }
    }

    const totalRecords = records.filter((r) => r.date === date);
    const onTime = totalRecords.filter((r) => {
      if (!r.entryTime) return false;
      const expected = this.getExpectedTime(r.region);
      return compareTime(r.entryTime, expected.entry) <= 0;
    }).length;

    if (totalRecords.length > 0) {
      const percentage = Math.round((onTime / totalRecords.length) * 100);
      comparisons.push({
        label: 'نسبة الالتزام بالوقت',
        expected: '100%',
        actual: `${percentage}%`,
        difference: 100 - percentage,
        percentage,
        status: percentage >= 90 ? 'good' : percentage >= 70 ? 'warning' : 'bad',
      });
    }

    return comparisons;
  }

  getUniqueDates(): string[] {
    const records = this.getAllRecords();
    const dates = new Set(records.map((r) => r.date));
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }

  getStatsByProvince(date: string): Map<string, { total: number; onTime: number; late: number }> {
    const records = this.getRecordsByDate(date);
    const stats = new Map<string, { total: number; onTime: number; late: number }>();

    for (const r of records) {
      const key = r.province || (r.region === 'baghdad' ? 'بغداد' : 'أخرى');
      if (!stats.has(key)) stats.set(key, { total: 0, onTime: 0, late: 0 });
      const s = stats.get(key)!;
      s.total++;
      if (r.entryTime) {
        const expected = this.getExpectedTime(r.region, r.province);
        if (compareTime(r.entryTime, expected.entry) <= 0) {
          s.onTime++;
        } else {
          s.late++;
        }
      }
    }

    return stats;
  }
}

export const operationsReportsRepository = new OperationsReportsRepository();
