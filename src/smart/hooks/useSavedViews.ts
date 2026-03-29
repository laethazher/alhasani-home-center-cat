import { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import type { PageKey, SavedViewRecord } from '../types';

const ViewsSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    pageKey: z.string(),
    createdAt: z.string(),
    payload: z.record(z.string(), z.unknown()),
  })
);

function storageKey(pageKey: PageKey) {
  return `smartSavedViews:v1:${pageKey}`;
}

function loadAll(pageKey: PageKey): SavedViewRecord[] {
  try {
    const raw = localStorage.getItem(storageKey(pageKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    const res = ViewsSchema.safeParse(parsed);
    if (!res.success) return [];
    return res.data
      .filter((r) => r.pageKey === pageKey)
      .map((r) => ({
        id: r.id,
        name: r.name,
        pageKey: r.pageKey as PageKey,
        createdAt: r.createdAt,
        payload: r.payload as Record<string, unknown>,
      }));
  } catch {
    return [];
  }
}

function saveAll(pageKey: PageKey, list: SavedViewRecord[]) {
  try {
    localStorage.setItem(storageKey(pageKey), JSON.stringify(list));
  } catch {
    /* noop */
  }
}

export function useSavedViews<T extends Record<string, unknown>>(pageKey: PageKey) {
  const [version, setVersion] = useState(0);
  const views = useMemo(() => loadAll(pageKey), [pageKey, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const saveView = useCallback(
    (name: string, payload: T) => {
      const list = loadAll(pageKey);
      const rec: SavedViewRecord<T> = {
        id: crypto.randomUUID(),
        name: name.trim() || 'عرض بدون اسم',
        pageKey,
        createdAt: new Date().toISOString(),
        payload,
      };
      list.unshift(rec as SavedViewRecord);
      saveAll(pageKey, list.slice(0, 30));
      refresh();
    },
    [pageKey, refresh]
  );

  const deleteView = useCallback(
    (id: string) => {
      const list = loadAll(pageKey).filter((v) => v.id !== id);
      saveAll(pageKey, list);
      refresh();
    },
    [pageKey, refresh]
  );

  return { views, saveView, deleteView, refresh };
}
