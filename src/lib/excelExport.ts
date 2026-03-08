/**
 * Excel export utility - ensures proper UTF-8/Arabic encoding.
 * Both XLSX and CSV with BOM are supported.
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
  a.download = filename.endsWith('.csv') ? filename : `${filename.split('.')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export to XLSX - Better for modern Excel and preserves RTL formatting.
 */
export function exportToExcel(rows: unknown[][], filename: string, sheetName = 'Sheet1'): void {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  
  // Set RTL property if supported by the file format
  if (!ws['!views']) ws['!views'] = [];
  ws['!views'].push({ RTL: true });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename.split('.')[0]}.xlsx`);
}

/**
 * Export multiple sheets to a single XLSX file.
 */
export function exportSheetsToExcel(
  sheets: { data: unknown[][]; name: string }[],
  filename: string
): void {
  const wb = XLSX.utils.book_new();
  for (const { data, name } of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(data);
    if (!ws['!views']) ws['!views'] = [];
    ws['!views'].push({ RTL: true });
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename.split('.')[0]}.xlsx`);
}

/**
 * Legacy support for multi-sheet CSV (exports as single CSV with headers).
 */
export function exportSheetsToCsv(
  sheets: { data: unknown[][]; name: string }[],
  baseFilename: string
): void {
  const combined: unknown[][] = [];
  for (const { data, name } of sheets) {
    combined.push([name]);
    combined.push(...data);
    combined.push([]);
  }
  exportToCsv(combined, baseFilename);
}
