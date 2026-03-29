/**
 * توليد صورة PNG لمعاينة الرسوم (أعمدة / توزيع / خط بسيط) عبر html2canvas.
 * يُستخدم فقط في التصدير؛ لا يغيّر RLS ولا استعلامات الخادم.
 */
import html2canvas from 'html2canvas';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

export type ChartPreviewPoint = { name: string; value: number };

export async function buildHubChartsPreviewPng(input: {
  bar: ChartPreviewPoint[];
  pie: ChartPreviewPoint[];
  line: ChartPreviewPoint[];
}): Promise<string | null> {
  const bar = input.bar.filter((b) => Number.isFinite(b.value)).slice(0, 16);
  const pie = input.pie.filter((p) => Number.isFinite(p.value) && p.value > 0).slice(0, 12);
  const line = input.line.filter((l) => Number.isFinite(l.value)).slice(0, 40);
  if (bar.length === 0 && pie.length === 0 && line.length === 0) return null;

  const maxBar = Math.max(1, ...bar.map((b) => b.value));
  const colors = ['#2563eb', '#0d9488', '#7c3aed', '#ea580c', '#db2777', '#ca8a04', '#4f46e5', '#059669'];

  const barHtml = bar
    .map((b, i) => {
      const pct = Math.round((b.value / maxBar) * 100);
      const bg = colors[i % colors.length];
      return `<div style="display:flex;align-items:center;gap:10px;margin:8px 0;direction:rtl">
        <span style="min-width:140px;max-width:220px;font-size:13px;text-align:right;word-break:break-word">${esc(b.name)}</span>
        <div style="flex:1;height:26px;background:#e2e8f0;border-radius:6px;overflow:hidden;max-width:420px">
          <div style="height:100%;width:${pct}%;background:${bg};border-radius:6px"></div>
        </div>
        <span style="min-width:36px;font-weight:700;font-size:13px">${b.value}</span>
      </div>`;
    })
    .join('');

  const pieHtml = pie
    .map((p, i) => {
      const bg = colors[i % colors.length];
      return `<div style="display:flex;align-items:center;gap:8px;margin:6px 0;direction:rtl">
        <span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${bg}"></span>
        <span style="font-size:13px">${esc(p.name)}</span>
        <span style="font-weight:700;font-size:13px">${p.value}</span>
      </div>`;
    })
    .join('');

  const maxL = Math.max(1, ...line.map((l) => l.value));
  const w = 640;
  const h = 120;
  const pad = 8;
  const pts = line.map((l, i) => {
    const x = pad + (i / Math.max(1, line.length - 1)) * (w - pad * 2);
    const y = h - pad - (l.value / maxL) * (h - pad * 2);
    return `${x},${y}`;
  });
  const lineSvg =
    line.length >= 2
      ? `<svg width="${w}" height="${h}" style="display:block;margin-top:12px;background:#fafafa;border-radius:8px;border:1px solid #e2e8f0">
          <polyline fill="none" stroke="#7c3aed" stroke-width="2" points="${pts.join(' ')}" />
        </svg>`
      : '';

  const root = document.createElement('div');
  root.setAttribute('dir', 'rtl');
  root.style.cssText =
    'position:fixed;left:-12000px;top:0;width:780px;padding:20px 24px;background:#ffffff;color:#0f172a;font-family:Segoe UI,Tahoma,Arial,sans-serif;box-sizing:border-box;opacity:1;visibility:hidden;z-index:-1;pointer-events:none;overflow:hidden';

  root.innerHTML = `
    <h2 style="margin:0 0 16px;font-size:18px;font-weight:800;border-bottom:2px solid #2563eb;padding-bottom:8px">معاينة الرسوم</h2>
    ${bar.length ? `<section><h3 style="margin:12px 0 6px;font-size:15px;color:#334155">رسم الأعمدة</h3>${barHtml}</section>` : ''}
    ${pie.length ? `<section><h3 style="margin:16px 0 6px;font-size:15px;color:#334155">التوزيع</h3>${pieHtml}</section>` : ''}
    ${line.length >= 2 ? `<section><h3 style="margin:16px 0 6px;font-size:15px;color:#334155">اتجاه زمني</h3>${lineSvg}</section>` : ''}
  `;

  document.body.appendChild(root);
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  try {
    const canvas = await html2canvas(root, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });
    return canvas.toDataURL('image/png');
  } finally {
    root.remove();
  }
}
