import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  Printer,
  MessageSquare,
  ChevronLeft,
  BarChart3,
  Loader2,
  Package,
  Wrench,
  Users,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type {
  ProfessionalReportData,
  AnalysisReport,
} from '../../../lib/dataAnalysis/types';
import TableOfContents, { StickyTOC, MiniTOC } from './TableOfContents';
import ExecutiveSummary from './ExecutiveSummary';
import DataUnderstanding from './DataUnderstanding';
import CriticalCases from './CriticalCases';
import ReportSection, { ReportTable, ReportCard } from './ReportSection';
import AdvancedCharts, {
  InvoiceDistributionChart,
  SuccessCompensationChart,
  StageDistributionChart,
  EmployeePerformanceChart,
  SupervisorPerformanceChart,
} from './AdvancedCharts';

interface ProfessionalReportProps {
  report: ProfessionalReportData;
  rawReport: AnalysisReport;
  onExportPDF: () => void;
  onOpenChat: () => void;
  onBack: () => void;
  isExporting?: boolean;
}

export default function ProfessionalReport({
  report,
  rawReport,
  onExportPDF,
  onOpenChat,
  onBack,
  isExporting = false,
}: ProfessionalReportProps) {
  const [activeSection, setActiveSection] = useState<string>('executive-summary');
  const [showStickyTOC, setShowStickyTOC] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (contentRef.current) {
        const scrollTop = window.scrollY;
        setShowStickyTOC(scrollTop > 300);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth',
      });
    }
  };

  const tocItems = report.tableOfContents.length > 0
    ? report.tableOfContents
    : [
        { id: 'executive-summary', title: 'الملخص التنفيذي', pageNumber: 1, level: 1 as const },
        { id: 'data-structure', title: 'هيكل البيانات', pageNumber: 2, level: 1 as const },
        { id: 'delivery-analysis', title: 'تحليل التجهيز', pageNumber: 3, level: 1 as const },
        { id: 'installation-analysis', title: 'تحليل التركيب', pageNumber: 4, level: 1 as const },
        { id: 'customer-journey', title: 'العلاقة بين التجهيز والتركيب', pageNumber: 5, level: 1 as const },
        { id: 'stage-analysis', title: 'تحليل Stage', pageNumber: 6, level: 1 as const },
        { id: 'team-analysis', title: 'تحليل الموظفين والمشرفين', pageNumber: 7, level: 1 as const },
        { id: 'critical-cases', title: 'الحالات الحرجة', pageNumber: 8, level: 1 as const },
        { id: 'charts', title: 'الرسوم البيانية', pageNumber: 9, level: 1 as const },
        { id: 'recommendations', title: 'التوصيات التنفيذية', pageNumber: 10, level: 1 as const },
        { id: 'conclusion', title: 'الاستنتاج النهائي', pageNumber: 11, level: 1 as const },
      ];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                العودة
              </button>
              <div className="hidden md:block h-6 w-px bg-slate-200 dark:bg-slate-700" />
              <div className="hidden md:flex items-center gap-2">
                <FileText className="h-5 w-5 text-cyan-600" />
                <span className="font-bold text-slate-900 dark:text-white">
                  {report.title}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenChat}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">محادثة البيانات</span>
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">طباعة</span>
              </button>
              <button
                onClick={onExportPDF}
                disabled={isExporting}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors',
                  isExporting
                    ? 'bg-slate-200 dark:bg-slate-600 text-slate-500 cursor-not-allowed'
                    : 'bg-cyan-600 text-white hover:bg-cyan-700'
                )}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {isExporting ? 'جاري التصدير...' : 'تصدير PDF'}
                </span>
              </button>
            </div>
          </div>

          {/* Mini TOC for mobile */}
          <div className="pb-3 overflow-x-auto md:hidden">
            <MiniTOC
              items={tocItems}
              activeSection={activeSection}
              onSectionClick={scrollToSection}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar TOC - Desktop */}
          <aside className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-24">
              <StickyTOC
                items={tocItems}
                activeSection={activeSection}
                onSectionClick={scrollToSection}
                reportTitle={report.title}
              />
            </div>
          </aside>

          {/* Report Content */}
          <main ref={contentRef} className="flex-1 min-w-0 space-y-8">
            {/* Cover Page */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-gradient-to-br from-cyan-600 via-blue-600 to-purple-700 p-8 text-white text-center print:break-after-page"
            >
              <h1 className="text-3xl md:text-4xl font-black mb-2">{report.title}</h1>
              <p className="text-xl text-cyan-100 mb-6">{report.subtitle}</p>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <span className="px-4 py-2 rounded-full bg-white/20">
                  {report.metadata.rowCount.toLocaleString('ar-IQ')} سجل
                </span>
                <span className="px-4 py-2 rounded-full bg-white/20">
                  {report.metadata.columnCount} عمود
                </span>
                <span className="px-4 py-2 rounded-full bg-white/20">
                  {new Date(report.generatedAt).toLocaleDateString('ar-IQ')}
                </span>
              </div>
            </motion.div>

            {/* Table of Contents - Print Only */}
            <div className="hidden print:block">
              <TableOfContents
                items={tocItems}
                activeSection={activeSection}
                onSectionClick={scrollToSection}
              />
            </div>

            {/* 1. Executive Summary */}
            <ExecutiveSummary data={report.executiveSummary} metadata={report.metadata} />

            {/* 2. Data Structure */}
            <ReportSection
              id="data-structure"
              sectionNumber={2}
              title="هيكل البيانات"
              subtitle="توزيع السجلات الكلي"
              icon={<FileText className="h-5 w-5" />}
            >
              <DataUnderstanding data={report.dataUnderstanding} columns={rawReport.columns} />
            </ReportSection>

            {/* 3. Delivery Analysis */}
            {report.detailedAnalysis && report.detailedAnalysis.filter(a => a.id?.includes('delivery')).length > 0 && (
              <ReportSection
                id="delivery-analysis"
                sectionNumber={3}
                title="تحليل التجهيز"
                subtitle="الفواتير الرئيسية والتكتات الفرعية"
                icon={<Package className="h-5 w-5" />}
              >
                <div className="space-y-6">
                  {report.detailedAnalysis
                    .filter(a => a.id?.includes('delivery'))
                    .map((analysis, idx) => (
                      <AnalysisCard key={analysis.id} analysis={analysis} index={idx} />
                    ))}
                </div>
              </ReportSection>
            )}

            {/* 4. Installation Analysis */}
            {report.detailedAnalysis && report.detailedAnalysis.filter(a => a.id?.includes('installation')).length > 0 && (
              <ReportSection
                id="installation-analysis"
                sectionNumber={4}
                title="تحليل التركيب"
                subtitle="الفواتير الرئيسية والمجهزة مسبقاً"
                icon={<Wrench className="h-5 w-5" />}
              >
                <div className="space-y-6">
                  {report.detailedAnalysis
                    .filter(a => a.id?.includes('installation'))
                    .map((analysis, idx) => (
                      <AnalysisCard key={analysis.id} analysis={analysis} index={idx} />
                    ))}
                </div>
              </ReportSection>
            )}

            {/* 5. Customer Journey */}
            {report.detailedAnalysis && report.detailedAnalysis.filter(a => a.id?.includes('customer') || a.id?.includes('journey')).length > 0 && (
              <ReportSection
                id="customer-journey"
                sectionNumber={5}
                title="العلاقة بين التجهيز والتركيب"
                subtitle="تحليل رحلة الزبون"
                icon={<TrendingUp className="h-5 w-5" />}
              >
                <div className="space-y-6">
                  {report.detailedAnalysis
                    .filter(a => a.id?.includes('customer') || a.id?.includes('journey'))
                    .map((analysis, idx) => (
                      <AnalysisCard key={analysis.id} analysis={analysis} index={idx} />
                    ))}
                </div>
              </ReportSection>
            )}

            {/* 6. Stage Analysis */}
            {report.detailedAnalysis && report.detailedAnalysis.filter(a => a.id?.includes('stage')).length > 0 && (
              <ReportSection
                id="stage-analysis"
                sectionNumber={6}
                title="تحليل Stage"
                subtitle="توزيع الحالات"
                icon={<CheckCircle2 className="h-5 w-5" />}
              >
                <div className="space-y-6">
                  {report.detailedAnalysis
                    .filter(a => a.id?.includes('stage'))
                    .map((analysis, idx) => (
                      <AnalysisCard key={analysis.id} analysis={analysis} index={idx} />
                    ))}
                </div>
              </ReportSection>
            )}

            {/* 7. Team Analysis */}
            {report.detailedAnalysis && report.detailedAnalysis.filter(a => a.id?.includes('employee') || a.id?.includes('supervisor') || a.id?.includes('team')).length > 0 && (
              <ReportSection
                id="team-analysis"
                sectionNumber={7}
                title="تحليل الموظفين والمشرفين"
                subtitle="أداء الفريق"
                icon={<Users className="h-5 w-5" />}
              >
                <div className="space-y-6">
                  {report.detailedAnalysis
                    .filter(a => a.id?.includes('employee') || a.id?.includes('supervisor') || a.id?.includes('team'))
                    .map((analysis, idx) => (
                      <AnalysisCard key={analysis.id} analysis={analysis} index={idx} />
                    ))}
                </div>
              </ReportSection>
            )}

            {/* 8. Critical Cases */}
            <ReportSection
              id="critical-cases"
              sectionNumber={8}
              title="الحالات الحرجة"
              subtitle="التكملات والمشاكل"
              icon={<AlertTriangle className="h-5 w-5" />}
            >
              <CriticalCases
                cases={report.criticalCases}
                recommendations={[]}
                conclusion={undefined}
              />
            </ReportSection>

            {/* 9. Charts */}
            {report.charts && report.charts.length > 0 && (
              <ReportSection
                id="charts"
                sectionNumber={9}
                title="الرسوم البيانية"
                subtitle={`${report.charts.length} رسم بياني`}
                icon={<BarChart3 className="h-5 w-5" />}
              >
                <AdvancedCharts charts={report.charts} />
              </ReportSection>
            )}

            {/* 10. Recommendations */}
            {report.recommendations && report.recommendations.length > 0 && (
              <ReportSection
                id="recommendations"
                sectionNumber={10}
                title="التوصيات التنفيذية"
                subtitle="الملاحظات والتوصيات"
                icon={<UserCheck className="h-5 w-5" />}
              >
                <RecommendationsSection recommendations={report.recommendations} />
              </ReportSection>
            )}

            {/* 11. Conclusion */}
            {report.conclusion && (
              <ReportSection
                id="conclusion"
                sectionNumber={11}
                title="الاستنتاج النهائي"
                icon={<CheckCircle2 className="h-5 w-5" />}
              >
                <ConclusionSection conclusion={report.conclusion} />
              </ReportSection>
            )}

            {/* Footer */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-6 text-center text-sm text-slate-500 dark:text-slate-400 print:mt-8">
              <p>
                تم إعداد هذا التقرير تلقائياً بواسطة مركز تحليل البيانات الذكي
              </p>
              <p className="mt-1">
                بناءً على بيانات ملف "{report.metadata.fileName}" •{' '}
                {new Date(report.generatedAt).toLocaleString('ar-IQ')}
              </p>
              <p className="mt-2 text-xs">
                {report.metadata.rowCount.toLocaleString('ar-IQ')} سجل | {report.metadata.columnCount} عمود
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// Analysis Card Component
interface AnalysisCardProps {
  analysis: {
    id: string;
    title: string;
    description?: string;
    tableHeaders?: string[];
    tableRows?: { indicator: string; value: string | number; percentage?: string; status?: string }[];
    analysis?: string;
    insights?: string[];
  };
  index: number;
}

function AnalysisCard({ analysis, index }: AnalysisCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5"
    >
      <h4 className="font-bold text-lg mb-2 text-slate-900 dark:text-white">
        {analysis.title}
      </h4>
      {analysis.description && (
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          {analysis.description}
        </p>
      )}

      {analysis.tableRows && analysis.tableRows.length > 0 && (
        <ReportTable
          headers={analysis.tableHeaders || ['المؤشر', 'العدد', 'النسبة']}
          rows={analysis.tableRows.map((row) => ({
            cells: [
              row.indicator,
              typeof row.value === 'number'
                ? row.value.toLocaleString('ar-IQ')
                : row.value,
              row.percentage || '—',
            ],
            status: row.status as 'good' | 'warning' | 'bad' | undefined,
          }))}
          className="mb-4"
        />
      )}

      {analysis.analysis && (
        <div className="rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 p-3 mt-4">
          <p className="text-sm text-cyan-700 dark:text-cyan-300">
            <span className="font-semibold">تحليل:</span> {analysis.analysis}
          </p>
        </div>
      )}

      {analysis.insights && analysis.insights.length > 0 && (
        <div className="mt-4 space-y-2">
          {analysis.insights.map((insight, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
            >
              <span className="text-emerald-600">•</span>
              {insight}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// Recommendations Section Component
interface RecommendationsSectionProps {
  recommendations: {
    id: string;
    priority: string;
    category: string;
    text: string;
  }[];
}

function RecommendationsSection({ recommendations }: RecommendationsSectionProps) {
  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
    low: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  };

  const priorityLabels: Record<string, string> = {
    urgent: 'عاجل',
    high: 'عالي',
    medium: 'متوسط',
    low: 'منخفض',
  };

  return (
    <div className="space-y-4">
      {/* Operational Notes */}
      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-5">
        <h4 className="font-bold text-emerald-800 dark:text-emerald-300 mb-3">الملاحظات التشغيلية</h4>
        <div className="space-y-2">
          {recommendations.filter(r => r.category === 'operational' || r.category === 'quality').slice(0, 3).map((rec, i) => (
            <div key={rec.id} className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <span>{i + 1}.</span>
              <span>{rec.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations List */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <h4 className="font-bold text-slate-900 dark:text-white mb-4">التوصيات</h4>
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border',
                priorityColors[rec.priority] || 'bg-slate-100 dark:bg-slate-700'
              )}
            >
              <span className="text-lg">✓</span>
              <div className="flex-1">
                <p className="text-sm">{rec.text}</p>
                <span className="text-xs opacity-75">{priorityLabels[rec.priority] || rec.priority}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Conclusion Section Component
interface ConclusionSectionProps {
  conclusion: {
    overallRating: string;
    summary: string;
    keyMetrics: { label: string; value: string; trend?: string }[];
    nextSteps: string[];
    finalNote?: string;
  };
}

function ConclusionSection({ conclusion }: ConclusionSectionProps) {
  const ratingColors: Record<string, string> = {
    excellent: 'bg-emerald-500',
    good: 'bg-green-500',
    acceptable: 'bg-yellow-500',
    needs_improvement: 'bg-orange-500',
    critical: 'bg-red-500',
  };

  const ratingLabels: Record<string, string> = {
    excellent: 'ممتاز',
    good: 'جيد جداً',
    acceptable: 'مقبول',
    needs_improvement: 'يحتاج تحسين',
    critical: 'حرج',
  };

  return (
    <div className="space-y-6">
      {/* Overall Rating */}
      <div className="text-center p-6 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700">
        <div className={cn(
          'inline-flex items-center justify-center w-20 h-20 rounded-full text-white text-2xl font-bold mb-4',
          ratingColors[conclusion.overallRating] || 'bg-slate-500'
        )}>
          {ratingLabels[conclusion.overallRating]?.charAt(0) || '؟'}
        </div>
        <h3 className="text-2xl font-black text-slate-900 dark:text-white">
          {ratingLabels[conclusion.overallRating] || conclusion.overallRating}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 mt-2 max-w-2xl mx-auto">
          {conclusion.summary}
        </p>
      </div>

      {/* Key Metrics */}
      {conclusion.keyMetrics && conclusion.keyMetrics.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {conclusion.keyMetrics.map((metric, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center"
            >
              <p className="text-sm text-slate-500 dark:text-slate-400">{metric.label}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{metric.value}</p>
              {metric.trend && (
                <span className={cn(
                  'text-xs',
                  metric.trend === 'up' ? 'text-emerald-600' : metric.trend === 'down' ? 'text-red-600' : 'text-slate-500'
                )}>
                  {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Next Steps */}
      {conclusion.nextSteps && conclusion.nextSteps.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <h4 className="font-bold text-slate-900 dark:text-white mb-3">الخطوات التالية</h4>
          <ul className="space-y-2">
            {conclusion.nextSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="text-cyan-600 font-bold">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Final Note */}
      {conclusion.finalNote && (
        <div className="rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 p-5 text-center">
          <p className="text-cyan-700 dark:text-cyan-300 italic">{conclusion.finalNote}</p>
        </div>
      )}
    </div>
  );
}
