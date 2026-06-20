/**
 * محلل العلاقات والرحلات
 * يحلل رحلة الزبون والعلاقات بين التجهيز والتركيب
 */

import type { AnalysisReport } from './types';
import type { DataRecognitionResult, RecognizedColumns } from './dataRecognizer';

// رحلة الزبون
export interface CustomerJourney {
  totalCustomers: number;
  customersWithDelivery: number;
  customersWithInstallation: number;
  customersWithBoth: number;
  customersDeliveryOnly: number;
  customersInstallationOnly: number;  // مجهزة مسبقاً فقط
  customerDetails: CustomerDetail[];
}

// تفاصيل الزبون
export interface CustomerDetail {
  name: string;
  hasDelivery: boolean;
  hasInstallation: boolean;
  deliveryCount: number;
  installationCount: number;
  completionCount: number;  // تكملات
  stages: string[];
  isProblematic: boolean;
  problems: string[];
}

// علاقة بين عمليتين
export interface OperationRelationship {
  customer: string;
  deliveryDate?: string;
  installationDate?: string;
  daysBetween?: number;
  status: 'complete' | 'pending_installation' | 'pending_delivery' | 'problematic';
}

/**
 * تحليل رحلة الزبون
 */
export function analyzeCustomerJourney(
  report: AnalysisReport,
  recognition: DataRecognitionResult
): CustomerJourney {
  const { rawData } = report;
  const cols = recognition.recognizedColumns;
  const customerCol = cols.customer;
  const opTypeCol = cols.operationType;
  const stageCol = cols.stage;
  
  if (!customerCol || !opTypeCol) {
    return {
      totalCustomers: 0,
      customersWithDelivery: 0,
      customersWithInstallation: 0,
      customersWithBoth: 0,
      customersDeliveryOnly: 0,
      customersInstallationOnly: 0,
      customerDetails: []
    };
  }
  
  // تجميع بيانات كل زبون
  const customerMap = new Map<string, CustomerDetail>();
  
  for (const row of rawData) {
    const customerName = String(row[customerCol] || '').trim();
    if (!customerName) continue;
    
    const opType = String(row[opTypeCol] || '').toLowerCase().trim();
    const stage = stageCol ? String(row[stageCol] || '').trim() : '';
    
    if (!customerMap.has(customerName)) {
      customerMap.set(customerName, {
        name: customerName,
        hasDelivery: false,
        hasInstallation: false,
        deliveryCount: 0,
        installationCount: 0,
        completionCount: 0,
        stages: [],
        isProblematic: false,
        problems: []
      });
    }
    
    const customer = customerMap.get(customerName)!;
    
    // تحديد نوع العملية
    const isMainDelivery = (opType.includes('delivery') && opType.includes('s')) || opType === 'تجهيز';
    const isMainInstallation = (opType.includes('installation') && opType.includes('s')) || 
                               opType === 'تركيب' || 
                               opType.includes('مجهزة مسبقاً');
    const isCompletion = opType.includes('تكملة') || opType.includes('completion');
    
    if (isMainDelivery) {
      customer.hasDelivery = true;
      customer.deliveryCount++;
    }
    
    if (isMainInstallation) {
      customer.hasInstallation = true;
      customer.installationCount++;
    }
    
    if (isCompletion) {
      customer.completionCount++;
    }
    
    if (stage && !customer.stages.includes(stage)) {
      customer.stages.push(stage);
    }
    
    // التحقق من المشاكل
    const lowerStage = stage.toLowerCase();
    if (lowerStage.includes('مشكلة') || lowerStage.includes('problem') || lowerStage.includes('cancelled')) {
      customer.isProblematic = true;
      customer.problems.push(stage);
    }
    
    if (customer.completionCount >= 2) {
      customer.isProblematic = true;
      customer.problems.push('تكملات متعددة');
    }
  }
  
  // حساب الإحصائيات
  const customers = Array.from(customerMap.values());
  const totalCustomers = customers.length;
  const customersWithDelivery = customers.filter(c => c.hasDelivery).length;
  const customersWithInstallation = customers.filter(c => c.hasInstallation).length;
  const customersWithBoth = customers.filter(c => c.hasDelivery && c.hasInstallation).length;
  const customersDeliveryOnly = customers.filter(c => c.hasDelivery && !c.hasInstallation).length;
  const customersInstallationOnly = customers.filter(c => !c.hasDelivery && c.hasInstallation).length;
  
  return {
    totalCustomers,
    customersWithDelivery,
    customersWithInstallation,
    customersWithBoth,
    customersDeliveryOnly,
    customersInstallationOnly,
    customerDetails: customers.sort((a, b) => {
      // الزبائن المشكلين أولاً
      if (a.isProblematic !== b.isProblematic) return a.isProblematic ? -1 : 1;
      // ثم حسب عدد التكملات
      if (a.completionCount !== b.completionCount) return b.completionCount - a.completionCount;
      // ثم أبجدياً
      return a.name.localeCompare(b.name, 'ar');
    })
  };
}

