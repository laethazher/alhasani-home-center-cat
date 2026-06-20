import * as XLSX from 'xlsx';
import type {
  ColumnDataType,
  ColumnInfo,
  ColumnAnalysis,
  NumericStats,
  TextStats,
  DateStats,
  DatasetSummary,
  ChartData,
  ChartSuggestion,
  ChartType,
  KPICard,
  AnalysisReport,
} from './types';
import { CHART_COLORS } from './types';

function parseCSV(text: string): { headers: string[]; rows: unknown[][] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map((line) => parseRow(line));
  return { headers, rows };
}

function detectColumnType(values: unknown[]): ColumnDataType {
  const nonNullValues = values.filter((v) => v != null && v !== '');
  if (nonNullValues.length === 0) return 'unknown';

  let numberCount = 0;
  let integerCount = 0;
  let dateCount = 0;
  let booleanCount = 0;
  let percentCount = 0;
  let currencyCount = 0;
  let emailCount = 0;
  let phoneCount = 0;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[\d\s\-+()]{7,}$/;
  const dateRegex = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}|^\d{1,2}[-/]\d{1,2}[-/]\d{4}/;
  const percentRegex = /^\d+(\.\d+)?%$/;
  const currencyRegex = /^[$€£¥₹]\s?\d|^\d+\s?[$€£¥₹]|^[\d,]+\s?(دينار|ريال|درهم)/i;

  for (const val of nonNullValues) {
    const str = String(val).trim();
    
    if (percentRegex.test(str)) {
      percentCount++;
      continue;
    }
    
    if (currencyRegex.test(str)) {
      currencyCount++;
      continue;
    }

    if (typeof val === 'boolean' || str.toLowerCase() === 'true' || str.toLowerCase() === 'false' || str === '1' || str === '0' || str === 'نعم' || str === 'لا') {
      booleanCount++;
      continue;
    }

    if (emailRegex.test(str)) {
      emailCount++;
      continue;
    }

    if (phoneRegex.test(str) && str.replace(/\D/g, '').length >= 7) {
      phoneCount++;
      continue;
    }

    if (dateRegex.test(str) || !isNaN(Date.parse(str))) {
      const parsed = new Date(str);
      if (parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
        dateCount++;
        continue;
      }
    }

    const numVal = typeof val === 'number' ? val : parseFloat(str.replace(/[,،]/g, ''));
    if (!isNaN(numVal)) {
      numberCount++;
      if (Number.isInteger(numVal)) {
        integerCount++;
      }
    }
  }

  const total = nonNullValues.length;
  const threshold = 0.7;

  if (percentCount / total >= threshold) return 'percentage';
  if (currencyCount / total >= threshold) return 'currency';
  if (booleanCount / total >= threshold) return 'boolean';
  if (emailCount / total >= threshold) return 'email';
  if (phoneCount / total >= threshold) return 'phone';
  if (dateCount / total >= threshold) return 'date';
  if (numberCount / total >= threshold) {
    return integerCount / numberCount >= 0.9 ? 'integer' : 'number';
  }

  return 'text';
}

function calculateNumericStats(values: number[]): NumericStats {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const min = sorted[0];
  const max = sorted[n - 1];

  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];

  return {
    sum,
    mean,
    median,
    min,
    max,
    stdDev,
    variance,
    range: max - min,
    q1,
    q3,
    iqr: q3 - q1,
    positiveCount: values.filter((v) => v > 0).length,
    negativeCount: values.filter((v) => v < 0).length,
    zeroCount: values.filter((v) => v === 0).length,
  };
}

function calculateTextStats(values: string[]): TextStats {
  const frequency = new Map<string, number>();
  let totalLength = 0;
  let minLength = Infinity;
  let maxLength = 0;
  let emptyCount = 0;

  for (const val of values) {
    if (!val || val.trim() === '') {
      emptyCount++;
      continue;
    }
    frequency.set(val, (frequency.get(val) || 0) + 1);
    totalLength += val.length;
    minLength = Math.min(minLength, val.length);
    maxLength = Math.max(maxLength, val.length);
  }

  const validCount = values.length - emptyCount;
  const sorted = [...frequency.entries()].sort((a, b) => b[1] - a[1]);

  return {
    uniqueValues: [...frequency.keys()],
    topValues: sorted.slice(0, 10).map(([value, count]) => ({
      value,
      count,
      percentage: (count / validCount) * 100,
    })),
    avgLength: validCount > 0 ? totalLength / validCount : 0,
    minLength: minLength === Infinity ? 0 : minLength,
    maxLength,
    emptyCount,
  };
}

