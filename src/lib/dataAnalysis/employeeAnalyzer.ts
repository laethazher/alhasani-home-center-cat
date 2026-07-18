/**
 * محلل أداء الموظفين والمشرفين
 * يحلل أداء الفريق ويحدد Top 10
 */

import type { AnalysisReport } from './types';
import type { DataRecognitionResult, RecognizedColumns } from './dataRecognizer';

// أداء الموظف
export interface EmployeePerformance {
  name: string;
  totalOperations: number;
  deliveryCount: number;
  installationCount: number;
  problemCount: number;
  completionCount: number;  // تكملات
  successRate: number;
  rank: number;
}

// أداء المشرف
export interface SupervisorPerformance {
  name: string;
  deliveryInvoices: number;
  deliverySuccessRate: number;
  installationInvoices: number;
  installationSuccessRate: number;
  totalTeamMembers: number;
  teamMembers: string[];
  problems: number;
}

// ملخص أداء الفريق
export interface TeamPerformanceSummary {
  totalEmployees: number;
  totalSupervisors: number;
  topEmployees: EmployeePerformance[];
  allEmployees: EmployeePerformance[];
  supervisorPerformance: SupervisorPerformance[];
  insights: string[];
}

/**
 * تحليل أداء الموظفين
 */
export function analyzeEmployeePerformance(
  report: AnalysisReport,
  recognition: DataRecognitionResult
): TeamPerformanceSummary {
  const { rawData } = report;
  const cols = recognition.recognizedColumns;
  
  // تحليل الموظفين
  const employeeMap = new Map<string, EmployeePerformance>();
  
  // تحليل المشرفين
  const supervisorMap = new Map<string, SupervisorPerformance>();
  const supervisorTeams = new Map<string, Set<string>>();
  
  for (const row of rawData) {
    const employee = cols.employee ? String(row[cols.employee] || '').trim() : '';
    const supervisor = cols.supervisor ? String(row[cols.supervisor] || '').trim() : '';
    const opType = cols.operationType ? String(row[cols.operationType] || '').toLowerCase().trim() : '';
    const stage = cols.stage ? String(row[cols.stage] || '').toLowerCase().trim() : '';
    
    // تحليل الموظف
    if (employee) {
      if (!employeeMap.has(employee)) {
        employeeMap.set(employee, {
          name: employee,
          totalOperations: 0,
          deliveryCount: 0,
          installationCount: 0,
          problemCount: 0,
          completionCount: 0,
          successRate: 0,
          rank: 0
        });
      }
      
      const emp = employeeMap.get(employee)!;
      emp.totalOperations++;
      
      // تصنيف العملية
      if (opType.includes('تجهيز') || opType.includes('delivery')) {
        emp.deliveryCount++;
      }
      if (opType.includes('تركيب') || opType.includes('installation') || opType.includes('مجهزة')) {
        emp.installationCount++;
      }
      if (opType.includes('تكملة') || opType.includes('completion')) {
        emp.completionCount++;
      }
      if (stage.includes('مشكلة') || stage.includes('problem')) {
        emp.problemCount++;
      }
    }
    
    // تحليل المشرف
    if (supervisor) {
      if (!supervisorMap.has(supervisor)) {
        supervisorMap.set(supervisor, {
          name: supervisor,
          deliveryInvoices: 0,
          deliverySuccessRate: 100,
          installationInvoices: 0,
          installationSuccessRate: 100,
          totalTeamMembers: 0,
          teamMembers: [],
          problems: 0
        });
        supervisorTeams.set(supervisor, new Set());
      }
      
      const sup = supervisorMap.get(supervisor)!;
      const team = supervisorTeams.get(supervisor)!;
      
      // إضافة عضو الفريق
      if (employee && !team.has(employee)) {
        team.add(employee);
      }
      
      // تصنيف الفواتير الرئيسية فقط
      const isMainDelivery = (opType.includes('delivery') && opType.includes('s')) || opType === 'تجهيز';
      const isMainInstallation = (opType.includes('installation') && opType.includes('s')) || 
                                  opType === 'تركيب' || 
                                  opType.includes('مجهزة مسبقاً');
      
      if (isMainDelivery) {
        sup.deliveryInvoices++;
      }
      if (isMainInstallation) {
        sup.installationInvoices++;
      }
      if (stage.includes('مشكلة') || stage.includes('problem')) {
        sup.problems++;
      }
    }
  }
  
  // حساب نسب النجاح للموظفين
  for (const emp of employeeMap.values()) {
    const successfulOps = emp.totalOperations - emp.problemCount - emp.completionCount;
    emp.successRate = emp.totalOperations > 0 
      ? (successfulOps / emp.totalOperations) * 100 
      : 100;
  }
  
  // تحديث بيانات المشرفين
  for (const [supervisor, team] of supervisorTeams) {
    const sup = supervisorMap.get(supervisor)!;
    sup.totalTeamMembers = team.size;
    sup.teamMembers = Array.from(team);
    
    // حساب نسب النجاح
    if (sup.deliveryInvoices > 0) {
      sup.deliverySuccessRate = 100; // افتراضياً ناجح ما لم يكن هناك تكملات
    }
    if (sup.installationInvoices > 0) {
      const successfulInstallations = sup.installationInvoices - sup.problems;
      sup.installationSuccessRate = (successfulInstallations / sup.installationInvoices) * 100;
    }
  }
  
  // ترتيب الموظفين حسب إجمالي العمليات
  const allEmployees = Array.from(employeeMap.values())
    .sort((a, b) => b.totalOperations - a.totalOperations);
  
  // تعيين الترتيب
  allEmployees.forEach((emp, index) => {
    emp.rank = index + 1;
  });
  
  // Top 10
  const topEmployees = allEmployees.slice(0, 10);
  
  // ترتيب المشرفين
  const supervisorPerformance = Array.from(supervisorMap.values())
    .sort((a, b) => (a.deliveryInvoices + a.installationInvoices) - (b.deliveryInvoices + b.installationInvoices))
    .reverse();
  
  // توليد رؤى
  const insights = generateTeamInsights(allEmployees, supervisorPerformance);
  
  return {
    totalEmployees: allEmployees.length,
    totalSupervisors: supervisorPerformance.length,
    topEmployees,
    allEmployees,
    supervisorPerformance,
    insights
  };
}

