import { motion } from 'framer-motion';
import { ArrowUpRight, BadgeCheck, CheckCircle2, Circle, FileDown, Play, Target } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useResults } from '@/api/hooks';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Tip } from '@/components/common/ui';
import { CountUp } from '@/components/common/misc';
import { DELIVERABLES, EXPECTED_SOLUTION, OBJECTIVES, ROUTE_TRACE } from '@/content/deliverables';
import { bestOf } from '@/features/results/O3Scorecard';
import { deltaPts } from '@/lib/format';
import { Report } from '@/lib/report';
import { useDemo, useUi } from '@/store';

const PAGES: { key: keyof typeof ROUTE_TRACE; label: string }[] = [
  { key: 'home', label: 'Home' }, { key: 'dashboard', label: 'Dashboard' }, { key: 'data', label: 'Data' }, { key: 'preprocess', label: 'Pre-process' }, { key: 'architecture', label: 'Architecture' },
  { key: 'models', label: 'Models' }, { key: 'train', label: 'Train' }, { key: 'results', label: 'Results' }, { key: 'explain', label: 'Explain' }, { key: 'predict', label: 'Predict' },
  { key: 'experiments', label: 'Registry' }, { key: 'api', label: 'API' }, { key: 'lab', label: 'Lab' }, { key: 'settings', label: 'Settings' },
];

