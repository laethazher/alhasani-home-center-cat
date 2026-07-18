import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AdvancedFilterKey } from '../hooks/useAdvancedFilters';

export interface FilterTagItem {
  key: AdvancedFilterKey;
  label: string;
}

export interface FilterTagsProps {
  tags: FilterTagItem[];
  onRemove: (key: AdvancedFilterKey) => void;
  onClearAll: () => void;
  className?: string;
}

export function FilterTags({ tags, onRemove, onClearAll, className }: FilterTagsProps) {
  if (tags.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} dir="rtl">
      {tags.map((t) => (
        <span
          key={t.key}
          className={cn(
            'inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg text-xs font-medium',
            'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200',
            'border border-stone-200 dark:border-stone-600'
          )}
        >
          <button
            type="button"
            onClick={() => onRemove(t.key)}
            className="p-0.5 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500"
            aria-label={`إزالة ${t.label}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
          {t.label}
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline px-1"
      >
        مسح الكل
      </button>
    </div>
  );
}

/** بناء قائمة وسوم من حالة useAdvancedFilters للعرض */
export function advancedFilterTags(state: import('../types').AdvancedFilterState): FilterTagItem[] {
  const tags: FilterTagItem[] = [];
  if (state.name.trim()) tags.push({ key: 'name', label: `الاسم: ${state.name.trim()}` });
  if (state.plate.trim()) tags.push({ key: 'plate', label: `لوحة: ${state.plate.trim()}` });
  if (state.dateFrom || state.dateTo) {
    const d = [state.dateFrom, state.dateTo].filter(Boolean).join(' — ');
    tags.push({ key: 'dates', label: `التواريخ: ${d}` });
  }
  if (state.statuses.length) {
    const map: Record<string, string> = {
      present: 'حاضر',
      late: 'متأخر',
      absent: 'غائب',
      full_leave: 'إجازة كاملة',
      time_leave: 'إجازة زمنية',
      break: 'استراحه',
    };
    tags.push({
      key: 'statuses',
      label: `الحالة: ${state.statuses.map((s) => map[s] ?? s).join('، ')}`,
    });
  }
  if (state.delayMin.trim() || state.delayMax.trim()) {
    tags.push({
      key: 'delay',
      label: `تأخير: ${state.delayMin || '…'}–${state.delayMax || '…'} د`,
    });
  }
  if (state.role !== 'all') {
    tags.push({
      key: 'role',
      label: state.role === 'driver' ? 'دور: سائق' : 'دور: مساعد',
    });
  }
  if (state.nlQuery.trim()) {
    const t = state.nlQuery.trim();
    tags.push({
      key: 'nl',
      label: t.length > 42 ? `بحث: ${t.slice(0, 40)}…` : `بحث: ${t}`,
    });
  }
  return tags;
}
