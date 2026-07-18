/**
 * محرك السرد التفصيلي الاحترافي
 * ينشئ نصوص سردية احترافية لجميع أقسام التقرير
 * كأنها مكتوبة بواسطة خبير تحليل بيانات متخصص
 */

import type { AnalysisReport } from './types';
import type { DataRecognitionResult } from './dataRecognizer';
import type { DeliveryInstallationKPIs, StageAnalysis } from './kpiEngine';
import type { CriticalCasesSummary } from './criticalCasesAnalyzer';
import type { RelationshipSummary } from './relationshipAnalyzer';
import type { TeamPerformanceSummary } from './employeeAnalyzer';
import type { RecommendationsSummary } from './recommendationEngine';

export interface NarrativeSections {
  executiveNarrative: ExecutiveNarrative;
  dataStructureNarrative: string;
  deliveryNarrative: DeliveryNarrative;
  installationNarrative: InstallationNarrative;
  customerJourneyNarrative: string;
  stageNarrative: string;
  teamNarrative: TeamNarrative;
  criticalCasesNarrative: CriticalNarrative;
  conclusionNarrative: ConclusionNarrative;
}

export interface ExecutiveNarrative {
  intro: string;
  analysis: string;
  highlights: string;
  conclusion: string;
}

export interface DeliveryNarrative {
  overview: string;
  mainInvoices: string;
  subTickets: string;
  successAnalysis: string;
  compensationAnalysis: string;
}

export interface InstallationNarrative {
  overview: string;
  mainInvoices: string;
  preEquipped: string;
  successAnalysis: string;
  compensationAnalysis: string;
}

export interface TeamNarrative {
  overview: string;
  topPerformers: string;
  supervisors: string;
  workDistribution: string;
}

export interface CriticalNarrative {
  overview: string;
  deliveryCompletions: string;
  installationCompletions: string;
  problemCases: string;
  repeatedCustomers: string;
  urgentActions: string;
}

export interface ConclusionNarrative {
  overallAssessment: string;
  keyFindings: string;
  challenges: string;
  recommendations: string;
  finalStatement: string;
  expertOpinion: string;
}

function formatNumber(num: number): string {
  return num.toLocaleString('ar-IQ');
}

function formatPercentage(num: number): string {
  return `${num.toFixed(1)}%`;
}

function getRatingDescription(rate: number): string {
  if (rate >= 95) return 'ممتاز ويعكس أداءً استثنائياً';
  if (rate >= 90) return 'جيد جداً ويدل على كفاءة عالية';
  if (rate >= 80) return 'جيد مع وجود مجال للتحسين';
  if (rate >= 70) return 'مقبول ويحتاج إلى متابعة';
  if (rate >= 60) return 'ضعيف ويتطلب تدخلاً عاجلاً';
  return 'حرج ويستدعي إجراءات فورية';
}

function getCompensationDescription(rate: number): string {
  if (rate === 0) return 'وهذا يعني عدم وجود أي حالات تعويض، مما يشير إلى جودة عالية في التنفيذ';
  if (rate <= 2) return 'وهي نسبة منخفضة جداً تدل على أداء متميز';
  if (rate <= 5) return 'وهي نسبة مقبولة ضمن المعدل الطبيعي';
  if (rate <= 10) return 'وهي نسبة تحتاج إلى مراجعة وتحسين';
  return 'وهي نسبة مرتفعة تستدعي تدخلاً عاجلاً';
}

