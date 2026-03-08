/**
 * PDF Export - uses browser print for 100% reliable Arabic/RTL rendering.
 * User selects "Save as PDF" or "Microsoft Print to PDF" in the print dialog.
 */
const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 20px; font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; background: #fff; color: #1c1917; font-size: 14px; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th, td { padding: 10px 12px; border: 1px solid #e2e8f0; text-align: right; }
  th { background: #f1f5f9; color: #0f172a; font-weight: 700; border-bottom: 2px solid #cbd5e1; }
  tr:nth-child(even) { background: #f8fafc; }
  h1, h2, h3 { color: #0f172a; margin: 16px 0 8px; }
  .no-print { display: none !important; }
  @media print { 
    body { padding: 0; } 
    @page { margin: 1.5cm; }
  }
`;

/**
 * Open content in a new window and trigger print (Save as PDF).
 * Most reliable method for Arabic text.
 */
export function exportHtmlToPdf(htmlContent: string, filename: string): Promise<void> {
  const fullHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap" rel="stylesheet">
  <style>${PRINT_STYLES}</style>
  <title>${filename.replace('.pdf', '')}</title>
</head>
<body>
  ${htmlContent}
  <script>
    window.onload = function() {
      // Ensure fonts are loaded before printing
      if (document.fonts) {
        document.fonts.ready.then(function() {
          setTimeout(() => { window.print(); }, 500);
        });
      } else {
        setTimeout(() => { window.print(); }, 1000);
      }
    };
  <\/script>
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer,width=900,height=700');
  if (win) {
    URL.revokeObjectURL(url);
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace('.pdf', '.html');
    a.click();
    URL.revokeObjectURL(url);
    alert('تم فتح الملف. يرجى استخدام Ctrl+P للطباعة واختيار "حفظ كـ PDF"');
  }
  return Promise.resolve();
}

/**
 * Capture visible element and save as PDF via print.
 * Use when you have an existing DOM element (e.g. Reports page).
 */
export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<void> {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;background:#fff;color:#1c1917;padding:20px;';
  document.body.appendChild(clone);
  const html = clone.outerHTML;
  document.body.removeChild(clone);
  exportHtmlToPdf(html, filename);
}
