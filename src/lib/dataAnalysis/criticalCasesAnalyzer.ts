/**
 * محلل الحالات الحرجة
 * يكتشف التكملات والحالات المشكلة والزبائن المتكررين
 */

import type { AnalysisReport } from './types';
import type { DataRecognitionResult, RecognizedColumns } from './dataRecognizer';

// حالة حرجة
export interface CriticalCase {
  id: string;
  type: 'delivery_completion' | 'installation_completion' | 'problem' | 'pending' | 'repeated_customer';
  severity: 'high' | 'medium' | 'low';
  customer: string;
  employee?: string;
  supervisor?: string;
  stage: string;
  description: string;
  ticketId?: string;
  recommendation: string;
}

// ملخص الحالات الحرجة
export interface CriticalCasesSummary {
  totalCriticalCases: number;
  deliveryCompletions: CriticalCase[];
  installationCompletions: CriticalCase[];
  problemCases: CriticalCase[];
  pendingCases: CriticalCase[];
  repeatedCustomerCases: CriticalCase[];
  criticalNotes: CriticalNote[];
}

// ملاحظة حرجة
export interface CriticalNote {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  affectedCustomers: string[];
  recommendation: string;
}

/**
 * تحليل الحالات الحرجة
 */
export function analyzeCriticalCases(
  report: AnalysisReport,
  recognition: DataRecognitionResult
): CriticalCasesSummary {
  const { rawData } = report;
  const cols = recognition.recognizedColumns;
  
  const deliveryCompletions: CriticalCase[] = [];
  const installationCompletions: CriticalCase[] = [];
  const problemCases: CriticalCase[] = [];
  const pendingCases: CriticalCase[] = [];
  
  // تتبع الزبائن المتكررين
  const customerCompletions = new Map<string, number>();
  const customerCases = new Map<string, CriticalCase[]>();
  
  let caseId = 0;
  
  for (const row of rawData) {
    const opType = cols.operationType ? String(row[cols.operationType] || '').trim() : '';
    const stage = cols.stage ? String(row[cols.stage] || '').trim() : '';
    const customer = cols.customer ? String(row[cols.customer] || '').trim() : '';
    const employee = cols.employee ? String(row[cols.employee] || '').trim() : '';
    const supervisor = cols.supervisor ? String(row[cols.supervisor] || '').trim() : '';
    const ticketId = cols.ticketId ? String(row[cols.ticketId] || '').trim() : '';
    
    const lowerOpType = opType.toLowerCase();
    const lowerStage = stage.toLowerCase();
    
    // تكملة تجهيز
    if (lowerOpType.includes('تكملة') && lowerOpType.includes('تجهيز') || 
        (lowerOpType.includes('delivery') && lowerOpType.includes('completion'))) {
      
      const criticalCase: CriticalCase = {
        id: `dc-${++caseId}`,
        type: 'delivery_completion',
        severity: 'medium',
        customer,
        employee,
        supervisor,
        stage,
        description: `تكملة تجهيز - ${opType}`,
        ticketId,
        recommendation: 'متابعة لإكمال التجهيز'
      };
      
      deliveryCompletions.push(criticalCase);
      trackCustomer(customerCompletions, customerCases, customer, criticalCase);
    }
    
    // تكملة تركيب
    if (lowerOpType.includes('تكملة') && lowerOpType.includes('تركيب') || 
        (lowerOpType.includes('installation') && lowerOpType.includes('completion'))) {
      
      const criticalCase: CriticalCase = {
        id: `ic-${++caseId}`,
        type: 'installation_completion',
        severity: 'medium',
        customer,
        employee,
        supervisor,
        stage,
        description: `تكملة تركيب - ${opType}`,
        ticketId,
        recommendation: 'متابعة لإكمال التركيب'
      };
      
      installationCompletions.push(criticalCase);
      trackCustomer(customerCompletions, customerCases, customer, criticalCase);
    }
    
    // حالات المشاكل
    if (lowerStage.includes('مشكلة') || lowerStage.includes('problem') || lowerStage.includes('يوجد مشكلة')) {
      const criticalCase: CriticalCase = {
        id: `pr-${++caseId}`,
        type: 'problem',
        severity: 'high',
        customer,
        employee,
        supervisor,
        stage,
        description: `يوجد مشكلة - ${stage}`,
        ticketId,
        recommendation: 'يحتاج معالجة عاجلة'
      };
      
      problemCases.push(criticalCase);
      trackCustomer(customerCompletions, customerCases, customer, criticalCase);
    }
    
    // حالات معلقة (جديد، بانتظار الموافقة، قيد العمل)
    if (lowerStage.includes('جديد') || lowerStage.includes('new') ||
        lowerStage.includes('انتظار') || lowerStage.includes('pending') ||
        lowerStage.includes('قيد العمل') || lowerStage.includes('in progress')) {
      
      // فقط للتكملات
      if (lowerOpType.includes('تكملة') || lowerOpType.includes('completion')) {
        const criticalCase: CriticalCase = {
          id: `pn-${++caseId}`,
          type: 'pending',
          severity: 'medium',
          customer,
          employee,
          supervisor,
          stage,
          description: `معلق - ${stage}`,
          ticketId,
          recommendation: 'يحتاج متابعة للبدء بالمعالجة'
        };
        
        pendingCases.push(criticalCase);
      }
    }
  }
  
  // تحديد الزبائن المتكررين
  const repeatedCustomerCases: CriticalCase[] = [];
  for (const [customer, count] of customerCompletions) {
    if (count >= 2) {
      const cases = customerCases.get(customer) || [];
      repeatedCustomerCases.push({
        id: `rc-${++caseId}`,
        type: 'repeated_customer',
        severity: count >= 4 ? 'high' : 'medium',
        customer,
        stage: `${count} حالات`,
        description: `زبون متكرر في ${count} حالات: ${cases.map(c => c.type === 'delivery_completion' ? 'تكملة تجهيز' : 'تكملة تركيب').join(', ')}`,
        recommendation: `يحتاج متابعة مكثفة - ${count >= 4 ? 'أولوية عالية' : 'أولوية متوسطة'}`
      });
    }
  }
  
  // توليد الملاحظات الحرجة
  const criticalNotes = generateCriticalNotes(
    deliveryCompletions,
    installationCompletions,
    problemCases,
    repeatedCustomerCases
  );
  
  return {
    totalCriticalCases: deliveryCompletions.length + installationCompletions.length + problemCases.length,
    deliveryCompletions,
    installationCompletions,
    problemCases,
    pendingCases,
    repeatedCustomerCases,
    criticalNotes
  };
}

