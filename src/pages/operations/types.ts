export type OperationsPageKey =
  | 'ops-dashboard'
  | 'ops-tasks'
  | 'ops-field'
  | 'ops-scheduling'
  | 'ops-incidents'
  | 'ops-inventory'
  | 'ops-analytics'
  | 'ops-integrations'
  | 'shared-reports';

export interface OperationsNavItem {
  key: OperationsPageKey;
  label: string;
  description: string;
  section: 'core' | 'shared';
}

export const OPERATIONS_NAV: OperationsNavItem[] = [
  { key: 'ops-dashboard', label: 'لوحة العمليات', description: 'مؤشرات ومتابعة يومية', section: 'core' },
  { key: 'ops-tasks', label: 'إدارة المهام', description: 'أوامر العمل والمهام', section: 'core' },
  { key: 'ops-field', label: 'العمليات الميدانية', description: 'الفرق والمواقع', section: 'core' },
  { key: 'ops-scheduling', label: 'الجدولة', description: 'جداول التشغيل', section: 'core' },
  { key: 'ops-incidents', label: 'البلاغات والطوارئ', description: 'حوادث وبلاغات', section: 'core' },
  { key: 'ops-inventory', label: 'مخزون العمليات', description: 'معدات ومواد تشغيل', section: 'core' },
  { key: 'ops-analytics', label: 'التقارير والتحليلات', description: 'تحليلات مخصصة', section: 'core' },
  { key: 'ops-integrations', label: 'التكامل', description: 'ربط الأنظمة الخارجية', section: 'core' },
  { key: 'shared-reports', label: 'تقارير المركبات', description: 'فحص وتقارير (بيانات معزولة)', section: 'shared' },
];