function calculateDateStats(values: Date[]): DateStats {
  const sorted = [...values].sort((a, b) => a.getTime() - b.getTime());
  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];

  const monthCounts = new Map<string, number>();
  for (const date of values) {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
  }

  return {
    earliest: earliest.toISOString().slice(0, 10),
    latest: latest.toISOString().slice(0, 10),
    range: Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)),
    distribution: [...monthCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, count]) => ({ period, count })),
  };
}

function analyzeColumn(name: string, values: unknown[]): ColumnAnalysis {
  const dataType = detectColumnType(values);
  const nonNullValues = values.filter((v) => v != null && v !== '');

  const columnInfo: ColumnInfo = {
    name,
    originalName: name,
    dataType,
    sampleValues: nonNullValues.slice(0, 5),
    nullCount: values.length - nonNullValues.length,
    uniqueCount: new Set(nonNullValues.map(String)).size,
    totalCount: values.length,
  };

  const analysis: ColumnAnalysis = { ...columnInfo };

  if (['number', 'integer', 'percentage', 'currency'].includes(dataType)) {
    const numbers = nonNullValues
      .map((v) => {
        if (typeof v === 'number') return v;
        const str = String(v).replace(/[%$€£¥₹,،\s]/g, '').replace(/[^\d.-]/g, '');
        return parseFloat(str);
      })
      .filter((n) => !isNaN(n));

    if (numbers.length > 0) {
      analysis.numericStats = calculateNumericStats(numbers);
    }
  } else if (dataType === 'text' || dataType === 'email' || dataType === 'phone') {
    analysis.textStats = calculateTextStats(nonNullValues.map(String));
  } else if (dataType === 'date' || dataType === 'datetime') {
    const dates = nonNullValues
      .map((v) => new Date(String(v)))
      .filter((d) => !isNaN(d.getTime()));

    if (dates.length > 0) {
      analysis.dateStats = calculateDateStats(dates);
    }
  }

  return analysis;
}

function generateChartSuggestions(columns: ColumnAnalysis[]): ChartSuggestion[] {
  const suggestions: ChartSuggestion[] = [];
  
  const numericCols = columns.filter((c) => 
    ['number', 'integer', 'percentage', 'currency'].includes(c.dataType)
  );
  const textCols = columns.filter((c) => c.dataType === 'text' && c.uniqueCount <= 20);
  const dateCols = columns.filter((c) => c.dataType === 'date' || c.dataType === 'datetime');

  for (const textCol of textCols) {
    if (textCol.textStats && textCol.textStats.topValues.length >= 2) {
      suggestions.push({
        type: 'pie',
        title: `توزيع ${textCol.name}`,
        description: `عرض توزيع القيم في عمود ${textCol.name}`,
        dataKey: textCol.name,
        priority: 90,
      });

      suggestions.push({
        type: 'bar',
        title: `تكرار ${textCol.name}`,
        description: `عدد التكرارات لكل قيمة في ${textCol.name}`,
        xAxis: textCol.name,
        yAxis: 'العدد',
        priority: 85,
      });
    }
  }

  for (const numCol of numericCols) {
    for (const textCol of textCols) {
      suggestions.push({
        type: 'bar',
        title: `${numCol.name} حسب ${textCol.name}`,
        description: `مقارنة ${numCol.name} لكل ${textCol.name}`,
        xAxis: textCol.name,
        yAxis: numCol.name,
        priority: 80,
      });
    }

    for (const dateCol of dateCols) {
      suggestions.push({
        type: 'line',
        title: `تطور ${numCol.name} عبر الوقت`,
        description: `اتجاه ${numCol.name} مع مرور الوقت`,
        xAxis: dateCol.name,
        yAxis: numCol.name,
        priority: 95,
      });

      suggestions.push({
        type: 'area',
        title: `مساحة ${numCol.name} عبر الوقت`,
        description: `عرض تراكمي لـ ${numCol.name}`,
        xAxis: dateCol.name,
        yAxis: numCol.name,
        priority: 75,
      });
    }
  }

  if (numericCols.length >= 2) {
    suggestions.push({
      type: 'scatter',
      title: `العلاقة بين ${numericCols[0].name} و ${numericCols[1].name}`,
      description: 'تحليل الارتباط بين المتغيرين',
      xAxis: numericCols[0].name,
      yAxis: numericCols[1].name,
      priority: 70,
    });
  }

  return suggestions.sort((a, b) => b.priority - a.priority).slice(0, 6);
}

