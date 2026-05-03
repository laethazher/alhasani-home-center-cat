/** وضع قالب الجرد «1 سائق + 2 مساعد» — يُطبَّق في الواجهة لـ department=tajhiz فقط */

export type ToolHolderSlotKind = 'driver' | 'assistant';

export interface ToolHolderSlotPersisted {
  slot: ToolHolderSlotKind;
  /** معرّف موظّف؛ null عند الاسم الكتابة اليدوي */
  staffId: number | null;
  /** الاسم الموثَّق للأرشيف */
  label: string;
}

export const TRIPLE_NAMED_ALLOCATION_MODE = 'triple_named' as const;

export type ToolHolderAllocationsByTemplateId = Record<number, ToolHolderSlotPersisted[]>;

/** قاعدة JSONB ذات مفاتيح نصية (template id) للإدراج */
export type ToolHolderAllocationsSerialized = Record<string, ToolHolderSlotPersisted[]>;

function normalizeSlot(slot: ToolHolderSlotPersisted): ToolHolderSlotPersisted {
  return {
    slot: slot.slot === 'driver' ? 'driver' : 'assistant',
    staffId:
      typeof slot.staffId === 'number' && Number.isFinite(slot.staffId)
        ? slot.staffId
        : slot.staffId != null && String(slot.staffId).trim()
          ? Number(slot.staffId)
          : null,
    label: typeof slot.label === 'string' ? slot.label.trim() : '',
  };
}

/** صفوف افتراضية: سائق (تسمية) + مساعدان فارغان */
export function emptyTripleSlots(driverLabelFallback: string): ToolHolderSlotPersisted[] {
  const dl = typeof driverLabelFallback === 'string' ? driverLabelFallback.trim() : '';
  return [
    { slot: 'driver', staffId: null, label: dl },
    { slot: 'assistant', staffId: null, label: '' },
    { slot: 'assistant', staffId: null, label: '' },
  ];
}

export function parseToolHolderAllocationsFromUnknown(raw: unknown): ToolHolderAllocationsByTemplateId {
  const out: ToolHolderAllocationsByTemplateId = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;

  const obj = raw as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    const tid = Number(key);
    if (!Number.isFinite(tid)) continue;
    if (!Array.isArray(value)) continue;

    const rows: ToolHolderSlotPersisted[] = [];
    for (const row of value) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const r = row as Record<string, unknown>;
      const slot = r.slot === 'driver' ? 'driver' : r.slot === 'assistant' ? 'assistant' : null;
      if (!slot) continue;
      const sidRaw = r.staffId;
      let staffId: number | null = null;
      if (sidRaw !== null && sidRaw !== undefined && sidRaw !== '') {
        const n = Number(sidRaw);
        if (Number.isFinite(n)) staffId = n;
      }
      rows.push(normalizeSlot({ slot, staffId, label: String(r.label ?? '') }));
    }

    const driverCount = rows.filter((s) => s.slot === 'driver').length;
    const assistCount = rows.filter((s) => s.slot === 'assistant').length;
    if (driverCount !== 1 || assistCount !== 2) continue;
    out[tid] = rows;
  }
  return out;
}

export function isTripleAllocationComplete(slots: ToolHolderSlotPersisted[] | undefined): boolean {
  if (!slots || slots.length !== 3) return false;
  return slots.every((s) => s.label.trim().length > 0);
}

/** يبني Payload إدراج Postgres فقط للعناصر triple ذات الأسطر المكتملة */
export function serializePartialAllocations(
  drafts: ToolHolderAllocationsByTemplateId,
  tripleTemplateIds: number[],
): ToolHolderAllocationsSerialized {
  const out: ToolHolderAllocationsSerialized = {};
  for (const id of tripleTemplateIds) {
    const slots = drafts[id];
    if (!slots || slots.length !== 3) continue;
    out[String(id)] = slots.map(normalizeSlot);
  }
  return out;
}

export function mergeVehiclePrefillDrafts(opts: {
  tripleItems: ReadonlyArray<{ id: number }>;
  parsedFromLastReport: ToolHolderAllocationsByTemplateId;
  defaultDriverLabel: string;
}): ToolHolderAllocationsByTemplateId {
  const drafts: ToolHolderAllocationsByTemplateId = {};
  const { tripleItems, parsedFromLastReport, defaultDriverLabel } = opts;

  for (const item of tripleItems) {
    const prev = parsedFromLastReport[item.id];
    if (prev && isTripleAllocationComplete(prev)) {
      drafts[item.id] = prev.map(normalizeSlot);
      continue;
    }
    const base = emptyTripleSlots(defaultDriverLabel);
    if (prev && prev.length === 3) {
      for (let i = 0; i < 3; i++) {
        const normalized = normalizeSlot(prev[i]);
        if (normalized.label.trim()) {
          base[i] = {
            slot: i === 0 ? 'driver' : 'assistant',
            staffId: normalized.staffId,
            label: normalized.label.trim(),
          };
        }
      }
    }
    if (!base[0].label.trim()) base[0].label = defaultDriverLabel.trim();
    drafts[item.id] = base;
  }
  return drafts;
}
