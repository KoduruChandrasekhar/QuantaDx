/** D2 system diagram (matches the deck): Data Sources → Classical front-end → QPU ↔ Optimizer → Decision support, plus Platform layer. */
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Drawer } from '@/components/common/ui';
import { useReducedMotion } from '@/hooks';
import { usePipeline } from '@/store';

interface Block { id: string; col: number; title: string; items: string[]; color: string; route: string; inputs: string; outputs: string; detail: string }

const BLOCKS: Block[] = [
  { id: 'sources', col: 0, title: 'Data Sources', color: 'var(--muted)', route: '/data', items: ['EHR / CSV', 'Lab reports', 'Genomics', 'Imaging features', 'Wearables', 'UCI benchmarks'], inputs: 'Hospital systems, uploads', outputs: 'Raw tables (CSV/XLSX), image archives', detail: 'Uploads are parsed in the browser first; PHI-like columns are flagged and can be dropped before anything is sent.' },
  { id: 'frontend', col: 1, title: 'Classical Front-end (CPU)', color: 'var(--blue)', route: '/preprocess', items: ['Cleaning', 'Imputation', 'Outlier handling', 'Normalisation [0, π]', 'Feature selection', 'PCA → n qubits'], inputs: 'Raw features', outputs: 'n bounded angles per patient', detail: 'scikit-learn pipeline fitted on the training split only (leakage guard). Reduces 30 features → 6 components for 6 qubits.' },
  { id: 'qpu', col: 2, title: 'QPU / Simulator', color: 'var(--purple)', route: '/models', items: ['Data encoding U_φ(x)', 'PQC ansatz W(θ)', 'Entangle + measure', 'Quantum kernel'], inputs: 'Angles x, parameters θ', outputs: '⟨Z⟩ expectations / kernel entries', detail: 'PennyLane + Qiskit Aer (statevector, shots, noisy) or IBM Quantum Runtime hardware. Hardware-agnostic by design.' },
  { id: 'optimizer', col: 3, title: 'Classical Optimizer', color: 'var(--saffron)', route: '/models', items: ['COBYLA · SPSA · Adam', 'Parameter-shift gradients', 'Loss on CPU', 'θ update → QPU'], inputs: '⟨Z⟩, loss', outputs: 'Updated θ', detail: 'Closes the variational loop. SPSA needs only 2 circuit evaluations per step — ideal for noisy hardware.' },
  { id: 'decision', col: 4, title: 'Decision Support', color: 'var(--green)', route: '/predict', items: ['Disease probability', 'Risk tiers', 'Threshold tuning', 'SHAP explanations', 'Benchmark vs classical'], inputs: 'Model outputs', outputs: 'Risk band + action + factors', detail: 'Clinician-facing: probability, calibrated risk band, recommended action and plain-language reasons.' },
];

