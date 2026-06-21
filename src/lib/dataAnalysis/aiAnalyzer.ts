import { GoogleGenAI } from '@google/genai';
import type {
  AnalysisReport,
  AIAnalysisResult,
  AIInsight,
  ChartSuggestion,
  ColumnAnalysis,
  ProfessionalReportData,
  ExecutiveSummaryData,
  DataUnderstandingSection,
  AnalysisSection,
  CriticalCase,
  Recommendation,
  ConclusionData,
} from './types';
import { recognizeData, isDeliveryInstallationData } from './dataRecognizer';
import { calculateDeliveryInstallationKPIs, analyzeStages } from './kpiEngine';
import { analyzeRelationships } from './relationshipAnalyzer';
import { analyzeCriticalCases } from './criticalCasesAnalyzer';
import { analyzeEmployeePerformance } from './employeeAnalyzer';
import { generateRecommendations } from './recommendationEngine';
import {
  generateExecutiveNarrative,
  generateDataStructureNarrative,
  generateDeliveryNarrative,
  generateInstallationNarrative,
  generateCustomerJourneyNarrative,
  generateStageNarrative,
  generateTeamNarrative,
  generateCriticalCasesNarrative,
  generateConclusionNarrative,
  generateSimpleNarrative,
} from './narrativeEngine';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

function buildAnalysisPrompt(report: AnalysisReport): string {
  const { summary, columns } = report;

  const columnsSummary = columns
    .map((col) => {
      let details = `- ${col.name} (${col.dataType}): ${col.uniqueCount} قيمة فريدة`;
      if (col.numericStats) {
        details += `، المتوسط: ${col.numericStats.mean.toFixed(2)}، النطاق: ${col.numericStats.min} - ${col.numericStats.max}`;
      }
      if (col.textStats && col.textStats.topValues.length > 0) {
        details += `، الأكثر شيوعاً: ${col.textStats.topValues.slice(0, 3).map((v) => v.value).join('، ')}`;
      }
      if (col.dateStats) {
        details += `، الفترة: ${col.dateStats.earliest} إلى ${col.dateStats.latest}`;
      }
      return details;
    })
    .join('\n');

  return `أنت محلل بيانات خبير. قم بتحليل البيانات التالية وأعط تقريراً شاملاً بالعربية:

## معلومات الملف:
- اسم الملف: ${summary.fileName}
- عدد السجلات: ${summary.rowCount}
- عدد الأعمدة: ${summary.columnCount}
${summary.dateRange ? `- الفترة الزمنية: ${summary.dateRange.from} إلى ${summary.dateRange.to}` : ''}

## الأعمدة:
${columnsSummary}

## المطلوب:
أعطني تحليلاً بصيغة JSON تحتوي على:
1. summary: ملخص تنفيذي للبيانات (فقرة واحدة)
2. insights: مصفوفة من الملاحظات الذكية، كل واحدة تحتوي على:
   - type: "observation" أو "warning" أو "recommendation" أو "pattern" أو "anomaly"
   - title: عنوان قصير
   - description: شرح مفصل
   - importance: "low" أو "medium" أو "high"
3. recommendations: مصفوفة من التوصيات (نصوص)
4. keyFindings: أهم 5 نتائج (نصوص قصيرة)
5. dataQualityScore: تقييم جودة البيانات من 0 إلى 100

أجب فقط بـ JSON صالح بدون أي نص إضافي.`;
}

