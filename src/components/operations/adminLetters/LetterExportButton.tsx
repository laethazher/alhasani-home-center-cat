import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { exportHtmlToPdf } from '../../../lib/pdfExport';
import { exportToExcel } from '../../../lib/excelExport';
import {
  ARCHIVE_STATUS_LABELS,
  LETTER_TYPE_LABELS,
  operationsAdminLettersRepository,
  type AdminLetterFilters,
} from '../../../data/repositories/operationsAdminLettersRepository';

interface LetterExportButtonProps {
  filters: AdminLetterFilters;
}

export default function LetterExportButton({ filters }: LetterExportButtonProps) {
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  async function loadData() {
    const letters = await operationsAdminLettersRepository.exportLettersData(filters);
    if (letters.length === 0) {
      alert('لا توجد كتب للتصدير');
      return null;
    }
    return letters;
  }

  async function exportPDF() {
    setExporting('pdf');
    try {
      const letters = await loadData();
      if (!letters) return;

      const headers = ['الرقم', 'النوع', 'الموضوع', 'الجهة', 'التاريخ', 'التوقيع', 'الحالة', 'المرجع'];
      const rows = letters.map((l) => [
        l.letter_number,
        LETTER_TYPE_LABELS[l.letter_type],
        l.subject,
        l.correspondent_entity || '—',
        l.letter_date,
        l.is_signed ? 'موقّع' : 'بانتظار',
        ARCHIVE_STATUS_LABELS[l.archive_status],
        l.reference_number || '—',
      ]);

      const html = `
        <h1 style="text-align:center;font-size:22px;margin-bottom:12px">أرشيف الكتب الإدارية — قسم العمليات</h1>
        <p style="text-align:center;color:#666;margin-bottom:20px">تاريخ التصدير: ${new Date().toLocaleDateString('ar-IQ')} | العدد: ${letters.length}</p>
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead><tr style="background:#0891b2;color:#fff">
            ${headers.map((h) => `<th style="padding:8px;text-align:right">${h}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${rows
              .map(
                (row, i) => `
              <tr style="${i % 2 === 0 ? 'background:#ecfeff' : ''}">
                ${row.map((cell) => `<td style="padding:6px 8px;border:1px solid #ddd">${cell}</td>`).join('')}
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      `;

      await exportHtmlToPdf(`<div dir="rtl">${html}</div>`, `ارشيف_الكتب_${Date.now()}.pdf`);
    } catch (e) {
      console.error(e);
      alert('فشل تصدير PDF');
    } finally {
      setExporting(null);
    }
  }

  async function exportExcel() {
    setExporting('excel');
    try {
      const letters = await loadData();
      if (!letters) return;

      const headers = ['الرقم', 'النوع', 'الموضوع', 'الجهة', 'التاريخ', 'التوقيع', 'الحالة', 'المرجع', 'ملخص'];
      const rows = letters.map((l) => [
        l.letter_number,
        LETTER_TYPE_LABELS[l.letter_type],
        l.subject,
        l.correspondent_entity || '',
        l.letter_date,
        l.is_signed ? 'موقّع' : 'بانتظار',
        ARCHIVE_STATUS_LABELS[l.archive_status],
        l.reference_number || '',
        l.content_summary || '',
      ]);

      exportToExcel([headers, ...rows], `ارشيف_الكتب_${new Date().toISOString().slice(0, 10)}`, 'الكتب الإدارية');
    } catch (e) {
      console.error(e);
      alert('فشل تصدير Excel');
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={() => void exportPDF()} disabled={!!exporting}>
        {exporting === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        PDF
      </Button>
      <Button type="button" variant="outline" onClick={() => void exportExcel()} disabled={!!exporting}>
        {exporting === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Excel
      </Button>
    </div>
  );
}