export function SystemDiagram() {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState<Block | null>(null);
  const q = usePipeline((s) => s.quantumConfig);
  const W = 1100, H = 430, colW = 172, gap = (W - 40 - colW * 5) / 4;
  const x = (c: number) => 20 + c * (colW + gap);
  const top = 30, bh = 270;
  const mid = top + bh / 2;
  const flow = `M${x(0) + colW},${mid} L${x(1)},${mid} M${x(1) + colW},${mid} L${x(2)},${mid}`;
  const toDecision = `M${x(2) + colW / 2},${top} C${x(2) + colW / 2},${top - 26} ${x(4) + colW / 2},${top - 26} ${x(4) + colW / 2},${top}`;
  const down = `M${x(2) + colW},${mid - 40} L${x(3)},${mid - 40}`;
  const up = `M${x(3)},${mid + 40} L${x(2) + colW},${mid + 40}`;
  return (
    <div data-tour="arch-diagram">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="System architecture: data sources, classical front-end, QPU with optimizer loop, decision support, platform layer">
        <defs>
          <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" /></marker>
          <filter id="sg" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <path d={flow} stroke="var(--line-strong)" strokeWidth={2} markerEnd="url(#ah)" fill="none" />
        <path d={toDecision} stroke="var(--line-strong)" strokeWidth={2} markerEnd="url(#ah)" fill="none" strokeDasharray="5 4" />
        <path d={down} stroke="var(--saffron)" strokeWidth={2} markerEnd="url(#ah)" fill="none" />
        <path d={up} stroke="var(--purple)" strokeWidth={2} markerEnd="url(#ah)" fill="none" />
        <text x={(x(2) + colW + x(3)) / 2} y={mid - 50} textAnchor="middle" fontSize={9.5} fill="var(--saffron)" fontFamily="JetBrains Mono">⟨Z⟩, loss ↓</text>
        <text x={(x(2) + colW + x(3)) / 2} y={mid + 60} textAnchor="middle" fontSize={9.5} fill="var(--purple)" fontFamily="JetBrains Mono">θ update ↑</text>
        {!reduced && (
          <g>
            {[0, 1, 2, 3].map((k) => <circle key={k} r={4} fill="var(--blue)" filter="url(#sg)"><animateMotion dur="3s" begin={`${k * 0.75}s`} repeatCount="indefinite" path={flow} /></circle>)}
            <circle r={4.5} fill="var(--saffron)" filter="url(#sg)"><animateMotion dur="1.3s" repeatCount="indefinite" path={down} /></circle>
            <circle r={4.5} fill="var(--purple)" filter="url(#sg)"><animateMotion dur="1.3s" begin="0.65s" repeatCount="indefinite" path={up} /></circle>
            {[0, 1].map((k) => <circle key={k} r={4} fill="var(--green)" filter="url(#sg)"><animateMotion dur="2.6s" begin={`${k * 1.3}s`} repeatCount="indefinite" path={toDecision} /></circle>)}
          </g>
        )}
        {BLOCKS.map((b, i) => (
          <motion.g key={b.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} whileHover={{ y: -3 }}
            style={{ cursor: 'pointer' }} onClick={() => setOpen(b)} role="button" tabIndex={0} aria-label={`${b.title}: open details`} onKeyDown={(e) => e.key === 'Enter' && setOpen(b)}>
            <rect x={x(b.col)} y={top} width={colW} height={bh} rx={16} fill={`color-mix(in srgb, ${b.color} 7%, var(--surface))`} stroke={b.color} strokeWidth={1.6} />
            <rect x={x(b.col)} y={top} width={colW} height={36} rx={16} fill={b.color} />
            <rect x={x(b.col)} y={top + 20} width={colW} height={16} fill={b.color} />
            <text x={x(b.col) + colW / 2} y={top + 23} textAnchor="middle" fontSize={12.5} fontWeight={700} fill="#fff">{b.title}</text>
            {b.items.map((it, k) => (
              <g key={it}>
                <rect x={x(b.col) + 12} y={top + 48 + k * 36} width={colW - 24} height={28} rx={8} fill="var(--surface)" stroke="var(--line)" />
                <text x={x(b.col) + colW / 2} y={top + 66 + k * 36} textAnchor="middle" fontSize={11} fill="var(--fg-2)">{it}</text>
              </g>
            ))}
          </motion.g>
        ))}
        <g>
          <rect x={20} y={H - 80} width={W - 40} height={62} rx={14} fill="var(--surface-2)" stroke="var(--line-strong)" strokeDasharray="5 4" />
          <text x={36} y={H - 56} fontSize={11} fontWeight={700} fill="var(--navy)">PLATFORM LAYER</text>
          {['React UI', 'FastAPI (REST + WebSocket)', 'Celery + Redis', 'PostgreSQL + MLflow', 'Docker Compose'].map((t, i, arr) => {
            const bx = 150 + i * ((W - 190) / arr.length);
            return (
              <g key={t}>
                <rect x={bx} y={H - 68} width={(W - 190) / arr.length - 26} height={38} rx={8} fill="var(--surface)" stroke="var(--navy)" strokeOpacity={0.5} />
                <text x={bx + ((W - 190) / arr.length - 26) / 2} y={H - 45} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--fg-2)">{t}</text>
                {i < arr.length - 1 && <text x={bx + (W - 190) / arr.length - 13} y={H - 45} textAnchor="middle" fontSize={12} fill="var(--muted)">⇄</text>}
              </g>
            );
          })}
        </g>
      </svg>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''}>
        {open && (
          <div className="space-y-4 text-sm">
            <p className="text-fg-2">{open.detail}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-surface-2 p-3"><div className="text-[10px] font-semibold uppercase text-muted">Inputs</div><div className="mt-1 text-fg">{open.inputs}</div></div>
              <div className="rounded-lg bg-surface-2 p-3"><div className="text-[10px] font-semibold uppercase text-muted">Outputs</div><div className="mt-1 text-fg">{open.outputs}</div></div>
            </div>
            <div className="rounded-lg border border-line p-3">
              <div className="text-[10px] font-semibold uppercase text-muted">Current configuration</div>
              <pre className="mt-1 overflow-x-auto font-mono text-[11px] text-fg-2">{open.id === 'qpu' || open.id === 'optimizer' ? JSON.stringify({ encoding: q.encoding, reps: q.encodingReps, ansatz: q.ansatz, layers: q.layers, optimizer: q.optimizer, gradient: q.gradient, backend: q.execution.backend }, null, 2) : open.items.join('\n')}</pre>
            </div>
            <Link to={open.route} className="inline-flex items-center rounded-lg bg-classical px-4 py-2 text-sm font-medium text-white">Open {open.title} →</Link>
          </div>
        )}
      </Drawer>
    </div>
  );
}
