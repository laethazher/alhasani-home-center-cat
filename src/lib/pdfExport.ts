/**
 * PDF Export utility - uses html-to-image for correct Arabic/RTL rendering.
 * Avoids jsPDF direct text which corrupts Arabic.
 */
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

const PDF_STYLE = `
  direction: rtl;
  font-family: 'Segoe UI', 'Tahoma', 'Arial', 'Noto Sans Arabic', sans-serif;
  background: #fff;
  color: #1c1917;
  padding: 20px;
  font-size: 14px;
  line-height: 1.6;
`;

/**
 * Capture an HTML element and save as PDF with proper page breaks.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  filename: string,
  options?: { pixelRatio?: number; quality?: number }
): Promise<void> {
  const pixelRatio = options?.pixelRatio ?? 2;
  const quality = options?.quality ?? 1;

  const wasDark = document.documentElement.classList.contains('dark');
  if (wasDark) document.documentElement.classList.remove('dark');

  const originalBg = element.style.backgroundColor;
  const originalColor = element.style.color;
  element.style.backgroundColor = '#ffffff';
  element.style.color = '#1c1917';

  await new Promise((r) => setTimeout(r, 200));

  const dataUrl = await toPng(element, {
    quality,
    pixelRatio,
    backgroundColor: '#ffffff',
    cacheBust: true,
    style: { backgroundColor: '#ffffff', color: '#1c1917' },
  });

  if (wasDark) document.documentElement.classList.add('dark');
  element.style.backgroundColor = originalBg;
  element.style.color = originalColor;

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load captured image'));
    img.src = dataUrl;
  });

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const margin = 5;
  const usableW = pdfW - margin * 2;
  const usableH = pdfH - margin * 2;
  const pxPerMm = img.width / usableW;
  const pageHeightPx = Math.floor(usableH * pxPerMm);

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = img.width;
  srcCanvas.height = img.height;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) throw new Error('Canvas unavailable');
  srcCtx.drawImage(img, 0, 0);

  let yOffset = 0;
  let pageIndex = 0;

  while (yOffset < img.height) {
    const sliceH = Math.min(pageHeightPx, img.height - yOffset);
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = img.width;
    tmpCanvas.height = sliceH;
    const tmpCtx = tmpCanvas.getContext('2d');
    if (!tmpCtx) throw new Error('Canvas unavailable');
    tmpCtx.fillStyle = '#ffffff';
    tmpCtx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
    tmpCtx.drawImage(srcCanvas, 0, yOffset, img.width, sliceH, 0, 0, img.width, sliceH);

    const imgData = tmpCanvas.toDataURL('image/jpeg', 0.92);
    const sliceHeightMm = sliceH / pxPerMm;

    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', margin, margin, usableW, sliceHeightMm);

    yOffset += sliceH;
    pageIndex++;
  }

  pdf.save(filename);
}

/**
 * Create a temporary div with HTML content, capture it, and save as PDF.
 * Use for data-based reports (no existing DOM element).
 */
export async function exportHtmlToPdf(
  htmlContent: string,
  filename: string,
  options?: { pixelRatio?: number; width?: number }
): Promise<void> {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `position:fixed;left:-9999px;top:0;width:${options?.width ?? 794}px;${PDF_STYLE}`;
  wrapper.dir = 'rtl';
  wrapper.innerHTML = htmlContent;
  document.body.appendChild(wrapper);

  await new Promise((r) => setTimeout(r, 100));

  try {
    await exportElementToPdf(wrapper, filename, { pixelRatio: options?.pixelRatio ?? 2 });
  } finally {
    document.body.removeChild(wrapper);
  }
}
