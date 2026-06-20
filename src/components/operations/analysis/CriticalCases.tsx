import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Shield,
  ChevronDown,
  ChevronUp,
  Users,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import ReportSection, { ReportBadge } from './ReportSection';
import type { CriticalCase, Recommendation, ConclusionData } from '../../../lib/dataAnalysis/types';
import { CRITICAL_TYPE_LABELS, PRIORITY_LABELS, CATEGORY_LABELS, RATING_LABELS } from '../../../lib/dataAnalysis/types';

interface CriticalCasesProps {
  cases: CriticalCase[];
  recommendations?: Recommendation[];
  conclusion?: ConclusionData;
}

const CASE_ICONS = {
  conflict: AlertTriangle,
  warning: AlertCircle,
  critical: Shield,
  info: Info,
};

const CASE_COLORS = {
  conflict: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    icon: 'text-amber-600',
    badge: 'warning' as const,
  },
  warning: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-800',
    icon: 'text-orange-600',
    badge: 'warning' as const,
  },
  critical: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-600',
    badge: 'danger' as const,
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-600',
    badge: 'info' as const,
  },
};

function CaseCard({ caseItem, index }: { caseItem: CriticalCase; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = CASE_ICONS[caseItem.type];
  const colors = CASE_COLORS[caseItem.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn('rounded-xl border overflow-hidden', colors.bg, colors.border)}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start justify-between gap-4 p-4 text-right hover:bg-white/50 dark:hover:bg-black/10 transition-colors"
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-black/20',
              colors.icon
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h4 className="font-bold text-slate-900 dark:text-white">{caseItem.title}</h4>
              <ReportBadge text={CRITICAL_TYPE_LABELS[caseItem.type]} variant={colors.badge} size="sm" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">{caseItem.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-white/70 dark:bg-black/20 px-3 py-1.5">
            <Users className="h-4 w-4 text-slate-500" />
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {caseItem.affectedCount.toLocaleString('ar-IQ')}
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-4">
              {caseItem.details && caseItem.details.length > 0 && (
                <div className="rounded-lg bg-white dark:bg-slate-800 p-3 space-y-2">
                  <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    التفاصيل
                  </h5>
                  {caseItem.details.map((detail, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-slate-500">{detail.label}</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {detail.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {caseItem.items && caseItem.items.length > 0 && (
                <div className="rounded-lg bg-white dark:bg-slate-800 p-3">
                  <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    الحالات المتأثرة
                  </h5>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {caseItem.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded bg-slate-50 dark:bg-slate-700/50 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">{item.status}</span>
                          {item.info && (
                            <span className="text-xs text-slate-400">{item.info}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function CriticalCases({ cases, recommendations, conclusion }: CriticalCasesProps) {
  const criticalCount = cases.filter((c) => c.type === 'critical').length;
  const warningCount = cases.filter((c) => c.type === 'warning' || c.type === 'conflict').length;

  return (
    <div className="space-y-6">
      {/* Critical Cases Section */}
      <ReportSection
        id="critical-cases"
        sectionNumber={5}
        title="الحالات الحرجة والتعارضات"
        subtitle={`${cases.length} حالة • ${criticalCount} حرجة • ${warningCount} تحذير`}
      >
        {cases.length === 0 ? (
          <div className="text-center py-8">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <Shield className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="mt-4 text-lg font-semibold text-slate-700 dark:text-slate-300">
              لا توجد حالات حرجة
            </p>
            <p className="text-sm text-slate-500">البيانات سليمة ولا تحتوي على تعارضات</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cases.map((caseItem, idx) => (
              <CaseCard key={caseItem.id} caseItem={caseItem} index={idx} />
            ))}
          </div>
        )}
      </ReportSection>

      {/* Recommendations Section */}
      {recommendations && recommendations.length > 0 && (
        <ReportSection
          id="recommendations"
          sectionNumber={6}
          title="التوصيات التنفيذية"
          subtitle={`${recommendations.length} توصية`}
        >
          <div className="space-y-3">
            {recommendations.map((rec, idx) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={cn(
                  'rounded-xl border p-4',
                  rec.priority === 'high'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : rec.priority === 'medium'
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white font-bold text-sm',
                      rec.priority === 'high'
                        ? 'bg-red-600'
                        : rec.priority === 'medium'
                          ? 'bg-amber-600'
                          : 'bg-blue-600'
                    )}
                  >
                    ✓
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="font-bold text-slate-900 dark:text-white">{rec.title}</h4>
                      <ReportBadge
                        text={PRIORITY_LABELS[rec.priority]}
                        variant={
                          rec.priority === 'high'
                            ? 'danger'
                            : rec.priority === 'medium'
                              ? 'warning'
                              : 'info'
                        }
                        size="sm"
                      />
                      <ReportBadge
                        text={CATEGORY_LABELS[rec.category]}
                        variant="neutral"
                        size="sm"
                      />
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{rec.description}</p>
                    {rec.impact && (
                      <p className="text-xs text-slate-500 mt-2">
                        <span className="font-semibold">التأثير:</span> {rec.impact}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </ReportSection>
      )}

      {/* Conclusion Section */}
      {conclusion && (
        <ReportSection
          id="conclusion"
          sectionNumber={7}
          title="الاستنتاج النهائي"
          subtitle="التقييم الشامل والملاحظات الختامية"
        >
          <div className="space-y-6">
            {/* Overall Rating */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-700 p-6 text-white">
              <div>
                <p className="text-slate-300 mb-1">التقييم الشامل</p>
                <h3 className="text-3xl font-black">{RATING_LABELS[conclusion.overallRating]}</h3>
              </div>
              <div
                className={cn(
                  'flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-black',
                  conclusion.ratingScore >= 80
                    ? 'bg-emerald-500'
                    : conclusion.ratingScore >= 60
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                )}
              >
                {conclusion.ratingScore}%
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 p-5">
              <p className="text-cyan-700 dark:text-cyan-300 leading-relaxed">
                {conclusion.summary}
              </p>
            </div>

            {/* Key Metrics */}
            {conclusion.keyMetrics && conclusion.keyMetrics.length > 0 && (
              <div className="grid gap-4 md:grid-cols-3">
                {conclusion.keyMetrics.map((metric, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'rounded-xl border p-4',
                      metric.status === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                        : metric.status === 'warning'
                          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    )}
                  >
                    <p className="text-sm text-slate-600 dark:text-slate-400">{metric.label}</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Final Notes */}
            {conclusion.finalNotes && conclusion.finalNotes.length > 0 && (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5">
                <h4 className="font-bold mb-3 text-slate-900 dark:text-white">
                  ملاحظات ختامية
                </h4>
                <ul className="space-y-2">
                  {conclusion.finalNotes.map((note, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <span className="text-cyan-600">•</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ReportSection>
      )}
    </div>
  );
}
