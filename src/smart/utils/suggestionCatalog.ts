import type { PageKey } from '../types';

export interface CatalogItem {
  label: string;
  /** نص يُدرج في حقل البحث عند الاختيار */
  insertText: string;
}

const DEFAULT_GENERAL: CatalogItem[] = [
  { label: 'اليوم', insertText: 'اليوم' },
  { label: 'هذا الأسبوع', insertText: 'هذا الأسبوع' },
];

const STAFF_EXIT: CatalogItem[] = [
  { label: 'متأخرين', insertText: 'متأخر' },
  { label: 'متأخر هذا الأسبوع', insertText: 'متأخر هذا الأسبوع' },
  { label: 'مخالفات التأخير', insertText: 'مخالفة' },
  { label: 'طلبات معلقة', insertText: 'قيد الانتظار' },
  { label: 'معتمد اليوم', insertText: 'معتمد' },
  { label: 'باحتساب تحميل', insertText: 'تحميل' },
  { label: 'هذا الأسبوع', insertText: 'هذا الأسبوع' },
  { label: 'أمس', insertText: 'أمس' },
];

const CREW_ATTENDANCE: CatalogItem[] = [
  { label: 'متأخرين', insertText: 'متأخر' },
  { label: 'غائبين', insertText: 'غائب' },
  { label: 'حاضرين', insertText: 'حاضر' },
  { label: 'إجازة', insertText: 'إجازة' },
  { label: 'السائقون فقط', insertText: 'سائق' },
];

const VEHICLES: CatalogItem[] = [
  { label: 'متاحة', insertText: 'متاح' },
  { label: 'صيانة', insertText: 'صيانة' },
  { label: 'احتياط', insertText: 'احتياط' },
  { label: 'تأمين قريب الانتهاء', insertText: 'تأمين' },
];

const ATTENDANCE_REPORTS: CatalogItem[] = [
  { label: 'تقرير السائقين', insertText: 'سائق' },
  { label: 'تقرير المساعدين', insertText: 'مساعد' },
  { label: 'متأخرين', insertText: 'متأخر' },
  { label: 'هذا الشهر', insertText: 'شهر' },
];

const VIOLATIONS_HUB: CatalogItem[] = [
  { label: 'مخالفات التأخير', insertText: 'مخالفة' },
  { label: 'تأخير طويل', insertText: 'تأخير' },
  { label: 'هذا الأسبوع', insertText: 'هذا الأسبوع' },
  { label: 'سائق', insertText: 'سائق' },
  { label: 'مساعد', insertText: 'مساعد' },
];

/** نطاقات مركز التقارير الذكية — اقتراحات حسب التبويب */
export type ReportsHubDomain = 'all' | 'attendance' | 'vehicles' | 'violations' | 'bubbles';

export function getCatalogForReportsHubDomain(domain: ReportsHubDomain): CatalogItem[] {
  switch (domain) {
    case 'bubbles':
      return [...BUBBLES, ...DEFAULT_GENERAL];
    case 'all':
      return [
        ...ATTENDANCE_REPORTS,
        ...VEHICLES,
        ...VIOLATIONS_HUB.slice(0, 6),
        ...BUBBLES.slice(0, 4),
        ...DEFAULT_GENERAL,
      ];
    case 'attendance':
      return [...ATTENDANCE_REPORTS, ...DEFAULT_GENERAL];
    case 'vehicles':
      return [...VEHICLES, ...DEFAULT_GENERAL];
    case 'violations':
      return [...VIOLATIONS_HUB, ...STAFF_EXIT.slice(0, 4), ...DEFAULT_GENERAL];
    default:
      return DEFAULT_GENERAL;
  }
}

const MAINTENANCE: CatalogItem[] = [
  { label: 'طلبات معلقة', insertText: 'pending' },
  { label: 'عاجل', insertText: 'عاجل' },
  { label: 'قيد التنفيذ', insertText: 'قيد' },
];

const BUBBLES: CatalogItem[] = [
  { label: 'معلّق', insertText: 'معلق' },
  { label: 'متأخر', insertText: 'متأخر' },
  { label: 'مشكلة', insertText: 'مشكلة' },
  { label: 'مكتمل', insertText: 'مكتمل' },
  { label: 'هذا الأسبوع', insertText: 'هذا الأسبوع' },
];

function groupForPage(pageKey: PageKey): CatalogItem[] {
  switch (pageKey) {
    case 'bubbles':
      return [...BUBBLES, ...DEFAULT_GENERAL];
    case 'staff-exit':
      return STAFF_EXIT;
    case 'crew-attendance':
    case 'attendance-history':
      return CREW_ATTENDANCE;
    case 'attendance-reports':
      return ATTENDANCE_REPORTS;
    case 'reports-hub':
      return [...ATTENDANCE_REPORTS, ...VEHICLES, ...DEFAULT_GENERAL];
    case 'vehicles':
      return VEHICLES;
    case 'maintenance-requests':
    case 'active-maintenance':
    case 'maintenance-history':
      return MAINTENANCE;
    default:
      return DEFAULT_GENERAL;
  }
}

export function getCatalogForPage(pageKey: PageKey): CatalogItem[] {
  return groupForPage(pageKey);
}
