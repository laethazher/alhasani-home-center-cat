import { cn } from '../../lib/utils';
import type { TripleHolderLabels } from '../../data/repositories/inventoryAnalyticsRepository';

interface TripleIntelDriverCellProps {
  /** اسم السائق المعيّن على المركبة (أو الفني بالتركيب). */
  driverName: string | null;
  staffLabel: string;
  /** undefined = هذا العنصر ليس بتنسيق 1+2 — نعرض السطر الأساسي فقط. null = تنسيق 1+2 لكن لا يوجد توزيع مكتمل في آخر تقرير. */
  tripleIntel: TripleHolderLabels | null | undefined;
  /** مسودة حقول الطباعة/التصدير (لا تُكتب للقاعدة تلقائياً). */
  printDraftTriple?: TripleHolderLabels;
  onPrintDraftTripleChange?: (next: TripleHolderLabels) => void;
  /** صف بحجم أصغر داخل المودال. */
  dense?: boolean;
  /** ذهاب لصفحة التقاريب لبدء جرد هذه المركبة (قسم التجهيز). */
  onStartInspection?: () => void;
}

function patchDraft(prev: TripleHolderLabels, field: keyof TripleHolderLabels, value: string): TripleHolderLabels {
  return { ...prev, [field]: value };
}

/** خلية عمود الموظّف: المعيّن على المركبة + تفاصيل آخر توزيع «١ سائق + ٢ مساعد». */
export default function TripleIntelDriverCell({
  driverName,
  staffLabel,
  tripleIntel,
  printDraftTriple,
  onPrintDraftTripleChange,
  dense,
  onStartInspection,
}: TripleIntelDriverCellProps) {
  if (tripleIntel === undefined) {
    return <>{driverName ?? '—'}</>;
  }

  const canEditPrint = Boolean(printDraftTriple && onPrintDraftTripleChange);

  return (
    <div className={cn('space-y-1 text-right leading-snug', dense ? 'max-w-[220px]' : '')}>
      <div className={cn(dense ? 'font-bold text-[11px]' : 'font-bold')}>
        <span>{driverName ?? '—'}</span>
        <span className="mr-2 text-[9px] font-semibold opacity-55 text-stone-500 dark:text-stone-400">
          ({staffLabel})
        </span>
      </div>
      {tripleIntel ? (
        <div className="rounded-lg border border-amber-200/70 bg-amber-50/50 px-2 py-1 dark:border-amber-800/50 dark:bg-amber-950/25">
          <p className="text-[9px] font-black text-amber-900 dark:text-amber-200 mb-1">من آخر جرد (١+٢)</p>
          <ul className="space-y-0.5 text-[10px] text-stone-800 dark:text-stone-200 font-semibold">
            <li className="flex flex-wrap gap-1">
              <span className="text-stone-500 shrink-0">سائق —</span> {tripleIntel.driver}
            </li>
            <li className="flex flex-wrap gap-1">
              <span className="text-stone-500 shrink-0">مساعد ١ —</span> {tripleIntel.assistant1}
            </li>
            <li className="flex flex-wrap gap-1">
              <span className="text-stone-500 shrink-0">مساعد ٢ —</span> {tripleIntel.assistant2}
            </li>
          </ul>
        </div>
      ) : (
        <p className="text-[9px] text-amber-800/85 dark:text-amber-300/85 font-semibold italic">
          لا يوجد توزيع مسجّل بالكامل في آخر تقرير جرد لهذه المركبة.
        </p>
      )}
      {canEditPrint ? (
        <div className="rounded-lg border border-stone-200/90 bg-white/95 px-2 py-1.5 dark:border-stone-600/70 dark:bg-stone-900/85">
          <p className="text-[9px] font-black text-stone-700 dark:text-stone-100 mb-1">
            تعديل للطباعة والتصدير فقط
          </p>
          <div className="space-y-1">
            <label className="block text-[9px] font-semibold text-stone-600 dark:text-stone-400">سائق (حامل ١)</label>
            <input
              dir="rtl"
              className={cn(
                'w-full rounded border border-stone-200 px-1 py-1 text-[10px] font-semibold dark:border-stone-600 dark:bg-stone-950',
                dense ? 'py-0.5' : '',
              )}
              value={printDraftTriple!.driver}
              onChange={(e) =>
                onPrintDraftTripleChange!(patchDraft(printDraftTriple!, 'driver', e.target.value))
              }
              aria-label="اسم السائق للطباعة"
            />
            <label className="block text-[9px] font-semibold text-stone-600 dark:text-stone-400 pt-1">مساعد ١</label>
            <input
              dir="rtl"
              className={cn(
                'w-full rounded border border-stone-200 px-1 py-1 text-[10px] font-semibold dark:border-stone-600 dark:bg-stone-950',
                dense ? 'py-0.5' : '',
              )}
              value={printDraftTriple!.assistant1}
              onChange={(e) =>
                onPrintDraftTripleChange!(patchDraft(printDraftTriple!, 'assistant1', e.target.value))
              }
              aria-label="اسم مساعد أول للطباعة"
            />
            <label className="block text-[9px] font-semibold text-stone-600 dark:text-stone-400 pt-1">مساعد ٢</label>
            <input
              dir="rtl"
              className={cn(
                'w-full rounded border border-stone-200 px-1 py-1 text-[10px] font-semibold dark:border-stone-600 dark:bg-stone-950',
                dense ? 'py-0.5' : '',
              )}
              value={printDraftTriple!.assistant2}
              onChange={(e) =>
                onPrintDraftTripleChange!(patchDraft(printDraftTriple!, 'assistant2', e.target.value))
              }
              aria-label="اسم مساعد ثانٍ للطباعة"
            />
          </div>
        </div>
      ) : null}
      {onStartInspection ? (
        <button
          type="button"
          className={cn(
            'mt-1 w-full rounded-md border border-violet-400/55 bg-violet-500/10 px-2 py-1 text-[9px] font-black text-violet-800 hover:bg-violet-500/18 dark:border-violet-600/50 dark:text-violet-100',
            dense ? 'py-0.5' : '',
          )}
          onClick={onStartInspection}
        >
          جرد جديد / تحديث التوزيع
        </button>
      ) : null}
    </div>
  );
}

/** نص للبحث والتصدير. */
export function tripleIntelSearchBlob(labels: TripleHolderLabels | null | undefined): string {
  if (labels == null) return '';
  return `${labels.driver} ${labels.assistant1} ${labels.assistant2}`.trim();
}

/** خلية عمود واحد في Excel/HTML. */
export function formatTripleIntelExportCell(labels: TripleHolderLabels | null | undefined): string {
  if (labels === undefined) return '';
  if (labels === null) return 'لا يوجد توزيع مسجَّل بالكامل في آخر جرد لهذه المركبة';
  const d = (labels.driver ?? '').trim() || '—';
  const a1 = (labels.assistant1 ?? '').trim() || '—';
  const a2 = (labels.assistant2 ?? '').trim() || '—';
  return `سائق: ${d}؛ مساعد١: ${a1}؛ مساعد٢: ${a2}`;
}
