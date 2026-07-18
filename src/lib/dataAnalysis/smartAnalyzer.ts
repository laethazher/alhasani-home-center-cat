/**
 * محرك التحليل الذكي المتقدم
 * يقوم بفهم طلب المستخدم والبدء بالتحليل باستخدام المحللات المتخصصة
 */

import { GoogleGenAI } from '@google/genai';
import type { AnalysisReport, ChatMessage, ColumnAnalysis } from './types';
import { recognizeData, isDeliveryInstallationData } from './dataRecognizer';
import { calculateDeliveryInstallationKPIs, analyzeStages } from './kpiEngine';
import { analyzeRelationships } from './relationshipAnalyzer';
import { analyzeCriticalCases, getQuickCriticalSummary } from './criticalCasesAnalyzer';
import { analyzeEmployeePerformance } from './employeeAnalyzer';
import { generateRecommendations, getRatingLabel } from './recommendationEngine';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

export interface SmartAnalysisState {
  stage: 'initial' | 'understanding' | 'clarifying' | 'ready';
  clarifications: string[];
  userRequirements: string;
  analysisType?: string;
  focusColumns?: string[];
  comparisonType?: string;
}

interface SmartAnalysisResponse {
  response: string;
  newState: SmartAnalysisState;
  readyToAnalyze: boolean;
  finalPrompt?: string;
}

function getColumnsSummary(columns: ColumnAnalysis[]): string {
  return columns
    .map((col) => {
      let details = `• ${col.name} (${col.dataType})`;
      if (col.numericStats) {
        details += `: أرقام من ${col.numericStats.min} إلى ${col.numericStats.max}، المتوسط ${col.numericStats.mean.toFixed(1)}`;
      }
      if (col.textStats && col.textStats.topValues.length > 0) {
        const topVals = col.textStats.topValues.slice(0, 3).map(v => v.value).join('، ');
        details += `: ${col.uniqueCount} قيمة فريدة، الأكثر شيوعاً: ${topVals}`;
      }
      if (col.dateStats) {
        details += `: تواريخ من ${col.dateStats.earliest} إلى ${col.dateStats.latest}`;
      }
      return details;
    })
    .join('\n');
}

export async function generateDataSummary(report: AnalysisReport): Promise<string> {
  const { summary, columns } = report;
  
  // استخدام محرك التعرف الذكي
  const recognition = recognizeData(report);
  const isDeliveryInstallation = isDeliveryInstallationData(recognition);

  let welcomeMessage = `مرحباً! 🎯 أنا مساعد التحليل الذكي المتقدم.

📊 **قرأت ملفك "${summary.fileName}"** وإليك ملخص سريع:

📈 **الحجم:** ${summary.rowCount.toLocaleString('ar-IQ')} سجل في ${summary.columnCount} عمود
`;

  // إذا كانت بيانات تجهيز وتركيب، نضيف معلومات إضافية
  if (isDeliveryInstallation) {
    const kpis = calculateDeliveryInstallationKPIs(report, recognition);
    const criticalCases = analyzeCriticalCases(report, recognition);
    const quickSummary = getQuickCriticalSummary(criticalCases);
    
    welcomeMessage += `
🎯 **نوع البيانات:** تجهيز وتركيب (تم التعرف تلقائياً)

📌 **المؤشرات الرئيسية:**
• فواتير التجهيز الرئيسية: ${kpis.delivery.totalMainInvoices}
• فواتير التركيب الرئيسية: ${kpis.installation.totalMainInvoices}
• نسبة نجاح التجهيز: ${kpis.delivery.deliverySuccessRate.toFixed(1)}%
• نسبة نجاح التركيب: ${kpis.installation.installationSuccessRate.toFixed(1)}%
• عدد الزبائن: ${kpis.uniqueCustomers}

${quickSummary.needsUrgentAttention ? `⚠️ **تنبيه:** ${quickSummary.summary}` : '✅ **الحالة:** لا توجد حالات حرجة'}
`;
  }

  if (summary.dateRange) {
    welcomeMessage += `📅 **الفترة:** ${summary.dateRange.from} إلى ${summary.dateRange.to}\n`;
  }

  welcomeMessage += `\n**الأعمدة المتاحة:**\n`;
  welcomeMessage += getColumnsSummary(columns.slice(0, 8));
  
  if (columns.length > 8) {
    welcomeMessage += `\n... و ${columns.length - 8} أعمدة أخرى`;
  }

  welcomeMessage += `\n\n---\n\n🤔 **الآن أخبرني: ما الذي تريد معرفته أو تحليله من هذه البيانات؟**

يمكنك كتابة طلبك بحرية، مثلاً:
- "حلل لي نسب النجاح والفشل"
- "قارن بين المناطق المختلفة"
- "أريد معرفة التوزيع حسب الفئات"
- أو أي سؤال آخر عن البيانات...`;

  return welcomeMessage;
}