export function generateExecutiveNarrative(
  report: AnalysisReport,
  kpis: DeliveryInstallationKPIs,
  criticalCases: CriticalCasesSummary
): ExecutiveNarrative {
  const { summary } = report;
  const totalCompletions = criticalCases.deliveryCompletions.length + criticalCases.installationCompletions.length;

  const intro = `يُقدم هذا التقرير التحليلي نظرة شاملة ومعمقة على بيانات ملف "${summary.fileName}" الذي يتضمن ${formatNumber(summary.rowCount)} سجل موزعة على ${summary.columnCount} عمود من البيانات.${summary.dateRange ? ` تغطي هذه البيانات الفترة الممتدة من ${summary.dateRange.from} إلى ${summary.dateRange.to}.` : ''} يهدف هذا التحليل إلى تقديم صورة واضحة عن مستوى الأداء التشغيلي وتحديد نقاط القوة والتحديات.`;

  const analysis = `من خلال التحليل المعمق للبيانات، يتضح أن الأداء التشغيلي العام يسجل نسبة نجاح كلية تبلغ ${formatPercentage(kpis.totalSuccessRate)} على مستوى الفواتير الرئيسية، ${getRatingDescription(kpis.totalSuccessRate)}. يُظهر قسم التجهيز نسبة نجاح ${formatPercentage(kpis.delivery.deliverySuccessRate)} من إجمالي ${formatNumber(kpis.delivery.totalMainInvoices)} فاتورة رئيسية، بينما يحقق قسم التركيب نسبة ${formatPercentage(kpis.installation.installationSuccessRate)} من ${formatNumber(kpis.installation.totalMainInvoices)} فاتورة رئيسية. تم خدمة ${formatNumber(kpis.uniqueCustomers)} زبون فريد خلال هذه الفترة.`;

  const highlights = totalCompletions === 0 && criticalCases.problemCases.length === 0
    ? `تجدر الإشارة إلى أن البيانات تُظهر أداءً متميزاً بدون أي حالات تعويض على مستوى الفواتير الرئيسية، وهذا يعكس مستوى عالٍ من الجودة والكفاءة في التنفيذ. كما أن غياب حالات المشاكل المعلقة يدل على فعالية نظام المتابعة والحل.`
    : `يُلاحظ وجود ${formatNumber(totalCompletions)} حالة تكملة فرعية تحتاج إلى متابعة، منها ${criticalCases.deliveryCompletions.length} تكملة تجهيز و${criticalCases.installationCompletions.length} تكملة تركيب.${criticalCases.problemCases.length > 0 ? ` كما تم رصد ${criticalCases.problemCases.length} حالة مشكلة تتطلب معالجة عاجلة.` : ''} هذه الحالات تمثل التحدي الرئيسي الذي يحتاج إلى اهتمام خاص.`;

  const conclusion = `بناءً على المؤشرات المذكورة أعلاه، يمكن تقييم الأداء التشغيلي بأنه ${kpis.totalSuccessRate >= 90 ? 'ممتاز' : kpis.totalSuccessRate >= 75 ? 'جيد' : 'يحتاج تحسين'}، مع التأكيد على أهمية متابعة الحالات المعلقة وضمان استمرارية الجودة في التنفيذ.`;

  return { intro, analysis, highlights, conclusion };
}

export function generateDataStructureNarrative(
  report: AnalysisReport,
  recognition: DataRecognitionResult
): string {
  const { summary } = report;
  const { dataStructure, dataType, confidence } = recognition;

  let narrative = `يتكون الملف من ${formatNumber(summary.rowCount)} سجل، وقد تم التعرف على نوع البيانات تلقائياً كبيانات "${dataType === 'delivery_installation' ? 'تجهيز وتركيب' : dataType}" بنسبة ثقة ${formatPercentage(confidence * 100)}. `;

  if (dataStructure.categories.length > 0) {
    narrative += `\n\nيُظهر تحليل هيكل البيانات التوزيع التالي:\n`;
    dataStructure.categories.forEach(cat => {
      narrative += `• ${cat.name}: ${formatNumber(cat.count)} سجل (${formatPercentage(cat.percentage)}) - ${cat.description}\n`;
    });
  }

  narrative += `\nيُعد فهم هذا التوزيع أساسياً لتفسير النتائج التالية بشكل صحيح، حيث يجب التمييز بين الفواتير الرئيسية (التي تمثل العمليات الأساسية) والتكتات الفرعية (التي تمثل تفاصيل المنتجات).`;

  return narrative;
}