/**
 * تتبع الزبون
 */
function trackCustomer(
  completions: Map<string, number>,
  cases: Map<string, CriticalCase[]>,
  customer: string,
  criticalCase: CriticalCase
): void {
  if (!customer) return;
  
  completions.set(customer, (completions.get(customer) || 0) + 1);
  
  if (!cases.has(customer)) {
    cases.set(customer, []);
  }
  cases.get(customer)!.push(criticalCase);
}

/**
 * توليد الملاحظات الحرجة
 */
function generateCriticalNotes(
  deliveryCompletions: CriticalCase[],
  installationCompletions: CriticalCase[],
  problemCases: CriticalCase[],
  repeatedCustomerCases: CriticalCase[]
): CriticalNote[] {
  const notes: CriticalNote[] = [];
  
  // ملاحظة عن الزبائن المتكررين
  if (repeatedCustomerCases.length > 0) {
    const highPriority = repeatedCustomerCases.filter(c => c.severity === 'high');
    const affectedCustomers = repeatedCustomerCases.map(c => c.customer);
    
    notes.push({
      title: 'زبائن متكررون في التكملات',
      description: highPriority.length > 0
        ? `${highPriority.length} زبون يظهر في 4 حالات أو أكثر. ${affectedCustomers[0]} يحتاج متابعة مكثفة.`
        : `${repeatedCustomerCases.length} زبون يظهر في حالات تكملة متعددة.`,
      severity: highPriority.length > 0 ? 'high' : 'medium',
      affectedCustomers,
      recommendation: 'مراجعة سبب التكرار لتجنب المشاكل المستقبلية'
    });
  }
  
  // ملاحظة عن تكملات التجهيز
  if (deliveryCompletions.length > 0) {
    const newStage = deliveryCompletions.filter(c => c.stage.includes('جديد') || c.stage.includes('new'));
    
    notes.push({
      title: `تكملة التجهيز (${deliveryCompletions.length} تكت فرعي)`,
      description: newStage.length > 0
        ? `${newStage.length} منها في Stage "جديد" - لم تبدأ المعالجة بعد`
        : `${deliveryCompletions.length} حالة تكملة تجهيز`,
      severity: deliveryCompletions.length >= 10 ? 'high' : 'medium',
      affectedCustomers: [...new Set(deliveryCompletions.map(c => c.customer).filter(Boolean))],
      recommendation: 'تحديد جدول زمني للإنجاز'
    });
  }
  
  // ملاحظة عن تكملات التركيب
  if (installationCompletions.length > 0) {
    const newStage = installationCompletions.filter(c => c.stage.includes('جديد') || c.stage.includes('new'));
    
    notes.push({
      title: `تكملة التركيب (${installationCompletions.length} تكت فرعي)`,
      description: newStage.length > 0
        ? `${newStage.length} منها في Stage "جديد" - لم تبدأ المعالجة بعد`
        : `${installationCompletions.length} حالة تكملة تركيب`,
      severity: installationCompletions.length >= 10 ? 'high' : 'medium',
      affectedCustomers: [...new Set(installationCompletions.map(c => c.customer).filter(Boolean))],
      recommendation: 'تحديد جدول زمني للإنجاز'
    });
  }
  
  // ملاحظة عن المشاكل
  if (problemCases.length > 0) {
    notes.push({
      title: `حالات مشاكل (${problemCases.length})`,
      description: `${problemCases.length} حالة تحتاج معالجة عاجلة`,
      severity: 'high',
      affectedCustomers: [...new Set(problemCases.map(c => c.customer).filter(Boolean))],
      recommendation: 'معالجة فورية للمشاكل المعلقة'
    });
  }
  
  return notes.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

/**
 * الحصول على ملخص سريع للحالات الحرجة
 */
export interface QuickCriticalSummary {
  totalCompletions: number;
  deliveryCompletionCount: number;
  installationCompletionCount: number;
  problemCount: number;
  repeatedCustomersCount: number;
  needsUrgentAttention: boolean;
  summary: string;
}

export function getQuickCriticalSummary(
  criticalCases: CriticalCasesSummary
): QuickCriticalSummary {
  const totalCompletions = criticalCases.deliveryCompletions.length + criticalCases.installationCompletions.length;
  const needsUrgentAttention = criticalCases.problemCases.length > 0 || 
                               criticalCases.repeatedCustomerCases.some(c => c.severity === 'high');
  
  let summary = '';
  if (totalCompletions === 0 && criticalCases.problemCases.length === 0) {
    summary = 'لا توجد حالات حرجة - الأداء ممتاز';
  } else {
    const parts: string[] = [];
    if (totalCompletions > 0) {
      parts.push(`${totalCompletions} تكت تكملة`);
    }
    if (criticalCases.problemCases.length > 0) {
      parts.push(`${criticalCases.problemCases.length} مشكلة`);
    }
    if (criticalCases.repeatedCustomerCases.length > 0) {
      parts.push(`${criticalCases.repeatedCustomerCases.length} زبون متكرر`);
    }
    summary = `يحتاج متابعة: ${parts.join('، ')}`;
  }
  
  return {
    totalCompletions,
    deliveryCompletionCount: criticalCases.deliveryCompletions.length,
    installationCompletionCount: criticalCases.installationCompletions.length,
    problemCount: criticalCases.problemCases.length,
    repeatedCustomersCount: criticalCases.repeatedCustomerCases.length,
    needsUrgentAttention,
    summary
  };
}

/**
 * تجميع الحالات الحرجة حسب الموظف
 */
export interface EmployeeCriticalCases {
  employee: string;
  totalCases: number;
  deliveryCompletions: number;
  installationCompletions: number;
  problems: number;
}

export function groupCriticalCasesByEmployee(
  criticalCases: CriticalCasesSummary
): EmployeeCriticalCases[] {
  const employeeMap = new Map<string, EmployeeCriticalCases>();
  
  const allCases = [
    ...criticalCases.deliveryCompletions,
    ...criticalCases.installationCompletions,
    ...criticalCases.problemCases
  ];
  
  for (const criticalCase of allCases) {
    const employee = criticalCase.employee || 'غير محدد';
    
    if (!employeeMap.has(employee)) {
      employeeMap.set(employee, {
        employee,
        totalCases: 0,
        deliveryCompletions: 0,
        installationCompletions: 0,
        problems: 0
      });
    }
    
    const emp = employeeMap.get(employee)!;
    emp.totalCases++;
    
    if (criticalCase.type === 'delivery_completion') emp.deliveryCompletions++;
    else if (criticalCase.type === 'installation_completion') emp.installationCompletions++;
    else if (criticalCase.type === 'problem') emp.problems++;
  }
  
  return Array.from(employeeMap.values())
    .filter(e => e.totalCases > 0)
    .sort((a, b) => b.totalCases - a.totalCases);
}
