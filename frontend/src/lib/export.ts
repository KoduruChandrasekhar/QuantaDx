/** Client-side exports: SVG/PNG of charts and circuits, CSV, JSON and text downloads. */

export function download(filename: string, content: string | Blob, mime = 'text/plain'): void {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Resolve CSS custom properties so the exported SVG renders identically outside the app. */
function resolveVars(svgText: string): string {
  const cs = getComputedStyle(document.documentElement);
  return svgText.replace(/var\((--[\w-]+)\)/g, (_, name: string) => cs.getPropertyValue(name).trim() || '#888');
}

export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const bbox = svg.getBoundingClientRect();
  if (!clone.getAttribute('width')) clone.setAttribute('width', String(bbox.width));
  if (!clone.getAttribute('height')) clone.setAttribute('height', String(bbox.height));
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim();
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('width', '100%');
  rect.setAttribute('height', '100%');
  rect.setAttribute('fill', bg || '#fff');
  clone.insertBefore(rect, clone.firstChild);
  // Inline computed text/fill colours from class-based styling.
  const src = svg.querySelectorAll('*');
  clone.querySelectorAll('*').forEach((el, i) => {
    const s = src[i - 1] ?? null;
    if (!s || !(el instanceof SVGElement)) return;
    const st = getComputedStyle(s);
    if (el.tagName === 'text' && !el.getAttribute('fill')) el.setAttribute('fill', st.fill);
    if (el.getAttribute('class')?.includes('recharts')) {
      if (!el.getAttribute('fill') && st.fill && st.fill !== 'none') el.setAttribute('fill', st.fill);
    }
  });
  return resolveVars(new XMLSerializer().serializeToString(clone));
}

export function exportSvg(svg: SVGSVGElement, filename: string): void {
  download(filename.endsWith('.svg') ? filename : `${filename}.svg`, serializeSvg(svg), 'image/svg+xml');
}

export async function svgToPngBlob(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const text = serializeSvg(svg);
  const bbox = svg.getBoundingClientRect();
  const img = new Image();
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('SVG rasterisation failed'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(bbox.width * scale);
  canvas.height = Math.ceil(bbox.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, bbox.width, bbox.height);
  URL.revokeObjectURL(url);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG encode failed'))), 'image/png'));
}

export async function exportPng(svg: SVGSVGElement, filename: string): Promise<void> {
  const blob = await svgToPngBlob(svg);
  download(filename.endsWith('.png') ? filename : `${filename}.png`, blob);
}

export function toCsv(rows: Record<string, string | number | null | undefined>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}
