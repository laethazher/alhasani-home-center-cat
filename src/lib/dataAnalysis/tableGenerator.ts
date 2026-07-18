/**
 * مولد الجداول الاحترافية
 * ينشئ جداول منسقة للتقارير
 */

import type { AnalysisReport } from './types';
import type { DataRecognitionResult } from './dataRecognizer';
import type { DeliveryInstallationKPIs, StageAnalysis } from './kpiEngine';
import type { CustomerJourney } from './relationshipAnalyzer';
import type { CriticalCasesSummary } from './criticalCasesAnalyzer';
import type { TeamPerformanceSummary, EmployeePerformance, SupervisorPerformance } from './employeeAnalyzer';

// عمود في الجدول
export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  format?: 'text' | 'number' | 'percentage' | 'currency';
}

// صف في الجدول
export interface TableRow {
  [key: string]: string | number | boolean;
}

// جدول كامل
export interface ReportTable {
  id: string;
  title: string;
  subtitle?: string;
  columns: TableColumn[];
  rows: TableRow[];
  footer?: TableRow;
  notes?: string[];
}

/**
 * جدول توزيع السجلات الكلي
 */
export function generateDataStructureTable(
  report: AnalysisReport,
  recognition: DataRecognitionResult
): ReportTable {
  const columns: TableColumn[] = [
    { key: 'category', label: 'الفئة', align: 'right' },
    { key: 'count', label: 'العدد', align: 'center', format: 'number' },
    { key: 'percentage', label: 'النسبة', align: 'center', format: 'percentage' },
    { key: 'description', label: 'الوصف', align: 'right' }
  ];
  
  const rows: TableRow[] = recognition.dataStructure.categories.map(cat => ({
    category: cat.name,
    count: cat.count,
    percentage: cat.percentage,
    description: cat.description
  }));
  
  // إضافة الإجمالي
  const footer: TableRow = {
    category: 'الإجمالي',
    count: report.summary.rowCount,
    percentage: 100,
    description: ''
  };
  
  return {
    id: 'data-structure',
    title: 'توزيع السجلات الكلي',
    columns,
    rows,
    footer
  };
}

/**
 * جدول فواتير التجهيز الرئيسية
 */
export function generateDeliveryInvoicesTable(kpis: DeliveryInstallationKPIs): ReportTable {
  const columns: TableColumn[] = [
    { key: 'indicator', label: 'المؤشر', align: 'right' },
    { key: 'count', label: 'العدد', align: 'center', format: 'number' },
    { key: 'percentage', label: 'النسبة', align: 'center', format: 'percentage' }
  ];
  
  const { delivery } = kpis;
  const rows: TableRow[] = [
    {
      indicator: 'إجمالي فواتير التجهيز الرئيسية',
      count: delivery.totalMainInvoices,
      percentage: 100
    },
    {
      indicator: 'تجهيز مكتمل (Operation Type = تجهيز)',
      count: delivery.completedDelivery,
      percentage: delivery.deliverySuccessRate
    },
    {
      indicator: 'تكملة تجهيز (Operation Type = تكملة تجهيز)',
      count: delivery.deliveryCompletion,
      percentage: delivery.deliveryCompensationRate
    }
  ];
  
  return {
    id: 'delivery-invoices',
    title: 'جدول 1: فواتير التجهيز الرئيسية',
    columns,
    rows,
    notes: [
      `نسبة نجاح التجهيز: ${delivery.deliverySuccessRate.toFixed(1)}%`,
      `نسبة تعويض التجهيز: ${delivery.deliveryCompensationRate.toFixed(1)}%`
    ]
  };
}

/**
 * جدول التكتات الفرعية للتجهيز
 */
export function generateDeliverySubTicketsTable(kpis: DeliveryInstallationKPIs): ReportTable {
  const columns: TableColumn[] = [
    { key: 'indicator', label: 'المؤشر', align: 'right' },
    { key: 'count', label: 'العدد', align: 'center', format: 'number' }
  ];
  
  const { delivery } = kpis;
  const rows: TableRow[] = [
    { indicator: 'تكتات تجهيز فرعية', count: delivery.subTickets.delivery },
    { indicator: 'تكتات تكملة تجهيز فرعية', count: delivery.subTickets.deliveryCompletion }
  ];
  
  return {
    id: 'delivery-sub-tickets',
    title: 'جدول 2: التكتات الفرعية للتجهيز',
    columns,
    rows
  };
}

/**
 * جدول فواتير التركيب الرئيسية
 */
