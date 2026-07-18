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

/** مفتاح التخزين؛ `storageScope` يفصل التقارير الذكية بين التجهيز والتركيب. */
function resolveStorageKey(pageKey: PageKey, storageScope?: string) {
  if (storageScope === undefined || storageScope === '') {
    return `smartSavedViews:v1:${pageKey}`;
  }
  return `smartSavedViews:v1:${pageKey}:${storageScope}`;
}

function loadAll(pageKey: PageKey, storageScope?: string): SavedViewRecord[] {
  try {
    let key = resolveStorageKey(pageKey, storageScope);
    let raw = localStorage.getItem(key);
    // ترحيل لمرة واحدة: مفتاح قديم بدون قسم → نفس مفتاح التجهيز الافتراضي
    if (
      !raw &&
      pageKey === 'reports-hub' &&
      storageScope === 'tajhiz'
    ) {
      const legacyKey = `smartSavedViews:v1:${pageKey}`;
      const legacyRaw = localStorage.getItem(legacyKey);
      if (legacyRaw) {
        try {
          localStorage.setItem(key, legacyRaw);
          localStorage.removeItem(legacyKey);
          raw = legacyRaw;
        } catch {
          raw = legacyRaw;
        }
      }
    }
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

function saveAll(pageKey: PageKey, list: SavedViewRecord[], storageScope?: string) {
  try {
    localStorage.setItem(resolveStorageKey(pageKey, storageScope), JSON.stringify(list));
  } catch {
    /* noop */
  }
}

export function useSavedViews<T extends Record<string, unknown>>(
  pageKey: PageKey,
  storageScope?: string
) {
  const [version, setVersion] = useState(0);
  const views = useMemo(() => loadAll(pageKey, storageScope), [pageKey, storageScope, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const saveView = useCallback(
    (name: string, payload: T) => {
      const list = loadAll(pageKey, storageScope);
      const rec: SavedViewRecord<T> = {
        id: crypto.randomUUID(),
        name: name.trim() || 'عرض بدون اسم',
        pageKey,
        createdAt: new Date().toISOString(),
        payload,
      };
      list.unshift(rec as SavedViewRecord);
      saveAll(pageKey, list.slice(0, 30), storageScope);
      refresh();
    },
    [pageKey, storageScope, refresh]
  );

  const deleteView = useCallback(
    (id: string) => {
      const list = loadAll(pageKey, storageScope).filter((v) => v.id !== id);
      saveAll(pageKey, list, storageScope);
      refresh();
    },
    [pageKey, storageScope, refresh]
  );

  return { views, saveView, deleteView, refresh };
}
