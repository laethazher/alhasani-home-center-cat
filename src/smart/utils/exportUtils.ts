import { exportToCsv, exportToExcel } from '../../lib/excelExport';
import { exportHtmlToPdf } from '../../lib/pdfExport';

export interface ExportMetadata {
  title: string;
  filterDescription: string;
  rowCount: number;
  exportedAt?: Date;
}

function metadataRows(meta: ExportMetadata): string[][] {
  const at = meta.exportedAt ?? new Date();
  return [
    ['عنوان التصدير', meta.title],
    ['تاريخ التصدير', at.toLocaleString('ar-IQ')],
    ['الفلاتر / البحث', meta.filterDescription || '—'],
    ['عدد الصفوف', String(meta.rowCount)],
    [],
  ];
}

/**
 * CSV مع صفوف تعريف في الأعلى ثم رؤوس الجدول والبيانات.
 */
export function exportFilteredCsv(
  meta: ExportMetadata,
  headerRow: unknown[],
  dataRows: unknown[][]
): void {
  const body = [...metadataRows(meta), headerRow, ...dataRows];
  const safeName = meta.title.replace(/[^\w\u0600-\u06FF-]+/g, '_').slice(0, 80);
  exportToCsv(body, `${safeName}_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportFilteredExcel(
  meta: ExportMetadata,
  headerRow: unknown[],
  dataRows: unknown[][],
  sheetName = 'البيانات'
): void {
  const body = [...metadataRows(meta), headerRow, ...dataRows];
  const safeName = meta.title.replace(/[^\w\u0600-\u06FF-]+/g, '_').slice(0, 80);
  exportToExcel(body, `${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`, sheetName);
}

export async function exportFilteredPdf(
  meta: ExportMetadata,
  headerRow: string[],
  dataRows: string[][]
): Promise<void> {
  const at = meta.exportedAt ?? new Date();
  const metaHtml = `
    <div style="margin-bottom:16px;font-size:12px;color:#64748b">
      <div><strong>العنوان:</strong> ${escapeHtml(meta.title)}</div>
      <div><strong>التاريخ:</strong> ${escapeHtml(at.toLocaleString('ar-IQ'))}</div>
      <div><strong>الفلاتر:</strong> ${escapeHtml(meta.filterDescription || '—')}</div>
      <div><strong>عدد الصفوف:</strong> ${meta.rowCount}</div>
    </div>`;
  const tableHead = `<tr style="background:#0f766e;color:#fff">${headerRow.map((h) => `<th style="padding:8px;text-align:right">${escapeHtml(h)}</th>`).join('')}</tr>`;
  const tableBody = dataRows
    .map(
      (row, i) =>
        `<tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}">${row.map((c) => `<td style="padding:6px 8px;border:1px solid #e2e8f0">${escapeHtml(String(c ?? ''))}</td>`).join('')}</tr>`
    )
    .join('');
  const html = `
    <h1 style="text-align:center;font-size:18px;margin-bottom:8px">${escapeHtml(meta.title)}</h1>
    ${metaHtml}
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>${tableHead}</thead>
      <tbody>${tableBody}</tbody>
    </table>`;
  const safeName = meta.title.replace(/[^\w\u0600-\u06FF-]+/g, '_').slice(0, 80);
  await exportHtmlToPdf(`<div dir="rtl">${html}</div>`, `${safeName}.pdf`);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