export default function Deliverables() {
  const navigate = useNavigate();
  const verified = useUi((s) => s.verified);
  const verify = useUi((s) => s.verify);
  const startDemo = useDemo((s) => s.start);
  const { data: poc } = useResults('exp-poc-001');
  const total = DELIVERABLES.reduce((s, d) => s + d.components.length, 0);
  const done = DELIVERABLES.reduce((s, d) => s + d.components.filter((c) => verified.includes(c.id)).length, 0);
  const o3 = poc ? bestOf(poc) : null;
  const o3Text = o3?.q && o3.c ? `${o3.q.label} vs ${o3.c.label}: accuracy ${deltaPts(o3.q.metrics!.accuracy.mean - o3.c.metrics!.accuracy.mean)}, sensitivity ${deltaPts(o3.q.metrics!.sensitivity.mean - o3.c.metrics!.sensitivity.mean)}, specificity ${deltaPts(o3.q.metrics!.specificity.mean - o3.c.metrics!.specificity.mean)} — not claimed as improved.` : 'loading…';

  const pdf = async () => {
    const rep = await Report.create('QuantaDx capability report', 'Hybrid quantum-classical AI for early disease detection');
    DELIVERABLES.forEach((d) => {
      rep.heading(`${d.short} · ${d.name}`);
      rep.paragraph(d.description);
      rep.table(['Key component', 'Page', 'Implementing component', 'Status'], d.components.map((c) => [c.name, c.route, c.component, verified.includes(c.id) ? 'verified' : 'implemented']), [50, 42, 62, 28]);
    });
    rep.heading('Objectives O1–O6');
    rep.table(['ID', 'How it is met / measured'], OBJECTIVES.map((o) => [o.id, o.id === 'O3' ? `${o.how} Current: ${o3Text}` : o.how]), [14, 168]);
    rep.heading('End-to-end solution checklist');
    rep.bullets(EXPECTED_SOLUTION.map((e) => `✓ ${e.item} — ${e.route}`));
    rep.save('quantadx-compliance-report.pdf');
  };

  return (
    <div data-tour="deliverables-page">
      <PageHeader title="Platform capabilities" trace="deliverables" description="Everything QuantaDx does, module by module — each capability links to the live screen that implements it." actions={
        <>
          <Button variant="quantum" icon={<Play size={14} />} onClick={() => { navigate('/'); startDemo(); }}>Verify via guided demo</Button>
          <Button variant="outline" icon={<BadgeCheck size={14} />} onClick={() => verify(DELIVERABLES.flatMap((d) => d.components.map((c) => c.id)))}>Mark all verified</Button>
          <Button icon={<FileDown size={14} />} onClick={pdf}>Compliance report (PDF)</Button>
        </>
      } />
      <Card className="gradient-border mb-6 flex flex-wrap items-center gap-6 rounded-2xl p-5">
        <div className="relative h-28 w-28">
          <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90"><circle cx={60} cy={60} r={50} fill="none" stroke="var(--surface-3)" strokeWidth={10} />
            <motion.circle cx={60} cy={60} r={50} fill="none" stroke="url(#dg)" strokeWidth={10} strokeLinecap="round" strokeDasharray={314} animate={{ strokeDashoffset: 314 * (1 - done / total) }} transition={{ type: 'spring', stiffness: 60, damping: 15 }} />
            <defs><linearGradient id="dg"><stop offset="0" stopColor="#1E9C48" /><stop offset="1" stopColor="#0E8C8C" /></linearGradient></defs></svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="metric text-2xl font-bold text-ok"><CountUp value={done} /></span><span className="text-[10px] text-muted">of {total} verified</span></div>
        </div>
        <div className="flex-1">
          <h2 className="font-serif text-xl font-semibold text-heading">All {total} capabilities are live</h2>
          <p className="mt-1 text-sm text-muted">Items turn <b className="text-ok">verified</b> as the guided demo walks through them (or click “Show me” to inspect any one yourself).</p>
          <div className="mt-3 flex flex-wrap gap-2">{DELIVERABLES.map((d) => <Badge key={d.id} solid color={d.color}>{d.short} · {d.components.filter((c) => verified.includes(c.id)).length}/{d.components.length}</Badge>)}</div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {DELIVERABLES.map((d, i) => (
          <motion.div key={d.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className={i === 4 ? 'lg:col-span-2' : ''}>
            <Card className="h-full overflow-hidden">
              <div className="flex items-start gap-3 border-b border-line p-4" style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${d.color} 12%, var(--surface)), var(--surface))` }}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-card" style={{ background: d.color }}>{i + 1}</span>
                <div><h3 className="font-semibold text-fg">{d.name}</h3><p className="text-xs text-muted">{d.description}</p></div>
              </div>
              <ul className="divide-y divide-line">
                {d.components.map((c) => {
                  const v = verified.includes(c.id);
                  return (
                    <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                      <motion.span key={String(v)} initial={{ scale: v ? 0.3 : 1, rotate: v ? -90 : 0 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }}>
                        {v ? <CheckCircle2 size={18} className="text-ok" /> : <Tip text="Implemented — not yet visited in this session"><span><Circle size={18} className="text-ok/50" /></span></Tip>}
                      </motion.span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-fg">{c.name}</div>
                        <div className="truncate font-mono text-[10px] text-muted">{c.route} · {c.component}</div>
                      </div>
                      {v && <Badge color="var(--green)">verified</Badge>}
                      <Button size="sm" variant="outline" icon={<ArrowUpRight size={13} />} onClick={() => { verify([c.id]); navigate(`${c.route}?spotlight=${c.tourId}`); }}>Show me</Button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader title="Objectives O1–O6 × pages" subtitle="✓ = the page contributes to the objective" icon={<Target size={16} />} />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface-2 text-muted"><tr><th className="px-3 py-2 text-left">Objective</th>{PAGES.map((p) => <th key={p.key} className="px-1.5 py-2 font-medium">{p.label}</th>)}</tr></thead>
            <tbody>
              {OBJECTIVES.map((o, i) => (
                <tr key={o.id} className="border-t border-line align-top">
                  <td className="max-w-md px-3 py-2.5">
                    <div className="font-semibold text-fg">{o.id} · <span className="font-normal text-fg-2">{o.text}</span></div>
                    <div className="mt-1 text-muted">{o.how}</div>
                    {o.id === 'O3' && <Link to="/experiments/exp-poc-001/results?spotlight=results-o3" className="mt-1 inline-flex items-center gap-1 font-semibold text-classical">Live O3 scorecard <ArrowUpRight size={11} /></Link>}
                    {o.id === 'O3' && <div className="mt-1 rounded bg-tint-saffron px-2 py-1 text-fg-2">Current honest result: {o3Text}</div>}
                  </td>
                  {PAGES.map((p, j) => (
                    <td key={p.key} className="px-1.5 py-2.5 text-center">
                      {ROUTE_TRACE[p.key].o.includes(o.id) && <motion.span initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: (i * PAGES.length + j) * 0.008, type: 'spring' }} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-tint-green text-ok">✓</motion.span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="End-to-end solution" subtitle="From raw data to a decision a clinician can act on" />
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXPECTED_SOLUTION.map((e, i) => (
            <motion.button key={e.item} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} onClick={() => navigate(`${e.route}?spotlight=${e.tourId}`)}
              className="flex items-center gap-2 rounded-xl border border-line p-3 text-left text-sm transition hover:-translate-y-0.5 hover:border-ok hover:shadow-card">
              <CheckCircle2 size={18} className="shrink-0 text-ok" /><span className="flex-1 text-fg">{e.item}</span><ArrowUpRight size={14} className="text-muted" />
            </motion.button>
          ))}
        </div>
      </Card>
    </div>
  );
}
