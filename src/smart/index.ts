export { SmartPageProvider, useSmartPageKey } from './context/SmartPageContext';
export type {
  PageKey,
  ParsedQuery,
  SavedViewRecord,
  SortMode,
  StructuredSearchFilters,
  AdvancedFilterState,
  AttendanceFilterStatus,
} from './types';
export { parseQuery, getDateRangeForWindow, localDateKey, textMatchesExpandedQuery } from './utils/searchParser';
export {
  parseSearchQuery,
  emptyFilters,
  mergeStructuredFilters,
} from './utils/parseSearchQuery';
export type { QuickCalendarRange } from './utils/dateUtils';
export {
  getThisWeekRangeLocal,
  getThisMonthRangeLocal,
  getTodayRangeLocal,
  quickRangeToDates,
} from './utils/dateUtils';
export { applyStructuredFilters, type RowFieldAdapters } from './utils/filterData';
export { rowMatchesHubQuery, normalizeForHubSearch } from './utils/hubSearchMatch';
export {
  getCatalogForReportsHubDomain,
  type ReportsHubDomain,
  type CatalogItem,
} from './utils/suggestionCatalog';
export { rankItems } from './utils/rankingEngine';
export { useDebouncedValue } from './hooks/useDebouncedValue';
export { useSmartSearch, type UseSmartSearchOptions } from './hooks/useSmartSearch';
export {
  useAdvancedFilters,
  advancedStateToStructured,
  ADVANCED_FILTER_INITIAL,
  type AdvancedFilterKey,
} from './hooks/useAdvancedFilters';
export { useFiltersState } from './hooks/useFilters';
export { useAISuggestions, pushRecentQuery } from './hooks/useAISuggestions';
export {
  insightsFromExitRows,
  insightsFromAttendanceRows,
  insightsFromVehicles,
  insightsFromMaintenanceRequests,
  type InsightMetric,
  type InsightsBundle,
} from './hooks/useInsights';
export { useSavedViews } from './hooks/useSavedViews';
export { useAutoRefresh } from './hooks/useAutoRefresh';
export { HighlightText } from './components/HighlightText';
export { SmartSearchBar, type ParsedFilterApply } from './components/SmartSearchBar';
export { SuggestionsDropdown } from './components/SuggestionsDropdown';
export { InsightsPanel } from './components/InsightsPanel';
export { ChartsPanel } from './components/ChartsPanel';
export { ExportMenu } from './components/ExportMenu';
export { SavedViews } from './components/SavedViews';
export { AdvancedFilterPanel, type AdvancedFilterPanelProps } from './components/AdvancedFilterPanel';
export { FilterTags, advancedFilterTags, type FilterTagsProps, type FilterTagItem } from './components/FilterTags';
export { DataTableEnhanced, type ColumnDef, type DataTableEnhancedProps } from './components/DataTableEnhanced';
export { exportFilteredCsv, exportFilteredExcel, exportFilteredPdf, type ExportMetadata } from './utils/exportUtils';
