import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Search, X, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { PageKey } from '../types';
import { parseQuery, getDateRangeForWindow } from '../utils/searchParser';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { CatalogItem } from '../utils/suggestionCatalog';
import { useAISuggestions, pushRecentQuery } from '../hooks/useAISuggestions';
import { SuggestionsDropdown } from './SuggestionsDropdown';

export interface ParsedFilterApply {
  searchText: string;
  dateRange: { from: string; to: string } | null;
}

interface SmartSearchBarProps {
  pageKey: PageKey;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** أسماء من الصف الحالي للاقتراح */
  dataSuggestions?: string[];
  /** عند النقر على شريحة «فلترة ذكية» */
  onApplyParsedFilters?: (apply: ParsedFilterApply) => void;
  showPredictiveChips?: boolean;
  /** تأخير اقتراحات القائمة والتحليل الثقيل (0 = فوري) */
  debounceMs?: number;
  /** كتالوج اقتراحات مخصص (يُدمج مع السجل والبيانات) */
  suggestionCatalogOverride?: CatalogItem[];
}

export function SmartSearchBar({
  pageKey,
  value,
  onChange,
  placeholder = 'بحث…',
  className,
  inputClassName,
  dataSuggestions,
  onApplyParsedFilters,
  showPredictiveChips = true,
  debounceMs = 250,
  suggestionCatalogOverride,
}: SmartSearchBarProps) {
  const [focused, setFocused] = useState(false);
  const [hl, setHl] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const valueForSuggestions = useDebouncedValue(value, debounceMs);
  const suggestions = useAISuggestions(pageKey, valueForSuggestions, dataSuggestions, suggestionCatalogOverride);
  const open = focused && (suggestions.length > 0 || value.trim().length >= 1);

  const parsed = useMemo(() => parseQuery(valueForSuggestions), [valueForSuggestions]);

  const predictiveLabel = useMemo(() => {
    if (!showPredictiveChips || !onApplyParsedFilters) return null;
    const parts: string[] = [];
    if (parsed.personFragments.length) parts.push(parsed.personFragments.join(' '));
    if (parsed.timeWindow) {
      const map: Record<string, string> = {
        today: 'اليوم',
        yesterday: 'أمس',
        this_week: 'هذا الأسبوع',
        last_week: 'الأسبوع الماضي',
      };
      parts.push(map[parsed.timeWindow] ?? parsed.timeWindow);
    }
    if (parts.length === 0) return null;
    return `فلترة: ${parts.join(' + ')}`;
  }, [parsed, onApplyParsedFilters, showPredictiveChips]);

  const applyPredictive = useCallback(() => {
    if (!onApplyParsedFilters) return;
    const searchText = parsed.personFragments.join(' ').trim() || value.trim();
    const dateRange = parsed.timeWindow ? getDateRangeForWindow(parsed.timeWindow) : null;
    onApplyParsedFilters({ searchText, dateRange });
    pushRecentQuery(pageKey, value);
  }, [onApplyParsedFilters, parsed, value, pageKey]);

  const pickSuggestion = useCallback(
    (v: string) => {
      onChange(v);
      pushRecentQuery(pageKey, v);
      setFocused(false);
    },
    [onChange, pageKey]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHl((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHl((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && suggestions[hl]) {
      e.preventDefault();
      pickSuggestion(suggestions[hl].value);
    } else if (e.key === 'Escape') {
      setFocused(false);
    }
  };

  return (
    <div ref={wrapRef} className={cn('relative flex flex-col gap-2', className)}>
      <div className="relative flex-1">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setHl(0);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setFocused(false), 120);
          }}
          placeholder={placeholder}
          className={cn(
            'w-full pr-10 pl-10 py-3 rounded-xl border border-stone-300 dark:border-stone-600',
            'bg-white dark:bg-stone-800 text-sm text-stone-900 dark:text-white',
            'focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all',
            'placeholder:text-stone-400',
            inputClassName
          )}
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-400"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
        <SuggestionsDropdown
          open={open && suggestions.length > 0}
          items={suggestions}
          onSelect={pickSuggestion}
          highlightedIndex={hl}
        />
      </div>

      {predictiveLabel && (
        <button
          type="button"
          onClick={applyPredictive}
          className={cn(
            'inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-lg text-xs font-semibold',
            'bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-200',
            'border border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors'
          )}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          {predictiveLabel}
        </button>
      )}
    </div>
  );
}