function buildProfessionalReportPrompt(report: AnalysisReport): string {
  const { summary, columns, rawData } = report;

  const columnsSummary = columns
    .map((col) => {
      let details = `- ${col.name} (${col.dataType}): ${col.uniqueCount} قيمة فريدة، ${col.nullCount} قيمة فارغة`;
      if (col.numericStats) {
        details += `\n  إحصائيات: المجموع=${col.numericStats.sum.toFixed(0)}، المتوسط=${col.numericStats.mean.toFixed(2)}، الحد الأدنى=${col.numericStats.min}، الحد الأقصى=${col.numericStats.max}`;
      }
      if (col.textStats && col.textStats.topValues.length > 0) {
        details += `\n  أكثر القيم شيوعاً: ${col.textStats.topValues.slice(0, 5).map((v) => `${v.value}(${v.count})`).join('، ')}`;
      }
      if (col.dateStats) {
        details += `\n  نطاق التواريخ: ${col.dateStats.earliest} إلى ${col.dateStats.latest}`;
      }
      return details;
    })
    .join('\n');

  const sampleDataStr = rawData.slice(0, 10).map((row, i) => 
    `سجل ${i + 1}: ${JSON.stringify(row)}`
  ).join('\n');

  return `أنت مدير تحليل بيانات خبير جداً. قم بإنشاء تقرير تحليلي احترافي شامل بالعربية.

## معلومات الملف:
- اسم الملف: ${summary.fileName}
- عدد السجلات: ${summary.rowCount}
- عدد الأعمدة: ${summary.columnCount}
${summary.dateRange ? `- الفترة الزمنية: ${summary.dateRange.from} إلى ${summary.dateRange.to}` : ''}

## تفاصيل الأعمدة:
${columnsSummary}

## عينة من البيانات:
${sampleDataStr}

## المطلوب:
أنشئ تقريراً احترافياً بصيغة JSON يحتوي على:

{
  "executiveSummary": {
    "title": "عنوان التقرير",
    "subtitle": "وصف مختصر",
    "kpis": [
      { "id": "kpi1", "title": "اسم المؤشر", "value": "القيمة", "percentage": 95.5, "trend": "up", "color": "green", "description": "شرح" }
    ],
    "summary": "ملخص تنفيذي شامل (فقرتين على الأقل)",
    "highlights": ["نقطة 1", "نقطة 2", "نقطة 3"]
  },
  "dataUnderstanding": {
    "title": "فهم البيانات والتصنيف",
    "description": "شرح عام للبيانات",
    "columns": [
      { "columnName": "اسم العمود", "description": "وصف العمود ودوره", "dataType": "نوع البيانات", "example": "مثال" }
    ],
    "classificationRules": [
      { "category": "الفئة", "condition": "شرط التصنيف", "count": 100, "percentage": 50 }
    ]
  },
  "detailedAnalysis": [
    {
      "id": "analysis1",
      "title": "عنوان التحليل",
      "description": "وصف",
      "tableTitle": "عنوان الجدول",
      "tableHeaders": ["المؤشر", "العدد", "النسبة"],
      "tableRows": [
        { "indicator": "المؤشر", "value": 100, "percentage": "50%", "status": "success" }
      ],
      "analysis": "تحليل النتائج",
      "insights": ["ملاحظة 1", "ملاحظة 2"]
    }
  ],
  "criticalCases": [
    {
      "id": "case1",
      "type": "warning",
      "title": "عنوان الحالة",
      "description": "وصف المشكلة",
      "affectedCount": 10,
      "details": [{ "label": "التفصيل", "value": "القيمة" }],
      "items": [{ "name": "الاسم", "status": "الحالة", "info": "معلومات إضافية" }]
    }
  ],
  "recommendations": [
    {
      "id": "rec1",
      "priority": "high",
      "title": "عنوان التوصية",
      "description": "شرح التوصية",
      "category": "immediate",
      "impact": "التأثير المتوقع"
    }
  ],
  "conclusion": {
    "overallRating": "excellent",
    "ratingScore": 95,
    "summary": "ملخص الاستنتاج النهائي",
    "keyMetrics": [
      { "label": "المقياس", "value": "القيمة", "status": "success" }
    ],
    "finalNotes": ["ملاحظة ختامية 1", "ملاحظة ختامية 2"]
  }
}

## أسلوب الكتابة المطلوب (مهم جداً):
- اكتب بأسلوب تقرير رسمي احترافي كأنك مدير تحليل بيانات خبير
- اشرح كل رقم ونسبة بشكل سردي تفصيلي
- استخدم عبارات مثل: "من خلال تحليل البيانات..."، "يتضح من المؤشرات..."، "بناءً على النتائج..."
- قدم تفسيراً وشرحاً لكل ملاحظة وليس فقط أرقام
- اربط النتائج ببعضها البعض بشكل منطقي
- اجعل القارئ يفهم القصة وراء الأرقام

## الحقول السردية المطلوبة (أضفها لكل قسم):
- executiveSummary يجب أن يحتوي على:
  - narrativeIntro: مقدمة سردية احترافية (3-4 جمل تشرح سياق التقرير)
  - narrativeAnalysis: تحليل سردي مفصل يفسر كل KPI ومعناه (فقرة كاملة)
  - narrativeConclusion: خلاصة سردية تلخص أهم النقاط
- dataUnderstanding يجب أن يحتوي على:
  - narrativeExplanation: شرح سردي لهيكل البيانات وكيفية تصنيفها
- كل عنصر في detailedAnalysis يجب أن يحتوي على:
  - narrativeExplanation: شرح سردي للقسم
  - detailedNarrative: تفسير مفصل للأرقام في الجدول
- كل حالة في criticalCases يجب أن تحتوي على:
  - narrativeDescription: وصف سردي تفصيلي للحالة
  - actionNarrative: شرح الإجراء المطلوب بالتفصيل
- conclusion يجب أن يحتوي على:
  - fullNarrative: سرد كامل للاستنتاج النهائي (فقرتين على الأقل)
  - expertOpinion: رأي المحلل الخبير في البيانات

ملاحظات هامة:
- اجعل التقرير احترافياً ومفصلاً مع سرد كلامي غني
- استخدم أرقاماً ونسباً حقيقية من البيانات مع تفسيرها
- حدد الحالات الحرجة والتعارضات إن وجدت مع شرحها
- قدم توصيات عملية ومحددة مع تبريرها
- اجعل التحليل عميقاً ومفيداً كأنه مكتوب بواسطة خبير
- أجب فقط بـ JSON صالح بدون أي نص إضافي`;
}

