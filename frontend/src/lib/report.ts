/** Minimal PDF report builder on jsPDF (lazy-loaded): headings, paragraphs, tables and chart images. */
import { svgToPngBlob } from './export';

type JsPdf = import('jspdf').jsPDF;

const MAP: Record<string, string> = { '▲': '+', '▼': '-', '●': '=', '→': '->', '←': '<-', '≥': '>=', '≤': '<=', 'π': 'pi', 'θ': 'theta', 'φ': 'phi', '⟨': '<', '⟩': '>', '✓': 'OK', '✕': 'x', '×': 'x', '²': '2', '√': 'sqrt', 'ψ': 'psi', '∂': 'd', '≈': '~', '′': "'" };
/** jsPDF's standard fonts are WinAnsi-only: map common scientific glyphs to ASCII. */
export function pdfSafe(t: string): string {
  const sub = t.replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080));
  return Array.from(sub).map((c) => {
    const code = c.charCodeAt(0);
    const ok = (code >= 32 && code <= 126) || (code >= 160 && code <= 255) || code === 10 || '•–—‘’“”…'.includes(c);
    return ok ? c : MAP[c] ?? '?';
  }).join('');
}

export class Report {
  private y = 20;
  private constructor(private doc: JsPdf, private title: string) {}

  static async create(title: string, subtitle: string): Promise<Report> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const r = new Report(doc, title);
    doc.setFillColor(31, 73, 125);
    doc.rect(0, 0, 210, 44, 'F');
    doc.setFillColor(123, 63, 160);
    doc.rect(0, 44, 210, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(pdfSafe(title), 14, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(pdfSafe(subtitle), 14, 28);
    doc.text(pdfSafe(`QuantaDx · hybrid quantum AI for early detection · generated ${new Date().toLocaleString('en-IN')}`), 14, 36);
    doc.setTextColor(15, 27, 45);
    r.y = 56;
    return r;
  }

  private ensure(h: number) {
    if (this.y + h > 280) {
      this.footer();
      this.doc.addPage();
      this.y = 18;
    }
  }

  private footer() {
    const n = this.doc.getNumberOfPages();
    this.doc.setFontSize(8);
    this.doc.setTextColor(120, 130, 145);
    this.doc.text(`${this.title} · page ${n} · Decision-support research prototype. Not a medical diagnosis.`, 14, 290);
    this.doc.setTextColor(15, 27, 45);
  }

  heading(text: string) {
    this.ensure(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(13);
    this.doc.setTextColor(31, 73, 125);
    this.doc.text(pdfSafe(text), 14, this.y);
    this.doc.setTextColor(15, 27, 45);
    this.y += 7;
  }

  paragraph(text: string, size = 10) {
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(size);
    const lines = this.doc.splitTextToSize(pdfSafe(text), 182) as string[];
    this.ensure(lines.length * 5 + 2);
    this.doc.text(lines, 14, this.y);
    this.y += lines.length * (size * 0.45) + 3;
  }

  bullets(items: string[]) {
    items.forEach((t) => this.paragraph(`•  ${t}`));
  }

  table(head: string[], rows: (string | number)[][], widths?: number[]) {
    const w = widths ?? head.map(() => 182 / head.length);
    const rowH = 6;
    this.ensure(rowH * 2);
    this.doc.setFillColor(234, 242, 251);
    this.doc.rect(14, this.y - 4.5, 182, rowH, 'F');
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8);
    let x = 14;
    head.forEach((h, i) => { this.doc.text(pdfSafe(String(h)), x + 1, this.y); x += w[i]; });
    this.y += rowH;
    this.doc.setFont('helvetica', 'normal');
    rows.forEach((r, k) => {
      this.ensure(rowH);
      if (k % 2) {
        this.doc.setFillColor(247, 249, 252);
        this.doc.rect(14, this.y - 4.5, 182, rowH, 'F');
      }
      x = 14;
      r.forEach((v, i) => {
        const s = pdfSafe(typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(3)) : v);
        this.doc.text((this.doc.splitTextToSize(s, w[i] - 2) as string[])[0] ?? '', x + 1, this.y);
        x += w[i];
      });
      this.y += rowH;
    });
    this.y += 3;
  }

  async chart(svg: SVGSVGElement | null, caption: string) {
    if (!svg) return;
    try {
      const blob = await svgToPngBlob(svg, 2);
      const url = await new Promise<string>((res) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.readAsDataURL(blob);
      });
      const r = svg.getBoundingClientRect();
      const w = 182, h = Math.min(100, (r.height / r.width) * w);
      this.ensure(h + 8);
      this.doc.addImage(url, 'PNG', 14, this.y, w, h);
      this.y += h + 2;
      this.doc.setFontSize(8);
      this.doc.setTextColor(120, 130, 145);
      this.doc.text(pdfSafe(caption), 14, this.y + 2);
      this.doc.setTextColor(15, 27, 45);
      this.y += 7;
    } catch {
      this.paragraph(`[chart unavailable: ${caption}]`, 8);
    }
  }

  save(name: string) {
    this.footer();
    this.doc.save(name);
  }
}