function buildSmartPrompt(
  userMessage: string,
  report: AnalysisReport,
  history: ChatMessage[],
  currentState: SmartAnalysisState
): string {
  const columnsSummary = getColumnsSummary(report.columns);
  
  const historyStr = history
    .filter(m => m.role !== 'system')
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'المستخدم' : 'المساعد'}: ${m.content}`)
    .join('\n\n');

  const sampleData = report.rawData.slice(0, 5).map((row, i) => 
    `سجل ${i + 1}: ${JSON.stringify(row, null, 0)}`
  ).join('\n');

  const messageCount = history.filter(m => m.role === 'user').length;

  return `أنت محلل بيانات ذكي. مهمتك فهم طلب المستخدم والبدء بالتحليل بسرعة.

## قاعدة مهمة جداً:
- إذا أرسل المستخدم طلباً واضحاً (مثل: حلل، قارن، أريد تحليل، إلخ) → ابدأ التحليل فوراً (readyToAnalyze=true)
- إذا كان الطلب غامضاً جداً → اسأل سؤال واحد فقط ثم ابدأ التحليل
- عدد رسائل المستخدم حتى الآن: ${messageCount}
- إذا كانت هذه الرسالة الثانية أو أكثر → يجب أن تبدأ التحليل (readyToAnalyze=true)

## بيانات الملف:
- الاسم: ${report.summary.fileName}
- السجلات: ${report.summary.rowCount}
- الأعمدة: ${report.summary.columnCount}

## الأعمدة:
${columnsSummary}

## عينة من البيانات:
${sampleData}

## المحادثة السابقة:
${historyStr}

## رسالة المستخدم:
${userMessage}

## تنسيق الرد (JSON فقط):
{
  "response": "رد قصير للمستخدم (جملة أو جملتين فقط)",
  "stage": "ready",
  "userRequirements": "ملخص الطلب",
  "analysisType": "achievements أو comparison أو quality أو custom",
  "readyToAnalyze": true,
  "finalPrompt": "وصف تفصيلي للتحليل المطلوب بناءً على طلب المستخدم والبيانات المتاحة"
}

مهم جداً:
- في أغلب الحالات، اجعل readyToAnalyze=true
- لا تطل في الدردشة، المستخدم يريد نتائج
- finalPrompt يجب أن يكون واضحاً ومفصلاً

أجب بـ JSON فقط:`;
}

function parseSmartResponse(
  responseText: string,
  currentState: SmartAnalysisState
): SmartAnalysisResponse {
  try {
    let jsonStr = responseText.trim();
    
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    } else {
      const startIdx = jsonStr.indexOf('{');
      const endIdx = jsonStr.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        jsonStr = jsonStr.slice(startIdx, endIdx + 1);
      }
    }

    const parsed = JSON.parse(jsonStr);
    
    return {
      response: parsed.response || 'عذراً، لم أفهم. هل يمكنك توضيح طلبك أكثر؟',
      newState: {
        stage: parsed.stage || 'understanding',
        clarifications: currentState.clarifications,
        userRequirements: parsed.userRequirements || currentState.userRequirements,
        analysisType: parsed.analysisType,
        focusColumns: parsed.focusColumns,
      },
      readyToAnalyze: parsed.readyToAnalyze === true,
      finalPrompt: parsed.finalPrompt,
    };
  } catch (e) {
    console.error('Failed to parse smart response:', e);
    return {
      response: responseText || 'عذراً، لم أفهم. هل يمكنك توضيح طلبك أكثر؟',
      newState: currentState,
      readyToAnalyze: false,
    };
  }
}

function generateFallbackResponse(
  userMessage: string,
  report: AnalysisReport,
  currentState: SmartAnalysisState
): SmartAnalysisResponse {
  const msg = userMessage.toLowerCase();
  const columns = report.columns.map(c => c.name).join('، ');
  
  if (msg.includes('نجاح') || msg.includes('فشل') || msg.includes('إنجاز') || msg.includes('حلل') || msg.includes('تحليل')) {
    return {
      response: `ممتاز! سأبدأ التحليل الآن...`,
      newState: {
        ...currentState,
        stage: 'ready',
        userRequirements: userMessage,
        analysisType: 'achievements',
      },
      readyToAnalyze: true,
      finalPrompt: `قم بتحليل شامل للبيانات بناءً على طلب المستخدم: "${userMessage}". 
