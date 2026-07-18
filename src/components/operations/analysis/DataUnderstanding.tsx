import { motion } from 'framer-motion';
import { Database, Link2, Table2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import ReportSection, { ReportTable, ReportBadge } from './ReportSection';
import type { DataUnderstandingSection, ColumnAnalysis } from '../../../lib/dataAnalysis/types';
import { DATA_TYPE_LABELS } from '../../../lib/dataAnalysis/types';

interface DataUnderstandingProps {
  data: DataUnderstandingSection;
  columns?: ColumnAnalysis[];
}

const DATA_TYPE_COLORS: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  number: 'success',
  integer: 'success',
  percentage: 'info',
  currency: 'warning',
  text: 'neutral',
  date: 'info',
  datetime: 'info',
  boolean: 'warning',
  email: 'info',
  phone: 'info',
  unknown: 'danger',
};

export default function DataUnderstanding({ data, columns }: DataUnderstandingProps) {
  return (
    <ReportSection
      id="data-understanding"
      sectionNumber={2}
      title={data.title}
      subtitle={data.description}
    >
      <div className="space-y-6">
        {/* Columns Description */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-5 w-5 text-cyan-600" />
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
              الأعمدة الرئيسية وعلاقاتها
            </h3>
          </div>

          <div className="space-y-3">
            {data.columns.map((col, idx) => (
              <motion.div
                key={col.columnName}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">
                        {col.columnName}
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {col.description}
                      </p>
                    </div>
                  </div>
                  <ReportBadge
                    text={DATA_TYPE_LABELS[col.dataType as keyof typeof DATA_TYPE_LABELS] || col.dataType}
                    variant={DATA_TYPE_COLORS[col.dataType] || 'neutral'}
                  />
                </div>
                {col.example && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                    <span className="text-xs text-slate-500">مثال:</span>
                    <code className="mr-2 px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-sm font-mono">
                      {col.example}
                    </code>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Classification Rules */}
        {data.classificationRules && data.classificationRules.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Link2 className="h-5 w-5 text-purple-600" />
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                قواعد التصنيف المعتمدة
              </h3>
            </div>

            <ReportTable
              headers={['الفئة', 'الشرط', 'العدد', 'النسبة']}
              rows={data.classificationRules.map((rule) => ({
                cells: [
                  <span key="cat" className="font-semibold">{rule.category}</span>,
                  <span key="cond" className="text-slate-600 dark:text-slate-400">{rule.condition}</span>,
                  rule.count.toLocaleString('ar-IQ'),
                  rule.percentage ? `${rule.percentage.toFixed(1)}%` : '—',
                ],
              }))}
            />
          </div>
        )}

        {/* Detailed Column Statistics */}
        {columns && columns.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Table2 className="h-5 w-5 text-emerald-600" />
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                إحصائيات الأعمدة التفصيلية
              </h3>
            </div>

            <ReportTable
              headers={['العمود', 'النوع', 'القيم الفريدة', 'القيم الفارغة', 'الأكثر شيوعاً']}
              rows={columns.map((col) => ({
                cells: [
                  <span key="name" className="font-semibold">{col.name}</span>,
                  <ReportBadge
                    key="type"
                    text={DATA_TYPE_LABELS[col.dataType] || col.dataType}
                    variant={DATA_TYPE_COLORS[col.dataType] || 'neutral'}
                    size="sm"
                  />,
                  col.uniqueCount.toLocaleString('ar-IQ'),
                  col.nullCount > 0 ? (
                    <span key="null" className={cn(
                      col.nullCount > col.totalCount * 0.1 ? 'text-red-600' : 'text-amber-600'
                    )}>
                      {col.nullCount.toLocaleString('ar-IQ')}
                    </span>
                  ) : (
                    <span key="null" className="text-emerald-600">0</span>
                  ),
                  col.textStats?.topValues?.[0]?.value || 
                    (col.numericStats ? `المتوسط: ${col.numericStats.mean.toFixed(2)}` : '—'),
                ],
                status: col.nullCount > col.totalCount * 0.1 ? 'warning' : undefined,
              }))}
            />
          </div>
        )}
      </div>
    </ReportSection>
  );
}

interface ColumnRelationshipDiagramProps {
  columns: { name: string; type: string; relatedTo?: string[] }[];
}

export function ColumnRelationshipDiagram({ columns }: ColumnRelationshipDiagramProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-6">
      <h4 className="font-bold mb-4">مخطط العلاقات</h4>
      <div className="flex flex-wrap gap-4 justify-center">
        {columns.map((col, idx) => (
          <motion.div
            key={col.name}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="flex flex-col items-center"
          >
            <div className="rounded-lg bg-cyan-100 dark:bg-cyan-900/30 border-2 border-cyan-300 dark:border-cyan-700 px-4 py-2">
              <span className="font-semibold text-cyan-800 dark:text-cyan-200">{col.name}</span>
              <span className="block text-xs text-cyan-600 dark:text-cyan-400">{col.type}</span>
            </div>
            {col.relatedTo && col.relatedTo.length > 0 && (
              <div className="mt-2 text-xs text-slate-500">
                → {col.relatedTo.join('، ')}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