export function generateInstallationInvoicesTable(kpis: DeliveryInstallationKPIs): ReportTable {
  const columns: TableColumn[] = [
    { key: 'indicator', label: 'المؤشر', align: 'right' },
    { key: 'count', label: 'العدد', align: 'center', format: 'number' },
    { key: 'percentage', label: 'النسبة', align: 'center', format: 'percentage' }
  ];
  
  const { installation } = kpis;
  const rows: TableRow[] = [
    {
      indicator: 'إجمالي فواتير التركيب الرئيسية',
      count: installation.totalMainInvoices,
      percentage: 100
    },
    {
      indicator: 'تركيب مكتمل (Operation Type = تركيب)',
      count: installation.completedInstallation,
      percentage: installation.installationSuccessRate
    },
    {
      indicator: 'مجهزة مسبقاً (Operation Type = مجهزة مسبقاً)',
      count: installation.preEquipped,
      percentage: installation.totalMainInvoices > 0 
        ? (installation.preEquipped / installation.totalMainInvoices) * 100 
        : 0
    },
    {
      indicator: 'تكملة تركيب (Operation Type = تكملة تركيب)',
      count: installation.installationCompletion,
      percentage: installation.installationCompensationRate
    }
  ];
  
  return {
    id: 'installation-invoices',
    title: 'جدول 3: فواتير التركيب الرئيسية',
    columns,
    rows,
    notes: [
      `نسبة نجاح التركيب: ${installation.installationSuccessRate.toFixed(1)}%`,
      `نسبة تعويض التركيب (الرئيسية): ${installation.installationCompensationRate.toFixed(1)}%`
    ]
  };
}

/**
 * جدول المجهزة مسبقاً
 */
export function generatePreEquippedTable(kpis: DeliveryInstallationKPIs): ReportTable {
  const columns: TableColumn[] = [
    { key: 'indicator', label: 'المؤشر', align: 'right' },
    { key: 'count', label: 'العدد', align: 'center', format: 'number' },
    { key: 'percentage', label: 'النسبة', align: 'center', format: 'percentage' }
  ];
  
  const { installation } = kpis;
  const rows: TableRow[] = [
    {
      indicator: 'فواتير مجهزة مسبقاً',
      count: installation.preEquipped,
      percentage: installation.totalMainInvoices > 0 
        ? (installation.preEquipped / installation.totalMainInvoices) * 100 
        : 0
    },
    {
      indicator: 'منجزة (Stage = منجز بالكامل)',
      count: installation.preEquipped, // افتراضياً كلها منجزة
      percentage: 100
    },
    {
      indicator: 'فاشلة',
      count: 0,
      percentage: 0
    }
  ];
  
  return {
    id: 'pre-equipped',
    title: 'المجهزة مسبقاً',
    columns,
    rows
  };
}

/**
 * جدول رحلة الزبون
 */
export function generateCustomerJourneyTable(journey: CustomerJourney): ReportTable {
  const columns: TableColumn[] = [
    { key: 'indicator', label: 'المؤشر', align: 'right' },
    { key: 'count', label: 'العدد', align: 'center', format: 'number' }
  ];
  
  const rows: TableRow[] = [
    { indicator: 'إجمالي الزبائن الفريدين', count: journey.totalCustomers },
    { indicator: 'زبائن لديهم تجهيز رئيسي', count: journey.customersWithDelivery },
    { indicator: 'زبائن لديهم تركيب رئيسي', count: journey.customersWithInstallation },
    { indicator: 'زبائن لديهم تجهيز + تركيب', count: journey.customersWithBoth },
    { indicator: 'زبائن تجهيز فقط', count: journey.customersDeliveryOnly },
    { indicator: 'زبائن تركيب فقط (مجهزة مسبقاً)', count: journey.customersInstallationOnly }
  ];
  
  return {
    id: 'customer-journey',
    title: 'جدول 4: تحليل رحلة الزبون',
    columns,
    rows
  };
}

/**
 * جدول توزيع Stage
 */
export function generateStageDistributionTable(stages: StageAnalysis): ReportTable {
  const columns: TableColumn[] = [
    { key: 'stage', label: 'Stage', align: 'right' },
    { key: 'count', label: 'العدد', align: 'center', format: 'number' },
    { key: 'percentage', label: 'النسبة', align: 'center', format: 'percentage' }
  ];
  
  const rows: TableRow[] = stages.stages.map(s => ({
    stage: s.stage,
    count: s.count,
    percentage: s.percentage
  }));
  
  return {
    id: 'stage-distribution',
    title: 'جدول 5: توزيع الحالات حسب Stage',
    columns,
    rows
  };
}

/**
 * جدول أداء الموظفين Top 10
 */
export function generateTopEmployeesTable(team: TeamPerformanceSummary): ReportTable {
  const columns: TableColumn[] = [
    { key: 'name', label: 'الموظف', align: 'right' },
    { key: 'total', label: 'المجموع', align: 'center', format: 'number' },
    { key: 'delivery', label: 'تجهيز', align: 'center', format: 'number' },
    { key: 'installation', label: 'تركيب', align: 'center', format: 'number' },
    { key: 'problems', label: 'مشاكل', align: 'center', format: 'number' }
  ];
  
  const rows: TableRow[] = team.topEmployees.map(emp => ({
    name: emp.name,
    total: emp.totalOperations,
    delivery: emp.deliveryCount,
    installation: emp.installationCount,
    problems: emp.problemCount
  }));
  
  return {
    id: 'top-employees',
    title: 'جدول 6: أداء الموظفين المنفذين (Top 10)',
    subtitle: 'حسب عدد العمليات',
    columns,
    rows
  };
}

