/**
 * محرك التعرف الذكي على البيانات
 * يقوم بتحليل البيانات وتحديد نوعها والأعمدة المهمة
 */

import type { ColumnAnalysis, AnalysisReport } from './types';

// أنواع البيانات المدعومة
export type DataType = 
  | 'delivery_installation'  // تجهيز وتركيب
  | 'sales'                  // مبيعات
  | 'attendance'             // حضور وانصراف
  | 'inventory'              // مخزون
  | 'customers'              // عملاء
  | 'financial'              // مالية
  | 'general';               // عام

// الأعمدة المهمة المكتشفة
export interface RecognizedColumns {
  operationType?: string;      // نوع العملية (تجهيز/تركيب/تكملة)
  stage?: string;              // المرحلة (جديد/منجز/إلخ)
  customer?: string;           // اسم الزبون
  employee?: string;           // الموظف المنفذ
  supervisor?: string;         // المشرف
  date?: string;               // التاريخ
  amount?: string;             // المبلغ
  quantity?: string;           // الكمية
  status?: string;             // الحالة
  category?: string;           // الفئة
  region?: string;             // المنطقة
  ticketId?: string;           // رقم التكت
  invoiceId?: string;          // رقم الفاتورة
  product?: string;            // المنتج
}

// نتيجة التعرف على البيانات
export interface DataRecognitionResult {
  dataType: DataType;
  confidence: number;
  recognizedColumns: RecognizedColumns;
  dataStructure: DataStructure;
  suggestions: string[];
}

// هيكل البيانات
export interface DataStructure {
  totalRecords: number;
  categories: DataCategory[];
  dateRange?: { from: string; to: string };
}

export interface DataCategory {
  name: string;
  count: number;
  percentage: number;
  description: string;
}

// أنماط الأعمدة للتعرف
const COLUMN_PATTERNS: Record<keyof RecognizedColumns, RegExp[]> = {
  operationType: [
    /operation.*type/i, /نوع.*العملية/i, /type/i, /عملية/i,
    /op.*type/i, /نوع/i
  ],
  stage: [
    /stage/i, /المرحلة/i, /الحالة/i, /status/i, /مرحلة/i,
    /حالة/i, /state/i
  ],
  customer: [
    /customer/i, /client/i, /زبون/i, /عميل/i, /الزبون/i,
    /العميل/i, /اسم.*الزبون/i, /اسم.*العميل/i, /customer.*name/i
  ],
  employee: [
    /employee/i, /موظف/i, /المنفذ/i, /الفني/i, /technician/i,
    /worker/i, /عامل/i, /منفذ/i, /assigned/i
  ],
  supervisor: [
    /supervisor/i, /مشرف/i, /المشرف/i, /manager/i, /مدير/i,
    /team.*lead/i, /قائد/i
  ],
  date: [
    /date/i, /تاريخ/i, /التاريخ/i, /created/i, /timestamp/i,
    /time/i, /وقت/i, /يوم/i
  ],
  amount: [
    /amount/i, /مبلغ/i, /المبلغ/i, /total/i, /price/i, /سعر/i,
    /قيمة/i, /value/i, /cost/i, /تكلفة/i
  ],
  quantity: [
    /quantity/i, /كمية/i, /الكمية/i, /count/i, /عدد/i, /qty/i,
    /number/i, /رقم/i
  ],
  status: [
    /status/i, /حالة/i, /الحالة/i, /state/i, /condition/i
  ],
  category: [
    /category/i, /فئة/i, /الفئة/i, /type/i, /نوع/i, /class/i,
    /صنف/i, /تصنيف/i
  ],
  region: [
    /region/i, /منطقة/i, /المنطقة/i, /area/i, /zone/i, /محافظة/i,
    /city/i, /مدينة/i, /location/i, /موقع/i
  ],
  ticketId: [
    /ticket/i, /تكت/i, /التكت/i, /ticket.*id/i, /رقم.*التكت/i,
    /تذكرة/i, /task.*id/i
  ],
  invoiceId: [
    /invoice/i, /فاتورة/i, /الفاتورة/i, /bill/i, /رقم.*الفاتورة/i,
    /invoice.*id/i, /bill.*no/i
  ],
  product: [
    /product/i, /منتج/i, /المنتج/i, /item/i, /عنصر/i, /سلعة/i,
    /صنف/i, /بضاعة/i
  ],
};

