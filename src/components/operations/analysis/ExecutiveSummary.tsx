import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
  BookOpen,
  FileText,
  Lightbulb,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import ReportSection from './ReportSection';
import type { ExecutiveSummaryData, ExecutiveSummaryKPI } from '../../../lib/dataAnalysis/types';

interface ExecutiveSummaryProps {
  data: ExecutiveSummaryData;
  metadata?: {
    fileName: string;
    rowCount: number;
    columnCount: number;
    dateRange?: { from: string; to: string };
  };
}

const KPI_COLORS = {
  green: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-300',
    value: 'text-emerald-800 dark:text-emerald-200',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    value: 'text-red-800 dark:text-red-200',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    value: 'text-amber-800 dark:text-amber-200',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
    value: 'text-blue-800 dark:text-blue-200',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    text: 'text-purple-700 dark:text-purple-300',
    value: 'text-purple-800 dark:text-purple-200',
  },
  cyan: {
    bg: 'bg-cyan-50 dark:bg-cyan-900/20',
    border: 'border-cyan-200 dark:border-cyan-800',
    text: 'text-cyan-700 dark:text-cyan-300',
    value: 'text-cyan-800 dark:text-cyan-200',
  },
};

function KPICard({ kpi, index }: { kpi: ExecutiveSummaryKPI; index: number }) {
  const colors = KPI_COLORS[kpi.color];
  const TrendIcon =
    kpi.trend === 'up' ? TrendingUp : kpi.trend === 'down' ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        'rounded-xl border p-4 transition-all hover:shadow-md',
        colors.bg,
        colors.border
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-sm font-medium', colors.text)}>{kpi.title}</p>
        {kpi.trend && (
          <TrendIcon
            className={cn(
              'h-4 w-4',
              kpi.trend === 'up'
                ? 'text-emerald-600'
                : kpi.trend === 'down'
                  ? 'text-red-600'
                  : 'text-slate-400'
            )}
          />
        )}
      </div>
      <p className={cn('text-2xl font-black mt-2', colors.value)}>{kpi.value}</p>
      {kpi.percentage !== undefined && (
        <div className="mt-2">
          <div className="h-2 w-full rounded-full bg-white/50 dark:bg-black/20 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(kpi.percentage, 100)}%` }}
              transition={{ duration: 0.8, delay: 0.3 + index * 0.1 }}
              className={cn('h-full rounded-full', {
                'bg-emerald-500': kpi.color === 'green',
                'bg-red-500': kpi.color === 'red',
                'bg-amber-500': kpi.color === 'amber',
                'bg-blue-500': kpi.color === 'blue',
                'bg-purple-500': kpi.color === 'purple',
                'bg-cyan-500': kpi.color === 'cyan',
              })}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">{kpi.percentage.toFixed(1)}%</p>
        </div>
      )}
      {kpi.description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          {kpi.description}
        </p>
      )}
    </motion.div>
  );
}

export default function ExecutiveSummary({ data, metadata }: ExecutiveSummaryProps) {
  return (
    <ReportSection
      id="executive-summary"
      sectionNumber={1}
      title="الملخص التنفيذي"
      subtitle="نظرة عامة على مؤشرات الأداء الرئيسية"
    >
      <div className="space-y-6">
        {/* Report Header */}
        <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-700 p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black mb-1">{data.title}</h1>
              <p className="text-slate-300">{data.subtitle}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">{data.date}</span>
            </div>
          </div>

          {metadata && (
            <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-white/10">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-cyan-400" />
                <span className="text-slate-300">الملف:</span>
                <span className="font-semibold">{metadata.fileName}</span>
              </div>
              <div>
                <span className="text-slate-300">السجلات:</span>
                <span className="font-semibold mr-1">
                  {metadata.rowCount.toLocaleString('ar-IQ')}
                </span>
              </div>
              <div>
                <span className="text-slate-300">الأعمدة:</span>
                <span className="font-semibold mr-1">{metadata.columnCount}</span>
              </div>
              {metadata.dateRange && (
                <div>
                  <span className="text-slate-300">الفترة:</span>
                  <span className="font-semibold mr-1">
                    {metadata.dateRange.from} - {metadata.dateRange.to}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* KPIs Grid */}
        <div>
          <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">
            مؤشرات الأداء الرئيسية (KPIs)
          </h3>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {data.kpis.map((kpi, idx) => (
              <KPICard key={kpi.id} kpi={kpi} index={idx} />
            ))}
          </div>
        </div>

        {/* Narrative Introduction Section */}
        {data.narrativeIntro && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40">
                <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-bold text-lg text-indigo-800 dark:text-indigo-200">
                نظرة تحليلية شاملة
              </h3>
            </div>
            <p className="text-indigo-700 dark:text-indigo-300 leading-relaxed whitespace-pre-line text-justify">
              {data.narrativeIntro}
            </p>
          </motion.div>
        )}

        {/* Narrative Analysis Section */}
        {data.narrativeAnalysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800 p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/40">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-bold text-lg text-blue-800 dark:text-blue-200">
                التحليل التفصيلي
              </h3>
            </div>
            <p className="text-blue-700 dark:text-blue-300 leading-relaxed whitespace-pre-line text-justify">
              {data.narrativeAnalysis}
            </p>
          </motion.div>
        )}

        {/* Executive Summary Text */}
        <div className="rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 p-5">
          <h3 className="font-bold text-lg mb-3 text-cyan-800 dark:text-cyan-200">
            الخلاصة التنفيذية
          </h3>
          <p className="text-cyan-700 dark:text-cyan-300 leading-relaxed whitespace-pre-line">
            {data.summary}
          </p>
        </div>

        {/* Narrative Conclusion Section */}
        {data.narrativeConclusion && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                <Lightbulb className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-bold text-lg text-emerald-800 dark:text-emerald-200">
                خلاصة النتائج
              </h3>
            </div>
            <p className="text-emerald-700 dark:text-emerald-300 leading-relaxed whitespace-pre-line text-justify">
              {data.narrativeConclusion}
            </p>
          </motion.div>
        )}

        {/* Highlights */}
        {data.highlights && data.highlights.length > 0 && (
          <div>
            <h3 className="font-bold text-lg mb-3 text-slate-900 dark:text-white">
              أبرز النقاط
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {data.highlights.map((highlight, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-start gap-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 p-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </span>
                  <span className="text-slate-700 dark:text-slate-300">{highlight}</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ReportSection>
  );
}