function parseAIResponse(response: string): Partial<AIAnalysisResult> {
  try {
    let jsonStr = response.trim();
    
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
      summary: parsed.summary || '',
      insights: (parsed.insights || []).map((i: Record<string, unknown>) => ({
        type: i.type || 'observation',
        title: i.title || '',
        description: i.description || '',
        importance: i.importance || 'medium',
      })),
      recommendations: parsed.recommendations || [],
      keyFindings: parsed.keyFindings || [],
      dataQualityScore: parsed.dataQualityScore || 75,
    };
  } catch {
    return {};
  }
}

function generateFallbackAnalysis(report: AnalysisReport): AIAnalysisResult {
  const { summary, columns } = report;
  const insights: AIInsight[] = [];

  insights.push({
    type: 'observation',
    title: 'حجم البيانات',
    description: `الملف يحتوي على ${summary.rowCount.toLocaleString('ar-IQ')} سجل و ${summary.columnCount} عمود.`,
    importance: 'medium',
  });

  const numericCols = columns.filter((c) => c.numericStats);
  for (const col of numericCols.slice(0, 2)) {
    if (col.numericStats) {
      if (col.numericStats.stdDev > col.numericStats.mean * 0.5) {
        insights.push({
          type: 'warning',
          title: `تباين عالي في ${col.name}`,
          description: `الانحراف المعياري (${col.numericStats.stdDev.toFixed(2)}) كبير مقارنة بالمتوسط (${col.numericStats.mean.toFixed(2)})، مما يشير إلى تشتت كبير في القيم.`,
          importance: 'high',
          relatedColumns: [col.name],
        });
      }

      if (col.numericStats.zeroCount > summary.rowCount * 0.1) {
        insights.push({
          type: 'observation',
          title: `قيم صفرية في ${col.name}`,
          description: `${col.numericStats.zeroCount} سجل (${((col.numericStats.zeroCount / summary.rowCount) * 100).toFixed(1)}%) يحتوي على قيمة صفر.`,
          importance: 'medium',
          relatedColumns: [col.name],
        });
      }
    }
  }

  const textCols = columns.filter((c) => c.textStats);
  for (const col of textCols.slice(0, 2)) {
    if (col.textStats && col.textStats.topValues.length > 0) {
      const topValue = col.textStats.topValues[0];
      if (topValue.percentage > 50) {
        insights.push({
          type: 'pattern',
          title: `قيمة مهيمنة في ${col.name}`,
          description: `"${topValue.value}" تمثل ${topValue.percentage.toFixed(1)}% من إجمالي القيم.`,
          importance: 'medium',
          relatedColumns: [col.name],
        });
      }
    }
  }

  const colsWithNulls = columns.filter((c) => c.nullCount > summary.rowCount * 0.05);
  if (colsWithNulls.length > 0) {
    insights.push({
      type: 'warning',
      title: 'قيم فارغة',
      description: `الأعمدة التالية تحتوي على قيم فارغة: ${colsWithNulls.map((c) => `${c.name} (${c.nullCount})`).join('، ')}`,
      importance: 'medium',
      relatedColumns: colsWithNulls.map((c) => c.name),
    });
  }

  const nullPercentage = columns.reduce((acc, c) => acc + c.nullCount, 0) / (summary.rowCount * summary.columnCount);
  const dataQualityScore = Math.round(100 - nullPercentage * 100);

  return {
    summary: `تم تحليل ملف "${summary.fileName}" الذي يحتوي على ${summary.rowCount.toLocaleString('ar-IQ')} سجل و ${summary.columnCount} عمود. ${summary.dateRange ? `البيانات تغطي الفترة من ${summary.dateRange.from} إلى ${summary.dateRange.to}.` : ''} الملف يحتوي على ${summary.numericColumnsCount} عمود رقمي و ${summary.textColumnsCount} عمود نصي${summary.dateColumnsCount > 0 ? ` و ${summary.dateColumnsCount} عمود تاريخ` : ''}.`,
    insights,
    recommendations: [
      'مراجعة القيم الفارغة ومعالجتها حسب الحاجة',
      'التحقق من القيم الشاذة في الأعمدة الرقمية',
      'تحليل الاتجاهات الزمنية إن وجدت',
    ],
    chartSuggestions: [],
    dataQualityScore,
    keyFindings: [
      `إجمالي السجلات: ${summary.rowCount.toLocaleString('ar-IQ')}`,
      `عدد الأعمدة: ${summary.columnCount}`,
      numericCols.length > 0 && numericCols[0].numericStats
        ? `أعلى قيمة في ${numericCols[0].name}: ${numericCols[0].numericStats.max.toLocaleString('ar-IQ')}`
        : null,
      textCols.length > 0 && textCols[0].textStats?.topValues[0]
        ? `الأكثر شيوعاً في ${textCols[0].name}: ${textCols[0].textStats.topValues[0].value}`
        : null,
      `جودة البيانات: ${dataQualityScore}%`,
    ].filter(Boolean) as string[],
  };
}