// قيم Operation Type للتجهيز والتركيب
const DELIVERY_INSTALLATION_VALUES = [
  'تجهيز', 'تركيب', 'تكملة تجهيز', 'تكملة تركيب', 'مجهزة مسبقاً',
  'delivery', 'installation', 'تجهيز s', 'تركيب s',
  'delivery - s', 'installation - s'
];

// قيم Stage
const STAGE_VALUES = [
  'جديد', 'منجز بالكامل', 'تم الانجاز-قيد التدقيق', 'قيد العمل',
  'بانتظار الموافقة', 'يوجد مشكلة', 'cancelled', 'ملغي',
  'new', 'completed', 'in progress', 'pending'
];

/**
 * التعرف على نوع العمود
 */
function recognizeColumn(columnName: string, columnValues: unknown[]): keyof RecognizedColumns | null {
  const normalizedName = columnName.toLowerCase().trim();
  
  for (const [columnType, patterns] of Object.entries(COLUMN_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedName)) {
        return columnType as keyof RecognizedColumns;
      }
    }
  }
  
  // التحقق من القيم للتعرف على Operation Type أو Stage
  const sampleValues = columnValues.slice(0, 100).map(v => String(v).toLowerCase());
  
  const hasDeliveryInstallation = sampleValues.some(v => 
    DELIVERY_INSTALLATION_VALUES.some(dv => v.includes(dv.toLowerCase()))
  );
  if (hasDeliveryInstallation) return 'operationType';
  
  const hasStageValues = sampleValues.some(v => 
    STAGE_VALUES.some(sv => v.includes(sv.toLowerCase()))
  );
  if (hasStageValues) return 'stage';
  
  return null;
}

/**
 * تحديد نوع البيانات بناءً على الأعمدة المكتشفة
 */
function determineDataType(columns: RecognizedColumns): { type: DataType; confidence: number } {
  let deliveryScore = 0;
  let salesScore = 0;
  let attendanceScore = 0;
  let inventoryScore = 0;
  
  if (columns.operationType) deliveryScore += 40;
  if (columns.stage) deliveryScore += 20;
  if (columns.employee) deliveryScore += 15;
  if (columns.supervisor) deliveryScore += 15;
  if (columns.customer) deliveryScore += 10;
  if (columns.ticketId) deliveryScore += 20;
  
  if (columns.amount) salesScore += 30;
  if (columns.product) salesScore += 25;
  if (columns.quantity) salesScore += 20;
  if (columns.customer) salesScore += 15;
  
  if (columns.employee && columns.date && !columns.operationType) attendanceScore += 40;
  
  if (columns.product && columns.quantity && !columns.customer) inventoryScore += 50;
  
  const scores = [
    { type: 'delivery_installation' as DataType, score: deliveryScore },
    { type: 'sales' as DataType, score: salesScore },
    { type: 'attendance' as DataType, score: attendanceScore },
    { type: 'inventory' as DataType, score: inventoryScore },
  ];
  
  scores.sort((a, b) => b.score - a.score);
  
  if (scores[0].score >= 50) {
    return { type: scores[0].type, confidence: Math.min(scores[0].score, 100) / 100 };
  }
  
  return { type: 'general', confidence: 0.5 };
}

/**
 * تحليل هيكل البيانات لبيانات التجهيز والتركيب
 */
function analyzeDeliveryInstallationStructure(
  data: Record<string, unknown>[],
  columns: RecognizedColumns
): DataCategory[] {
  const categories: DataCategory[] = [];
  const total = data.length;
  
  if (!columns.operationType) return categories;
  
  const opTypeCol = columns.operationType;
  const operationCounts: Record<string, number> = {};
  
  data.forEach(row => {
    const opType = String(row[opTypeCol] || '').trim();
    if (opType) {
      operationCounts[opType] = (operationCounts[opType] || 0) + 1;
    }
  });
  
  // تصنيف العمليات
  let deliveryMain = 0;
  let installationMain = 0;
  let subTickets = 0;
  let returns = 0;
  
  for (const [opType, count] of Object.entries(operationCounts)) {
    const lower = opType.toLowerCase();
    
    if (lower.includes('delivery') && lower.includes('s') || lower === 'تجهيز') {
      deliveryMain += count;
    } else if (lower.includes('installation') && lower.includes('s') || lower === 'تركيب') {
      installationMain += count;
    } else if (lower.includes('مردود') || lower.includes('return')) {
      returns += count;
    } else {
      subTickets += count;
    }
  }
  
  if (deliveryMain > 0) {
    categories.push({
      name: 'فواتير تجهيز رئيسية (Delivery - S)',
      count: deliveryMain,
      percentage: (deliveryMain / total) * 100,
      description: 'فواتير رئيسية'
    });
  }
  
  if (installationMain > 0) {
    categories.push({
      name: 'فواتير تركيب رئيسية (Installation - S)',
      count: installationMain,
      percentage: (installationMain / total) * 100,
      description: 'فواتير رئيسية'
    });
  }
  
  if (subTickets > 0) {
    categories.push({
      name: 'تكتات فرعية (منتجات)',
      count: subTickets,
      percentage: (subTickets / total) * 100,
      description: 'تكتات فرعية ضمن الفواتير'
    });
  }
  
  if (returns > 0) {
    categories.push({
      name: 'مردودات',
      count: returns,
      percentage: (returns / total) * 100,
      description: 'مستبعدة من الإنجاز'
    });
  }
  
  return categories;
}

