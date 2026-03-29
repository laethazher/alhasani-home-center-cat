import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, BarChart3 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { InsightMetric } from '../hooks/useInsights';

interface InsightsPanelProps {
  metrics: InsightMetric[];
  alerts?: string[];
  className?: string;
}

export function InsightsPanel({ metrics, alerts = [], className }: InsightsPanelProps) {
  if (metrics.length === 0 && alerts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50/80 dark:bg-stone-900/60 p-4 space-y-3',
        className
      )}
    >
      <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
        <BarChart3 className="w-4 h-4" />
        <span className="text-xs font-bold tracking-wide">رؤى سريعة</span>
      </div>
      {metrics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-xl px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200/80 dark:border-stone-600 min-w-[100px]"
            >
              <p className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">{m.label}</p>
              <p className="text-lg font-bold text-stone-900 dark:text-white tabular-nums">{m.value}</p>
            </div>
          ))}
        </div>
      )}
      {alerts.map((a, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/90 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-100"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{a}</span>
        </div>
      ))}
    </motion.div>
  );
}