function generateCharts(
  data: Record<string, unknown>[],
  columns: ColumnAnalysis[],
  suggestions: ChartSuggestion[]
): ChartData[] {
  const charts: ChartData[] = [];

  for (const suggestion of suggestions.slice(0, 4)) {
    try {
      if (suggestion.type === 'pie' && suggestion.dataKey) {
        const col = columns.find((c) => c.name === suggestion.dataKey);
        if (col?.textStats) {
          charts.push({
            type: 'pie',
            title: suggestion.title,
            data: col.textStats.topValues.slice(0, 8).map((v) => ({
              name: v.value,
              value: v.count,
            })),
            xKey: 'name',
            yKey: 'value',
            colors: CHART_COLORS,
          });
        }
      } else if (suggestion.type === 'bar' && suggestion.xAxis) {
        const xCol = columns.find((c) => c.name === suggestion.xAxis);
        if (xCol?.textStats && suggestion.yAxis) {
          const aggregated = new Map<string, number>();
          const counts = new Map<string, number>();

          for (const row of data) {
            const xVal = String(row[suggestion.xAxis!] || '');
            const yVal = parseFloat(String(row[suggestion.yAxis!] || '0').replace(/[^\d.-]/g, ''));

            if (xVal && !isNaN(yVal)) {
              aggregated.set(xVal, (aggregated.get(xVal) || 0) + yVal);
              counts.set(xVal, (counts.get(xVal) || 0) + 1);
            }
          }

          const chartData = [...aggregated.entries()]
            .slice(0, 10)
            .map(([name, total]) => ({
              name,
              value: Math.round(total / (counts.get(name) || 1)),
            }));

          if (chartData.length > 0) {
            charts.push({
              type: 'bar',
              title: suggestion.title,
              data: chartData,
              xKey: 'name',
              yKey: 'value',
              colors: CHART_COLORS,
            });
          }
        } else if (xCol?.textStats) {
          charts.push({
            type: 'bar',
            title: suggestion.title,
            data: xCol.textStats.topValues.slice(0, 10).map((v) => ({
              name: v.value,
              value: v.count,
            })),
            xKey: 'name',
            yKey: 'value',
            colors: CHART_COLORS,
          });
        }
      } else if ((suggestion.type === 'line' || suggestion.type === 'area') && suggestion.xAxis && suggestion.yAxis) {
        const aggregated = new Map<string, { sum: number; count: number }>();

        for (const row of data) {
          const xVal = String(row[suggestion.xAxis!] || '');
          const yVal = parseFloat(String(row[suggestion.yAxis!] || '0').replace(/[^\d.-]/g, ''));

          if (xVal && !isNaN(yVal)) {
            const dateKey = xVal.slice(0, 7);
            if (!aggregated.has(dateKey)) {
              aggregated.set(dateKey, { sum: 0, count: 0 });
            }
            const agg = aggregated.get(dateKey)!;
            agg.sum += yVal;
            agg.count++;
          }
        }

        const chartData = [...aggregated.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([name, { sum, count }]) => ({
            name,
            value: Math.round(sum / count),
          }));

        if (chartData.length >= 2) {
          charts.push({
            type: suggestion.type,
            title: suggestion.title,
            data: chartData,
            xKey: 'name',
            yKey: 'value',
            colors: CHART_COLORS,
          });
        }
      }
    } catch {
      continue;
    }
  }

  return charts;
}