export function generateDeliveryNarrative(
  kpis: DeliveryInstallationKPIs
): DeliveryNarrative {
  const { delivery } = kpis;

  const overview = `يُعد قسم التجهيز من الأقسام الأساسية في العمليات، وقد تم تحليل أدائه بناءً على ${formatNumber(delivery.totalMainInvoices)} فاتورة تجهيز رئيسية. يُظهر التحليل أن هذا القسم يحقق مستوى أداء ${getRatingDescription(delivery.deliverySuccessRate)}.`;

  const mainInvoices = `بلغ إجمالي فواتير التجهيز الرئيسية (Delivery - S) ${formatNumber(delivery.totalMainInvoices)} فاتورة، تم إنجاز ${formatNumber(delivery.completedDelivery)} منها بنجاح. تمثل هذه الفواتير العمليات الأساسية التي يتم قياس الأداء على أساسها.`;

  const subTickets = delivery.subTickets.total > 0
    ? `على صعيد التكتات الفرعية، تم رصد ${formatNumber(delivery.subTickets.total)} تكت فرعي، منها ${formatNumber(delivery.subTickets.delivery)} تكت تجهيز عادي و${formatNumber(delivery.subTickets.deliveryCompletion)} تكت تكملة تجهيز. التكتات الفرعية تمثل تفاصيل المنتجات ضمن الفواتير الرئيسية.`
    : `لا توجد تكتات فرعية مسجلة في هذه الفترة.`;

  const successAnalysis = `تبلغ نسبة نجاح التجهيز الرئيسي ${formatPercentage(delivery.deliverySuccessRate)}، ${getRatingDescription(delivery.deliverySuccessRate)}. هذه النسبة تُحسب بناءً على الفواتير الرئيسية المكتملة بدون الحاجة إلى تكملات لاحقة.`;

  const compensationAnalysis = `أما نسبة التعويض (التكملات) فتبلغ ${formatPercentage(delivery.deliveryCompensationRate)}، ${getCompensationDescription(delivery.deliveryCompensationRate)}. يشير هذا المؤشر إلى مدى الحاجة للعودة لإكمال عمليات التجهيز.`;

  return { overview, mainInvoices, subTickets, successAnalysis, compensationAnalysis };
}

export function generateInstallationNarrative(
  kpis: DeliveryInstallationKPIs
): InstallationNarrative {
  const { installation } = kpis;

  const overview = `يُمثل قسم التركيب المرحلة النهائية في رحلة الزبون، وقد تم تحليل ${formatNumber(installation.totalMainInvoices)} فاتورة تركيب رئيسية. يتضمن هذا القسم نوعين من العمليات: التركيب العادي والتركيب للمجهزة مسبقاً.`;

  const mainInvoices = `بلغ إجمالي فواتير التركيب الرئيسية (Installation - S) ${formatNumber(installation.totalMainInvoices)} فاتورة، تم إنجاز ${formatNumber(installation.completedInstallation)} منها كتركيب عادي. هذه الفواتير تمثل عمليات التركيب الفعلية التي تتم بعد التجهيز.`;

  const preEquipped = installation.preEquipped > 0
    ? `تم رصد ${formatNumber(installation.preEquipped)} حالة "مجهزة مسبقاً"، وهي الحالات التي يأتي فيها الزبون بمواد مجهزة من مصدر آخر ويطلب خدمة التركيب فقط. تُعامل هذه الحالات كعمليات ناجحة ضمن قسم التركيب.`
    : `لا توجد حالات "مجهزة مسبقاً" في هذه الفترة، مما يعني أن جميع عمليات التركيب مرتبطة بعمليات تجهيز سابقة.`;

  const successAnalysis = `تبلغ نسبة نجاح التركيب الرئيسي ${formatPercentage(installation.installationSuccessRate)}، ${getRatingDescription(installation.installationSuccessRate)}. يُحسب هذا المؤشر بناءً على عمليات التركيب العادية (باستثناء المجهزة مسبقاً).`;

  const compensationAnalysis = `نسبة التعويض في التركيب تبلغ ${formatPercentage(installation.installationCompensationRate)}، ${getCompensationDescription(installation.installationCompensationRate)}. تشير هذه النسبة إلى الحالات التي احتاجت زيارات إضافية لإكمال التركيب.`;

  return { overview, mainInvoices, preEquipped, successAnalysis, compensationAnalysis };
}

