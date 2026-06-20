import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSpreadsheet,
  Table2,
  BarChart3,
  Brain,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Info,
  Download,
  ChevronDown,
  ChevronUp,
  Search,
  Sparkles,
  Target,
  Shield,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type {
  AnalysisReport as AnalysisReportType,
  AIAnalysisResult,
  ColumnAnalysis,
  KPICard,
} from '../../../lib/dataAnalysis/types';
import {
  DATA_TYPE_LABELS,
  INSIGHT_TYPE_LABELS,
  formatNumber,
} from '../../../lib/dataAnalysis/types';
import { generateKPIs } from '../../../lib/dataAnalysis/analysisEngine';
import AdvancedCharts from './AdvancedCharts';
import { exportToExcel } from '../../../lib/excelExport';

interface AnalysisReportProps {
  report: AnalysisReportType;
  aiAnalysis?: AIAnalysisResult;
  isLoadingAI?: boolean;
}

const INSIGHT_ICONS = {
  observation: Info,
  warning: AlertTriangle,
  recommendation: Lightbulb,
  pattern: TrendingUp,
  anomaly: Shield,
};

const INSIGHT_COLORS = {
  observation: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
  warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
  recommendation: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
  pattern: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300',
  anomaly: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
};

const KPI_COLORS = {
  cyan: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800',
  emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
  amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
};

type TabKey = 'overview' | 'charts' | 'data' | 'columns' | 'ai';