/**
 * جدول أداء المشرفين
 */
export function generateSupervisorsTable(team: TeamPerformanceSummary): ReportTable {
  const columns: TableColumn[] = [
    { key: 'name', label: 'المشرف', align: 'right' },
    { key: 'deliveryInvoices', label: 'فواتير تجهيز', align: 'center', format: 'number' },
    { key: 'deliverySuccess', label: 'نجاح تجهيز', align: 'center', format: 'percentage' },
    { key: 'installationInvoices', label: 'فواتير تركيب', align: 'center', format: 'number' },
    { key: 'installationSuccess', label: 'نجاح تركيب', align: 'center', format: 'percentage' }
  ];
  
  const rows: TableRow[] = team.supervisorPerformance.map(sup => ({
    name: sup.name,
    deliveryInvoices: sup.deliveryInvoices,
    deliverySuccess: sup.deliverySuccessRate,
    installationInvoices: sup.installationInvoices,
    installationSuccess: sup.installationSuccessRate
  }));
  
  return {
    id: 'supervisors',
    title: 'جدول 7: أداء المشرفين (الفواتير الرئيسية)',
    columns,
    rows
  };
}

/**
 * جدول الحالات الحرجة
 */
export function generateCriticalCasesTable(cases: CriticalCasesSummary): ReportTable[] {
  const tables: ReportTable[] = [];
  
  // جدول تكملة التجهيز
  if (cases.deliveryCompletions.length > 0) {
    tables.push({
      id: 'delivery-completions',
      title: `تكملة التجهيز (${cases.deliveryCompletions.length} تكت فرعي)`,
      columns: [
        { key: 'customer', label: 'الزبون', align: 'right' },
        { key: 'employee', label: 'الموظف', align: 'right' },
        { key: 'stage', label: 'Stage', align: 'center' }
      ],
      rows: cases.deliveryCompletions.slice(0, 20).map(c => ({
        customer: `${c.employee || ''} - ${c.customer}`,
        employee: c.supervisor || '',
        stage: `Stage: ${c.stage}`
      }))
    });
  }
  
  // جدول تكملة التركيب
  if (cases.installationCompletions.length > 0) {
    tables.push({
      id: 'installation-completions',
      title: `تكملة التركيب (${cases.installationCompletions.length} تكت فرعي)`,
      columns: [
        { key: 'customer', label: 'الزبون', align: 'right' },
        { key: 'employee', label: 'الموظف', align: 'right' },
        { key: 'stage', label: 'Stage', align: 'center' }
      ],
      rows: cases.installationCompletions.slice(0, 20).map(c => ({
        customer: `${c.employee || ''} - ${c.customer}`,
        employee: c.supervisor || '',
        stage: `Stage: ${c.stage}`
      }))
    });
  }
  
  return tables;
}

/**
 * تنسيق القيمة حسب النوع
 */
export function formatTableValue(value: unknown, format?: TableColumn['format']): string {
  if (value === null || value === undefined) return '-';
  
  switch (format) {
    case 'number':
      return typeof value === 'number' 
        ? value.toLocaleString('ar-IQ') 
        : String(value);
    case 'percentage':
      return typeof value === 'number' 
        ? `${value.toFixed(1)}%` 
        : String(value);
    case 'currency':
      return typeof value === 'number' 
        ? `${value.toLocaleString('ar-IQ')} د.ع` 
        : String(value);
    default:
      return String(value);
  }
}

/**
 * تجميع جميع الجداول للتقرير
 */
export interface AllReportTables {
  dataStructure: ReportTable;
  deliveryInvoices: ReportTable;
  deliverySubTickets: ReportTable;
  installationInvoices: ReportTable;
  preEquipped: ReportTable;
  customerJourney: ReportTable;
  stageDistribution: ReportTable;
  topEmployees: ReportTable;
  supervisors: ReportTable;
  criticalCases: ReportTable[];
}

export function generateAllTables(
  report: AnalysisReport,
  recognition: DataRecognitionResult,
  kpis: DeliveryInstallationKPIs,
  stages: StageAnalysis,
  journey: CustomerJourney,
  team: TeamPerformanceSummary,
  criticalCases: CriticalCasesSummary
): AllReportTables {
  return {
    dataStructure: generateDataStructureTable(report, recognition),
    deliveryInvoices: generateDeliveryInvoicesTable(kpis),
    deliverySubTickets: generateDeliverySubTicketsTable(kpis),
    installationInvoices: generateInstallationInvoicesTable(kpis),
    preEquipped: generatePreEquippedTable(kpis),
    customerJourney: generateCustomerJourneyTable(journey),
    stageDistribution: generateStageDistributionTable(stages),
    topEmployees: generateTopEmployeesTable(team),
    supervisors: generateSupervisorsTable(team),
    criticalCases: generateCriticalCasesTable(criticalCases)
  };
}
