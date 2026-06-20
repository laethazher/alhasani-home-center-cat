import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { ComparisonData } from '../../../pages/operations/reports/types';

interface ComparisonCardProps {
  data: ComparisonData;
  index?: number;
}

const STATUS_CONFIG = {
  good: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
    barColor: 'bg-emerald-500',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    icon: AlertTriangle,
    barColor: 'bg-amber-500',
  },
  bad: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    icon: XCircle,
    barColor: 'bg-red-500',
  },
};

export default function ComparisonCard({ data, index = 0 }: ComparisonCardProps) {
  const config = STATUS_CONFIG[data.status];
  const StatusIcon = config.icon;

  const getDifferenceDisplay = () => {
    if (data.difference === 0) return { icon: Minus, text: 'مطابق', color: 'text-slate-500' };
    if (data.difference > 0) {
      return {
        icon: TrendingUp,
        text: `+${data.difference} دقيقة`,
        color: data.label.includes('خروج') ? 'text-emerald-600' : 'text-red-600',
      };
    }
    return {
      icon: TrendingDown,
      text: `${data.difference} دقيقة`,
      color: data.label.includes('دخول') ? 'text-emerald-600' : 'text-red-600',
    };
  };

  const diff = getDifferenceDisplay();
  const DiffIcon = diff.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        'rounded-2xl border p-5 transition-all hover:shadow-md',
        config.bg,
        config.border
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <StatusIcon className={cn('h-5 w-5', config.text)} />
            <h4 className="font-bold text-slate-900 dark:text-white truncate">{data.label}</h4>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">المتوقع</p>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="text-lg font-bold text-slate-700 dark:text-slate-200">
                  {data.expected}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">الفعلي</p>
              <div className="flex items-center gap-1.5">
                <Clock className={cn('h-4 w-4', config.text)} />
                <span className={cn('text-lg font-bold', config.text)}>{data.actual}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <DiffIcon className={cn('h-4 w-4', diff.color)} />
            <span className={cn('font-medium', diff.color)}>{diff.text}</span>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-xl font-black text-lg',
              config.bg,
              config.text
            )}
          >
            {data.percentage}%
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${data.percentage}%` }}
            transition={{ duration: 0.8, delay: index * 0.1 + 0.3 }}
            className={cn('h-full rounded-full', config.barColor)}
          />
        </div>
      </div>
    </motion.div>
  );
}

interface ComparisonGridProps {
  comparisons: ComparisonData[];
}

export function ComparisonGrid({ comparisons }: ComparisonGridProps) {
  if (comparisons.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        لا توجد بيانات للمقارنة
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {comparisons.map((comp, idx) => (
        <ComparisonCard key={`${comp.label}-${idx}`} data={comp} index={idx} />
      ))}
    </div>
  );
}
