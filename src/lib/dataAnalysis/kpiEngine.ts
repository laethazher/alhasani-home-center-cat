/**
 * محرك حساب KPIs الذكي
 * يحسب مؤشرات الأداء الرئيسية بناءً على نوع البيانات
 */

import type { AnalysisReport } from './types';
import type { DataRecognitionResult, RecognizedColumns } from './dataRecognizer';

// مؤشر أداء رئيسي
export interface KPI {
  id: string;
  label: string;
  value: number | string;
  percentage?: number;
  trend?: 'up' | 'down' | 'stable';
  color: 'green' | 'red' | 'blue' | 'yellow' | 'gray';
  description?: string;
}

// نتائج التجهيز
export interface DeliveryAnalysis {
  totalMainInvoices: number;
  completedDelivery: number;
  deliveryCompletion: number;  // تكملة تجهيز
  deliverySuccessRate: number;
  deliveryCompensationRate: number;
  subTickets: {
    total: number;
    delivery: number;
    deliveryCompletion: number;
  };
}

// نتائج التركيب
export interface InstallationAnalysis {
  totalMainInvoices: number;
  completedInstallation: number;
  preEquipped: number;  // مجهزة مسبقاً
  installationCompletion: number;  // تكملة تركيب
  installationSuccessRate: number;
  installationCompensationRate: number;
  subTickets: {
    total: number;
    installation: number;
    installationCompletion: number;
  };
}

// نتائج KPIs للتجهيز والتركيب
export interface DeliveryInstallationKPIs {
  kpis: KPI[];
  delivery: DeliveryAnalysis;
  installation: InstallationAnalysis;
  totalSuccessRate: number;
  uniqueCustomers: number;
  totalMainInvoices: number;
}

/**
 * حساب KPIs للتجهيز والتركيب
 */
export function calculateDeliveryInstallationKPIs(
  report: AnalysisReport,
  recognition: DataRecognitionResult
): DeliveryInstallationKPIs {
  const { rawData } = report;
  const cols = recognition.recognizedColumns;
  
  // تحليل التجهيز
  const delivery = analyzeDelivery(rawData, cols);
  
  // تحليل التركيب
  const installation = analyzeInstallation(rawData, cols);
  
  // حساب الزبائن الفريدين
  const uniqueCustomers = countUniqueCustomers(rawData, cols);
  
  // حساب نسبة النجاح الكلية
  const totalMainInvoices = delivery.totalMainInvoices + installation.totalMainInvoices;
  const totalSuccessful = delivery.completedDelivery + installation.completedInstallation + installation.preEquipped;
  const totalSuccessRate = totalMainInvoices > 0 
    ? (totalSuccessful / totalMainInvoices) * 100 
    : 0;
  
  // إنشاء KPIs
  const kpis: KPI[] = [
    {
      id: 'delivery_success',
      label: 'نجاح التجهيز الرئيسي',
      value: `${delivery.deliverySuccessRate.toFixed(1)}%`,
      percentage: delivery.deliverySuccessRate,
      color: delivery.deliverySuccessRate >= 95 ? 'green' : delivery.deliverySuccessRate >= 80 ? 'yellow' : 'red',
      description: `${delivery.completedDelivery} من ${delivery.totalMainInvoices} فاتورة`
    },
    {
      id: 'installation_success',
      label: 'نجاح التركيب الرئيسي',
      value: `${installation.installationSuccessRate.toFixed(1)}%`,
      percentage: installation.installationSuccessRate,
      color: installation.installationSuccessRate >= 90 ? 'green' : installation.installationSuccessRate >= 75 ? 'yellow' : 'red',
      description: `${installation.completedInstallation} من ${installation.totalMainInvoices} فاتورة`
    },
    {
      id: 'total_success',
      label: 'النجاح الكلي (الرئيسية)',
      value: `${totalSuccessRate.toFixed(1)}%`,
      percentage: totalSuccessRate,
      color: totalSuccessRate >= 90 ? 'green' : totalSuccessRate >= 75 ? 'yellow' : 'red'
    },
    {
      id: 'delivery_compensation',
      label: 'تعويض التجهيز الرئيسي',
      value: `${delivery.deliveryCompensationRate.toFixed(1)}%`,
      percentage: delivery.deliveryCompensationRate,
      color: delivery.deliveryCompensationRate === 0 ? 'green' : delivery.deliveryCompensationRate <= 5 ? 'yellow' : 'red'
    },
    {
      id: 'installation_compensation',
      label: 'تعويض التركيب الرئيسي',
      value: `${installation.installationCompensationRate.toFixed(1)}%`,
      percentage: installation.installationCompensationRate,
      color: installation.installationCompensationRate === 0 ? 'green' : installation.installationCompensationRate <= 5 ? 'yellow' : 'red'
    },
    {
      id: 'delivery_invoices',
      label: 'فواتير التجهيز الرئيسية',
      value: delivery.totalMainInvoices,
      color: 'blue'
    },
    {
      id: 'installation_invoices',
      label: 'فواتير التركيب الرئيسية',
      value: installation.totalMainInvoices,
      color: 'blue'
    },
    {
      id: 'unique_customers',
      label: 'زبون فريد',
      value: uniqueCustomers,
      color: 'blue'
    }
  ];
  
  return {
    kpis,
    delivery,
    installation,
    totalSuccessRate,
    uniqueCustomers,
    totalMainInvoices
  };
}

