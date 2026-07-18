import { GoogleGenAI } from '@google/genai';
import type {
  ChatMessage,
  ChatSession,
  ChatContext,
  AnalysisReport,
  ColumnAnalysis,
} from './types';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

function buildChatPrompt(
  question: string,
  context: ChatContext,
  history: ChatMessage[]
): string {
  const columnsSummary = context.columns
    .map((col) => {
      let details = `- ${col.name} (${col.dataType}): ${col.uniqueCount} قيمة فريدة`;
      if (col.numericStats) {
        details += `، المجموع: ${col.numericStats.sum}، المتوسط: ${col.numericStats.mean.toFixed(2)}، الحد الأدنى: ${col.numericStats.min}، الحد الأقصى: ${col.numericStats.max}`;
      }
      if (col.textStats && col.textStats.topValues.length > 0) {
        details += `، الأكثر شيوعاً: ${col.textStats.topValues.slice(0, 3).map((v) => `${v.value}(${v.count})`).join('، ')}`;
      }
      return details;
    })
    .join('\n');

  const sampleDataStr = context.sampleData
    .slice(0, 5)
    .map((row, i) => `سجل ${i + 1}: ${JSON.stringify(row)}`)
    .join('\n');

  const historyStr = history
    .filter((m) => m.role !== 'system')
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'المستخدم' : 'المساعد'}: ${m.content}`)
    .join('\n');

  return `أنت مساعد تحليل بيانات ذكي. أجب على أسئلة المستخدم بناءً على البيانات المتاحة.

## معلومات الملف:
- اسم الملف: ${context.reportSummary.fileName}
- عدد السجلات: ${context.reportSummary.rowCount}
- عدد الأعمدة: ${context.reportSummary.columnCount}
${context.reportSummary.dateRange ? `- الفترة الزمنية: ${context.reportSummary.dateRange.from} إلى ${context.reportSummary.dateRange.to}` : ''}

## الأعمدة:
${columnsSummary}

## عينة من البيانات:
${sampleDataStr}

${context.aiAnalysis?.summary ? `## ملخص التحليل السابق:\n${context.aiAnalysis.summary}` : ''}

${historyStr ? `## المحادثة السابقة:\n${historyStr}` : ''}

## سؤال المستخدم:
${question}

## تعليمات:
- أجب بالعربية فقط
- كن دقيقاً وموجزاً
- استخدم الأرقام والإحصائيات من البيانات المتاحة
- إذا كان السؤال يتطلب حساباً، قم بالحساب وأظهر النتيجة
- إذا كان السؤال خارج نطاق البيانات، أخبر المستخدم بذلك
- يمكنك اقتراح أسئلة متابعة إذا كان ذلك مفيداً

أجب الآن:`;
}

function generateFallbackResponse(question: string, context: ChatContext): string {
  const q = question.toLowerCase();
  
  if (q.includes('كم') || q.includes('عدد')) {
    if (q.includes('سجل') || q.includes('صف')) {
      return `إجمالي السجلات في الملف: ${context.reportSummary.rowCount.toLocaleString('ar-IQ')} سجل.`;
    }
    if (q.includes('عمود') || q.includes('حقل')) {
      return `إجمالي الأعمدة في الملف: ${context.reportSummary.columnCount} عمود.`;
    }
  }

  if (q.includes('ملخص') || q.includes('نظرة عامة')) {
    return `ملخص الملف "${context.reportSummary.fileName}":
- إجمالي السجلات: ${context.reportSummary.rowCount.toLocaleString('ar-IQ')}
- إجمالي الأعمدة: ${context.reportSummary.columnCount}
- الأعمدة الرقمية: ${context.reportSummary.numericColumnsCount}
- الأعمدة النصية: ${context.reportSummary.textColumnsCount}
${context.reportSummary.dateRange ? `- الفترة: ${context.reportSummary.dateRange.from} إلى ${context.reportSummary.dateRange.to}` : ''}`;
  }

  if (q.includes('أعمدة') || q.includes('حقول')) {
    const colNames = context.columns.map((c) => c.name).join('، ');
    return `الأعمدة المتاحة في الملف:\n${colNames}`;
  }

  const numericCols = context.columns.filter((c) => c.numericStats);
  if (numericCols.length > 0) {
    if (q.includes('مجموع') || q.includes('إجمالي')) {
      const col = numericCols[0];
      return `مجموع عمود "${col.name}": ${col.numericStats!.sum.toLocaleString('ar-IQ')}`;
    }
    if (q.includes('متوسط') || q.includes('معدل')) {
      const col = numericCols[0];
      return `متوسط عمود "${col.name}": ${col.numericStats!.mean.toFixed(2)}`;
    }
  }

  return `شكراً لسؤالك. بناءً على البيانات المتاحة في ملف "${context.reportSummary.fileName}" الذي يحتوي على ${context.reportSummary.rowCount.toLocaleString('ar-IQ')} سجل، يمكنني مساعدتك في:
- استعراض إحصائيات الأعمدة
- حساب المجاميع والمتوسطات
- تحليل توزيع البيانات
- الإجابة على أسئلة محددة عن البيانات

هل يمكنك توضيح سؤالك أكثر؟`;
}

export async function sendChatMessage(
  question: string,
  context: ChatContext,
  history: ChatMessage[]
): Promise<string> {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key not found, using fallback response');
    return generateFallbackResponse(question, context);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const prompt = buildChatPrompt(question, context, history);

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    return response.text || generateFallbackResponse(question, context);
  } catch (error) {
    console.error('Chat message failed:', error);
    return generateFallbackResponse(question, context);
  }
}

export function createChatSession(report: AnalysisReport): ChatSession {
  const now = new Date().toISOString();
  return {
    id: `chat-${Date.now()}`,
    reportId: report.id,
    messages: [
      {
        id: `msg-${Date.now()}`,
        role: 'system',
        content: `مرحباً! أنا مساعد تحليل البيانات الذكي. يمكنني مساعدتك في فهم وتحليل ملف "${report.summary.fileName}" الذي يحتوي على ${report.summary.rowCount.toLocaleString('ar-IQ')} سجل و ${report.summary.columnCount} عمود.

اسألني أي سؤال عن البيانات وسأحاول مساعدتك!`,
        timestamp: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export function createChatContext(report: AnalysisReport): ChatContext {
  return {
    reportSummary: report.summary,
    columns: report.columns,
    sampleData: report.rawData.slice(0, 50),
    aiAnalysis: report.aiAnalysis,
  };
}

export function addMessageToSession(
  session: ChatSession,
  role: 'user' | 'assistant',
  content: string
): ChatSession {
  const now = new Date().toISOString();
  return {
    ...session,
    messages: [
      ...session.messages,
      {
        id: `msg-${Date.now()}`,
        role,
        content,
        timestamp: now,
      },
    ],
    updatedAt: now,
  };
}

export const SUGGESTED_QUESTIONS = [
  'ما هو ملخص البيانات؟',
  'كم عدد السجلات في الملف؟',
  'ما هي الأعمدة المتاحة؟',
  'ما هو متوسط القيم الرقمية؟',
  'ما هي القيم الأكثر تكراراً؟',
  'هل توجد قيم فارغة؟',
  'ما هي أعلى قيمة؟',
  'ما هي توصياتك لتحسين البيانات؟',
];