export function generateCustomerJourneyNarrative(
  relationships: RelationshipSummary,
  kpis: DeliveryInstallationKPIs
): string {
  const { journey } = relationships;

  let narrative = `يُعد تحليل رحلة الزبون من أهم المؤشرات لفهم تجربة العميل الكاملة. من إجمالي ${formatNumber(kpis.uniqueCustomers)} زبون فريد:\n\n`;

  if (journey.customersWithBoth > 0) {
    const bothPercentage = (journey.customersWithBoth / journey.totalCustomers) * 100;
    narrative += `• ${formatNumber(journey.customersWithBoth)} زبون (${formatPercentage(bothPercentage)}) حصلوا على خدمتي التجهيز والتركيب معاً، وهؤلاء يمثلون الرحلة الكاملة للخدمة.\n`;
  }

  if (journey.customersDeliveryOnly > 0) {
    narrative += `• ${formatNumber(journey.customersDeliveryOnly)} زبون حصلوا على التجهيز فقط، وهؤلاء إما بانتظار موعد التركيب أو لديهم ترتيبات أخرى.\n`;
  }

  if (journey.customersInstallationOnly > 0) {
    narrative += `• ${formatNumber(journey.customersInstallationOnly)} زبون حصلوا على التركيب فقط (مجهزة مسبقاً)، وهؤلاء جاءوا بمواد مجهزة من مصادر أخرى.\n`;
  }

  if (relationships.problematicCustomers.length > 0) {
    narrative += `\nتم تحديد ${formatNumber(relationships.problematicCustomers.length)} زبون يحتاجون متابعة خاصة بسبب تكرار الحالات أو وجود مشاكل. يُنصح بمراجعة ملفات هؤلاء الزبائن وتحديد أسباب التكرار لتجنب المشاكل المستقبلية.`;
  }

  if (relationships.deliveryInstallationRelation.averageDaysBetween > 0) {
    narrative += `\nيبلغ متوسط الفترة بين التجهيز والتركيب ${relationships.deliveryInstallationRelation.averageDaysBetween.toFixed(1)} يوم، وهذا يعطي مؤشراً على سرعة إتمام الخدمة الكاملة للزبون.`;
  }

  return narrative;
}

export function generateStageNarrative(
  stages: StageAnalysis
): string {
  let narrative = `يُظهر تحليل مراحل العمل (Stage) التوزيع الحالي لجميع التكتات حسب حالتها:\n\n`;

  stages.stages.slice(0, 8).forEach(stage => {
    narrative += `• ${stage.stage}: ${formatNumber(stage.count)} تكت (${formatPercentage(stage.percentage)})\n`;
  });

  narrative += `\n`;

  if (stages.completedCount > 0) {
    narrative += `يُشكل عدد التكتات المنجزة ${formatNumber(stages.completedCount)} تكت، مما يدل على حجم العمل المُنفذ. `;
  }

  if (stages.newCount > 0) {
    narrative += `يوجد ${formatNumber(stages.newCount)} تكت في حالة "جديد" بانتظار البدء بالمعالجة. `;
  }

  if (stages.inProgressCount > 0) {
    narrative += `${formatNumber(stages.inProgressCount)} تكت قيد العمل حالياً. `;
  }

  if (stages.problemCount > 0) {
    narrative += `\n\nيُلاحظ وجود ${formatNumber(stages.problemCount)} تكت في حالة "يوجد مشكلة"، وهذه الحالات تتطلب اهتماماً خاصاً ومتابعة عاجلة لحلها.`;
  }

  return narrative;
}

