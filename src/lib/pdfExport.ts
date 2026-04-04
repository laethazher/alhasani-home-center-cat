/**
 * PDF Export - uses browser print for 100% reliable Arabic/RTL rendering.
 * يفتح المستند عبر blob: URL (وليس data: للصفحة كاملة) حتى تعمل صور data:image/png داخل المحتوى.
 */

/** أنماط أساسية */
const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 20px; font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; background: #fff; color: #1c1917; font-size: 14px; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th, td { padding: 10px 12px; border: 1px solid #e2e8f0; text-align: right; }
  th { background: #f1f5f9; color: #0f172a; font-weight: 700; border-bottom: 2px solid #cbd5e1; }
  tr:nth-child(even) { background: #f8fafc; }
  h1, h2, h3 { color: #0f172a; margin: 16px 0 8px; }
  img { max-width: 100%; height: auto; display: block; margin: 12px auto; }
  .no-print { display: none !important; }
  @media print {
    body { padding: 0; }
    @page { margin: 1.5cm; }
  }
`;

/**
 * تخطيط يعوض غياب Tailwind في نافذة الطباعة — تقرير فحص المركبة (Reports / SavedReportDetailModal).
 * بدون هذا يظهر المحتوى عموداً ضيقاً ولا تُحمّل صور المسارات النسبية.
 */
const REPORT_PDF_LAYOUT_CSS = `
  .pdf-report-root {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0;
    box-sizing: border-box;
  }
  .pdf-report-root .relative { position: relative; }
  .pdf-report-root .absolute { position: absolute; }
  .pdf-report-root .flex { display: flex; }
  .pdf-report-root .inline-flex { display: inline-flex; }
  .pdf-report-root .grid { display: grid; }
  .pdf-report-root .flex-1 { flex: 1 1 0%; }
  .pdf-report-root .flex-wrap { flex-wrap: wrap; }
  .pdf-report-root .flex-col { flex-direction: column; }
  .pdf-report-root .items-start { align-items: flex-start; }
  .pdf-report-root .items-center { align-items: center; }
  .pdf-report-root .justify-between { justify-content: space-between; }
  .pdf-report-root .justify-center { justify-content: center; }
  .pdf-report-root .gap-2 { gap: 0.5rem; }
  .pdf-report-root .gap-3 { gap: 0.75rem; }
  .pdf-report-root .gap-4 { gap: 1rem; }
  .pdf-report-root .gap-6 { gap: 1.5rem; }
  .pdf-report-root .gap-x-8 { column-gap: 2rem; }
  .pdf-report-root .gap-y-12 { row-gap: 3rem; }
  .pdf-report-root .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .pdf-report-root .w-full { width: 100% !important; }
  .pdf-report-root .w-20 { width: 5rem; }
  .pdf-report-root .h-20 { height: 5rem; }
  .pdf-report-root .h-24 { height: 6rem; }
  .pdf-report-root .h-auto { height: auto; }
  .pdf-report-root .max-h-full { max-height: 100%; }
  .pdf-report-root .min-w-\\[200px\\] { min-width: 200px; }
  .pdf-report-root .overflow-hidden { overflow: hidden; }
  .pdf-report-root .rounded-2xl { border-radius: 1rem; }
  .pdf-report-root .rounded-lg { border-radius: 0.5rem; }
  .pdf-report-root .rounded-full { border-radius: 9999px; }
  .pdf-report-root .border-2 { border-width: 2px; border-style: solid; }
  .pdf-report-root .border-b { border-bottom-width: 1px; border-bottom-style: solid; }
  .pdf-report-root .border-t { border-top-width: 1px; border-top-style: solid; }
  .pdf-report-root .border-b-4 { border-bottom-width: 4px; border-bottom-style: solid; }
  .pdf-report-root .border-r-4 { border-right-width: 4px; border-right-style: solid; }
  .pdf-report-root .border-stone-100 { border-color: #f5f5f4; }
  .pdf-report-root .border-stone-200 { border-color: #e7e5e4; }
  .pdf-report-root .border-rose-400 { border-color: #fb7185; }
  .pdf-report-root .border-red-700 { border-color: #b91c1c; }
  .pdf-report-root .p-12 { padding: 3rem; }
  .pdf-report-root .p-6 { padding: 1.5rem; }
  .pdf-report-root .p-4 { padding: 1rem; }
  .pdf-report-root .p-3 { padding: 0.75rem; }
  .pdf-report-root .pb-8 { padding-bottom: 2rem; }
  .pdf-report-root .pr-4 { padding-right: 1rem; }
  .pdf-report-root .pr-6 { padding-right: 1.5rem; }
  .pdf-report-root .pt-12 { padding-top: 3rem; }
  .pdf-report-root .space-y-12 > * + * { margin-top: 3rem; }
  .pdf-report-root .space-y-4 > * + * { margin-top: 1rem; }
  .pdf-report-root .space-y-2 > * + * { margin-top: 0.5rem; }
  .pdf-report-root .text-left { text-align: left; }
  .pdf-report-root .text-right { text-align: right; }
  .pdf-report-root .text-center { text-align: center; }
  .pdf-report-root .text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
  .pdf-report-root .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
  .pdf-report-root .text-2xl { font-size: 1.5rem; line-height: 2rem; }
  .pdf-report-root .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
  .pdf-report-root .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
  .pdf-report-root .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
  .pdf-report-root .text-xs { font-size: 0.75rem; line-height: 1rem; }
  .pdf-report-root .text-\\[10px\\] { font-size: 10px; }
  .pdf-report-root .font-black { font-weight: 900; }
  .pdf-report-root .font-bold { font-weight: 700; }
  .pdf-report-root .font-medium { font-weight: 500; }
  .pdf-report-root .font-mono { font-family: ui-monospace, monospace; }
  .pdf-report-root .leading-tight { line-height: 1.25; }
  .pdf-report-root .text-stone-900 { color: #1c1917; }
  .pdf-report-root .text-stone-800 { color: #292524; }
  .pdf-report-root .text-stone-700 { color: #44403c; }
  .pdf-report-root .text-stone-600 { color: #57534e; }
  .pdf-report-root .text-stone-500 { color: #78716c; }
  .pdf-report-root .text-stone-400 { color: #a8a29e; }
  .pdf-report-root .text-stone-300 { color: #d6d3d1; }
  .pdf-report-root .text-rose-500 { color: #f43f5e; }
  .pdf-report-root .text-red-600 { color: #dc2626; }
  .pdf-report-root .text-red-700 { color: #b91c1c; }
  .pdf-report-root .text-orange-700 { color: #c2410c; }
  .pdf-report-root .text-green-600 { color: #16a34a; }
  .pdf-report-root .text-green-700 { color: #15803d; }
  .pdf-report-root .text-blue-500 { color: #3b82f6; }
  .pdf-report-root .bg-white { background-color: #fff; }
  .pdf-report-root .bg-stone-50 { background-color: #fafaf9; }
  .pdf-report-root .bg-stone-100 { background-color: #f5f5f4; }
  .pdf-report-root .bg-rose-50 { background-color: #fff1f2; }
  .pdf-report-root .bg-red-100 { background-color: #fee2e2; }
  .pdf-report-root .bg-orange-100 { background-color: #ffedd5; }
  .pdf-report-root .bg-green-50 { background-color: #f0fdf4; }
  .pdf-report-root .bg-green-100 { background-color: #dcfce7; }
  .pdf-report-root .bg-red-50 { background-color: #fef2f2; }
  .pdf-report-root .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
  .pdf-report-root .px-2\\.5 { padding-left: 0.625rem; padding-right: 0.625rem; }
  .pdf-report-root .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
  .pdf-report-root .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
  .pdf-report-root .whitespace-nowrap { white-space: nowrap; }
  .pdf-report-root .italic { font-style: italic; }
  .pdf-report-root .uppercase { text-transform: uppercase; }
  .pdf-report-root .block { display: block; }
  .pdf-report-root .mb-1 { margin-bottom: 0.25rem; }
  .pdf-report-root .mb-2 { margin-bottom: 0.5rem; }
  .pdf-report-root .mb-3 { margin-bottom: 0.75rem; }
  .pdf-report-root .mb-4 { margin-bottom: 1rem; }
  .pdf-report-root .mt-2 { margin-top: 0.5rem; }
  .pdf-report-root .mt-6 { margin-top: 1.5rem; }
  .pdf-report-root .mx-auto { margin-left: auto; margin-right: auto; }
  .pdf-report-root .w-6 { width: 1.5rem; }
  .pdf-report-root .h-6 { height: 1.5rem; }
  .pdf-report-root .w-4 { width: 1rem; }
  .pdf-report-root .h-4 { height: 1rem; }
  .pdf-report-root .max-h-60 { max-height: 15rem; }
  .pdf-report-root .overflow-y-auto { overflow-y: auto; }
  .pdf-report-root .pdf-vehicle-map { position: relative; display: block; width: 100%; }
  .pdf-report-root .pdf-vehicle-map img {
    width: 100% !important;
    height: auto !important;
    object-fit: contain !important;
    max-height: 11cm;
  }
  .pdf-report-root img.report-embed-photo {
    min-height: 0 !important;
    max-width: 100% !important;
    max-height: 300px !important;
    object-fit: contain !important;
  }
  .pdf-report-root .pdf-damage-stack > .pdf-section { margin-bottom: 0.35rem !important; }
  .pdf-report-root .pdf-damage-stack > .pdf-section + .pdf-section { margin-top: 0.25rem !important; }
  .pdf-report-root .pdf-section > h3 {
    page-break-after: avoid !important;
    break-after: avoid !important;
  }
  @media print {
    .pdf-report-root #print-section { padding: 12px 16px !important; }
    .pdf-report-root #print-section > *:not(:first-child) {
      margin-top: 0.625rem !important;
    }
    .pdf-report-root .pdf-section {
      page-break-before: auto !important;
      break-before: auto !important;
      page-break-inside: auto !important;
      break-inside: auto !important;
      margin-bottom: 0.5rem !important;
    }
    .pdf-report-root .pdf-section-signatures {
      page-break-before: always !important;
      break-before: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .pdf-report-root .pdf-print-flow-row {
      page-break-inside: auto !important;
      break-inside: auto !important;
    }
    .pdf-report-root .pdf-damage-card {
      page-break-inside: auto !important;
      break-inside: auto !important;
    }
    .pdf-report-root img {
      min-height: 0 !important;
    }
  }
`;

export type ExportPdfOptions = {
  /** تقرير الفحص: يُفعّل CSS التخطيط + تثبيت عرض الصفحة */
  reportInspectionLayout?: boolean;
};

/** تحويل src النسبية (مثل /truck.jpg) إلى مطلقة حتى تعمل داخل blob: URL */
function absolutizePathForPrintUrl(path: string, base: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (p.includes('%')) {
    return `${base}${p}`;
  }
  return `${base}${encodeURI(p)}`;
}

export function absolutizeHtmlResourceUrls(html: string, origin: string): string {
  const base = origin.replace(/\/$/, '');
  return html
    .replace(/\ssrc="(\/[^"]*)"/gi, (_m, path: string) => ` src="${absolutizePathForPrintUrl(path, base)}"`)
    .replace(/\ssrc='(\/[^']*)'/gi, (_m, path: string) => ` src='${absolutizePathForPrintUrl(path, base)}'`);
}

/** تجهيز HTML مقطع تقرير الفحص للطباعة/PDF */
export function wrapReportHtmlForPdf(innerHtml: string, origin: string): string {
  const fixed = absolutizeHtmlResourceUrls(innerHtml, origin);
  return `<div class="pdf-report-root" dir="rtl">${fixed}</div>`;
}

function buildPrintableHtmlDocument(
  htmlContent: string,
  filename: string,
  options?: ExportPdfOptions,
): string {
  const extra = options?.reportInspectionLayout ? REPORT_PDF_LAYOUT_CSS : '';
  const combinedStyles = PRINT_STYLES + extra;
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap" rel="stylesheet">
  <style>${combinedStyles}</style>
  <title>${filename.replace('.pdf', '')}</title>
</head>
<body>
  ${htmlContent}
  <div class="no-print" style="margin-top: 40px; padding: 20px; border-top: 1px solid #eee; color: #666; text-align: center;">
    <p>إذا لم تظهر نافذة الطباعة تلقائياً، يرجى الضغط على <strong>Ctrl + P</strong> واختيار "حفظ كـ PDF".</p>
  </div>
</body>
</html>`;
}

/**
 * فتح المحتوى في نافذة جديدة واستدعاء الطباعة.
 * استخدام blob: URL يضمن ظهور &lt;img src="data:image/png;base64,..."&gt; (لا يعمل موثوقاً داخل صفحة data: أب).
 */
export function exportHtmlToPdf(
  htmlContent: string,
  filename: string,
  options?: ExportPdfOptions,
): Promise<void> {
  return new Promise((resolve) => {
    const fullHtml = buildPrintableHtmlDocument(htmlContent, filename, options);
    const blob = new Blob(['\uFEFF' + fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const revokeLater = () => {
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };

    const win = window.open(url, '_blank', 'noopener,noreferrer,width=1024,height=800');
    if (!win) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.replace('.pdf', '.html');
      a.rel = 'noopener';
      a.click();
      revokeLater();
      alert('تم تنزيل صفحة HTML. افتحها ثم استخدم Ctrl+P → حفظ كـ PDF. إن وُجد حاجب نوافذ، اسمح بالنوافذ المنبثقة.');
      resolve();
      return;
    }

    const finish = () => {
      revokeLater();
      resolve();
    };

    win.addEventListener('afterprint', finish, { once: true });
    window.setTimeout(finish, 120_000);

    const delayMs = options?.reportInspectionLayout ? 1100 : 700;
    const runPrint = () => {
      window.setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          /* empty */
        }
      }, delayMs);
    };

    if (win.document.readyState === 'complete') runPrint();
    else win.addEventListener('load', runPrint, { once: true });
  });
}

/**
 * Capture visible element and save as PDF via print.
 */
export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<void> {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;background:#fff;color:#1c1917;padding:20px;';
  document.body.appendChild(clone);
  const html = clone.outerHTML;
  document.body.removeChild(clone);
  await exportHtmlToPdf(html, filename);
}
