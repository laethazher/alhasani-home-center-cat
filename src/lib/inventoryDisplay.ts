/** Same separator as formatInventoryLabel — used to detect pre-formatted labels in DB. */
export const INVENTORY_LABEL_SEPARATOR = ' · ';

/**
 * Single-line label for inventory rows (RTL-friendly): barcode before name when set.
 */
export function formatInventoryLabel(name: string, barcode?: string | null): string {
  const n = String(name ?? '').trim();
  const b = barcode != null ? String(barcode).trim() : '';
  if (!b) return n;
  if (!n) return `الباركود: ${b}`;
  return `${b}${INVENTORY_LABEL_SEPARATOR}${n}`;
}

/**
 * Enrich a stored `item_name` (plain name, or already `barcode · name`) using current templates
 * so old recovery rows show barcode after templates are updated.
 */
export function enrichStoredInventoryLabel(
  storedName: string,
  nameToBarcode: ReadonlyMap<string, string | null>,
): string {
  const t = String(storedName ?? '').trim();
  if (!t) return '';
  if (nameToBarcode.has(t)) {
    return formatInventoryLabel(t, nameToBarcode.get(t) ?? null);
  }
  const i = t.indexOf(INVENTORY_LABEL_SEPARATOR);
  if (i > 0) {
    const rest = t.slice(i + INVENTORY_LABEL_SEPARATOR.length).trim();
    if (nameToBarcode.has(rest)) {
      return formatInventoryLabel(rest, nameToBarcode.get(rest) ?? null);
    }
  }
  return t;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Split display line from formatInventoryLabel for table columns (PDF/exports). */
export function splitBarcodeAndNameFromDisplay(display: string): { barcode: string; name: string } {
  const t = String(display ?? '').trim();
  const i = t.indexOf(INVENTORY_LABEL_SEPARATOR);
  if (i > 0) {
    return { barcode: t.slice(0, i).trim() || '—', name: t.slice(i + INVENTORY_LABEL_SEPARATOR.length).trim() || '—' };
  }
  return { barcode: '—', name: t || '—' };
}

export { escapeHtml as escapeHtmlForPdf };