/**
 * اكتشاف الزبائن المتكررين في المشاكل
 */
export interface ProblematicCustomer {
  name: string;
  issueCount: number;
  issues: string[];
  recommendation: string;
}

export function findProblematicCustomers(
  report: AnalysisReport,
  recognition: DataRecognitionResult
): ProblematicCustomer[] {
  const journey = analyzeCustomerJourney(report, recognition);
  
  return journey.customerDetails
    .filter(c => c.isProblematic || c.completionCount >= 2)
    .map(c => ({
      name: c.name,
      issueCount: c.completionCount + c.problems.length,
      issues: [...new Set([...c.problems, c.completionCount >= 2 ? `${c.completionCount} تكملات` : ''].filter(Boolean))],
      recommendation: generateCustomerRecommendation(c)
    }))
    .sort((a, b) => b.issueCount - a.issueCount);
}

/**
 * توليد توصية للزبون
 */
function generateCustomerRecommendation(customer: CustomerDetail): string {
  if (customer.completionCount >= 3) {
    return 'يحتاج متابعة مكثفة - تكملات متعددة تشير إلى مشكلة متكررة';
  }
  if (customer.completionCount >= 2) {
    return 'يحتاج مراجعة لتحديد سبب التكرار';
  }
  if (customer.problems.some(p => p.includes('مشكلة'))) {
    return 'يحتاج متابعة عاجلة لحل المشكلة';
  }
  return 'متابعة عادية';
}

/**
 * تحليل العلاقة بين التجهيز والتركيب
 */
export interface DeliveryInstallationRelation {
  customersWithCompleteJourney: number;
  customersWaitingInstallation: number;
  averageDaysBetween: number;
  relations: OperationRelationship[];
}