export function generateTeamNarrative(
  team: TeamPerformanceSummary
): TeamNarrative {
  const overview = `يضم فريق العمل ${formatNumber(team.totalEmployees)} موظف تحت إشراف ${formatNumber(team.totalSupervisors)} مشرف. يُظهر تحليل الأداء توزيعاً متفاوتاً للعمليات بين أعضاء الفريق.`;

  let topPerformers = `يتصدر قائمة الأداء الموظفون التاليون:\n`;
  team.topEmployees.slice(0, 5).forEach((emp, index) => {
    topPerformers += `${index + 1}. ${emp.name}: ${formatNumber(emp.totalOperations)} عملية (${emp.deliveryCount} تجهيز، ${emp.installationCount} تركيب)`;
    if (emp.completionCount > 0) {
      topPerformers += ` - ${emp.completionCount} تكملة`;
    }
    topPerformers += `\n`;
  });
  topPerformers += `\nهؤلاء الموظفون يمثلون العمود الفقري للعمليات الميدانية ويُنصح بتكريمهم وتقدير جهودهم.`;

  let supervisors = `على صعيد المشرفين، `;
  if (team.supervisorPerformance.length > 0) {
    const topSup = team.supervisorPerformance[0];
    supervisors += `يتصدر المشرف "${topSup.name}" القائمة بإشراف على ${topSup.deliveryInvoices + topSup.installationInvoices} عملية رئيسية، مع فريق مكون من ${topSup.totalTeamMembers} موظف. `;
    if (team.supervisorPerformance.length > 1) {
      supervisors += `يليه المشرفون الآخرون بأعداد متفاوتة من العمليات.`;
    }
  } else {
    supervisors += `لم يتم تحديد مشرفين في البيانات المتاحة.`;
  }

  const workDistribution = team.insights.length > 0
    ? `من أبرز الملاحظات على أداء الفريق:\n${team.insights.map(i => `• ${i}`).join('\n')}`
    : `يُظهر توزيع العمل بين الموظفين نمطاً متوازناً بشكل عام.`;

  return { overview, topPerformers, supervisors, workDistribution };
}