الأعمدة المتاحة: ${columns}. 
قدم تحليلاً مفصلاً يشمل: نسب النجاح والفشل، مقارنات بين الفئات، إحصائيات رئيسية، وتوصيات.`,
    };
  }
  
  if (msg.includes('مقارن') || msg.includes('فرق') || msg.includes('بين') || msg.includes('قارن')) {
    return {
      response: `ممتاز! سأبدأ المقارنة الآن...`,
      newState: {
        ...currentState,
        stage: 'ready',
        userRequirements: userMessage,
        analysisType: 'comparison',
      },
      readyToAnalyze: true,
      finalPrompt: `قم بإجراء مقارنات شاملة في البيانات بناءً على طلب المستخدم: "${userMessage}".
الأعمدة المتاحة: ${columns}.
قارن بين الفئات المختلفة، قدم نسب مئوية، ورسوم بيانية توضيحية.`,
    };
  }
  
  if (msg.includes('جود') || msg.includes('مشكل') || msg.includes('فارغ') || msg.includes('ناقص') || msg.includes('فحص')) {
    return {
      response: `سأفحص جودة البيانات الآن...`,
      newState: {
        ...currentState,
        stage: 'ready',
        userRequirements: userMessage,
        analysisType: 'quality',
      },
      readyToAnalyze: true,
      finalPrompt: `افحص جودة البيانات واكتشف المشاكل. الأعمدة: ${columns}. 
حدد القيم الفارغة، التعارضات، القيم الشاذة، وقدم توصيات للتحسين.`,
    };
  }

  return {
    response: `فهمت طلبك. سأبدأ التحليل الشامل الآن...`,
    newState: {
      ...currentState,
      stage: 'ready',
      userRequirements: userMessage,
      analysisType: 'custom',
    },
    readyToAnalyze: true,
    finalPrompt: `قم بتحليل شامل للبيانات بناءً على طلب المستخدم: "${userMessage}".
الملف: ${report.summary.fileName}
السجلات: ${report.summary.rowCount}
الأعمدة: ${columns}
قدم تحليلاً احترافياً يشمل: ملخص تنفيذي، إحصائيات رئيسية، رسوم بيانية، وتوصيات.`,
  };
}

export async function sendSmartAnalysisMessage(
  userMessage: string,
  report: AnalysisReport,
  history: ChatMessage[],
  currentState: SmartAnalysisState
): Promise<SmartAnalysisResponse> {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key not found, using fallback');
    return generateFallbackResponse(userMessage, report, currentState);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const prompt = buildSmartPrompt(userMessage, report, history, currentState);

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const text = response.text || '';
    return parseSmartResponse(text, currentState);
  } catch (error) {
    console.error('Smart analysis message failed:', error);
    return generateFallbackResponse(userMessage, report, currentState);
  }
}

export async function generateCustomAnalysis(
  report: AnalysisReport,
  customPrompt: string,
  analysisType: string
): Promise<string> {
  // استخدام المحللات المتخصصة لإنتاج تحليل مفصل
  const recognition = recognizeData(report);
  const isDeliveryInstallation = isDeliveryInstallationData(recognition);
  
  let analysisContext = '';
  
  if (isDeliveryInstallation) {
    const kpis = calculateDeliveryInstallationKPIs(report, recognition);
    const stages = analyzeStages(report, recognition);
    const relationships = analyzeRelationships(report, recognition);
    const criticalCases = analyzeCriticalCases(report, recognition);
    const team = analyzeEmployeePerformance(report, recognition);
    const recommendations = generateRecommendations(kpis, stages, criticalCases, relationships, team);
    
    analysisContext = `
## التحليل التلقائي (تجهيز وتركيب):