export function analyzeDeliveryInstallationRelation(
  report: AnalysisReport,
  recognition: DataRecognitionResult
): DeliveryInstallationRelation {
  const { rawData } = report;
  const cols = recognition.recognizedColumns;
  const customerCol = cols.customer;
  const opTypeCol = cols.operationType;
  const dateCol = cols.date;
  
  if (!customerCol || !opTypeCol) {
    return {
      customersWithCompleteJourney: 0,
      customersWaitingInstallation: 0,
      averageDaysBetween: 0,
      relations: []
    };
  }
  
  // تجميع العمليات حسب الزبون
  const customerOperations = new Map<string, { deliveries: Date[]; installations: Date[] }>();
  
  for (const row of rawData) {
    const customerName = String(row[customerCol] || '').trim();
    if (!customerName) continue;
    
    const opType = String(row[opTypeCol] || '').toLowerCase().trim();
    const dateStr = dateCol ? String(row[dateCol] || '') : '';
    const date = dateStr ? new Date(dateStr) : null;
    
    if (!customerOperations.has(customerName)) {
      customerOperations.set(customerName, { deliveries: [], installations: [] });
    }
    
    const ops = customerOperations.get(customerName)!;
    
    const isDelivery = (opType.includes('delivery') && opType.includes('s')) || opType === 'تجهيز';
    const isInstallation = (opType.includes('installation') && opType.includes('s')) || 
                           opType === 'تركيب' || 
                           opType.includes('مجهزة مسبقاً');
    
    if (isDelivery && date && !isNaN(date.getTime())) {
      ops.deliveries.push(date);
    }
    if (isInstallation && date && !isNaN(date.getTime())) {
      ops.installations.push(date);
    }
  }
  
  // تحليل العلاقات
  const relations: OperationRelationship[] = [];
  let totalDays = 0;
  let daysCount = 0;
  let completeJourney = 0;
  let waitingInstallation = 0;
  
  for (const [customer, ops] of customerOperations) {
    const hasDelivery = ops.deliveries.length > 0;
    const hasInstallation = ops.installations.length > 0;
    
    if (hasDelivery && hasInstallation) {
      completeJourney++;
      
      // حساب الفرق بالأيام
      const firstDelivery = new Date(Math.min(...ops.deliveries.map(d => d.getTime())));
      const firstInstallation = new Date(Math.min(...ops.installations.map(d => d.getTime())));
      const daysDiff = Math.ceil((firstInstallation.getTime() - firstDelivery.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff >= 0) {
        totalDays += daysDiff;
        daysCount++;
      }
      
      relations.push({
        customer,
        deliveryDate: firstDelivery.toLocaleDateString('ar-IQ'),
        installationDate: firstInstallation.toLocaleDateString('ar-IQ'),
        daysBetween: daysDiff,
        status: 'complete'
      });
    } else if (hasDelivery && !hasInstallation) {
      waitingInstallation++;
      relations.push({
        customer,
        deliveryDate: ops.deliveries[0]?.toLocaleDateString('ar-IQ'),
        status: 'pending_installation'
      });
    } else if (!hasDelivery && hasInstallation) {
      // مجهزة مسبقاً
      relations.push({
        customer,
        installationDate: ops.installations[0]?.toLocaleDateString('ar-IQ'),
        status: 'pending_delivery'
      });
    }
  }
  
  return {
    customersWithCompleteJourney: completeJourney,
    customersWaitingInstallation: waitingInstallation,
    averageDaysBetween: daysCount > 0 ? totalDays / daysCount : 0,
    relations: relations.sort((a, b) => {
      const statusOrder = { 'problematic': 0, 'pending_installation': 1, 'pending_delivery': 2, 'complete': 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    })
  };
}

/**
 * ملخص العلاقات
 */
export interface RelationshipSummary {
  journey: CustomerJourney;
  problematicCustomers: ProblematicCustomer[];
  deliveryInstallationRelation: DeliveryInstallationRelation;
  insights: string[];
}

export function analyzeRelationships(
  report: AnalysisReport,
  recognition: DataRecognitionResult
): RelationshipSummary {
  const journey = analyzeCustomerJourney(report, recognition);
  const problematicCustomers = findProblematicCustomers(report, recognition);
  const deliveryInstallationRelation = analyzeDeliveryInstallationRelation(report, recognition);
  
  // توليد رؤى
  const insights: string[] = [];
  
  if (journey.customersWithBoth > 0) {
    const bothPercentage = (journey.customersWithBoth / journey.totalCustomers * 100).toFixed(1);
    insights.push(`${bothPercentage}% من الزبائن لديهم تجهيز وتركيب معاً`);
  }
  
  if (journey.customersDeliveryOnly > 0) {
    insights.push(`${journey.customersDeliveryOnly} زبون لديهم تجهيز فقط (بانتظار التركيب)`);
  }
  
  if (journey.customersInstallationOnly > 0) {
    insights.push(`${journey.customersInstallationOnly} زبون لديهم تركيب فقط (مجهزة مسبقاً)`);
  }
  
  if (problematicCustomers.length > 0) {
    insights.push(`${problematicCustomers.length} زبون يحتاجون متابعة خاصة`);
  }
  
  if (deliveryInstallationRelation.averageDaysBetween > 0) {
    insights.push(`متوسط الفترة بين التجهيز والتركيب: ${deliveryInstallationRelation.averageDaysBetween.toFixed(1)} يوم`);
  }
  
  return {
    journey,
    problematicCustomers,
    deliveryInstallationRelation,
    insights
  };
}