export function generateCriticalCasesNarrative(
  criticalCases: CriticalCasesSummary
): CriticalNarrative {
  const totalCompletions = criticalCases.deliveryCompletions.length + criticalCases.installationCompletions.length;

  const overview = criticalCases.totalCriticalCases === 0
    ? `يُسعدنا الإشارة إلى أنه لا توجد حالات حرجة تتطلب معالجة عاجلة. هذا يعكس جودة عالية في التنفيذ ومتابعة فعالة للعمليات.`
    : `تم رصد ${formatNumber(criticalCases.totalCriticalCases)} حالة تحتاج متابعة ومعالجة. يشمل ذلك حالات التكملات والمشاكل التي تتطلب اهتماماً خاصاً لضمان رضا الزبائن وجودة الخدمة.`;

  const deliveryCompletions = criticalCases.deliveryCompletions.length > 0
    ? `تم رصد ${formatNumber(criticalCases.deliveryCompletions.length)} حالة تكملة تجهيز. هذه الحالات تمثل عمليات تجهيز لم تكتمل في الزيارة الأولى واحتاجت إلى متابعة. ${criticalCases.deliveryCompletions.filter(c => c.stage.includes('جديد')).length > 0 ? `منها ${criticalCases.deliveryCompletions.filter(c => c.stage.includes('جديد')).length} حالة لم تبدأ معالجتها بعد.` : 'جميعها قيد المعالجة.'}`
    : `لا توجد حالات تكملة تجهيز، وهذا مؤشر إيجابي على جودة التنفيذ من المرة الأولى.`;

  const installationCompletions = criticalCases.installationCompletions.length > 0
    ? `على صعيد التركيب، تم رصد ${formatNumber(criticalCases.installationCompletions.length)} حالة تكملة تركيب. هذه الحالات احتاجت زيارات إضافية لإكمال عملية التركيب. ${criticalCases.installationCompletions.filter(c => c.stage.includes('جديد')).length > 0 ? `${criticalCases.installationCompletions.filter(c => c.stage.includes('جديد')).length} منها في مرحلة "جديد" بانتظار الجدولة.` : ''}`
    : `لا توجد حالات تكملة تركيب، مما يدل على إتمام عمليات التركيب بنجاح من الزيارة الأولى.`;

  const problemCases = criticalCases.problemCases.length > 0
    ? `تم تسجيل ${formatNumber(criticalCases.problemCases.length)} حالة في وضع "يوجد مشكلة". هذه الحالات تتطلب معالجة عاجلة وتحديد أسباب المشكلة للحل الفوري. يُنصح بمراجعة كل حالة على حدة وتوثيق الإجراءات المتخذة.`
    : `لا توجد حالات مشاكل معلقة، وهذا يعكس فعالية نظام حل المشاكل والمتابعة.`;

  const repeatedCustomers = criticalCases.repeatedCustomerCases.length > 0
    ? `تم تحديد ${formatNumber(criticalCases.repeatedCustomerCases.length)} زبون يظهر في حالات تكملة متعددة. هؤلاء الزبائن يحتاجون متابعة مكثفة لتحديد سبب التكرار - هل هو بسبب طبيعة المشروع أم بسبب مشاكل في التنفيذ؟ يُنصح بمراجعة ملفاتهم بالتفصيل.`
    : `لا يوجد زبائن متكررون في حالات التكملات، مما يدل على تنفيذ منظم ومنهجي.`;

  let urgentActions = ``;
  if (totalCompletions > 0 || criticalCases.problemCases.length > 0) {
    urgentActions = `الإجراءات المطلوبة:\n`;
    if (totalCompletions > 0) {
      urgentActions += `1. جدولة زيارات لإنجاز ${formatNumber(totalCompletions)} حالة تكملة معلقة\n`;
    }
    if (criticalCases.problemCases.length > 0) {
      urgentActions += `2. معالجة ${formatNumber(criticalCases.problemCases.length)} حالة مشكلة بشكل عاجل\n`;
    }
    if (criticalCases.repeatedCustomerCases.length > 0) {
      urgentActions += `3. مراجعة ملفات ${formatNumber(criticalCases.repeatedCustomerCases.length)} زبون متكرر\n`;
    }
  } else {
    urgentActions = `لا توجد إجراءات عاجلة مطلوبة. يُنصح بالاستمرار في نفس مستوى الأداء.`;
  }

  return { overview, deliveryCompletions, installationCompletions, problemCases, repeatedCustomers, urgentActions };
}

