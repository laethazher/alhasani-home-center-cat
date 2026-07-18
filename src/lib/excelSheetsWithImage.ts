/**
 * تصدير عدة أوراق XLSX مع ورقة صورة اختيارية (exceljs).
 * عند فشل exceljs يُستخدم تلقائياً exportSheetsToExcel (xlsx).
 */
import { exportSheetsToExcel } from './excelExport';

function downloadXlsxBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename.replace(/\.xlsx$/i, '')}.xlsx`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function safeSheetName(name: string): string {
  const s = name.replace(/[:\\/?*[\]]/g, '_').trim().slice(0, 31);
  return s || 'Sheet';
}

function toUint8Array(buf: unknown): Uint8Array | null {
  if (buf instanceof Uint8Array) return buf;
  if (buf instanceof ArrayBuffer) return new Uint8Array(buf);
  if (buf && typeof buf === 'object' && 'buffer' in buf && (buf as ArrayBufferView).byteLength != null) {
    const v = buf as ArrayBufferView;
    return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  }
  return null;
}

async function runExcelJsExport(
  sheets: { name: string; data: unknown[][] }[],
  filename: string,
  chartPngDataUrl: string | null
): Promise<boolean> {
  const exceljsMod = (await import('exceljs')) as unknown as {
    Workbook?: new () => import('exceljs').Workbook;
    default?: { Workbook?: new () => import('exceljs').Workbook };
  };
  const WorkbookCtor = exceljsMod.Workbook ?? exceljsMod.default?.Workbook;
  if (typeof WorkbookCtor !== 'function') throw new Error('exceljs Workbook not available');
  const wb = new WorkbookCtor();
  wb.creator = 'Reports Hub';

  for (const { name, data } of sheets) {
    const ws = wb.addWorksheet(safeSheetName(name), { views: [{ rightToLeft: true }] });
    data.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        const c = ws.getCell(ri + 1, ci + 1);
        const v = cell;
        if (v == null || v === '') c.value = '';
        else if (typeof v === 'number' && Number.isFinite(v)) c.value = v;
        else c.value = String(v);
      });
    });
  }

  if (chartPngDataUrl) {
    const m = chartPngDataUrl.match(/^data:image\/png;base64,(.+)$/);
    const b64 = m ? m[1] : chartPngDataUrl.replace(/^data:image\/\w+;base64,/, '');
    if (b64.length > 0) {
      const imageId = wb.addImage({ base64: b64, extension: 'png' });
      const imgWs = wb.addWorksheet(safeSheetName('رسم_بصري'), { views: [{ rightToLeft: true }] });
      imgWs.getCell(1, 1).value = 'معاينة الرسوم';
      imgWs.addImage(imageId, { tl: { col: 0, row: 2 }, ext: { width: 700, height: 380 } });
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const bytes = toUint8Array(buf);
  if (!bytes) return false;
  downloadXlsxBytes(bytes, filename);
  return true;
}

export async function exportSheetsToExcelWithOptionalChartImage(
  sheets: { name: string; data: unknown[][] }[],
  filename: string,
  chartPngDataUrl: string | null
): Promise<void> {
  try {
    const ok = await runExcelJsExport(sheets, filename, chartPngDataUrl);
    if (ok) return;
  } catch (e) {
    console.warn('[exceljs] export failed, using xlsx fallback', e);
  }
  exportSheetsToExcel(sheets, filename);
}