export async function analyzeWithAI(report: AnalysisReport): Promise<AIAnalysisResult> {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key not found, using fallback analysis');
    return generateFallbackAnalysis(report);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const prompt = buildAnalysisPrompt(report);

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const text = response.text || '';
    const parsed = parseAIResponse(text);

    if (parsed.summary && parsed.insights) {
      return {
        summary: parsed.summary,
        insights: parsed.insights,
        recommendations: parsed.recommendations || [],
        chartSuggestions: parsed.chartSuggestions || [],
        dataQualityScore: parsed.dataQualityScore || 75,
        keyFindings: parsed.keyFindings || [],
      };
    }

    return generateFallbackAnalysis(report);
  } catch (error) {
    console.error('AI analysis failed:', error);
    return generateFallbackAnalysis(report);
  }
}

export function isAIAvailable(): boolean {
  return !!GEMINI_API_KEY;
}

function parseProfessionalReportResponse(response: string, report: AnalysisReport): Partial<ProfessionalReportData> {
  try {
    let jsonStr = response.trim();
    
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
      executiveSummary: parsed.executiveSummary,
      dataUnderstanding: parsed.dataUnderstanding,
      detailedAnalysis: parsed.detailedAnalysis || [],
      criticalCases: parsed.criticalCases || [],
      recommendations: parsed.recommendations || [],
      conclusion: parsed.conclusion,
    };
  } catch (e) {
    console.error('Failed to parse professional report response:', e);
    return {};
  }
}