function generateKPIs(columns: ColumnAnalysis[], rowCount: number): KPICard[] {
  const kpis: KPICard[] = [];

  kpis.push({
    id: 'rows',
    title: 'إجمالي السجلات',
    value: rowCount.toLocaleString('ar-IQ'),
    color: 'cyan',
  });

  kpis.push({
    id: 'columns',
    title: 'عدد الأعمدة',
    value: columns.length,
    color: 'purple',
  });

  const numericCols = columns.filter((c) => c.numericStats);
  for (const col of numericCols.slice(0, 3)) {
    if (col.numericStats) {
      kpis.push({
        id: `sum_${col.name}`,
        title: `مجموع ${col.name}`,
        value: col.numericStats.sum.toLocaleString('ar-IQ', { maximumFractionDigits: 0 }),
        subtitle: `المتوسط: ${col.numericStats.mean.toLocaleString('ar-IQ', { maximumFractionDigits: 2 })}`,
        color: 'emerald',
      });

      kpis.push({
        id: `range_${col.name}`,
        title: `نطاق ${col.name}`,
        value: `${col.numericStats.min.toLocaleString('ar-IQ')} - ${col.numericStats.max.toLocaleString('ar-IQ')}`,
        color: 'amber',
      });
    }
  }

  const textCols = columns.filter((c) => c.textStats);
  for (const col of textCols.slice(0, 2)) {
    if (col.textStats && col.textStats.topValues.length > 0) {
      kpis.push({
        id: `top_${col.name}`,
        title: `الأكثر في ${col.name}`,
        value: col.textStats.topValues[0].value,
        subtitle: `${col.textStats.topValues[0].percentage.toFixed(1)}% من الإجمالي`,
        color: 'blue',
      });
    }
  }

  return kpis.slice(0, 8);
}

export async function analyzeFile(file: File): Promise<AnalysisReport> {
  const fileName = file.name.toLowerCase();
  const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
  const isCsv = fileName.endsWith('.csv');

  if (!isExcel && !isCsv) {
    throw new Error('نوع الملف غير مدعوم. يرجى رفع ملف Excel أو CSV.');
  }

  let headers: string[] = [];
  let rows: unknown[][] = [];

  if (isCsv) {
    const text = await file.text();
    const parsed = parseCSV(text);
    headers = parsed.headers;
    rows = parsed.rows;
  } else {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, raw: false });

    if (json.length > 0) {
      headers = (json[0] as unknown[]).map((h) => String(h || '').trim());
      rows = json.slice(1) as unknown[][];
    }
  }

  rows = rows.filter((row) => row.some((cell) => cell != null && String(cell).trim() !== ''));

  if (headers.length === 0 || rows.length === 0) {
    throw new Error('الملف فارغ أو لا يحتوي على بيانات صالحة.');
  }

  const data: Record<string, unknown>[] = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });

  const columns: ColumnAnalysis[] = headers.map((header) => {
    const values = data.map((row) => row[header]);
    return analyzeColumn(header, values);
  });

  const numericColumnsCount = columns.filter((c) => 
    ['number', 'integer', 'percentage', 'currency'].includes(c.dataType)
  ).length;
  const textColumnsCount = columns.filter((c) => c.dataType === 'text').length;
  const dateColumnsCount = columns.filter((c) => 
    ['date', 'datetime'].includes(c.dataType)
  ).length;

  const dateCol = columns.find((c) => c.dateStats);
  let dateRange: { from: string; to: string } | undefined;
  if (dateCol?.dateStats) {
    dateRange = {
      from: dateCol.dateStats.earliest,
      to: dateCol.dateStats.latest,
    };
  }

  const summary: DatasetSummary = {
    fileName: file.name,
    fileSize: file.size,
    fileType: isExcel ? 'excel' : 'csv',
    rowCount: rows.length,
    columnCount: headers.length,
    uploadedAt: new Date().toISOString(),
    dateRange,
    numericColumnsCount,
    textColumnsCount,
    dateColumnsCount,
  };

  const chartSuggestions = generateChartSuggestions(columns);
  const charts = generateCharts(data, columns, chartSuggestions);

  const report: AnalysisReport = {
    id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    summary,
    columns,
    charts,
    rawData: data,
    createdAt: new Date().toISOString(),
  };

  return report;
}

export { generateKPIs, generateChartSuggestions };