export default function AnalysisReportComponent({
  report,
  aiAnalysis,
  isLoadingAI,
}: AnalysisReportProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [dataSearch, setDataSearch] = useState('');
  const [dataPage, setDataPage] = useState(0);
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);
  const pageSize = 50;

  const kpis = useMemo(
    () => generateKPIs(report.columns, report.summary.rowCount),
    [report.columns, report.summary.rowCount]
  );

  const filteredData = useMemo(() => {
    if (!dataSearch.trim()) return report.rawData;
    const q = dataSearch.toLowerCase();
    return report.rawData.filter((row) =>
      Object.values(row).some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [report.rawData, dataSearch]);

  const paginatedData = useMemo(() => {
    const start = dataPage * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, dataPage]);

  const totalPages = Math.ceil(filteredData.length / pageSize);

  const handleExport = () => {
    const headers = report.columns.map((c) => c.name);
    const rows = report.rawData.map((row) =>
      headers.map((h) => String(row[h] ?? ''))
    );
    exportToExcel([headers, ...rows], `تحليل_${report.summary.fileName}.xlsx`);
  };

  const tabs: { key: TabKey; label: string; icon: typeof FileSpreadsheet }[] = [
    { key: 'overview', label: 'نظرة عامة', icon: FileSpreadsheet },
    { key: 'charts', label: 'الرسوم البيانية', icon: BarChart3 },
    { key: 'data', label: 'البيانات', icon: Table2 },
    { key: 'columns', label: 'الأعمدة', icon: Target },
    { key: 'ai', label: 'تحليل AI', icon: Brain },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            {report.summary.fileName}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {report.summary.rowCount.toLocaleString('ar-IQ')} سجل • {report.summary.columnCount} عمود
            {report.summary.dateRange && (
              <> • {report.summary.dateRange.from} إلى {report.summary.dateRange.to}</>
            )}
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700"
        >
          <Download className="h-4 w-4" />
          تصدير Excel
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all',
                activeTab === tab.key
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* AI Summary */}
            {aiAnalysis?.summary && (
              <div className="rounded-2xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-900/20 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Sparkles className="h-5 w-5 text-cyan-600" />
                  <h3 className="font-bold text-cyan-800 dark:text-cyan-200">ملخص التحليل</h3>
                </div>
                <p className="text-cyan-700 dark:text-cyan-300 leading-relaxed">
                  {aiAnalysis.summary}
                </p>
              </div>
            )}

            {/* KPIs Grid */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {kpis.map((kpi, idx) => (
                <motion.div
                  key={kpi.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    'rounded-2xl border p-5',
                    KPI_COLORS[kpi.color || 'cyan']
                  )}
                >
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {kpi.title}
                  </p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    {kpi.value}
                  </p>
                  {kpi.subtitle && (
                    <p className="text-xs text-slate-500 mt-1">{kpi.subtitle}</p>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Key Findings */}
            {aiAnalysis?.keyFindings && aiAnalysis.keyFindings.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  أهم النتائج
                </h3>
                <ul className="space-y-2">
                  {aiAnalysis.keyFindings.map((finding, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-xs font-bold text-emerald-700">
                        {idx + 1}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quick Charts Preview */}
            {report.charts.length > 0 && (
              <div>
                <h3 className="font-bold text-lg mb-4">معاينة سريعة</h3>
                <AdvancedCharts charts={report.charts.slice(0, 2)} />
              </div>
            )}
          </motion.div>
        )}

        {/* Charts Tab */}
        {activeTab === 'charts' && (
          <motion.div
            key="charts"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <AdvancedCharts charts={report.charts} />
          </motion.div>
        )}

        {/* Data Tab */}
        {activeTab === 'data' && (
          <motion.div
            key="data"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={dataSearch}
                  onChange={(e) => {
                    setDataSearch(e.target.value);
                    setDataPage(0);
                  }}
                  placeholder="بحث في البيانات..."
                  className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"
                />
              </div>
              <p className="text-sm text-slate-500">
                {filteredData.length.toLocaleString('ar-IQ')} سجل
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-right text-sm font-semibold w-16">#</th>
                      {report.columns.map((col) => (
                        <th key={col.name} className="px-4 py-3 text-right text-sm font-semibold">
                          {col.name}
                          <span className="text-xs font-normal text-slate-400 mr-1">
                            ({DATA_TYPE_LABELS[col.dataType]})
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((row, idx) => (
                      <tr
                        key={idx}
                        className={cn(
                          'border-t border-slate-100 dark:border-slate-700',
                          idx % 2 === 0 && 'bg-slate-50/50 dark:bg-slate-800/50'
                        )}
                      >
                        <td className="px-4 py-2 text-sm text-slate-500">
                          {dataPage * pageSize + idx + 1}
                        </td>
                        {report.columns.map((col) => (
                          <td key={col.name} className="px-4 py-2 text-sm max-w-[200px] truncate">
                            {String(row[col.name] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-500">
                    صفحة {dataPage + 1} من {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDataPage((p) => Math.max(0, p - 1))}
                      disabled={dataPage === 0}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50"
                    >
                      السابق
                    </button>
                    <button
                      onClick={() => setDataPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={dataPage >= totalPages - 1}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50"
                    >
                      التالي
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Columns Tab */}
        {activeTab === 'columns' && (
          <motion.div
            key="columns"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {report.columns.map((col) => (
              <div
                key={col.name}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedColumn(expandedColumn === col.name ? null : col.name)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700">
                      <Table2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div className="text-right">
                      <h4 className="font-bold">{col.name}</h4>
                      <p className="text-sm text-slate-500">
                        {DATA_TYPE_LABELS[col.dataType]} • {col.uniqueCount} قيمة فريدة
                      </p>
                    </div>
                  </div>
                  {expandedColumn === col.name ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </button>

                <AnimatePresence>
                  {expandedColumn === col.name && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700 space-y-4">
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3">
                            <p className="text-xs text-slate-500 mb-1">إجمالي القيم</p>
                            <p className="text-lg font-bold">{col.totalCount.toLocaleString('ar-IQ')}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3">
                            <p className="text-xs text-slate-500 mb-1">القيم الفارغة</p>
                            <p className="text-lg font-bold">{col.nullCount.toLocaleString('ar-IQ')}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3">
                            <p className="text-xs text-slate-500 mb-1">القيم الفريدة</p>
                            <p className="text-lg font-bold">{col.uniqueCount.toLocaleString('ar-IQ')}</p>
                          </div>
                        </div>

                        {col.numericStats && (
                          <div>
                            <h5 className="font-semibold mb-2">إحصائيات رقمية</h5>
                            <div className="grid gap-2 md:grid-cols-4 text-sm">
                              <div>
                                <span className="text-slate-500">المجموع:</span>{' '}
                                <strong>{formatNumber(col.numericStats.sum)}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500">المتوسط:</span>{' '}
                                <strong>{formatNumber(col.numericStats.mean)}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500">الوسيط:</span>{' '}
                                <strong>{formatNumber(col.numericStats.median)}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500">الانحراف:</span>{' '}
                                <strong>{formatNumber(col.numericStats.stdDev)}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500">الحد الأدنى:</span>{' '}
                                <strong>{formatNumber(col.numericStats.min)}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500">الحد الأقصى:</span>{' '}
                                <strong>{formatNumber(col.numericStats.max)}</strong>
                              </div>
                            </div>
                          </div>
                        )}

                        {col.textStats && col.textStats.topValues.length > 0 && (
                          <div>
                            <h5 className="font-semibold mb-2">القيم الأكثر شيوعاً</h5>
                            <div className="space-y-1">
                              {col.textStats.topValues.slice(0, 5).map((v, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <div
                                    className="h-2 rounded-full bg-cyan-500"
                                    style={{ width: `${v.percentage}%`, maxWidth: '60%' }}
                                  />
                                  <span className="text-sm">
                                    {v.value} ({v.count} - {v.percentage.toFixed(1)}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {col.dateStats && (
                          <div>
                            <h5 className="font-semibold mb-2">نطاق التواريخ</h5>
                            <p className="text-sm">
                              من <strong>{col.dateStats.earliest}</strong> إلى{' '}
                              <strong>{col.dateStats.latest}</strong> ({col.dateStats.range} يوم)
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        )}

        {/* AI Tab */}
        {activeTab === 'ai' && (
          <motion.div
            key="ai"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {isLoadingAI ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-200 border-t-cyan-600" />
                <p className="mt-4 text-lg font-medium text-slate-600 dark:text-slate-400">
                  جاري تحليل البيانات بالذكاء الاصطناعي...
                </p>
              </div>
            ) : aiAnalysis ? (
              <>
                {/* Data Quality Score */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg">جودة البيانات</h3>
                      <p className="text-sm text-slate-500">تقييم شامل لجودة البيانات</p>
                    </div>
                    <div
                      className={cn(
                        'flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black',
                        aiAnalysis.dataQualityScore >= 80
                          ? 'bg-emerald-100 text-emerald-700'
                          : aiAnalysis.dataQualityScore >= 60
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                      )}
                    >
                      {aiAnalysis.dataQualityScore}%
                    </div>
                  </div>
                </div>

                {/* Insights */}
                {aiAnalysis.insights.length > 0 && (
                  <div>
                    <h3 className="font-bold text-lg mb-4">الملاحظات الذكية</h3>
                    <div className="space-y-3">
                      {aiAnalysis.insights.map((insight, idx) => {
                        const Icon = INSIGHT_ICONS[insight.type] || Info;
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className={cn(
                              'rounded-xl border p-4',
                              INSIGHT_COLORS[insight.type]
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-bold">{insight.title}</h4>
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20">
                                    {INSIGHT_TYPE_LABELS[insight.type]}
                                  </span>
                                </div>
                                <p className="text-sm opacity-90">{insight.description}</p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {aiAnalysis.recommendations.length > 0 && (
                  <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-6">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                      <Lightbulb className="h-5 w-5" />
                      التوصيات
                    </h3>
                    <ul className="space-y-2">
                      {aiAnalysis.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16 text-slate-500">
                <Brain className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">تحليل AI غير متاح</p>
                <p className="text-sm mt-2">تأكد من إعداد GEMINI_API_KEY</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
