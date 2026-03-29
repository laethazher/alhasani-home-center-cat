import { useCallback, useMemo, useState } from 'react';
import type { AdvancedFilterState, AttendanceFilterStatus, StructuredSearchFilters } from '../types';
import { parseSearchQuery, emptyFilters } from '../utils/parseSearchQuery';

export const ADVANCED_FILTER_INITIAL: AdvancedFilterState = {
  name: '',
  plate: '',
  dateFrom: '',
  dateTo: '',
  statuses: [],
  delayMin: '',
  delayMax: '',
  role: 'all',
  nlQuery: '',
};

export type AdvancedFilterKey =
  | 'name'
  | 'plate'
  | 'dates'
  | 'statuses'
  | 'delay'
  | 'role'
  | 'nl';

function mergeNlIntoState(prev: AdvancedFilterState, text: string): AdvancedFilterState {
  const p = parseSearchQuery(text);
  return {
    ...prev,
    nlQuery: text,
    name: p.nameContains ?? prev.name,
    plate: (p.plateContains ?? p.vehicleNumberContains ?? prev.plate).trim()
      ? (p.plateContains ?? p.vehicleNumberContains ?? prev.plate)
      : prev.plate,
    dateFrom: p.dateFrom ?? prev.dateFrom,
    dateTo: p.dateTo ?? prev.dateTo,
    delayMin: p.delayMinMinutes != null ? String(p.delayMinMinutes) : prev.delayMin,
    delayMax: p.delayMaxMinutes != null ? String(p.delayMaxMinutes) : prev.delayMax,
    statuses: p.attendanceStatuses.length ? p.attendanceStatuses : prev.statuses,
  };
}

/** تحويل نموذج اللوحة إلى فلاتر موحّدة للتصفية البرمجية */
export function advancedStateToStructured(state: AdvancedFilterState): StructuredSearchFilters {
  const dm = state.delayMin.trim();
  const dx = state.delayMax.trim();
  return {
    nameContains: state.name.trim() || null,
    plateContains: state.plate.trim() || null,
    vehicleNumberContains: null,
    dateFrom: state.dateFrom.trim() || null,
    dateTo: state.dateTo.trim() || null,
    quickRange: null,
    delayMinMinutes: dm ? parseInt(dm, 10) : null,
    delayMaxMinutes: dx ? parseInt(dx, 10) : null,
    attendanceStatuses: state.statuses,
    freeText: state.nlQuery.trim() || null,
  };
}

export function useAdvancedFilters(seed?: Partial<AdvancedFilterState>) {
  const [state, setState] = useState<AdvancedFilterState>(() => ({
    ...ADVANCED_FILTER_INITIAL,
    ...seed,
  }));

  const setField = useCallback(<K extends keyof AdvancedFilterState>(key: K, value: AdvancedFilterState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetAll = useCallback(() => {
    setState({ ...ADVANCED_FILTER_INITIAL });
  }, []);

  const removeKey = useCallback((key: AdvancedFilterKey) => {
    setState((prev) => {
      switch (key) {
        case 'name':
          return { ...prev, name: '' };
        case 'plate':
          return { ...prev, plate: '' };
        case 'dates':
          return { ...prev, dateFrom: '', dateTo: '' };
        case 'statuses':
          return { ...prev, statuses: [] };
        case 'delay':
          return { ...prev, delayMin: '', delayMax: '' };
        case 'role':
          return { ...prev, role: 'all' };
        case 'nl':
          return { ...prev, nlQuery: '' };
        default:
          return prev;
      }
    });
  }, []);

  /** دمج نتيجة parseSearchQuery في الحقول المناظرة */
  const applyNaturalLanguage = useCallback((text: string) => {
    setState((prev) => mergeNlIntoState(prev, text));
  }, []);

  const structured = useMemo(() => advancedStateToStructured(state), [state]);

  const hasAnyFilter = useMemo(() => {
    const s = structured;
    return !!(
      s.nameContains ||
      s.plateContains ||
      s.dateFrom ||
      s.dateTo ||
      s.delayMinMinutes != null ||
      s.delayMaxMinutes != null ||
      s.attendanceStatuses.length ||
      s.freeText
    );
  }, [structured]);

  return {
    state,
    setState,
    setField,
    resetAll,
    removeKey,
    applyNaturalLanguage,
    structured,
    hasAnyFilter,
  };
}
