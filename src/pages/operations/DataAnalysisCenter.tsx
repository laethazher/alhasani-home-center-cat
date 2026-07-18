import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Upload,
  FileSpreadsheet,
  FileText,
  Trash2,
  Clock,
  Loader2,
  AlertCircle,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import OperationsPageShell from '../../components/operations/OperationsPageShell';
import ProfessionalReport from '../../components/operations/analysis/ProfessionalReport';
import DataChat from '../../components/operations/analysis/DataChat';
import SmartAnalysisChat from '../../components/operations/analysis/SmartAnalysisChat';
import { analyzeFile } from '../../lib/dataAnalysis/analysisEngine';
import { analyzeWithAI, isAIAvailable, generateProfessionalReport } from '../../lib/dataAnalysis/aiAnalyzer';
import { generateCustomAnalysis } from '../../lib/dataAnalysis/smartAnalyzer';
import { exportReportToPDF } from '../../lib/dataAnalysis/pdfExporter';
import type {
  AnalysisReport as AnalysisReportType,
  AIAnalysisResult,
  ProfessionalReportData,
} from '../../lib/dataAnalysis/types';

const STORAGE_KEY = 'data_analysis_reports_v2';

interface StoredReport {
  report: AnalysisReportType;
  aiAnalysis?: AIAnalysisResult;
  professionalReport?: ProfessionalReportData;
  customPrompt?: string;
}

