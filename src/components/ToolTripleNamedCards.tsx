import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { Package, UserRound } from 'lucide-react';
import type { StaffMember } from '../lib/supabaseClient';
import { ImageCapture } from './ImageCapture';
import { cn } from '../lib/utils';
import { formatInventoryLabel } from '../lib/inventoryDisplay';
import { emptyTripleSlots, type ToolHolderSlotPersisted } from '../lib/toolHolderAllocations';

export interface TripleNamedItemRow {
  id: number;
  name: string;
  barcode?: string | null;
  quantity: number;
  sortOrder: number;
}

interface ToolTripleNamedCardsProps {
  items: TripleNamedItemRow[];
  slotsByTemplateId: Record<number, ToolHolderSlotPersisted[]>;
  assistants: StaffMember[];
  defaultDriverCaption: string;
  toolImages: Record<number, string[]>;
  onSlotsChange: (templateId: number, next: ToolHolderSlotPersisted[]) => void;
  onImagesChange: (id: number, images: string[]) => void;
}

const ROW_HELPER =
  'عند وجود تقرير سابق لهذه المركبة قد تُنسخ بعض الأسماء تلقائياً؛ يمكنك تصحيح الحقول أو كتابة مساعداً يدوياً.';
const ASSIST_MANUAL_HELPER =
  'لا يوجد مساعدون نشطون في الكادر؛ اكتب أسماء المساعدين في الحقل أدناه (يُحفَظ الاسم بالتقرير).';

function SlotRow(props: {
  title: string;
  slotIdx: number;
  templateId: number;
  value: ToolHolderSlotPersisted;
  assistants: StaffMember[];
  datalistId: string;
  isDriver: boolean;
  onPatch: (patch: Partial<{ label: string; staffId: number | null }>) => void;
}) {
  const { title, slotIdx, templateId, value, assistants, datalistId, isDriver, onPatch } = props;

  const handleInput = (raw: string) => {
    const found = assistants.find((a) => a.full_name.trim() === raw.trim());
    if (!isDriver && found) {
      onPatch({
        label: found.full_name,
        staffId: Number(found.id),
      });
      return;
    }
    onPatch({ label: raw, staffId: null });
  };

  const handleSelectAssist = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === '') {
      onPatch({ label: '', staffId: null });
      return;
    }
    const ass = assistants.find((a) => String(a.id) === v);
    if (ass) onPatch({ label: ass.full_name, staffId: Number(ass.id) });
  };

  return (
    <div className="rounded-lg bg-stone-50 dark:bg-stone-700/50 border border-stone-100 dark:border-stone-600 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-black text-stone-700 dark:text-stone-200">
        <UserRound className="w-3.5 h-3.5 text-stone-500 shrink-0" />
        <span>{title}</span>
        <span className="mr-auto text-[10px] font-bold text-stone-400">كمية واحدة</span>
      </div>
      {!isDriver && assistants.length > 0 && (
        <select
          className="input-field text-xs py-2"
          value={
            value.staffId != null && assistants.some((a) => Number(a.id) === value.staffId)
              ? String(value.staffId)
              : ''
          }
          onChange={handleSelectAssist}
          aria-label={`اختيار ${title}`}
        >
          <option value="">— اختيار مساعد من الكادر —</option>
          {assistants.map((a) => (
            <option key={`${templateId}-${slotIdx}-${a.id}`} value={String(a.id)}>
              {a.full_name}
            </option>
          ))}
        </select>
      )}
      <input
        type="text"
        className={cn(
          'input-field text-sm',
          value.label.trim() ? '' : 'border-amber-300/70 dark:border-amber-700/70',
        )}
        list={!isDriver && assistants.length > 0 ? datalistId : undefined}
        placeholder={isDriver ? 'اسم السائق (قابل للتعديل)' : 'اسم المساعد أو كتابة حرة'}
        value={value.label}
        onChange={(e) => handleInput(e.target.value)}
      />
      {!isDriver && assistants.length > 0 && (
        <datalist id={datalistId}>
          {assistants.map((a) => (
            <option key={`dl-${templateId}-${slotIdx}-${a.id}`} value={a.full_name} />
          ))}
        </datalist>
      )}
    </div>
  );
}