/**
 * توليد رؤى عن الفريق
 */
function generateTeamInsights(
  employees: EmployeePerformance[],
  supervisors: SupervisorPerformance[]
): string[] {
  const insights: string[] = [];
  
  if (employees.length > 0) {
    const topEmployee = employees[0];
    insights.push(`أعلى موظف: ${topEmployee.name} بـ ${topEmployee.totalOperations} عملية`);
    
    const avgOperations = employees.reduce((sum, e) => sum + e.totalOperations, 0) / employees.length;
    insights.push(`متوسط العمليات للموظف: ${avgOperations.toFixed(1)}`);
    
    const problemEmployees = employees.filter(e => e.problemCount > 0);
    if (problemEmployees.length > 0) {
      insights.push(`${problemEmployees.length} موظف لديهم حالات مشاكل`);
    }
  }
  
  if (supervisors.length > 0) {
    const avgSuccess = supervisors.reduce((sum, s) => sum + s.installationSuccessRate, 0) / supervisors.length;
    insights.push(`متوسط نجاح التركيب للمشرفين: ${avgSuccess.toFixed(1)}%`);
    
    const highPerformers = supervisors.filter(s => s.installationSuccessRate >= 95);
    if (highPerformers.length > 0) {
      insights.push(`${highPerformers.length} مشرف بنسبة نجاح تركيب 95%+`);
    }
  }
  
  return insights;
}

/**
 * الحصول على أداء موظف معين
 */
export function getEmployeeDetails(
  report: AnalysisReport,
  recognition: DataRecognitionResult,
  employeeName: string
): EmployeePerformance | null {
  const summary = analyzeEmployeePerformance(report, recognition);
  return summary.allEmployees.find(e => e.name === employeeName) || null;
}

/**
 * الحصول على أداء مشرف معين
 */
