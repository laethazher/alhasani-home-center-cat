import { useMemo, useState, useCallback } from 'react';
import { parseQuery } from '../utils/searchParser';
import { parseSearchQuery } from '../utils/parseSearchQuery';
import { useDebouncedValue } from './useDebouncedValue';
import type { ParsedQuery, SortMode, StructuredSearchFilters } from '../types';

export interface UseSmartSearchOptions {
  debounceMs?: number;
}

export function useSmartSearch(initial = '', options: UseSmartSearchOptions = {}) {
  const { debounceMs = 250 } = options;
  const [query, setQuery] = useState(initial);
  const [sortMode, setSortMode] = useState<SortMode>('default');

  const debouncedQuery = useDebouncedValue(query, debounceMs);
  const parsed: ParsedQuery = useMemo(() => parseQuery(debouncedQuery), [debouncedQuery]);
  const structured: StructuredSearchFilters = useMemo(
    () => parseSearchQuery(debouncedQuery),
    [debouncedQuery]
  );

  const reset = useCallback(() => {
    setQuery('');
    setSortMode('default');
  }, []);

  return {
    query,
    setQuery,
    debouncedQuery,
    parsed,
    structured,
    sortMode,
    setSortMode,
    reset,
  };
}
