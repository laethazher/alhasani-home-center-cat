import { useEffect, useLayoutEffect, useRef } from 'react';
import type { DepartmentCode } from '../data/department';
import { getDepartmentClient, getDepartmentTables } from '../data/supabaseSource';

export interface FleetInventoryRealtimeSyncOptions {
  /** عند تعطيله لا تُنشأ قناة (مثل صفحة بدون مركبة). */
  enabled: boolean;
  /** تمييز اسم القناة عند اشتراكات متعددة في نفس المشروع. */
  channelSuffix: string;
  /** إعادة جلب البيانات (تقرير تجمعي، آخر جرد…). */
  onSync: () => void;
  /** دمج bursts من Realtime لتقليل الضغط على الشبكة. */
  debounceMs?: number;
  /**
   * جداول محدّدة فقط؛ مفيد لتحديث خرائط الاسم الحي دون إعادة جلب عند كل تقرير.
   * إن لم تُمرَّر يُستمع لتقارير الجرد + المركبات + الكادر + القوالب + النواقص.
   */
  tablesOnly?: readonly string[];
}

/** قائمة افتراضية للجداول التي تؤثّر على أرقام الجرد ومؤشر آخر تقرير. */
function defaultInventoryTables(depTables: ReturnType<typeof getDepartmentTables>): string[] {
  return [
    depTables.reports,
    depTables.vehicles,
    depTables.staffMembers,
    depTables.inventoryTemplates,
    'inspection_recovery',
    'inspection_recovery_actions',
  ];
}

/**
 * يزامن واجهات الجرد الذكية مع قاعدة البيانات عبر Supabase Realtime:
 * تقارير الجرد، النواقص، حركات التعويض، المركبات، الكادر، وقوالب العناصر.
 * يُكمِّل `inventoryTemplatesBus` الذي يغطّي تحديثات القوالب داخل التطبيق فقط.
 */
export function useFleetInventoryRealtimeSync(
  department: DepartmentCode,
  {
    enabled,
    channelSuffix,
    onSync,
    debounceMs = 380,
    tablesOnly,
  }: FleetInventoryRealtimeSyncOptions,
): void {
  const onSyncRef = useRef(onSync);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tablesKey = tablesOnly?.join('\0') ?? '';

  useLayoutEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  useEffect(() => {
    if (!enabled) return;

    const client = getDepartmentClient(department);
    const deptTables = getDepartmentTables(department);

    const scheduleSync = () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        try {
          void onSyncRef.current();
        } catch {
          /* onSync عادةً async؛ الأخطاء تُدار في الدالة المرسلة */
        }
      }, debounceMs);
    };

    const list =
      tablesOnly && tablesOnly.length > 0
        ? [...tablesOnly]
        : defaultInventoryTables(deptTables);
    const uniqueTables = Array.from(new Set(list.filter((t): t is string => Boolean(t))));

    let ch = client.channel(`fleet-inv-rt:${department}:${channelSuffix}`);
    for (const table of uniqueTables) {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleSync);
    }
    ch.subscribe();

    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
      debounceRef.current = null;
      client.removeChannel(ch);
    };
  }, [enabled, department, channelSuffix, debounceMs, tablesKey]);
}
