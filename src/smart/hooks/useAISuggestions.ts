import { useMemo } from 'react';
import type { PageKey } from '../types';
import type { CatalogItem } from '../utils/suggestionCatalog';
import { getCatalogForPage } from '../utils/suggestionCatalog';

const STORAGE_PREFIX = 'smartRecentQueries:v1:';

function readRecent(pageKey: PageKey): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + pageKey);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string').slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function pushRecentQuery(pageKey: PageKey, q: string) {
  const t = q.trim();
  if (t.length < 2) return;
  try {
    const prev = readRecent(pageKey).filter((x) => x !== t);
    const next = [t, ...prev].slice(0, 12);
    localStorage.setItem(STORAGE_PREFIX + pageKey, JSON.stringify(next));
  } catch {
    /* noop */
  }
}

export function useAISuggestions(
  pageKey: PageKey,
  inputValue: string,
  dataDerived: string[] | undefined,
  /** عند التمرير يُستخدم بدل كتالوج pageKey (مثلاً تبويبات مركز التقارير) */
  catalogOverride?: CatalogItem[]
): { label: string; value: string; source: 'catalog' | 'recent' | 'data' }[] {
  return useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    const rawCatalog = catalogOverride ?? getCatalogForPage(pageKey);
    const catalog = rawCatalog.map((c) => ({
      label: c.label,
      value: c.insertText,
      source: 'catalog' as const,
    }));

    const recent = readRecent(pageKey).map((r) => ({
      label: r,
      value: r,
      source: 'recent' as const,
    }));

    const data = (dataDerived ?? []).map((r) => ({
      label: r,
      value: r,
      source: 'data' as const,
    }));

    const merged: { label: string; value: string; source: 'catalog' | 'recent' | 'data' }[] = [];
    const seen = new Set<string>();

    const pushUnique = (item: { label: string; value: string; source: 'catalog' | 'recent' | 'data' }) => {
      const k = item.value.toLowerCase();
      if (!k || seen.has(k)) return;
      if (q && !item.label.toLowerCase().includes(q) && !item.value.toLowerCase().includes(q)) return;
      seen.add(k);
      merged.push(item);
    };

    for (const c of catalog) pushUnique(c);
    for (const r of recent) pushUnique(r);
    for (const d of data) pushUnique(d);

    if (!q) return merged.slice(0, 20);
    return merged.filter(
      (m) => m.label.toLowerCase().includes(q) || m.value.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [pageKey, inputValue, dataDerived, catalogOverride]);
}
