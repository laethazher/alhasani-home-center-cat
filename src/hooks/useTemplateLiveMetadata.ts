import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DepartmentCode } from '../data/department';
import { getDepartmentClient, getDepartmentTables } from '../data/supabaseSource';
import { inventoryTemplatesBus } from '../lib/inventoryTemplatesBus';
import { useFleetInventoryRealtimeSync } from './useFleetInventoryRealtimeSync';

export interface TemplateLiveMetadata {
  templateId: number;
  itemName: string;
  barcode: string | null;
  isActive: boolean;
}

export interface UseTemplateLiveMetadataResult {
  byId: Map<number, TemplateLiveMetadata>;
  byName: Map<string, TemplateLiveMetadata>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** يُرجع الاسم الحي لعنصر ما من snapshot + template. */
  resolveLiveLabel: (
    snapshot: { templateId?: number | null; itemNameSnapshot?: string | null },
  ) => { itemName: string | null; barcode: string | null; changed: boolean };
}

/**
 * Hook خفيف يجلب خريطة الأسماء/الباركود الحيّة لقوالب الجرد،
 * ويُستخدم في عروض الأرشيف لإظهار الاسم وقت التقرير (snapshot) مع
 * الاسم الحالي (live) عند الاختلاف.
 *
 * يُجلب مرة واحدة عند mount أو عند تغيّر department/enabled، ويمكن
 * استدعاء refetch يدوياً بعد أي تحديث على القوالب. يُحدَّث الاسم الحيّ
 * أيضاً عبر Realtime على جدول القوالب (إن كان مفعّلاً في المشروع) بالإضافة
 * إلى `inventoryTemplatesBus` داخل الواجهة.
 */
export function useTemplateLiveMetadata(
  department: DepartmentCode,
  enabled: boolean = true,
): UseTemplateLiveMetadataResult {
  const [byId, setById] = useState<Map<number, TemplateLiveMetadata>>(() => new Map());
  const [byName, setByName] = useState<Map<string, TemplateLiveMetadata>>(() => new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const client = getDepartmentClient(department);
      const table = getDepartmentTables(department).inventoryTemplates;
      const { data, error: fetchError } = await client
        .from(table)
        .select('id,item_name,barcode,is_active,category,department_code')
        .eq('department_code', department)
        .eq('category', 'tools');
      if (fetchError) throw fetchError;
      const nextById = new Map<number, TemplateLiveMetadata>();
      const nextByName = new Map<string, TemplateLiveMetadata>();
      for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        const id = Number(row.id);
        if (!Number.isFinite(id)) continue;
        const name = String(row.item_name ?? '').trim();
        const barcode =
          row.barcode != null && String(row.barcode).trim() ? String(row.barcode).trim() : null;
        const entry: TemplateLiveMetadata = {
          templateId: id,
          itemName: name,
          barcode,
          isActive: row.is_active !== false,
        };
        nextById.set(id, entry);
        if (name) nextByName.set(name, entry);
      }
      if (!mountedRef.current) return;
      setById(nextById);
      setByName(nextByName);
    } catch (e) {
      if (!mountedRef.current) return;
      console.error('useTemplateLiveMetadata load failed', e);
      setError(e instanceof Error ? e.message : 'تعذّر تحميل قوالب الجرد الحية.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled, department]);

  useEffect(() => {
    void load();
  }, [load]);

  // إعادة جلب الخريطة عند تغيير القوالب من أي مكان.
  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = inventoryTemplatesBus.subscribe(department, () => {
      void load();
    });
    return () => {
      unsubscribe();
    };
  }, [enabled, department, load]);

  const loadRef = useRef(load);
  useLayoutEffect(() => {
    loadRef.current = load;
  }, [load]);

  const templatesTablesOnly = useMemo(
    () => [getDepartmentTables(department).inventoryTemplates],
    [department],
  );

  useFleetInventoryRealtimeSync(department, {
    enabled,
    channelSuffix: 'template-live-metadata',
    onSync: () => void loadRef.current(),
    tablesOnly: templatesTablesOnly,
  });

  const resolveLiveLabel: UseTemplateLiveMetadataResult['resolveLiveLabel'] = useCallback(
    (snapshot) => {
      const snapshotName = String(snapshot.itemNameSnapshot ?? '').trim();
      let entry: TemplateLiveMetadata | undefined;
      if (snapshot.templateId != null && Number.isFinite(Number(snapshot.templateId))) {
        entry = byId.get(Number(snapshot.templateId));
      }
      if (!entry && snapshotName) entry = byName.get(snapshotName);
      if (!entry) {
        return { itemName: null, barcode: null, changed: false };
      }
      const changed = !!snapshotName && snapshotName !== entry.itemName;
      return { itemName: entry.itemName, barcode: entry.barcode, changed };
    },
    [byId, byName],
  );

  return useMemo(
    () => ({ byId, byName, loading, error, refetch: load, resolveLiveLabel }),
    [byId, byName, loading, error, load, resolveLiveLabel],
  );
}
