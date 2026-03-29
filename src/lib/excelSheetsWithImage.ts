/**
 * تصدير عدة أوراق XLSX مع ورقة صورة اختيارية (exceljs).
 * لا يستبدل exportSheetsToExcel العام — يُستخدم من التقارير الذكية فقط عند الحاجة.
 * استيراد ديناميكي لـ exceljs حتى لا تُحمّل المكتبة إلا عند التصدير.
 */
function downloadXlsxBuffer(buffer: ArrayBuffer | Uint8Array | BlobPart, filename: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename.replace(/\.xlsx$/i, '')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * نفس فكرة exportSheetsToExcel مع إضافة ورقة «رسم_بصري» عند تمرير صورة PNG (data URL).
 */
export async function exportSheetsToExcelWithOptionalChartImage(
  sheets: { name: string; data: unknown[][] }[],
  filename: string,
  chartPngDataUrl: string | null
): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Alhasani Reports Hub';

  for (const { name, data } of sheets) {
    const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ rightToLeft: true }] });
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
    const imageId = wb.addImage({ base64: b64, extension: 'png' });
    const imgWs = wb.addWorksheet('رسم_بصري', { views: [{ rightToLeft: true }] });
    imgWs.getCell(1, 1).value = 'معاينة الرسوم (صورة)';
    imgWs.addImage(imageId, { tl: { col: 0, row: 2 }, ext: { width: 720, height: 400 } });
  }

  const buf = await wb.xlsx.writeBuffer();
  downloadXlsxBuffer(buf, filename);
}
