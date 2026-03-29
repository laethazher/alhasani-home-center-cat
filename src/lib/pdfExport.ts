/**
 * PDF Export - uses browser print for 100% reliable Arabic/RTL rendering.
 * يفتح المستند عبر blob: URL (وليس data: للصفحة كاملة) حتى تعمل صور data:image/png داخل المحتوى.
 */
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

function buildPrintableHtmlDocument(htmlContent: string, filename: string): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap" rel="stylesheet">
  <style>${PRINT_STYLES}</style>
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
export function exportHtmlToPdf(htmlContent: string, filename: string): Promise<void> {
  return new Promise((resolve) => {
    const fullHtml = buildPrintableHtmlDocument(htmlContent, filename);
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

    const runPrint = () => {
      window.setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          /* empty */
        }
      }, 700);
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
