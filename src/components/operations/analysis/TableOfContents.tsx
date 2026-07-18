import { motion } from 'framer-motion';
import { List, ChevronLeft } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { TOCItem } from '../../../lib/dataAnalysis/types';

interface TableOfContentsProps {
  items: TOCItem[];
  activeSection?: string;
  onSectionClick: (sectionId: string) => void;
  className?: string;
  compact?: boolean;
}

export default function TableOfContents({
  items,
  activeSection,
  onSectionClick,
  className,
  compact = false,
}: TableOfContentsProps) {
  const renderItem = (item: TOCItem, index: number) => {
    const isActive = activeSection === item.id;
    const levelPadding = {
      1: 'pr-0',
      2: 'pr-4',
      3: 'pr-8',
    };

    return (
      <motion.li
        key={item.id}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
      >
        <button
          onClick={() => onSectionClick(item.id)}
          className={cn(
            'w-full flex items-center justify-between gap-2 rounded-lg transition-all text-right',
            compact ? 'py-2 px-3' : 'py-3 px-4',
            levelPadding[item.level],
            isActive
              ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 font-bold'
              : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
          )}
        >
          <div className="flex items-center gap-2">
            {item.level === 1 && (
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold',
                  isActive
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                )}
              >
                {index + 1}
              </span>
            )}
            <span className={cn(item.level === 1 ? 'font-semibold' : 'text-sm')}>
              {item.title}
            </span>
          </div>
          <ChevronLeft
            className={cn(
              'h-4 w-4 transition-transform',
              isActive ? 'text-cyan-600 rotate-90' : 'text-slate-400'
            )}
          />
        </button>

        {item.children && item.children.length > 0 && (
          <ul className="mr-4 mt-1 space-y-1">
            {item.children.map((child, childIdx) => renderItem(child, childIdx))}
          </ul>
        )}
      </motion.li>
    );
  };

  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden',
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
        <List className="h-5 w-5 text-cyan-600" />
        <h3 className="font-bold text-slate-900 dark:text-white">فهرس المحتويات</h3>
      </div>

      <nav className="p-3">
        <ul className="space-y-1">{items.map((item, idx) => renderItem(item, idx))}</ul>
      </nav>
    </div>
  );
}

interface StickyTOCProps {
  items: TOCItem[];
  activeSection?: string;
  onSectionClick: (sectionId: string) => void;
  reportTitle: string;
  className?: string;
}

export function StickyTOC({
  items,
  activeSection,
  onSectionClick,
  reportTitle,
  className,
}: StickyTOCProps) {
  return (
    <div className={cn('sticky top-4 space-y-4', className)}>
      <div className="rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 p-4 text-white">
        <h2 className="font-bold text-lg mb-1">{reportTitle}</h2>
        <p className="text-sm text-cyan-100 opacity-90">
          {items.length} قسم
        </p>
      </div>

      <TableOfContents
        items={items}
        activeSection={activeSection}
        onSectionClick={onSectionClick}
        compact
      />
    </div>
  );
}

interface MiniTOCProps {
  items: { id: string; title: string }[];
  activeSection?: string;
  onSectionClick: (sectionId: string) => void;
}

export function MiniTOC({ items, activeSection, onSectionClick }: MiniTOCProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSectionClick(item.id)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
            activeSection === item.id
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          )}
        >
          {item.title}
        </button>
      ))}
    </div>
  );
}