function loadStoredReports(): StoredReport[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveReports(reports: StoredReport[]): void {
  try {
    const toStore = reports.slice(0, 10).map((r) => ({
      report: {
        ...r.report,
        rawData: r.report.rawData.slice(0, 100),
      },
      aiAnalysis: r.aiAnalysis,
      professionalReport: r.professionalReport,
      customPrompt: r.customPrompt,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    console.warn('Failed to save reports to localStorage');
  }
}

type ViewState = 'home' | 'uploading' | 'chat' | 'analyzing' | 'report';

export default function DataAnalysisCenter() {
  const [view, setView] = useState<ViewState>('home');
  const [storedReports, setStoredReports] = useState(loadStoredReports);
  const [currentReport, setCurrentReport] = useState<AnalysisReportType | null>(null);
  const [currentAIAnalysis, setCurrentAIAnalysis] = useState<AIAnalysisResult | null>(null);
  const [currentProfessionalReport, setCurrentProfessionalReport] = useState<ProfessionalReportData | null>(null);
  const [currentCustomPrompt, setCurrentCustomPrompt] = useState<string>('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    setView('uploading');
    setUploadProgress(10);
    setStatusMessage('جاري قراءة الملف...');

    try {
      setUploadProgress(30);
      const report = await analyzeFile(file);
      setUploadProgress(80);
      setStatusMessage('تم قراءة الملف بنجاح!');

      setCurrentReport(report);
      setCurrentAIAnalysis(null);
      setCurrentProfessionalReport(null);
      setCurrentCustomPrompt('');
      setUploadProgress(100);

      setTimeout(() => {
        setView('chat');
      }, 500);
    } catch (e) {
      console.error('File reading failed:', e);
      setError(e instanceof Error ? e.message : 'فشل في قراءة الملف');
      setView('home');
    }
  }, []);

  const handleAnalysisComplete = useCallback(async (customPrompt: string, analysisType: string) => {
    if (!currentReport) return;
    
    setView('analyzing');
    setUploadProgress(10);
    setStatusMessage('جاري تحليل البيانات حسب طلبك...');
    setIsLoadingAI(true);
    setCurrentCustomPrompt(customPrompt);

    try {
      setUploadProgress(30);
      setStatusMessage('جاري التحليل بالذكاء الاصطناعي...');
      
      const customAnalysisText = await generateCustomAnalysis(currentReport, customPrompt, analysisType);
      setUploadProgress(50);
      
      const aiResult = await analyzeWithAI(currentReport);
      aiResult.summary = customAnalysisText;
      setCurrentAIAnalysis(aiResult);
      setUploadProgress(70);
      
      setStatusMessage('جاري إنشاء التقرير الاحترافي...');
      const profReport = await generateProfessionalReport(currentReport);
      profReport.executiveSummary.summary = customAnalysisText;
      setCurrentProfessionalReport(profReport);
      setUploadProgress(90);

      currentReport.aiAnalysis = aiResult;
      setIsLoadingAI(false);
      setUploadProgress(100);
      setStatusMessage('تم الانتهاء!');

      const newReports = [
        { report: currentReport, aiAnalysis: aiResult, professionalReport: profReport, customPrompt },
        ...storedReports,
      ];
      setStoredReports(newReports);
      saveReports(newReports);

      setTimeout(() => {
        setView('report');
      }, 500);
    } catch (e) {
      console.error('Analysis failed:', e);
      setError(e instanceof Error ? e.message : 'فشل في تحليل الملف');
      setView('chat');
      setIsLoadingAI(false);
    }
  }, [currentReport, storedReports]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [handleFileSelect]
  );

  const openReport = useCallback((stored: StoredReport) => {
    setCurrentReport(stored.report);
    setCurrentAIAnalysis(stored.aiAnalysis || null);
    setCurrentProfessionalReport(stored.professionalReport || null);
    setCurrentCustomPrompt(stored.customPrompt || '');
    setView('report');
  }, []);

  const deleteReport = useCallback((reportId: string) => {
    const newReports = storedReports.filter((r) => r.report.id !== reportId);
    setStoredReports(newReports);
    saveReports(newReports);
  }, [storedReports]);

  const goHome = useCallback(() => {
    setView('home');
    setCurrentReport(null);
    setCurrentAIAnalysis(null);
    setCurrentProfessionalReport(null);
    setCurrentCustomPrompt('');
    setError(null);
    setIsChatOpen(false);
  }, []);

  const handleExportPDF = useCallback(async () => {
    if (!currentProfessionalReport || !currentReport) return;
    
    setIsExportingPDF(true);
    try {
      await exportReportToPDF(currentProfessionalReport, currentReport);
    } catch (e) {
      console.error('PDF export failed:', e);
      setError('فشل في تصدير التقرير');
    } finally {
      setIsExportingPDF(false);
    }
  }, [currentProfessionalReport, currentReport]);

  if (view === 'chat' && currentReport) {
    return (
      <OperationsPageShell
        title="محادثة التحليل الذكي"
        subtitle="أخبرني ما الذي تريد تحليله من البيانات"
        icon={MessageSquare}
      >
        <SmartAnalysisChat
          report={currentReport}
          onAnalysisComplete={handleAnalysisComplete}
          onBack={goHome}
        />
      </OperationsPageShell>
    );
  }

  if (view === 'report' && currentReport && currentProfessionalReport) {
    return (
      <>
        <ProfessionalReport
          report={currentProfessionalReport}
          rawReport={currentReport}
          onExportPDF={handleExportPDF}
          onOpenChat={() => setIsChatOpen(true)}
          onBack={goHome}
          isExporting={isExportingPDF}
        />
        <DataChat
          report={currentReport}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      </>
    );
  }

  return (
    <OperationsPageShell
      title="مركز تحليل البيانات الذكي"
      subtitle="ارفع ملفك وأخبر الذكاء الاصطناعي بما تريد تحليله"
      icon={Brain}
      actions={
        isAIAvailable() && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            AI ذكي متاح
          </div>
        )
      }
    >
      <AnimatePresence mode="wait">
        {(view === 'uploading' || view === 'analyzing') && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="relative">
              <div className="h-28 w-28 rounded-full border-4 border-purple-200 dark:border-purple-800" />
              <motion.div
                className="absolute inset-0 h-28 w-28 rounded-full border-4 border-transparent border-t-purple-600"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                {view === 'uploading' ? (
                  <Upload className="h-10 w-10 text-purple-600" />
                ) : (
                  <Brain className="h-10 w-10 text-purple-600" />
                )}
              </div>
            </div>
            <p className="mt-6 text-xl font-bold text-slate-900 dark:text-white">
              {statusMessage}
            </p>
            <div className="mt-4 w-80 h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-600 to-cyan-600 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="mt-2 text-sm text-slate-500">{uploadProgress}%</p>
            
            {view === 'analyzing' && (
              <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-slate-500">
                <span className={cn('flex items-center gap-1', uploadProgress >= 30 && 'text-emerald-600')}>
                  {uploadProgress >= 30 ? '✓' : '○'} فهم الطلب
                </span>
                <span className={cn('flex items-center gap-1', uploadProgress >= 50 && 'text-emerald-600')}>
                  {uploadProgress >= 50 ? '✓' : '○'} تحليل AI
                </span>
                <span className={cn('flex items-center gap-1', uploadProgress >= 70 && 'text-emerald-600')}>
                  {uploadProgress >= 70 ? '✓' : '○'} إنشاء التحليل
                </span>
                <span className={cn('flex items-center gap-1', uploadProgress >= 90 && 'text-emerald-600')}>
                  {uploadProgress >= 90 ? '✓' : '○'} التقرير النهائي
                </span>
              </div>
            )}
          </motion.div>
        )}

        {view === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Upload Area */}
            <div
              className={cn(
                'relative rounded-2xl border-2 border-dashed p-12 text-center transition-all cursor-pointer',
                'border-slate-300 dark:border-slate-600',
                'hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10',
                'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900'
              )}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleInputChange}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-600 shadow-xl shadow-purple-500/30">
                  <Upload className="h-12 w-12 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    اسحب الملف هنا أو اضغط للرفع
                  </p>
                  <p className="mt-2 text-slate-500 dark:text-slate-400">
                    بعد الرفع، ستبدأ محادثة ذكية لتحديد ما تريد تحليله
                  </p>
                </div>
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 px-4 py-2">
                    <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium text-emerald-700 dark:text-emerald-300">Excel</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 px-4 py-2">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-blue-700 dark:text-blue-300">CSV</span>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-300"
              >
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* How it works */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                كيف يعمل التحليل الذكي؟
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 font-bold">
                    1
                  </span>
                  <div>
                    <h4 className="font-semibold">ارفع ملفك</h4>
                    <p className="text-sm text-slate-500">Excel أو CSV</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 font-bold">
                    2
                  </span>
                  <div>
                    <h4 className="font-semibold">تحدث مع AI</h4>
                    <p className="text-sm text-slate-500">أخبره ما تريد تحليله</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 font-bold">
                    3
                  </span>
                  <div>
                    <h4 className="font-semibold">احصل على تقرير مخصص</h4>
                    <p className="text-sm text-slate-500">تحليل حسب طلبك بالضبط</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Previous Reports */}
            {storedReports.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-4">التقارير السابقة</h3>
                <div className="space-y-3">
                  {storedReports.map((stored) => (
                    <motion.div
                      key={stored.report.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 hover:border-purple-400 dark:hover:border-purple-500 transition-colors cursor-pointer group"
                      onClick={() => openReport(stored)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors">
                          <FileSpreadsheet className="h-7 w-7 text-slate-600 dark:text-slate-400 group-hover:text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">{stored.report.summary.fileName}</h4>
                          <p className="text-sm text-slate-500">
                            {stored.report.summary.rowCount.toLocaleString('ar-IQ')} سجل •{' '}
                            {stored.report.summary.columnCount} عمود
                            {stored.customPrompt && (
                              <span className="mr-2 text-purple-600">• تحليل مخصص</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="h-3 w-3" />
                          {new Date(stored.report.createdAt).toLocaleDateString('ar-IQ')}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteReport(stored.report.id);
                          }}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </OperationsPageShell>
  );
}
