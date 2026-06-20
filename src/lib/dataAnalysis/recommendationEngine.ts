/**
 * مولد التوصيات الذكية
 * ينشئ توصيات تنفيذية بناءً على التحليل
 */

import type { DeliveryInstallationKPIs, StageAnalysis } from './kpiEngine';
import type { CriticalCasesSummary } from './criticalCasesAnalyzer';
import type { RelationshipSummary } from './relationshipAnalyzer';
import type { TeamPerformanceSummary } from './employeeAnalyzer';

// توصية
export interface Recommendation {
  id: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  category: 'operational' | 'quality' | 'team' | 'customer' | 'process';
  title: string;
  description: string;
  action: string;
  impact: string;
  relatedData?: string;
}

// ملاحظة تشغيلية
export interface OperationalNote {
  id: string;
  type: 'positive' | 'warning' | 'critical';
  title: string;
  description: string;
  metrics?: { label: string; value: string }[];
}

// الاستنتاج النهائي
export interface FinalConclusion {
  overallRating: 'excellent' | 'good' | 'acceptable' | 'needs_improvement' | 'critical';
  summary: string;
  keyMetrics: { label: string; value: string; status: 'good' | 'warning' | 'bad' }[];
  mainChallenge: string;
  nextSteps: string[];
}

// ملخص التوصيات
export interface RecommendationsSummary {
  operationalNotes: OperationalNote[];
  recommendations: Recommendation[];
  conclusion: FinalConclusion;
}

/**
 * توليد التوصيات التنفيذية
 */
export function generateRecommendations(
  kpis: DeliveryInstallationKPIs,
  stages: StageAnalysis,
  criticalCases: CriticalCasesSummary,
  relationships: RelationshipSummary,
  team: TeamPerformanceSummary
): RecommendationsSummary {
  const operationalNotes = generateOperationalNotes(kpis, stages, criticalCases);
  const recommendations = generateDetailedRecommendations(kpis, stages, criticalCases, relationships, team);
  const conclusion = generateConclusion(kpis, stages, criticalCases, relationships);
  
  return {
    operationalNotes,
    recommendations,
    conclusion
  };
}

/**
 * توليد الملاحظات التشغيلية
 */
function generateOperationalNotes(
  kpis: DeliveryInstallationKPIs,
  stages: StageAnalysis,
  criticalCases: CriticalCasesSummary
): OperationalNote[] {
  const notes: OperationalNote[] = [];
  let noteId = 0;
  
  // ملاحظة عن الأداء الممتاز
  if (kpis.delivery.deliverySuccessRate >= 95 && kpis.installation.installationSuccessRate >= 90) {
    notes.push({
      id: `note-${++noteId}`,
      type: 'positive',
      title: 'أداء ممتاز على مستوى الفواتير الرئيسية',
      description: `نجاح تجهيز ${kpis.delivery.deliverySuccessRate.toFixed(1)}% و نجاح تركيب ${kpis.installation.installationSuccessRate.toFixed(1)}%. هذا يعني أن العمليات الأساسية تتم بكفاءة عالية.`,
      metrics: [
        { label: 'نجاح التجهيز', value: `${kpis.delivery.deliverySuccessRate.toFixed(1)}%` },
        { label: 'نجاح التركيب', value: `${kpis.installation.installationSuccessRate.toFixed(1)}%` }
      ]
    });
  }
  
  // ملاحظة عن صفر تعويض
  if (kpis.delivery.deliveryCompensationRate === 0 && kpis.installation.installationCompensationRate === 0) {
    notes.push({
      id: `note-${++noteId}`,
      type: 'positive',
      title: 'صفر تعويض على مستوى الفواتير الرئيسية',
      description: 'جميع فواتير التجهيز والتركيب الرئيسية مكتملة بنجاح بدون أي تكملة.'
    });
  }
  
  // ملاحظة عن التكتات الفرعية المعلقة
  const totalCompletions = criticalCases.deliveryCompletions.length + criticalCases.installationCompletions.length;
  if (totalCompletions > 0) {
    notes.push({
      id: `note-${++noteId}`,
      type: 'warning',
      title: `تكتات فرعية تحتاج متابعة (${totalCompletions} تكت)`,
      description: `${criticalCases.deliveryCompletions.length} تكملة تجهيز و ${criticalCases.installationCompletions.length} تكملة تركيب. معظمها في Stage "جديد" مما يعني عدم بدء المعالجة بعد.`,
      metrics: [
        { label: 'تكملة تجهيز', value: String(criticalCases.deliveryCompletions.length) },
        { label: 'تكملة تركيب', value: String(criticalCases.installationCompletions.length) }
      ]
    });
  }
  
  // ملاحظة عن الزبائن المتكررين
  if (criticalCases.repeatedCustomerCases.length > 0) {
    const topRepeated = criticalCases.repeatedCustomerCases[0];
    notes.push({
      id: `note-${++noteId}`,
      type: 'warning',
      title: 'زبائن متكررون في التكملات',
      description: `${criticalCases.repeatedCustomerCases.length} زبون يظهر في حالات تكملة متعددة. زبون ${topRepeated.customer} يحتاج متابعة مكثفة.`
    });
  }
  
  // ملاحظة عن المشاكل
  if (criticalCases.problemCases.length > 0) {
    notes.push({
      id: `note-${++noteId}`,
      type: 'critical',
      title: `حالات مشاكل معلقة (${criticalCases.problemCases.length})`,
      description: 'هذه الحالات تحتاج معالجة عاجلة لتجنب تأثيرها على رضا العملاء.'
    });
  }
  
  return notes;
}

