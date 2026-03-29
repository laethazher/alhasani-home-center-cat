import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface SuggestionItem {
  label: string;
  value: string;
  source: 'catalog' | 'recent' | 'data';
}

interface SuggestionsDropdownProps {
  open: boolean;
  items: SuggestionItem[];
  onSelect: (value: string) => void;
  highlightedIndex: number;
  className?: string;
}

export function SuggestionsDropdown({
  open,
  items,
  onSelect,
  highlightedIndex,
  className,
}: SuggestionsDropdownProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${highlightedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, open]);

  return (
    <AnimatePresence>
      {open && items.length > 0 && (
        <motion.div
          ref={listRef}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className={cn(
            'absolute z-[60] mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-stone-200 dark:border-stone-600',
            'bg-white dark:bg-stone-900 shadow-xl text-right',
            className
          )}
        >
          {items.map((item, idx) => (
            <button
              key={`${item.source}-${item.value}-${idx}`}
              type="button"
              data-idx={idx}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(item.value)}
              className={cn(
                'w-full px-3 py-2.5 text-sm flex flex-col items-start gap-0.5 transition-colors',
                idx === highlightedIndex
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-100'
                  : 'hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200'
              )}
            >
              <span className="font-medium">{item.label}</span>
              <span className="text-[10px] text-stone-400">
                {item.source === 'catalog' && 'اقتراح'}
                {item.source === 'recent' && 'بحث سابق'}
                {item.source === 'data' && 'من البيانات'}
              </span>
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