function generateFallbackProfessionalReport(report: AnalysisReport): ProfessionalReportData {
  const { summary, columns } = report;
  const now = new Date();
  
  const numericCols = columns.filter((c) => c.numericStats);
  const textCols = columns.filter((c) => c.textStats);

  const recognition = recognizeData(report);
  const isDeliveryInstallation = isDeliveryInstallationData(recognition);
  
  let narrativeSections: ProfessionalReportData['narrativeSections'] = {};
  let executiveNarrative = { intro: '', analysis: '', highlights: '', conclusion: '' };
  let conclusionNarrative = { overallAssessment: '', keyFindings: '', challenges: '', recommendations: '', finalStatement: '', expertOpinion: '' };

  if (isDeliveryInstallation) {
    const kpis = calculateDeliveryInstallationKPIs(report, recognition);
    const stages = analyzeStages(report, recognition);
    const relationships = analyzeRelationships(report, recognition);
    const criticalCases = analyzeCriticalCases(report, recognition);
    const team = analyzeEmployeePerformance(report, recognition);
    const recommendations = generateRecommendations(kpis, stages, criticalCases, relationships, team);

    executiveNarrative = generateExecutiveNarrative(report, kpis, criticalCases);
    const deliveryNarrative = generateDeliveryNarrative(kpis);
    const installationNarrative = generateInstallationNarrative(kpis);
    const teamNarrative = generateTeamNarrative(team);
    const criticalNarrative = generateCriticalCasesNarrative(criticalCases);
    conclusionNarrative = generateConclusionNarrative(kpis, stages, criticalCases, recommendations);

    narrativeSections = {
      dataStructureNarrative: generateDataStructureNarrative(report, recognition),
      deliveryNarrative: `${deliveryNarrative.overview}\n\n${deliveryNarrative.mainInvoices}\n\n${deliveryNarrative.subTickets}\n\n${deliveryNarrative.successAnalysis}\n\n${deliveryNarrative.compensationAnalysis}`,
      installationNarrative: `${installationNarrative.overview}\n\n${installationNarrative.mainInvoices}\n\n${installationNarrative.preEquipped}\n\n${installationNarrative.successAnalysis}\n\n${installationNarrative.compensationAnalysis}`,
      customerJourneyNarrative: generateCustomerJourneyNarrative(relationships, kpis),
      stageNarrative: generateStageNarrative(stages),
      teamNarrative: `${teamNarrative.overview}\n\n${teamNarrative.topPerformers}\n\n${teamNarrative.supervisors}\n\n${teamNarrative.workDistribution}`,
      criticalCasesNarrative: `${criticalNarrative.overview}\n\n${criticalNarrative.deliveryCompletions}\n\n${criticalNarrative.installationCompletions}\n\n${criticalNarrative.problemCases}\n\n${criticalNarrative.repeatedCustomers}\n\n${criticalNarrative.urgentActions}`,
    };
  }
  
  const kpis: ProfessionalReportData['executiveSummary']['kpis'] = [
    {
      id: 'total-records',
      title: 'إجمالي السجلات',
      value: summary.rowCount.toLocaleString('ar-IQ'),
      color: 'blue',
      description: 'عدد السجلات الكلي في الملف',
    },
    {
      id: 'total-columns',
      title: 'عدد الأعمدة',
      value: summary.columnCount,
      color: 'purple',
      description: 'عدد الحقول في البيانات',
    },
  ];

  if (numericCols.length > 0 && numericCols[0].numericStats) {
    const col = numericCols[0];
    kpis.push({
      id: 'numeric-sum',
      title: `مجموع ${col.name}`,
      value: col.numericStats!.sum.toLocaleString('ar-IQ'),
      color: 'green',
    });
  }

  const nullPercentage = columns.reduce((acc, c) => acc + c.nullCount, 0) / (summary.rowCount * summary.columnCount) * 100;
  const dataQuality = Math.round(100 - nullPercentage);
  
  kpis.push({
    id: 'data-quality',
    title: 'جودة البيانات',
    value: `${dataQuality}%`,
    percentage: dataQuality,
    color: dataQuality >= 80 ? 'green' : dataQuality >= 60 ? 'amber' : 'red',
    trend: 'neutral',
  });

  const detailedAnalysis: AnalysisSection[] = [];
  
  if (numericCols.length > 0) {
    detailedAnalysis.push({
      id: 'numeric-analysis',
      title: 'تحليل البيانات الرقمية',
      description: 'إحصائيات الأعمدة الرقمية',
      tableTitle: 'جدول التحليل الرقمي',
      tableHeaders: ['العمود', 'المجموع', 'المتوسط', 'الحد الأدنى', 'الحد الأقصى'],
      tableRows: numericCols.slice(0, 5).map((col) => ({
        indicator: col.name,
        value: col.numericStats?.sum.toLocaleString('ar-IQ') || '—',
        percentage: col.numericStats ? `${col.numericStats.mean.toFixed(2)}` : '—',
        status: 'info' as const,
      })),
      analysis: `تم تحليل ${numericCols.length} عمود رقمي`,
    });
  }

  if (textCols.length > 0) {
    detailedAnalysis.push({
      id: 'text-analysis',
      title: 'تحليل البيانات النصية',
      description: 'توزيع القيم النصية',
      tableTitle: 'جدول التحليل النصي',
      tableHeaders: ['العمود', 'القيم الفريدة', 'الأكثر شيوعاً', 'النسبة'],
      tableRows: textCols.slice(0, 5).map((col) => ({
        indicator: col.name,
        value: col.uniqueCount,
        percentage: col.textStats?.topValues[0] 
          ? `${col.textStats.topValues[0].value} (${col.textStats.topValues[0].percentage.toFixed(1)}%)`
          : '—',
        status: 'info' as const,
      })),
      analysis: `تم تحليل ${textCols.length} عمود نصي`,
    });
  }

  const criticalCases: CriticalCase[] = [];
  
  const colsWithNulls = columns.filter((c) => c.nullCount > summary.rowCount * 0.05);
  if (colsWithNulls.length > 0) {
    criticalCases.push({
      id: 'null-values',
      type: 'warning',
      title: 'قيم فارغة مرتفعة',
      description: `يوجد ${colsWithNulls.length} أعمدة تحتوي على نسبة عالية من القيم الفارغة`,
      affectedCount: colsWithNulls.reduce((acc, c) => acc + c.nullCount, 0),
      details: colsWithNulls.map((c) => ({
        label: c.name,
        value: `${c.nullCount} قيمة فارغة (${((c.nullCount / summary.rowCount) * 100).toFixed(1)}%)`,
      })),
    });
  }

  return {
    id: `report-${Date.now()}`,
    title: `تقرير تحليل ${summary.fileName}`,
    subtitle: `تحليل شامل للبيانات`,
    generatedAt: now.toISOString(),
    tableOfContents: [
      { id: 'executive-summary', title: 'الملخص التنفيذي', pageNumber: 1, level: 1 },
      { id: 'data-understanding', title: 'فهم البيانات والتصنيف', pageNumber: 2, level: 1 },
      { id: 'detailed-analysis', title: 'التحليلات التفصيلية', pageNumber: 3, level: 1 },
      { id: 'critical-cases', title: 'الحالات الحرجة', pageNumber: 4, level: 1 },
      { id: 'recommendations', title: 'التوصيات', pageNumber: 5, level: 1 },
      { id: 'conclusion', title: 'الاستنتاج النهائي', pageNumber: 6, level: 1 },
    ],
    executiveSummary: {
      title: `تقرير تحليلي - ${summary.fileName}`,
      subtitle: `${now.toLocaleDateString('ar-IQ')}`,
      date: now.toLocaleDateString('ar-IQ'),
      kpis,
      summary: executiveNarrative.analysis || `يقدم هذا التقرير تحليلاً شاملاً ومفصلاً لملف "${summary.fileName}" الذي يحتوي على ${summary.rowCount.toLocaleString('ar-IQ')} سجل و ${summary.columnCount} عمود. ${summary.dateRange ? `البيانات تغطي الفترة من ${summary.dateRange.from} إلى ${summary.dateRange.to}.` : ''} تم تحليل ${summary.numericColumnsCount} عمود رقمي و ${summary.textColumnsCount} عمود نصي${summary.dateColumnsCount > 0 ? ` و ${summary.dateColumnsCount} عمود تاريخ` : ''}.`,
      highlights: [
        `إجمالي السجلات: ${summary.rowCount.toLocaleString('ar-IQ')}`,
        `جودة البيانات: ${dataQuality}%`,
        `الأعمدة الرقمية: ${summary.numericColumnsCount}`,
        `الأعمدة النصية: ${summary.textColumnsCount}`,
      ],
      narrativeIntro: executiveNarrative.intro || generateSimpleNarrative(summary.fileName, summary.rowCount, summary.columnCount, dataQuality),
      narrativeAnalysis: executiveNarrative.analysis || '',
      narrativeConclusion: executiveNarrative.conclusion || '',
    },
    dataUnderstanding: {
      title: 'فهم البيانات والتصنيف',
      description: 'تحليل هيكل البيانات والأعمدة وعلاقاتها',
      columns: columns.map((col) => ({
        columnName: col.name,
        description: `عمود من نوع ${col.dataType} يحتوي على ${col.uniqueCount} قيمة فريدة`,
        dataType: col.dataType,
        example: col.sampleValues[0] ? String(col.sampleValues[0]) : '—',
      })),
      classificationRules: [],
      narrativeExplanation: narrativeSections.dataStructureNarrative || `يتكون هذا الملف من ${summary.rowCount.toLocaleString('ar-IQ')} سجل موزعة على ${summary.columnCount} عمود. تم تحليل البيانات وتصنيفها تلقائياً حسب نوعها ومحتواها.`,
    },
    detailedAnalysis,
    criticalCases,
    charts: report.charts,
    recommendations: [
      {
        id: 'rec-1',
        priority: 'medium',
        title: 'مراجعة القيم الفارغة',
        description: 'يُنصح بمراجعة ومعالجة القيم الفارغة في البيانات',
        category: 'short-term',
      },
      {
        id: 'rec-2',
        priority: 'low',
        title: 'توثيق البيانات',
        description: 'إنشاء توثيق شامل لمعنى كل عمود وقواعد التحقق',
        category: 'long-term',
      },
    ],
    conclusion: {
      overallRating: dataQuality >= 80 ? 'excellent' : dataQuality >= 60 ? 'good' : dataQuality >= 40 ? 'fair' : 'poor',
      ratingScore: dataQuality,
      summary: conclusionNarrative.overallAssessment || `بناءً على التحليل الشامل، تُقيّم جودة البيانات بـ ${dataQuality}%. البيانات ${dataQuality >= 80 ? 'ممتازة وجاهزة للاستخدام' : dataQuality >= 60 ? 'جيدة مع بعض التحسينات المطلوبة' : 'تحتاج إلى مراجعة ومعالجة'}.`,
      keyMetrics: [
        { label: 'جودة البيانات', value: `${dataQuality}%`, status: dataQuality >= 80 ? 'success' : dataQuality >= 60 ? 'warning' : 'danger' },
        { label: 'اكتمال السجلات', value: `${(100 - nullPercentage).toFixed(1)}%`, status: nullPercentage < 5 ? 'success' : nullPercentage < 15 ? 'warning' : 'danger' },
      ],
      finalNotes: conclusionNarrative.finalStatement ? [
        conclusionNarrative.finalStatement,
        'يُنصح بمراجعة التوصيات والعمل عليها لتحسين الأداء',
      ] : [
        'تم إعداد هذا التقرير تلقائياً بناءً على تحليل البيانات',
        'يُنصح بمراجعة التوصيات والعمل عليها لتحسين جودة البيانات',
      ],
      fullNarrative: `${conclusionNarrative.overallAssessment}\n\n${conclusionNarrative.keyFindings}\n\n${conclusionNarrative.challenges}\n\n${conclusionNarrative.recommendations}\n\n${conclusionNarrative.finalStatement}`.trim() || undefined,
      expertOpinion: conclusionNarrative.expertOpinion || undefined,
    },
    metadata: {
      fileName: summary.fileName,
      rowCount: summary.rowCount,
      columnCount: summary.columnCount,
      dateRange: summary.dateRange,
    },
    narrativeSections: Object.keys(narrativeSections).length > 0 ? narrativeSections : undefined,
  };
}

