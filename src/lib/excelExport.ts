/**
 * Excel export utility - ensures proper UTF-8/Arabic encoding.
 * CSV with UTF-8 BOM is the most reliable for Arabic in Excel.
 */
import * as XLSX from 'xlsx';

const UTF8_BOM = '\uFEFF';

/** Escape CSV cell (handle commas, quotes, newlines) */
function escapeCsvCell(val: unknown): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Convert rows to CSV string */
function rowsToCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

/**
 * Export to CSV with UTF-8 BOM - 100% reliable for Arabic in Excel.
 */
export function exportToCsv(rows: unknown[][], filename: string): void {
  const csv = rowsToCsv(rows);
  const blob = new Blob([UTF8_BOM + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : filename.replace(/\.xlsx?$/i, '.csv');
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export multiple sheets as separate CSV files (for multi-sheet data).
 * Or use single CSV with section headers.
 */
export function exportSheetsToCsv(
  sheets: { data: unknown[][]; name: string }[],
  baseFilename: string
): void {
  if (sheets.length === 1) {
    exportToCsv(sheets[0].data, `${baseFilename}.csv`);
    return;
  }
  const combined: unknown[][] = [];
  for (const { data, name } of sheets) {
    combined.push([name]);
    combined.push(...data);
    combined.push([]);
  }
  exportToCsv(combined, `${baseFilename}.csv`);
}

/** Truncate sheet name for Excel (max 31 chars) */
function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/*?:\[\]]/g, '').trim();
  return cleaned.slice(0, 31) || 'Sheet1';
}

/**
 * Write workbook to file (xlsx) - may have encoding issues with Arabic.
 * Prefer exportToCsv for Arabic content.
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