/**
 * تحليل بيانات التجهيز
 */
function analyzeDelivery(
  data: Record<string, unknown>[],
  cols: RecognizedColumns
): DeliveryAnalysis {
  const opTypeCol = cols.operationType;
  
  if (!opTypeCol) {
    return {
      totalMainInvoices: 0,
      completedDelivery: 0,
      deliveryCompletion: 0,
      deliverySuccessRate: 0,
      deliveryCompensationRate: 0,
      subTickets: { total: 0, delivery: 0, deliveryCompletion: 0 }
    };
  }
  
  let totalMainInvoices = 0;
  let completedDelivery = 0;
  let deliveryCompletion = 0;
  let subDelivery = 0;
  let subDeliveryCompletion = 0;
  
  for (const row of data) {
    const opType = String(row[opTypeCol] || '').toLowerCase().trim();
    
    // فواتير التجهيز الرئيسية (Delivery - S)
    if (opType.includes('delivery') && opType.includes('s') || opType === 'تجهيز') {
      totalMainInvoices++;
      completedDelivery++;
    }
    // تكملة تجهيز رئيسية
    else if (opType.includes('تكملة تجهيز') || (opType.includes('delivery') && opType.includes('completion'))) {
      if (opType.includes('s')) {
        deliveryCompletion++;
      }
    }
    // تجهيز فرعي
    else if (opType === 'تجهيز' || opType.includes('delivery')) {
      subDelivery++;
    }
    // تكملة تجهيز فرعية
    else if (opType.includes('تكملة') && opType.includes('تجهيز')) {
      subDeliveryCompletion++;
    }
  }
  
  const deliverySuccessRate = totalMainInvoices > 0 
    ? ((totalMainInvoices - deliveryCompletion) / totalMainInvoices) * 100 
    : 100;
  
  const deliveryCompensationRate = totalMainInvoices > 0 
    ? (deliveryCompletion / totalMainInvoices) * 100 
    : 0;
  
  return {
    totalMainInvoices,
    completedDelivery,
    deliveryCompletion,
    deliverySuccessRate,
    deliveryCompensationRate,
    subTickets: {
      total: subDelivery + subDeliveryCompletion,
      delivery: subDelivery,
      deliveryCompletion: subDeliveryCompletion
    }
  };
}

/**
 * تحليل بيانات التركيب
 */
function analyzeInstallation(
  data: Record<string, unknown>[],
  cols: RecognizedColumns
): InstallationAnalysis {
  const opTypeCol = cols.operationType;
  const stageCol = cols.stage;
  
  if (!opTypeCol) {
    return {
      totalMainInvoices: 0,
      completedInstallation: 0,
      preEquipped: 0,
      installationCompletion: 0,
      installationSuccessRate: 0,
      installationCompensationRate: 0,
      subTickets: { total: 0, installation: 0, installationCompletion: 0 }
    };
  }
  
  let totalMainInvoices = 0;
  let completedInstallation = 0;
  let preEquipped = 0;
  let installationCompletion = 0;
  let subInstallation = 0;
  let subInstallationCompletion = 0;
  
  for (const row of data) {
    const opType = String(row[opTypeCol] || '').toLowerCase().trim();
    const stage = stageCol ? String(row[stageCol] || '').toLowerCase().trim() : '';
    
    // فواتير التركيب الرئيسية (Installation - S)
    if (opType.includes('installation') && opType.includes('s') || opType === 'تركيب') {
      totalMainInvoices++;
      completedInstallation++;
    }
    // مجهزة مسبقاً
    else if (opType.includes('مجهزة مسبقاً') || opType.includes('pre-equipped') || opType.includes('مجهزة مسبقا')) {
      totalMainInvoices++;
      preEquipped++;
    }
    // تكملة تركيب رئيسية
    else if (opType.includes('تكملة تركيب') || (opType.includes('installation') && opType.includes('completion'))) {
      if (opType.includes('s')) {
        installationCompletion++;
      }
    }
    // تركيب فرعي
    else if (opType === 'تركيب' || opType.includes('installation')) {
      subInstallation++;
    }
    // تكملة تركيب فرعية
    else if (opType.includes('تكملة') && opType.includes('تركيب')) {
      subInstallationCompletion++;
    }
  }
  
  // نسبة نجاح التركيب = (التركيب المكتمل) / (إجمالي فواتير التركيب الرئيسية)
  // المجهزة مسبقاً تعتبر ناجحة لكن لا تحسب في نسبة "التركيب"
  const installationOnly = totalMainInvoices - preEquipped;
  const installationSuccessRate = installationOnly > 0 
    ? (completedInstallation / installationOnly) * 100 
    : 100;
  
  const installationCompensationRate = totalMainInvoices > 0 
    ? (installationCompletion / totalMainInvoices) * 100 
    : 0;
  
  return {
    totalMainInvoices,
    completedInstallation,
    preEquipped,
    installationCompletion,
    installationSuccessRate,
    installationCompensationRate,
    subTickets: {
      total: subInstallation + subInstallationCompletion,
      installation: subInstallation,
      installationCompletion: subInstallationCompletion
    }
  };
}

