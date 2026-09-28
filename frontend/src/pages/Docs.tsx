import { motion } from 'framer-motion';
import { FileDown, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, cn } from '@/components/common/ui';
import { Tex } from '@/components/common/misc';
import { Bloch } from '@/components/quantum/Bloch';
import { SystemDiagram } from '@/features/architecture/SystemDiagram';
import { DOCS, type Block } from '@/content/docs';
import { GATES, gateColor } from '@/content/gates';
import { simulate } from '@/lib/quantum/simulator';
import { Report } from '@/lib/report';

const POC_ROWS = [['Logistic Regression', '0.961 ± 0.015', '0.948 ± 0.050', '0.969 ± 0.027', '0.995 ± 0.004'], ['SVM (RBF)', '0.961 ± 0.020', '0.948 ± 0.045', '0.969 ± 0.027', '0.995 ± 0.005'], ['Random Forest', '0.953 ± 0.023', '0.929 ± 0.049', '0.967 ± 0.039', '0.988 ± 0.009'], ['QSVM, raw ZZ kernel (bw 1.0)', '0.808 ± 0.021', '0.722 ± 0.061', '0.860 ± 0.051', '0.885 ± 0.015'], ['QSVM, bandwidth-tuned', '0.940 ± 0.013', '0.892 ± 0.047', '0.969 ± 0.028', '0.985 ± 0.008']];

function GateCard({ i }: { i: number }) {
  const gt = GATES[i];
  const [on, setOn] = useState(false);
  useEffect(() => { const id = setInterval(() => setOn((o) => !o), 1500 + i * 50); return () => clearInterval(id); }, [i]);
  const after = gt.twoQubit || gt.name === 'MEASURE' ? { x: 0, y: 0, z: 1 } : simulate(1, [{ id: 'a', name: gt.name, wires: [0], params: [Math.PI / 2, 0, 0], role: 'variational', layer: 0 }]).bloch[0];
  return (
    <div className="card flex items-center gap-3 p-3">
      <Bloch vector={on ? after : { x: 0, y: 0, z: 1 }} size={82} compact interactive={false} />
      <div className="min-w-0">
        <div className="flex items-center gap-2"><span className="rounded px-1.5 font-mono text-xs font-bold text-white" style={{ background: gateColor(gt.name) }}>{gt.name}</span><span className="text-sm font-semibold text-fg">{gt.title}</span></div>
        <div className="mt-1 overflow-x-auto text-xs"><Tex>{gt.matrix}</Tex></div>
        <div className="text-[11px] text-muted">{gt.qml}</div>
      </div>
    </div>
  );
}

function Render({ b }: { b: Block }) {
  if ('p' in b) return <p className="text-sm leading-relaxed text-fg-2">{b.p}</p>;
  if ('list' in b) return <ul className="list-disc space-y-1 pl-5 text-sm text-fg-2">{b.list.map((l) => <li key={l}>{l}</li>)}</ul>;
  if ('tex' in b) return <div className="rounded-lg bg-surface-2 px-3 py-2"><Tex block>{b.tex}</Tex></div>;
  if ('table' in b) return (
    <div className="overflow-x-auto rounded-lg border border-line"><table className="w-full text-xs"><thead className="bg-surface-2 text-left text-muted"><tr>{b.table.head.map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead><tbody>{b.table.rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((c, j) => <td key={j} className="px-3 py-1.5 text-fg-2">{c}</td>)}</tr>)}</tbody></table></div>
  );
  if (b.embed === 'architecture') return <Card className="p-3"><SystemDiagram /></Card>;
  if (b.embed === 'poc') return <Render b={{ table: { head: ['Model', 'Accuracy', 'Sensitivity', 'Specificity', 'ROC-AUC'], rows: POC_ROWS } }} />;
  return <div className="grid gap-3 md:grid-cols-2">{GATES.map((_, i) => <GateCard key={i} i={i} />)}</div>;
}

export default function Docs() {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(DOCS[0].id);
  const shown = useMemo(() => DOCS.filter((d) => !q || JSON.stringify(d).toLowerCase().includes(q.toLowerCase())), [q]);
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id.replace('doc-', ''))), { rootMargin: '-20% 0px -70% 0px' });
    DOCS.forEach((d) => { const el = document.getElementById(`doc-${d.id}`); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [shown]);
  const pdf = async () => {
    const rep = await Report.create('QuantaDx documentation', 'Hybrid Quantum ML Platform for Early Disease Detection');
    DOCS.forEach((d) => {
      rep.heading(d.title);
      d.blocks.forEach((b) => {
        if ('p' in b) rep.paragraph(b.p);
        else if ('list' in b) rep.bullets(b.list);
        else if ('table' in b) rep.table(b.table.head, b.table.rows);
        else if ('tex' in b) rep.paragraph(`[formula] ${b.tex.replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}]/g, '')}`, 8);
        else if (b.embed === 'poc') rep.table(['Model', 'Accuracy', 'Sensitivity', 'Specificity', 'ROC-AUC'], POC_ROWS, [54, 32, 32, 32, 32]);
        else if (b.embed === 'gates') rep.table(['Gate', 'Description', 'Use in QML'], GATES.map((gt) => [gt.name, gt.description, gt.qml]), [18, 82, 82]);
      });
    });
    rep.save('quantadx-documentation.pdf');
  };
  return (
    <div>
      <PageHeader title="Documentation" trace="docs" description="Architecture, D1–D5 modules, metric formulas, statistical tests, the PoC, NISQ limitations and ethics." actions={<Button icon={<FileDown size={14} />} onClick={pdf}>Download as PDF</Button>} />
      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)] lg:overflow-y-auto" data-tour="docs-toc">
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5"><Search size={14} className="text-muted" /><input aria-label="Search documentation" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search docs…" className="h-9 w-full bg-transparent text-sm outline-none" /></div>
          <nav className="space-y-0.5">
            {shown.map((d) => (
              <a key={d.id} href={`#doc-${d.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`doc-${d.id}`)?.scrollIntoView({ behavior: 'smooth' }); }}
                className={cn('relative block rounded-lg px-3 py-1.5 text-sm transition', active === d.id ? 'font-semibold text-classical' : 'text-fg-2 hover:bg-surface-2')}>
                {active === d.id && <motion.span layoutId="doc-active" className="absolute inset-0 rounded-lg bg-tint-blue" />}
                <span className="relative">{d.title}</span>
              </a>
            ))}
          </nav>
        </aside>
        <div className="space-y-10">
          {shown.map((d) => (
            <motion.section key={d.id} id={`doc-${d.id}`} className="scroll-mt-24 space-y-3" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="flex items-center gap-2 font-serif text-2xl font-semibold text-heading">{d.title}{d.tag && <Badge color="var(--purple)">{d.tag}</Badge>}</h2>
              {d.blocks.map((b, i) => <Render key={i} b={b} />)}
            </motion.section>
          ))}
          {!shown.length && <div className="text-sm text-muted">No sections match “{q}”.</div>}
        </div>
      </div>
    </div>
  );
}
