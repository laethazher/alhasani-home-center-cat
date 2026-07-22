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
              {/* Data Structure Narrative */}
              {(report.dataUnderstanding.narrativeExplanation || report.narrativeSections?.dataStructureNarrative) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 p-6 mb-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40">
                      <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h4 className="font-bold text-lg text-indigo-800 dark:text-indigo-200">
                      تحليل هيكل البيانات
                    </h4>
                  </div>
                  <p className="text-indigo-700 dark:text-indigo-300 leading-relaxed whitespace-pre-line text-justify">
                    {report.dataUnderstanding.narrativeExplanation || report.narrativeSections?.dataStructureNarrative}
                  </p>
                </motion.div>
              )}
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
                {/* Delivery Narrative */}
                {report.narrativeSections?.deliveryNarrative && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 p-6 mb-6"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                        <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <h4 className="font-bold text-lg text-emerald-800 dark:text-emerald-200">
                        التحليل السردي للتجهيز
                      </h4>
                    </div>
                    <p className="text-emerald-700 dark:text-emerald-300 leading-relaxed whitespace-pre-line text-justify">
                      {report.narrativeSections.deliveryNarrative}
                    </p>
                  </motion.div>
                )}
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
                {/* Installation Narrative */}
                {report.narrativeSections?.installationNarrative && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800 p-6 mb-6"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/40">
                        <Wrench className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h4 className="font-bold text-lg text-blue-800 dark:text-blue-200">
                        التحليل السردي للتركيب
                      </h4>
                    </div>
                    <p className="text-blue-700 dark:text-blue-300 leading-relaxed whitespace-pre-line text-justify">
                      {report.narrativeSections.installationNarrative}
                    </p>
                  </motion.div>
                )}
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
                {/* Customer Journey Narrative */}
                {report.narrativeSections?.customerJourneyNarrative && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 p-6 mb-6"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/40">
                        <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <h4 className="font-bold text-lg text-purple-800 dark:text-purple-200">
                        تحليل رحلة الزبون
                      </h4>
                    </div>
                    <p className="text-purple-700 dark:text-purple-300 leading-relaxed whitespace-pre-line text-justify">
                      {report.narrativeSections.customerJourneyNarrative}
                    </p>
                  </motion.div>
                )}
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
                {/* Stage Narrative */}
                {report.narrativeSections?.stageNarrative && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl bg-gradient-to-br from-teal-50 to-green-50 dark:from-teal-900/20 dark:to-green-900/20 border border-teal-200 dark:border-teal-800 p-6 mb-6"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/40">
                        <CheckCircle2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <h4 className="font-bold text-lg text-teal-800 dark:text-teal-200">
                        تحليل مراحل العمل
                      </h4>
                    </div>
                    <p className="text-teal-700 dark:text-teal-300 leading-relaxed whitespace-pre-line text-justify">
                      {report.narrativeSections.stageNarrative}
                    </p>
                  </motion.div>
                )}
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
                {/* Team Narrative */}
                {report.narrativeSections?.teamNarrative && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800 p-6 mb-6"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/40">
                        <Users className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <h4 className="font-bold text-lg text-orange-800 dark:text-orange-200">
                        تحليل أداء الفريق
                      </h4>
                    </div>
                    <p className="text-orange-700 dark:text-orange-300 leading-relaxed whitespace-pre-line text-justify">
                      {report.narrativeSections.teamNarrative}
                    </p>
                  </motion.div>
                )}
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
              {/* Critical Cases Narrative */}
              {report.narrativeSections?.criticalCasesNarrative && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200 dark:border-red-800 p-6 mb-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/40">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <h4 className="font-bold text-lg text-red-800 dark:text-red-200">
                      تحليل الحالات الحرجة
                    </h4>
                  </div>
                  <p className="text-red-700 dark:text-red-300 leading-relaxed whitespace-pre-line text-justify">
                    {report.narrativeSections.criticalCasesNarrative}
                  </p>
                </motion.div>
              )}
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
    tableRows?: { indicator: string; value: string | number; percentage?: string; status?: 'success' | 'warning' | 'danger' | 'info' }[];
    analysis?: string;
    insights?: string[];
    narrativeExplanation?: string;
    detailedNarrative?: string;
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

      {/* Narrative Explanation Section */}
      {analysis.narrativeExplanation && (
        <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
              <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h5 className="font-semibold text-sm text-indigo-800 dark:text-indigo-200">شرح تحليلي</h5>
          </div>
          <p className="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed whitespace-pre-line text-justify">
            {analysis.narrativeExplanation}
          </p>
        </div>
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
            status: row.status,
          }))}
          className="mb-4"
        />
      )}

      {/* Detailed Narrative for Table Data */}
      {analysis.detailedNarrative && (
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800 p-4 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
              <BarChart3 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <h5 className="font-semibold text-sm text-blue-800 dark:text-blue-200">تفسير الأرقام</h5>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed whitespace-pre-line text-justify">
            {analysis.detailedNarrative}
          </p>
        </div>
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
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    category: 'immediate' | 'short-term' | 'long-term';
    impact?: string;
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
          {recommendations.filter(r => r.category === 'immediate').slice(0, 3).map((rec, i) => (
            <div key={rec.id} className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <span>{i + 1}.</span>
              <span>{rec.description}</span>
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
                <p className="text-sm">{rec.description}</p>
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
    keyMetrics: { label: string; value: string; status?: 'success' | 'warning' | 'danger' }[];
    finalNotes: string[];
    finalNote?: string;
    fullNarrative?: string;
    expertOpinion?: string;
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

      {/* Full Narrative Section */}
      {conclusion.fullNarrative && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40">
              <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h4 className="font-bold text-lg text-indigo-800 dark:text-indigo-200">
              الاستنتاج التفصيلي
            </h4>
          </div>
          <p className="text-indigo-700 dark:text-indigo-300 leading-relaxed whitespace-pre-line text-justify">
            {conclusion.fullNarrative}
          </p>
        </motion.div>
      )}

      {/* Expert Opinion Section */}
      {conclusion.expertOpinion && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
              <UserCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h4 className="font-bold text-lg text-amber-800 dark:text-amber-200">
              رأي المحلل الخبير
            </h4>
          </div>
          <p className="text-amber-700 dark:text-amber-300 leading-relaxed whitespace-pre-line text-justify italic">
            {conclusion.expertOpinion}
          </p>
        </motion.div>
      )}

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
              {metric.status && (
                <span className={cn(
                  'inline-block mt-1 h-2.5 w-2.5 rounded-full',
                  metric.status === 'success' ? 'bg-emerald-500' : metric.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                )} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Final Notes */}
      {conclusion.finalNotes && conclusion.finalNotes.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <h4 className="font-bold text-slate-900 dark:text-white mb-3">الملاحظات الختامية</h4>
          <ul className="space-y-2">
            {conclusion.finalNotes.map((step, i) => (
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
