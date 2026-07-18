import { forwardRef, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';

interface ReportSectionProps {
  id: string;
  sectionNumber?: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  noPadding?: boolean;
}

const ReportSection = forwardRef<HTMLElement, ReportSectionProps>(
  (
    {
      id,
      sectionNumber,
      title,
      subtitle,
      children,
      className,
      headerClassName,
      icon,
      actions,
      noPadding = false,
    },
    ref
  ) => {
    return (
      <motion.section
        ref={ref}
        id={id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={cn(
          'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden print:border print:rounded-none print:shadow-none',
          className
        )}
      >
        <div
          className={cn(
            'flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-700 p-5 bg-slate-50 dark:bg-slate-800/50',
            headerClassName
          )}
        >
          <div className="flex items-start gap-3">
            {sectionNumber !== undefined && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-600 text-white text-sm font-bold">
                {sectionNumber}
              </span>
            )}
            {icon && !sectionNumber && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600">
                {icon}
              </span>
            )}
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {title}
              </h2>
              {subtitle && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>

        <div className={cn(!noPadding && 'p-5')}>{children}</div>
      </motion.section>
    );
  }
);

ReportSection.displayName = 'ReportSection';

export default ReportSection;

interface ReportTableProps {
  headers: string[];
  rows: {
    cells: (string | number | ReactNode)[];
    status?: 'success' | 'warning' | 'danger' | 'info';
  }[];
  className?: string;
  striped?: boolean;
  compact?: boolean;
}

export function ReportTable({
  headers,
  rows,
  className,
  striped = true,
  compact = false,
}: ReportTableProps) {
  const statusColors = {
    success: 'bg-emerald-50 dark:bg-emerald-900/20',
    warning: 'bg-amber-50 dark:bg-amber-900/20',
    danger: 'bg-red-50 dark:bg-red-900/20',
    info: 'bg-blue-50 dark:bg-blue-900/20',
  };

  return (
    <div className={cn('overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700', className)}>
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-700/50">
            {headers.map((header, idx) => (
              <th
                key={idx}
                className={cn(
                  'text-right text-sm font-semibold text-slate-700 dark:text-slate-300',
                  compact ? 'px-3 py-2' : 'px-4 py-3'
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={cn(
                'border-t border-slate-100 dark:border-slate-700',
                row.status && statusColors[row.status],
                striped && rowIdx % 2 === 0 && !row.status && 'bg-slate-50/50 dark:bg-slate-800/50'
              )}
            >
              {row.cells.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  className={cn(
                    'text-sm text-slate-700 dark:text-slate-300',
                    compact ? 'px-3 py-2' : 'px-4 py-3'
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ReportCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  color?: 'cyan' | 'emerald' | 'purple' | 'amber' | 'red' | 'blue';
  className?: string;
}

export function ReportCard({
  title,
  value,
  subtitle,
  icon,
  color = 'cyan',
  className,
}: ReportCardProps) {
  const colors = {
    cyan: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  };

  return (
    <div className={cn('rounded-xl border p-4', colors[color], className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/50 dark:bg-black/20">
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}

interface ReportBadgeProps {
  text: string;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

export function ReportBadge({ text, variant, size = 'md' }: ReportBadgeProps) {
  const variants = {
    success: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    danger: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    neutral: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  };

  return (
    <span className={cn('inline-flex items-center rounded-full font-medium', variants[variant], sizes[size])}>
      {text}
    </span>
  );
}
