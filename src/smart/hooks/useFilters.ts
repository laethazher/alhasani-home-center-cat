import { useCallback, useState } from 'react';

/**
 * غلاف بسيط لحالة فلاتر يمكن ربطها بـ Saved Views (additive).
 */
export function useFiltersState<T extends Record<string, unknown>>(initial: T) {
  const [filters, setFilters] = useState<T>(initial);

  const patch = useCallback((part: Partial<T>) => {
    setFilters((prev) => ({ ...prev, ...part }));
  }, []);

  const replace = useCallback((next: T) => {
    setFilters(next);
  }, []);

  return { filters, setFilters, patch, replace };
}