### المؤشرات الرئيسية (KPIs):
- نسبة نجاح التجهيز الرئيسي: ${kpis.delivery.deliverySuccessRate.toFixed(1)}%
- نسبة نجاح التركيب الرئيسي: ${kpis.installation.installationSuccessRate.toFixed(1)}%
- نسبة النجاح الكلية: ${kpis.totalSuccessRate.toFixed(1)}%
- فواتير التجهيز الرئيسية: ${kpis.delivery.totalMainInvoices}
- فواتير التركيب الرئيسية: ${kpis.installation.totalMainInvoices}
- المجهزة مسبقاً: ${kpis.installation.preEquipped}
- الزبائن الفريدين: ${kpis.uniqueCustomers}

### رحلة الزبون:
- زبائن لديهم تجهيز + تركيب: ${relationships.journey.customersWithBoth}
- زبائن تجهيز فقط: ${relationships.journey.customersDeliveryOnly}
- زبائن تركيب فقط (مجهزة مسبقاً): ${relationships.journey.customersInstallationOnly}
- زبائن مشكلين: ${relationships.problematicCustomers.length}

### توزيع Stage:
${stages.stages.slice(0, 5).map(s => `- ${s.stage}: ${s.count} (${s.percentage.toFixed(1)}%)`).join('\n')}

### الحالات الحرجة:
- تكملة تجهيز: ${criticalCases.deliveryCompletions.length} تكت
- تكملة تركيب: ${criticalCases.installationCompletions.length} تكت
- حالات مشاكل: ${criticalCases.problemCases.length}

### أداء الفريق:
- عدد الموظفين: ${team.totalEmployees}
- عدد المشرفين: ${team.totalSupervisors}
${team.topEmployees.slice(0, 3).map((e, i) => `- Top ${i + 1}: ${e.name} (${e.totalOperations} عملية)`).join('\n')}

### التقييم العام: ${getRatingLabel(recommendations.conclusion.overallRating)}
### التحدي الرئيسي: ${recommendations.conclusion.mainChallenge}
`;
  }

  if (!GEMINI_API_KEY) {
    return analysisContext || 'لم يتم تكوين مفتاح API. يرجى إضافة VITE_GEMINI_API_KEY';
  }

  const columnsSummary = getColumnsSummary(report.columns);
  const sampleData = report.rawData.slice(0, 30).map((row, i) => 
    `${i + 1}. ${JSON.stringify(row)}`
  ).join('\n');

  const prompt = `أنت محلل بيانات خبير متخصص في إنشاء تقارير احترافية مثل التقارير اليومية للعمليات.

## البيانات:
- الملف: ${report.summary.fileName}
- السجلات: ${report.summary.rowCount}
- الأعمدة: ${report.summary.columnCount}

## الأعمدة:
${columnsSummary}

## عينة من البيانات (30 سجل):
${sampleData}

${analysisContext}

## طلب التحليل من المستخدم:
${customPrompt}

## نوع التحليل: ${analysisType}

## المطلوب:
أنشئ تقريراً احترافياً مفصلاً يشمل:

1. **الملخص التنفيذي** - KPIs الرئيسية والخلاصة
2. **هيكل البيانات** - توزيع السجلات حسب الفئة مع النسب
3. **تحليل التجهيز** (إذا وجد) - جداول تفصيلية
4. **تحليل التركيب** (إذا وجد) - مع المجهزة مسبقاً
5. **العلاقة بين التجهيز والتركيب** - رحلة الزبون
6. **تحليل Stage** - توزيع الحالات
7. **تحليل الموظفين والمشرفين** - Top 10 وأداء المشرفين
8. **الحالات الحرجة** - تكملات ومشاكل بالتفصيل
9. **التوصيات التنفيذية** - ملاحظات وتوصيات عملية
10. **الاستنتاج النهائي** - التقييم والخطوات التالية

استخدم الأرقام الفعلية من التحليل التلقائي أعلاه وقدم تحليلاً عميقاً ومفيداً.
اكتب بالعربية بأسلوب احترافي ومباشر.`;

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    return response.text || analysisContext || 'لم يتم الحصول على نتيجة';
  } catch (error) {
    console.error('Custom analysis failed:', error);
    return analysisContext || 'فشل في إنشاء التحليل. يرجى المحاولة مرة أخرى.';
  }
}