export function getSupervisorDetails(
  report: AnalysisReport,
  recognition: DataRecognitionResult,
  supervisorName: string
): SupervisorPerformance | null {
  const summary = analyzeEmployeePerformance(report, recognition);
  return summary.supervisorPerformance.find(s => s.name === supervisorName) || null;
}

/**
 * مقارنة أداء الموظفين
 */
export interface EmployeeComparison {
  employee1: EmployeePerformance;
  employee2: EmployeePerformance;
  operationsDiff: number;
  successRateDiff: number;
  winner: string;
}

export function compareEmployees(
  report: AnalysisReport,
  recognition: DataRecognitionResult,
  employee1Name: string,
  employee2Name: string
): EmployeeComparison | null {
  const summary = analyzeEmployeePerformance(report, recognition);
  
  const emp1 = summary.allEmployees.find(e => e.name === employee1Name);
  const emp2 = summary.allEmployees.find(e => e.name === employee2Name);
  
  if (!emp1 || !emp2) return null;
  
  return {
    employee1: emp1,
    employee2: emp2,
    operationsDiff: emp1.totalOperations - emp2.totalOperations,
    successRateDiff: emp1.successRate - emp2.successRate,
    winner: emp1.totalOperations > emp2.totalOperations ? emp1.name : emp2.name
  };
}

/**
 * تحليل توزيع العمل
 */
export interface WorkDistribution {
  balanced: boolean;
  maxOperations: number;
  minOperations: number;
  standardDeviation: number;
  overloadedEmployees: string[];
  underutilizedEmployees: string[];
}

export function analyzeWorkDistribution(
  report: AnalysisReport,
  recognition: DataRecognitionResult
): WorkDistribution {
  const summary = analyzeEmployeePerformance(report, recognition);
  const employees = summary.allEmployees;
  
  if (employees.length === 0) {
    return {
      balanced: true,
      maxOperations: 0,
      minOperations: 0,
      standardDeviation: 0,
      overloadedEmployees: [],
      underutilizedEmployees: []
    };
  }
  
  const operations = employees.map(e => e.totalOperations);
  const max = Math.max(...operations);
  const min = Math.min(...operations);
  const avg = operations.reduce((a, b) => a + b, 0) / operations.length;
  
  // حساب الانحراف المعياري
  const squaredDiffs = operations.map(op => Math.pow(op - avg, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
  const stdDev = Math.sqrt(avgSquaredDiff);
  
  // تحديد الموظفين المحملين بزيادة أو أقل
  const threshold = avg + stdDev;
  const lowThreshold = avg - stdDev;
  
  const overloaded = employees.filter(e => e.totalOperations > threshold).map(e => e.name);
  const underutilized = employees.filter(e => e.totalOperations < lowThreshold && e.totalOperations > 0).map(e => e.name);
  
  return {
    balanced: stdDev / avg < 0.5, // متوازن إذا كان الانحراف أقل من 50% من المتوسط
    maxOperations: max,
    minOperations: min,
    standardDeviation: stdDev,
    overloadedEmployees: overloaded,
    underutilizedEmployees: underutilized
  };
}

/**
 * الموظفون المتسببون بالمشاكل
 */
export interface ProblematicEmployee {
  name: string;
  problemCount: number;
  completionCount: number;
  totalIssues: number;
  recommendation: string;
}

export function findProblematicEmployees(
  report: AnalysisReport,
  recognition: DataRecognitionResult
): ProblematicEmployee[] {
  const summary = analyzeEmployeePerformance(report, recognition);
  
  return summary.allEmployees
    .filter(e => e.problemCount > 0 || e.completionCount > 2)
    .map(e => ({
      name: e.name,
      problemCount: e.problemCount,
      completionCount: e.completionCount,
      totalIssues: e.problemCount + e.completionCount,
      recommendation: e.problemCount > 2 
        ? 'يحتاج تدريب إضافي - مشاكل متكررة'
        : e.completionCount > 3
          ? 'مراجعة سبب التكملات المتعددة'
          : 'متابعة عادية'
    }))
    .sort((a, b) => b.totalIssues - a.totalIssues);
}