/**
 * استخراج نطاق التواريخ
 */
function extractDateRange(
  data: Record<string, unknown>[],
  dateColumn?: string
): { from: string; to: string } | undefined {
  if (!dateColumn) return undefined;
  
  const dates = data
    .map(row => row[dateColumn])
    .filter(Boolean)
    .map(d => new Date(String(d)))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  
  if (dates.length === 0) return undefined;
  
  return {
    from: dates[0].toLocaleDateString('ar-IQ'),
    to: dates[dates.length - 1].toLocaleDateString('ar-IQ')
  };
}

/**
 * توليد اقتراحات التحليل
 */
function generateSuggestions(dataType: DataType, columns: RecognizedColumns): string[] {
  const suggestions: string[] = [];
  
  if (dataType === 'delivery_installation') {
    suggestions.push('تحليل نسب نجاح التجهيز والتركيب');
    suggestions.push('تحليل أداء الموظفين والمشرفين');
    suggestions.push('اكتشاف الحالات الحرجة والتكملات');
    suggestions.push('تحليل رحلة الزبون');
    if (columns.stage) suggestions.push('تحليل توزيع Stage');
  } else if (dataType === 'sales') {
    suggestions.push('تحليل المبيعات حسب الفترة');
    suggestions.push('أفضل المنتجات مبيعاً');
    suggestions.push('تحليل العملاء');
  } else if (dataType === 'attendance') {
    suggestions.push('تحليل الحضور والانصراف');
    suggestions.push('نسب الالتزام');
    suggestions.push('التأخيرات والغيابات');
  }
  
  return suggestions;
}

/**
 * التعرف على البيانات وتحليلها
 */
export function recognizeData(report: AnalysisReport): DataRecognitionResult {
  const { columns, rawData } = report;
  const recognizedColumns: RecognizedColumns = {};
  
  // التعرف على الأعمدة
  for (const col of columns) {
    const sampleValues = rawData.slice(0, 100).map(row => row[col.name]);
    const recognized = recognizeColumn(col.name, sampleValues);
    
    if (recognized && !recognizedColumns[recognized]) {
      recognizedColumns[recognized] = col.name;
    }
  }
  
  // تحديد نوع البيانات
  const { type: dataType, confidence } = determineDataType(recognizedColumns);
  
  // تحليل هيكل البيانات
  let categories: DataCategory[] = [];
  if (dataType === 'delivery_installation') {
    categories = analyzeDeliveryInstallationStructure(rawData, recognizedColumns);
  }
  
  // استخراج نطاق التواريخ
  const dateRange = extractDateRange(rawData, recognizedColumns.date);
  
  // توليد الاقتراحات
  const suggestions = generateSuggestions(dataType, recognizedColumns);
  
  return {
    dataType,
    confidence,
    recognizedColumns,
    dataStructure: {
      totalRecords: rawData.length,
      categories,
      dateRange
    },
    suggestions
  };
}

/**
 * التحقق مما إذا كانت البيانات من نوع التجهيز والتركيب
 */
export function isDeliveryInstallationData(result: DataRecognitionResult): boolean {
  return result.dataType === 'delivery_installation' && result.confidence >= 0.6;
}

/**
 * الحصول على اسم العمود المعترف به
 */
export function getRecognizedColumnName(
  result: DataRecognitionResult,
  columnType: keyof RecognizedColumns
): string | undefined {
  return result.recognizedColumns[columnType];
}