export function generateConclusionNarrative(
  kpis: DeliveryInstallationKPIs,
  stages: StageAnalysis,
  criticalCases: CriticalCasesSummary,
  recommendations: RecommendationsSummary
): ConclusionNarrative {
  const { conclusion } = recommendations;
  const totalCompletions = criticalCases.deliveryCompletions.length + criticalCases.installationCompletions.length;

  const ratingScore = Math.round(kpis.totalSuccessRate);
  const overallAssessment = `بناءً على التحليل الشامل للبيانات، يُقيّم الأداء التشغيلي العام بدرجة "${conclusion.overallRating === 'excellent' ? 'ممتاز' : conclusion.overallRating === 'good' ? 'جيد جداً' : conclusion.overallRating === 'acceptable' ? 'مقبول' : 'يحتاج تحسين'}" بمعدل ${ratingScore}%. يعكس هذا التقييم مستوى الإنجاز في كل من قسمي التجهيز والتركيب، مع الأخذ بعين الاعتبار الحالات الحرجة ونسب التعويض.`;

  const keyFindings = `أبرز النتائج الرئيسية:\n` +
    `• نسبة نجاح التجهيز الرئيسي: ${formatPercentage(kpis.delivery.deliverySuccessRate)}\n` +
    `• نسبة نجاح التركيب الرئيسي: ${formatPercentage(kpis.installation.installationSuccessRate)}\n` +
    `• إجمالي الفواتير الرئيسية: ${formatNumber(kpis.totalMainInvoices)}\n` +
    `• عدد الزبائن المخدومين: ${formatNumber(kpis.uniqueCustomers)}\n` +
    (kpis.installation.preEquipped > 0 ? `• حالات مجهزة مسبقاً: ${formatNumber(kpis.installation.preEquipped)}\n` : '');

  const challenges = conclusion.mainChallenge !== 'لا توجد تحديات كبيرة'
    ? `التحدي الرئيسي: ${conclusion.mainChallenge}. يتطلب هذا التحدي اهتماماً خاصاً ومتابعة مستمرة لضمان عدم تفاقمه.`
    : `لا توجد تحديات كبيرة في الأداء الحالي، مما يعكس استقراراً في العمليات وفعالية في التنفيذ.`;

  let recommendationsText = `التوصيات التنفيذية:\n`;
  conclusion.nextSteps.forEach((step, index) => {
    recommendationsText += `${index + 1}. ${step}\n`;
  });

  const finalStatement = `في الختام، ${kpis.totalSuccessRate >= 90 
    ? 'يُظهر التحليل أداءً متميزاً يستحق التقدير. يُنصح بالحفاظ على هذا المستوى من الجودة وتوثيق الممارسات الناجحة لتعميمها.'
    : kpis.totalSuccessRate >= 75
      ? 'يُظهر التحليل أداءً جيداً مع وجود فرص للتحسين. التركيز على الحالات المعلقة سيرفع من مستوى الأداء.'
      : 'يتطلب الأداء الحالي مراجعة شاملة وإجراءات تصحيحية لتحسين النتائج.'
  }`;

  const expertOpinion = `رأي المحلل: من وجهة نظر تحليلية، ${
    kpis.delivery.deliveryCompensationRate === 0 && kpis.installation.installationCompensationRate === 0
      ? 'يُعد غياب حالات التعويض على مستوى الفواتير الرئيسية إنجازاً يستحق الإشادة. هذا يدل على تخطيط جيد وتنفيذ دقيق.'
      : totalCompletions > 0
        ? `وجود ${formatNumber(totalCompletions)} حالة تكملة يشير إلى الحاجة لمراجعة عمليات التخطيط والجدولة. يُنصح بتحليل أسباب التكملات لتقليلها مستقبلاً.`
        : 'الأداء ضمن المعدل الطبيعي، مع التأكيد على أهمية المتابعة المستمرة.'
  }`;

  return { overallAssessment, keyFindings, challenges, recommendations: recommendationsText, finalStatement, expertOpinion };
}

export function generateFullReportNarrative(
  report: AnalysisReport,
  recognition: DataRecognitionResult,
  kpis: DeliveryInstallationKPIs,
  stages: StageAnalysis,
  relationships: RelationshipSummary,
  criticalCases: CriticalCasesSummary,
  team: TeamPerformanceSummary,
  recommendations: RecommendationsSummary
): NarrativeSections {
  return {
    executiveNarrative: generateExecutiveNarrative(report, kpis, criticalCases),
    dataStructureNarrative: generateDataStructureNarrative(report, recognition),
    deliveryNarrative: generateDeliveryNarrative(kpis),
    installationNarrative: generateInstallationNarrative(kpis),
    customerJourneyNarrative: generateCustomerJourneyNarrative(relationships, kpis),
    stageNarrative: generateStageNarrative(stages),
    teamNarrative: generateTeamNarrative(team),
    criticalCasesNarrative: generateCriticalCasesNarrative(criticalCases),
    conclusionNarrative: generateConclusionNarrative(kpis, stages, criticalCases, recommendations),
  };
}

export function generateSimpleNarrative(
  fileName: string,
  rowCount: number,
  columnCount: number,
  dataQuality: number
): string {
  return `يُقدم هذا التقرير تحليلاً شاملاً لملف "${fileName}" الذي يحتوي على ${formatNumber(rowCount)} سجل موزعة على ${columnCount} عمود. تبلغ جودة البيانات ${formatPercentage(dataQuality)}، ${dataQuality >= 80 ? 'وهي نسبة ممتازة تدل على اكتمال البيانات' : dataQuality >= 60 ? 'وهي نسبة مقبولة مع وجود بعض القيم الناقصة' : 'وهي نسبة تحتاج مراجعة لمعالجة القيم الفارغة'}.`;
}