export async function generateProfessionalReport(report: AnalysisReport): Promise<ProfessionalReportData> {
  const fallbackReport = generateFallbackProfessionalReport(report);
  
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key not found, using fallback professional report');
    return fallbackReport;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const prompt = buildProfessionalReportPrompt(report);

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const text = response.text || '';
    const parsed = parseProfessionalReportResponse(text, report);

    if (parsed.executiveSummary && parsed.conclusion) {
      return {
        ...fallbackReport,
        executiveSummary: {
          ...fallbackReport.executiveSummary,
          ...parsed.executiveSummary,
          date: new Date().toLocaleDateString('ar-IQ'),
        },
        dataUnderstanding: parsed.dataUnderstanding || fallbackReport.dataUnderstanding,
        detailedAnalysis: parsed.detailedAnalysis?.length ? parsed.detailedAnalysis : fallbackReport.detailedAnalysis,
        criticalCases: parsed.criticalCases?.length ? parsed.criticalCases : fallbackReport.criticalCases,
        recommendations: parsed.recommendations?.length ? parsed.recommendations : fallbackReport.recommendations,
        conclusion: parsed.conclusion || fallbackReport.conclusion,
      };
    }

    return fallbackReport;
  } catch (error) {
    console.error('Professional report generation failed:', error);
    return fallbackReport;
  }
}