/**
 * توليد التوصيات المفصلة
 */
function generateDetailedRecommendations(
  kpis: DeliveryInstallationKPIs,
  stages: StageAnalysis,
  criticalCases: CriticalCasesSummary,
  relationships: RelationshipSummary,
  team: TeamPerformanceSummary
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let recId = 0;
  
  // توصية: متابعة التكتات المعلقة
  const totalCompletions = criticalCases.deliveryCompletions.length + criticalCases.installationCompletions.length;
  if (totalCompletions > 0) {
    recommendations.push({
      id: `rec-${++recId}`,
      priority: 'urgent',
      category: 'operational',
      title: `متابعة عاجلة لـ ${totalCompletions} تكت تكملة`,
      description: `${criticalCases.deliveryCompletions.length} تجهيز + ${criticalCases.installationCompletions.length} تركيب`,
      action: 'تحديد جدول زمني للإنجاز ومتابعة يومية',
      impact: 'تقليل التكملات المعلقة وتحسين رضا العملاء',
      relatedData: `(تجهيز ${criticalCases.deliveryCompletions.length} + تركيب ${criticalCases.installationCompletions.length})`
    });
  }
  
  // توصية: مراجعة الزبون المتكرر
  if (criticalCases.repeatedCustomerCases.length > 0) {
    const topRepeated = criticalCases.repeatedCustomerCases[0];
    recommendations.push({
      id: `rec-${++recId}`,
      priority: 'high',
      category: 'customer',
      title: `مراجعة مكثفة لزبون ${topRepeated.customer}`,
      description: topRepeated.description,
      action: 'تحديد سبب التكرار ومعالجة المشكلة الجذرية',
      impact: 'تجنب المشاكل المستقبلية وتحسين الكفاءة'
    });
  }
  
  // توصية: تحديث Stage
  if (stages.newCount > 50 || stages.inProgressCount > 20) {
    recommendations.push({
      id: `rec-${++recId}`,
      priority: 'medium',
      category: 'process',
      title: `تحديث Stage لـ ${stages.newCount} تكت "جديد" و ${stages.inProgressCount} "قيد"`,
      description: 'التحقق من الحالة الفعلية وتحديث النظام',
      action: 'مراجعة وتحديث Stage بعد التحقق',
      impact: 'دقة أفضل في تقارير الأداء'
    });
  }
  
  // توصية: نظام تنبيهات
  recommendations.push({
    id: `rec-${++recId}`,
    priority: 'medium',
    category: 'process',
    title: 'تطبيق نظام تنبيه تلقائي',
    description: 'للتكتات التي تبقى في Stage "جديد" لأكثر من 48 ساعة',
    action: 'إعداد نظام تنبيهات في النظام',
    impact: 'تقليل التأخير في المعالجة'
  });
  
  // توصية: تكريم الفريق
  if (kpis.totalSuccessRate >= 90) {
    recommendations.push({
      id: `rec-${++recId}`,
      priority: 'low',
      category: 'team',
      title: 'تكريم فرق التجهيز والتركيب',
      description: 'على النسبة الممتازة في الإنجاز',
      action: 'تقدير ومكافأة الفريق',
      impact: 'تحفيز وتحسين الأداء المستقبلي'
    });
  }
  
  // توصية: تدريب الموظفين المتسببين بالمشاكل
  const problematicEmployees = team.allEmployees.filter(e => e.completionCount > 2 || e.problemCount > 0);
  if (problematicEmployees.length > 0) {
    recommendations.push({
      id: `rec-${++recId}`,
      priority: 'medium',
      category: 'team',
      title: `تدريب إضافي لـ ${problematicEmployees.length} موظف`,
      description: 'للموظفين المتسببين في التكملات لتقليل المشاكل المستقبلية',
      action: 'تحديد برنامج تدريبي مخصص',
      impact: 'تقليل التكملات وتحسين الجودة'
    });
  }
  
  return recommendations.sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * توليد الاستنتاج النهائي
 */
function generateConclusion(
  kpis: DeliveryInstallationKPIs,
  stages: StageAnalysis,
  criticalCases: CriticalCasesSummary,
  relationships: RelationshipSummary
): FinalConclusion {
  // تحديد التقييم العام
  let overallRating: FinalConclusion['overallRating'] = 'good';
  
  if (kpis.totalSuccessRate >= 95 && criticalCases.problemCases.length === 0) {
    overallRating = 'excellent';
  } else if (kpis.totalSuccessRate >= 90) {
    overallRating = 'good';
  } else if (kpis.totalSuccessRate >= 75) {
    overallRating = 'acceptable';
  } else if (kpis.totalSuccessRate >= 50) {
    overallRating = 'needs_improvement';
  } else {
    overallRating = 'critical';
  }
  
  // المقاييس الرئيسية
  const keyMetrics: FinalConclusion['keyMetrics'] = [
    {
      label: 'نجاح التجهيز',
      value: `${kpis.delivery.deliverySuccessRate.toFixed(1)}%`,
      status: kpis.delivery.deliverySuccessRate >= 95 ? 'good' : kpis.delivery.deliverySuccessRate >= 80 ? 'warning' : 'bad'
    },
    {
      label: 'نجاح التركيب',
      value: `${kpis.installation.installationSuccessRate.toFixed(1)}%`,
      status: kpis.installation.installationSuccessRate >= 90 ? 'good' : kpis.installation.installationSuccessRate >= 75 ? 'warning' : 'bad'
    },
    {
      label: 'تعويض التجهيز',
      value: `${kpis.delivery.deliveryCompensationRate.toFixed(1)}%`,
      status: kpis.delivery.deliveryCompensationRate === 0 ? 'good' : kpis.delivery.deliveryCompensationRate <= 5 ? 'warning' : 'bad'
    },
    {
      label: 'تعويض التركيب',
      value: `${kpis.installation.installationCompensationRate.toFixed(1)}%`,
      status: kpis.installation.installationCompensationRate === 0 ? 'good' : kpis.installation.installationCompensationRate <= 5 ? 'warning' : 'bad'
    }
  ];
  
  // تحديد التحدي الرئيسي
  let mainChallenge = 'لا توجد تحديات كبيرة';
  const totalCompletions = criticalCases.deliveryCompletions.length + criticalCases.installationCompletions.length;
  
  if (criticalCases.problemCases.length > 0) {
    mainChallenge = `${criticalCases.problemCases.length} حالة مشكلة تحتاج معالجة عاجلة`;
  } else if (totalCompletions > 10) {
    mainChallenge = `${totalCompletions} تكت تكملة فرعي يحتاج متابعة`;
  } else if (totalCompletions > 0) {
    mainChallenge = `التحدي الوحيد هو ${totalCompletions} تكت تكملة فرعي يحتاج متابعة`;
  }
  
  // الخطوات التالية
  const nextSteps: string[] = [];
  
  if (totalCompletions > 0) {
    nextSteps.push(`متابعة ${totalCompletions} تكت تكملة وتحديد جدول زمني للإنجاز`);
  }
  if (criticalCases.repeatedCustomerCases.length > 0) {
    nextSteps.push(`مراجعة الزبائن المتكررين (${criticalCases.repeatedCustomerCases.length}) لتحديد سبب التكرار`);
  }
  if (stages.newCount > 0) {
    nextSteps.push(`تحديث Stage لـ ${stages.newCount} تكت "جديد" بعد التحقق`);
  }
  if (nextSteps.length === 0) {
    nextSteps.push('الحفاظ على مستوى الأداء الممتاز');
    nextSteps.push('متابعة مستمرة للجودة');
  }
  
  // الملخص
  const summary = generateSummaryText(kpis, stages, criticalCases, overallRating);
  
  return {
    overallRating,
    summary,
    keyMetrics,
    mainChallenge,
    nextSteps
  };
}

/**
 * توليد نص الملخص
 */
function generateSummaryText(
  kpis: DeliveryInstallationKPIs,
  stages: StageAnalysis,
  criticalCases: CriticalCasesSummary,
  rating: FinalConclusion['overallRating']
): string {
  const totalCompletions = criticalCases.deliveryCompletions.length + criticalCases.installationCompletions.length;
  
  let summary = '';
  
  switch (rating) {
    case 'excellent':
      summary = `الأداء التشغيلي ممتاز بجميع المقاييس. نسبة نجاح ${kpis.delivery.deliverySuccessRate.toFixed(1)}% في التجهيز و ${kpis.installation.installationSuccessRate.toFixed(1)}% في التركيب على مستوى الفواتير الرئيسية.`;
      break;
    case 'good':
      summary = `الأداء التشغيلي جيد جداً. نسبة نجاح ${kpis.delivery.deliverySuccessRate.toFixed(1)}% في التجهيز و ${kpis.installation.installationSuccessRate.toFixed(1)}% في التركيب على مستوى الفواتير الرئيسية.`;
      break;
    case 'acceptable':
      summary = `الأداء التشغيلي مقبول مع وجود مجال للتحسين. نسبة نجاح ${kpis.totalSuccessRate.toFixed(1)}% على مستوى الفواتير الرئيسية.`;
      break;
    default:
      summary = `الأداء التشغيلي يحتاج تحسين. نسبة النجاح ${kpis.totalSuccessRate.toFixed(1)}%.`;
  }
  
  if (kpis.delivery.deliveryCompensationRate === 0 && kpis.installation.installationCompensationRate === 0) {
    summary += ' صفر تعويض على مستوى الفواتير الرئيسية.';
  }
  
  if (totalCompletions > 0) {
    summary += ` التحدي الوحيد هو ${totalCompletions} تكت فرعي (تكملة) يحتاج متابعة.`;
  }
  
  return summary;
}

/**
 * الحصول على أيقونة الأولوية
 */
export function getPriorityIcon(priority: Recommendation['priority']): string {
  switch (priority) {
    case 'urgent': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
}

/**
 * الحصول على نص الأولوية
 */
export function getPriorityLabel(priority: Recommendation['priority']): string {
  switch (priority) {
    case 'urgent': return 'عاجل';
    case 'high': return 'عالي';
    case 'medium': return 'متوسط';
    case 'low': return 'منخفض';
    default: return '';
  }
}

/**
 * الحصول على نص التقييم
 */
export function getRatingLabel(rating: FinalConclusion['overallRating']): string {
  switch (rating) {
    case 'excellent': return 'ممتاز';
    case 'good': return 'جيد جداً';
    case 'acceptable': return 'مقبول';
    case 'needs_improvement': return 'يحتاج تحسين';
    case 'critical': return 'حرج';
    default: return '';
  }
}