/**
 * حساب عدد الزبائن الفريدين
 */
function countUniqueCustomers(
  data: Record<string, unknown>[],
  cols: RecognizedColumns
): number {
  const customerCol = cols.customer;
  if (!customerCol) return 0;
  
  const uniqueCustomers = new Set<string>();
  
  for (const row of data) {
    const customer = String(row[customerCol] || '').trim();
    if (customer) {
      uniqueCustomers.add(customer.toLowerCase());
    }
  }
  
  return uniqueCustomers.size;
}

/**
 * تحليل Stage
 */
export interface StageAnalysis {
  stages: StageCount[];
  completedCount: number;
  newCount: number;
  inProgressCount: number;
  problemCount: number;
}

export interface StageCount {
  stage: string;
  count: number;
  percentage: number;
}

export function analyzeStages(
  report: AnalysisReport,
  recognition: DataRecognitionResult
): StageAnalysis {
  const { rawData } = report;
  const stageCol = recognition.recognizedColumns.stage;
  
  if (!stageCol) {
    return {
      stages: [],
      completedCount: 0,
      newCount: 0,
      inProgressCount: 0,
      problemCount: 0
    };
  }
  
  const stageCounts: Record<string, number> = {};
  let completedCount = 0;
  let newCount = 0;
  let inProgressCount = 0;
  let problemCount = 0;
  
  for (const row of rawData) {
    const stage = String(row[stageCol] || '').trim();
    if (!stage) continue;
    
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    
    const lower = stage.toLowerCase();
    if (lower.includes('منجز') || lower.includes('completed') || lower.includes('تم')) {
      completedCount++;
    } else if (lower.includes('جديد') || lower.includes('new')) {
      newCount++;
    } else if (lower.includes('قيد') || lower.includes('progress') || lower.includes('انتظار')) {
      inProgressCount++;
    } else if (lower.includes('مشكلة') || lower.includes('problem') || lower.includes('cancelled')) {
      problemCount++;
    }
  }
  
  const total = rawData.length;
  const stages: StageCount[] = Object.entries(stageCounts)
    .map(([stage, count]) => ({
      stage,
      count,
      percentage: (count / total) * 100
    }))
    .sort((a, b) => b.count - a.count);
  
  return {
    stages,
    completedCount,
    newCount,
    inProgressCount,
    problemCount
  };
}

/**
 * حساب KPIs عامة لأي نوع بيانات
 */
export function calculateGeneralKPIs(report: AnalysisReport): KPI[] {
  const { summary, columns } = report;
  const kpis: KPI[] = [];
  
  kpis.push({
    id: 'total_records',
    label: 'إجمالي السجلات',
    value: summary.rowCount,
    color: 'blue'
  });
  
  kpis.push({
    id: 'total_columns',
    label: 'عدد الأعمدة',
    value: summary.columnCount,
    color: 'blue'
  });
  
  // إضافة إحصائيات للأعمدة الرقمية
  const numericCols = columns.filter(c => c.numericStats);
  for (const col of numericCols.slice(0, 3)) {
    if (col.numericStats) {
      kpis.push({
        id: `sum_${col.name}`,
        label: `مجموع ${col.name}`,
        value: col.numericStats.sum.toLocaleString('ar-IQ'),
        color: 'green'
      });
    }
  }
  
  return kpis;
}
