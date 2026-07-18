import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Columns3, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SERVER_TABLE_PAGE_ALL } from '../../lib/serverTablePagination';

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortable?: boolean;
  getSortValue?: (row: T) => string | number;
  defaultVisible?: boolean;
}

export interface DataTableEnhancedProps<T> {
  rows: T[];
  columns: ColumnDef<T>[];
  getRowKey: (row: T) => string;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  loading?: boolean;
  emptyLabel?: string;
  className?: string;
  /** تحديد صفوف للتصدير — المفاتيح من getRowKey */
  selectionEnabled?: boolean;
  selectedKeys?: ReadonlySet<string>;
  onSelectedKeysChange?: (next: Set<string>) => void;
  /** إظهار خيار «إظهار الكل» في قائمة حجم الصفحة (عرض كل الصفوف المحمّلة محلياً) */
  showAllRowsOption?: boolean;
}

type ClientPageSize = number | typeof SERVER_TABLE_PAGE_ALL;

export function DataTableEnhanced<T>({
  rows,
  columns,
  getRowKey,
  pageSizeOptions = [10, 25, 50],
  defaultPageSize = 10,
  loading,
  emptyLabel = 'لا توجد بيانات',
  className,
  selectionEnabled,
  selectedKeys,
  onSelectedKeysChange,
  showAllRowsOption = true,
}: DataTableEnhancedProps<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<ClientPageSize>(defaultPageSize);
  const [visible, setVisible] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const c of columns) init[c.id] = c.defaultVisible !== false;
    return init;
  });
  const [colMenu, setColMenu] = useState(false);

  const activeCols = useMemo(() => columns.filter((c) => visible[c.id]), [columns, visible]);

  const showAllColumns = () => {
    const next: Record<string, boolean> = {};
    for (const c of columns) next[c.id] = true;
    setVisible(next);
  };

  const hideAllColumns = () => {
    const next: Record<string, boolean> = {};
    for (const c of columns) next[c.id] = false;
    if (columns[0]) next[columns[0].id] = true;
    setVisible(next);
  };

  const sorted = useMemo(() => {
    if (!sortCol) return rows;
    const col = columns.find((c) => c.id === sortCol);
    if (!col?.sortable || !col.getSortValue) return rows;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.getSortValue!(a);
      const vb = col.getSortValue!(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'ar') * dir;
    });
  }, [rows, sortCol, sortDir, columns]);

  const numericPageSize =
    pageSize === SERVER_TABLE_PAGE_ALL ? Math.max(sorted.length, 1) : pageSize;
  const pageCount =
    pageSize === SERVER_TABLE_PAGE_ALL
      ? 1
      : Math.max(1, Math.ceil(sorted.length / pageSize) || 1);
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(() => {
    if (pageSize === SERVER_TABLE_PAGE_ALL) return sorted;
    const start = safePage * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize]);

  const sel = selectedKeys ?? new Set<string>();
  const toggleKey = (key: string) => {
    if (!onSelectedKeysChange) return;
    const next = new Set(sel);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectedKeysChange(next);
  };

  const pageKeys = useMemo(() => pageRows.map((r) => getRowKey(r)), [pageRows, getRowKey]);
  const allSortedKeys = useMemo(() => sorted.map((r) => getRowKey(r)), [sorted, getRowKey]);

  const allPageSelected =
    pageKeys.length > 0 && pageKeys.every((k) => sel.has(k));
  const somePageSelected = pageKeys.some((k) => sel.has(k)) && !allPageSelected;

  const togglePageSelection = () => {
    if (!onSelectedKeysChange) return;
    const next = new Set(sel);
    if (allPageSelected) pageKeys.forEach((k) => next.delete(k));
    else pageKeys.forEach((k) => next.add(k));
    onSelectedKeysChange(next);
  };

  const selectAllResults = () => {
    if (!onSelectedKeysChange) return;
    onSelectedKeysChange(new Set(allSortedKeys));
  };

  const clearSelection = () => {
    if (!onSelectedKeysChange) return;
    onSelectedKeysChange(new Set());
  };

  const selectPageOnly = () => {
    if (!onSelectedKeysChange) return;
    onSelectedKeysChange(new Set(pageKeys));
  };

  const canSelect = !!(selectionEnabled && onSelectedKeysChange);
  const headerSelectRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const el = headerSelectRef.current;
    if (el) el.indeterminate = somePageSelected;
  }, [somePageSelected, allPageSelected, safePage]);

  const toggleSort = (id: string) => {
    const col = columns.find((c) => c.id === id);
    if (!col?.sortable) return;
    if (sortCol === id) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(id);
      setSortDir('asc');
    }
    setPage(0);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-stone-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border border-stone-200 dark:border-stone-700 overflow-x-auto', className)} dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-stone-200 dark:border-stone-700 bg-stone-50/80 dark:bg-stone-800/50 relative z-20 overflow-visible">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setColMenu((o) => !o)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900"
          >
            <Columns3 className="w-4 h-4" />
            الأعمدة
          </button>
          {colMenu ? (
            <>
              <button type="button" className="fixed inset-0 z-40" aria-label="إغلاق" onClick={() => setColMenu(false)} />
              <div
                className={cn(
                  'absolute z-50 mt-1 min-w-[220px] max-w-[min(100vw-2rem,280px)] max-h-[min(70vh,360px)] overflow-y-auto overflow-x-hidden',
                  'rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 shadow-xl p-2 space-y-1',
                  'right-0 left-auto top-full'
                )}
                style={{ direction: 'rtl' }}
              >
                <div className="flex gap-1 pb-2 mb-1 border-b border-stone-100 dark:border-stone-700">
                  <button
                    type="button"
                    onClick={showAllColumns}
                    className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-700"
                  >
                    الكل
                  </button>
                  <button
                    type="button"
                    onClick={hideAllColumns}
                    className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border border-stone-200 dark:border-stone-600 hover:bg-stone-100 dark:hover:bg-stone-800"
                  >
                    لا شيء
                  </button>
                </div>
                {columns.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-right"
                  >
                    <input
                      type="checkbox"
                      className="shrink-0"
                      checked={!!visible[c.id]}
                      onChange={() => setVisible((v) => ({ ...v, [c.id]: !v[c.id] }))}
                    />
                    <span className="min-w-0 break-words flex-1">{c.header}</span>
                  </label>
                ))}
              </div>
            </>
          ) : null}
        </div>
        {canSelect ? (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
            <span className="text-stone-500 px-1">محدد: {sel.size}</span>
            <button
              type="button"
              onClick={selectPageOnly}
              className="px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              تحديد الصفحة
            </button>
            <button
              type="button"
              onClick={selectAllResults}
              className="px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200"
            >
              تحديد الكل ({allSortedKeys.length})
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={sel.size === 0}
              className="px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-600 disabled:opacity-40"
            >
              مسح
            </button>
          </div>
        ) : null}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-stone-500">حجم الصفحة</span>
          <select
            value={pageSize === SERVER_TABLE_PAGE_ALL ? SERVER_TABLE_PAGE_ALL : String(pageSize)}
            onChange={(e) => {
              const v = e.target.value;
              if (v === SERVER_TABLE_PAGE_ALL) {
                setPageSize(SERVER_TABLE_PAGE_ALL);
                setPage(0);
                return;
              }
              const n = Number(v);
              if (!Number.isFinite(n) || n < 1) return;
              setPageSize(n);
              setPage(0);
            }}
            className="rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 px-2 py-1 min-w-[7rem]"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            {showAllRowsOption ? (
              <option value={SERVER_TABLE_PAGE_ALL}>إظهار الكل</option>
            ) : null}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="bg-stone-100 dark:bg-stone-700/50">
              {canSelect ? (
                <th className="w-10 px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-stone-300"
                    checked={allPageSelected}
                    ref={headerSelectRef}
                    onChange={togglePageSelection}
                    aria-label="تحديد الصفحة"
                  />
                </th>
              ) : null}
              {activeCols.map((c) => (
                <th key={c.id} className="px-3 py-2 text-right font-semibold text-stone-700 dark:text-stone-200">
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.id)}
                      className="inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {c.header}
                      {sortCol === c.id ? (
                        sortDir === 'asc' ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      ) : null}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={getRowKey(row)}
                className="border-t border-stone-100 dark:border-stone-700/60 odd:bg-stone-50/40 dark:odd:bg-stone-800/20"
              >
                {canSelect ? (
                  <td className="w-10 px-2 py-2 text-center align-middle">
                    <input
                      type="checkbox"
                      className="rounded border-stone-300"
                      checked={sel.has(getRowKey(row))}
                      onChange={() => toggleKey(getRowKey(row))}
                      aria-label="تحديد الصف"
                    />
                  </td>
                ) : null}
                {activeCols.map((c) => (
                  <td key={c.id} className="px-3 py-2 text-stone-800 dark:text-stone-100">
                    {c.accessor(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 ? (
        <div className="py-12 text-center text-stone-500 text-sm">{emptyLabel}</div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-stone-200 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-400">
          <span>
            {pageSize === SERVER_TABLE_PAGE_ALL
              ? `إظهار الكل — ${sorted.length} من ${sorted.length}`
              : `${safePage * numericPageSize + 1} — ${Math.min((safePage + 1) * numericPageSize, sorted.length)} من ${sorted.length}`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 0 || pageSize === SERVER_TABLE_PAGE_ALL}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1 rounded-lg border border-stone-200 dark:border-stone-600 disabled:opacity-40"
            >
              السابق
            </button>
            <button
              type="button"
              disabled={safePage >= pageCount - 1 || pageSize === SERVER_TABLE_PAGE_ALL}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="px-3 py-1 rounded-lg border border-stone-200 dark:border-stone-600 disabled:opacity-40"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