export function ToolTripleNamedCards({
  items,
  slotsByTemplateId,
  assistants,
  defaultDriverCaption,
  toolImages,
  onSlotsChange,
  onImagesChange,
}: ToolTripleNamedCardsProps) {
  const onSlotsRef = useRef(onSlotsChange);
  onSlotsRef.current = onSlotsChange;

  const slotSignature = useMemo(
    () =>
      items
        .map((i) => `${i.id}:${slotsByTemplateId[i.id]?.length ?? 0}`)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .join('|'),
    [items, slotsByTemplateId],
  );

  const itemsKey = useMemo(
    () =>
      [...items]
        .map((i) => i.id)
        .sort((a, b) => a - b)
        .join(','),
    [items],
  );

  /** يضمن رفع الحالة للأب بحيث لا تُعاد بطاقة null عندما لا تزال toolHolderDrafts غير مفعّلة لهذا template_id */
  useLayoutEffect(() => {
    if (!itemsKey) return;
    const drv = typeof defaultDriverCaption === 'string' ? defaultDriverCaption.trim() : '';
    for (const raw of itemsKey.split(',')) {
      const tid = Number(raw);
      if (!Number.isFinite(tid)) continue;
      const slots = slotsByTemplateId[tid];
      if (!slots || slots.length !== 3) {
        onSlotsRef.current(tid, emptyTripleSlots(drv));
      }
    }
  }, [itemsKey, slotSignature, defaultDriverCaption, slotsByTemplateId]);

  if (items.length === 0) return null;

  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-200/80 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
        <span className="font-bold block mb-1">توزيع 1 سائق + 2 مساعد</span>
        <span>{ROW_HELPER}</span>
        <span className="block mt-1 text-[10px] opacity-90">
          سائق افتراضي من المركبة: {defaultDriverCaption || '— لم يُعيَّن سائق على المركبة —'}
        </span>
        {assistants.length === 0 ? (
          <span className="block mt-2 text-[10px] font-semibold text-amber-950/90 dark:text-amber-100/95">
            {ASSIST_MANUAL_HELPER}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((item) => {
          const rawSlots = slotsByTemplateId[item.id];
          const slots =
            rawSlots != null && rawSlots.length === 3 ? rawSlots : emptyTripleSlots(defaultDriverCaption);
          const idListBase = `assistant-dl-${item.id}`;
          const patchSlot = (idx: number, patch: Partial<{ label: string; staffId: number | null }>) => {
            const copy = [...slots];
            copy[idx] = {
              ...copy[idx],
              ...patch,
            };
            onSlotsChange(item.id, copy);
          };
          return (
            <div
              key={item.id}
              className="bg-white dark:bg-stone-800 p-4 rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm flex flex-col gap-4"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="p-2 bg-stone-100 dark:bg-stone-700 rounded-lg shrink-0">
                    <Package className="w-4 h-4 text-stone-600 dark:text-stone-300" />
                  </div>
                  <span className="font-bold text-sm leading-tight text-stone-900 dark:text-stone-100">
                    {formatInventoryLabel(item.name, item.barcode ?? null)}
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 bg-emerald-800 text-white rounded-full shrink-0 whitespace-nowrap">
                  المطلوب: {item.quantity}
                </span>
              </div>

              <div className="space-y-3">
                <SlotRow
                  title="السائق — ١"
                  slotIdx={0}
                  templateId={item.id}
                  value={slots[0]}
                  assistants={assistants}
                  datalistId={idListBase}
                  isDriver
                  onPatch={(p) => patchSlot(0, p)}
                />
                <SlotRow
                  title="مساعد ١ — ١"
                  slotIdx={1}
                  templateId={item.id}
                  value={slots[1]}
                  assistants={assistants}
                  datalistId={`${idListBase}-1`}
                  isDriver={false}
                  onPatch={(p) => patchSlot(1, p)}
                />
                <SlotRow
                  title="مساعد ٢ — ١"
                  slotIdx={2}
                  templateId={item.id}
                  value={slots[2]}
                  assistants={assistants}
                  datalistId={`${idListBase}-2`}
                  isDriver={false}
                  onPatch={(p) => patchSlot(2, p)}
                />
              </div>

              <ImageCapture
                toolName={item.name}
                images={toolImages[item.id] || []}
                onImageCapture={(image) => {
                  const cur = toolImages[item.id] || [];
                  onImagesChange(item.id, [...cur, image]);
                }}
                onRemoveImage={(index) => {
                  const cur = toolImages[item.id] || [];
                  onImagesChange(
                    item.id,
                    cur.filter((_, i) => i !== index),
                  );
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
