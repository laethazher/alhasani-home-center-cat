/**
 * Excel export utility - ensures proper UTF-8/Arabic encoding.
 */
import * as XLSX from 'xlsx';

/** Truncate sheet name for Excel (max 31 chars) */
function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/*?:\[\]]/g, '').trim();
  return cleaned.slice(0, 31) || 'Sheet1';
}

/**
 * Write workbook to file with proper Unicode support.
 */
export function writeExcelFile(wb: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(wb, filename, { bookType: 'xlsx', bookSST: true });
}

/**
 * Create sheet from array of arrays (headers + rows).
 */
export function createSheetFromArrays(data: unknown[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(data);
}

/**
 * Create sheet from array of objects.
 */
export function createSheetFromObjects<T extends Record<string, unknown>>(data: T[]): XLSX.WorkSheet {
  return XLSX.utils.json_to_sheet(data);
}

/**
 * Create workbook and add sheet.
 */
export function createWorkbook(sheet: XLSX.WorkSheet, sheetName: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, safeSheetName(sheetName));
  return wb;
}

/**
 * Create workbook with multiple sheets.
 */
export function createWorkbookWithSheets(
  sheets: { data: unknown[][] | Record<string, unknown>[]; name: string }[]
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const { data, name } of sheets) {
    const isAoa = data.length > 0 && Array.isArray(data[0]);
    const ws = isAoa
      ? XLSX.utils.aoa_to_sheet(data as unknown[][])
      : XLSX.utils.json_to_sheet(data as Record<string, unknown>[]);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(name));
  }
  return wb;
}
