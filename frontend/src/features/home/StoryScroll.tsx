/** Scroll-driven story: a sticky visual morphs through five stages as the user scrolls ("from patient to prediction"). */
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform } from 'framer-motion';
import { Brain, Cpu, Database, Stethoscope, Workflow } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildCircuit } from '@/lib/quantum/circuits';
import { DEFAULT_BANDS } from '@/lib/risk';
import { CountUp, RiskBadge } from '@/components/common/misc';
import { RiskGauge } from '@/components/common/RiskGauge';
import { Bloch } from '@/components/quantum/Bloch';
import { CircuitViewer } from '@/components/quantum/CircuitViewer';
import { cn } from '@/components/common/ui';

const STAGES = [
  { icon: Database, color: 'var(--blue)', title: 'A patient record arrives', text: '30 measurements from a fine-needle aspirate: radius, texture, concavity… noisy, correlated, sometimes missing.' },
  { icon: Workflow, color: 'var(--blue)', title: 'Clean and compress', text: 'Impute, clip outliers, standardise — then PCA folds 30 correlated features into 6 components that fit on 6 qubits.' },
  { icon: Cpu, color: 'var(--purple)', title: 'Encode into qubits', text: 'Each component becomes a rotation angle in [0, π]. The ZZ feature map entangles neighbouring qubits so feature interactions live in the quantum state.' },
  { icon: Brain, color: 'var(--purple)', title: 'Train the hybrid loop', text: 'The QPU evaluates the circuit, a classical optimiser updates θ with parameter-shift gradients, and the loss falls.' },
  { icon: Stethoscope, color: 'var(--green)', title: 'Decide — and explain', text: 'A calibrated probability, a risk band with a recommended action and the top factors in plain language.' },
];

const RAW = [['radius_mean', 17.99, 'mm'], ['texture_mean', 10.38, ''], ['perimeter_mean', 122.8, 'mm'], ['area_mean', 1001, 'mm²'], ['concavity_mean', 0.3001, ''], ['concave_points_worst', 0.2654, ''], ['symmetry_worst', 0.4601, ''], ['fractal_dim_worst', 0.1189, '']] as const;
const ANGLES = [2.41, 0.62, 1.88, 1.12, 2.95, 0.37];

function Visual({ stage }: { stage: number }) {
  const [compressed, setCompressed] = useState(false);
  const [encoded, setEncoded] = useState(false);
  useEffect(() => {
    setCompressed(false);
    setEncoded(false);
    const t1 = setTimeout(() => setCompressed(true), 700);
    const t2 = setTimeout(() => setEncoded(true), 350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [stage]);
  const bars = useMemo(() => Array.from({ length: 30 }, (_, i) => 0.25 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.75), []);
  const circuit = useMemo(() => buildCircuit({ nQubits: 4, encoding: 'zz_feature_map', encodingReps: 1, ansatz: 'real_amplitudes', layers: 1, x: ANGLES.slice(0, 4) }), []);
  switch (stage) {
    case 0:
      return (
        <div className="w-full max-w-md space-y-1.5">
          <div className="mb-2 flex items-center justify-between font-mono text-xs text-muted"><span>PAT-842302</span><span>30 features · 1 missing</span></div>
          {RAW.map(([k, v, u], i) => (
            <motion.div key={k} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-xs">
              <span className="text-muted">{k}</span>
              <span className="tnum font-semibold text-fg">{i === 6 ? <span className="text-danger">NaN</span> : <CountUp value={v as number} format={(x) => (x < 1 ? x.toFixed(4) : x < 100 ? x.toFixed(2) : x.toFixed(0))} />} <span className="text-muted">{u}</span></span>
            </motion.div>
          ))}
        </div>
      );
    case 1:
      return (
        <div className="w-full max-w-md">
          <div className="flex h-56 items-end gap-1">
            {bars.map((h, i) => {
              const keep = i < 6;
              return (
                <motion.div key={i} className="rounded-t" initial={false}
                  animate={{ height: `${(compressed ? (keep ? [0.95, 0.72, 0.55, 0.42, 0.33, 0.27][i] : 0) : h) * 100}%`, flexGrow: compressed ? (keep ? 5 : 0.0001) : 1, backgroundColor: compressed ? 'var(--purple)' : 'var(--line-strong)', opacity: compressed && !keep ? 0 : 1 }}
                  transition={{ duration: 0.9, delay: compressed ? (keep ? 0.3 : i * 0.01) : 0, ease: [0.16, 1, 0.3, 1] }} style={{ flexBasis: 0 }} />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between font-mono text-xs text-muted"><span>{compressed ? 'PC1 … PC6' : '30 raw features'}</span><span>{compressed ? '94.8% variance kept' : 'correlated, unscaled'}</span></div>
        </div>
      );
    case 2:
      return (
        <div className="grid grid-cols-3 gap-2">
          {ANGLES.map((a, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08, type: 'spring' }}>
              <Bloch vector={encoded ? { x: Math.sin(a), y: 0, z: Math.cos(a) } : { x: 0, y: 0, z: 1 }} size={120} compact label={`q${i} ← PC${i + 1}`} sublabel={`RY(${a.toFixed(2)})`} />
            </motion.div>
          ))}
        </div>
      );
    case 3: {
      const pts = Array.from({ length: 40 }, (_, i) => `${i * 9},${110 - 90 * (0.25 + 0.75 * Math.exp(-i / 9)) + Math.sin(i * 1.7) * 3}`).join(' ');
      return (
        <div className="w-full max-w-lg space-y-3">
          <CircuitViewer spec={circuit} mode="build" compact toolbar={false} />
          <div className="rounded-lg border border-line bg-surface p-3">
            <div className="mb-1 flex justify-between text-[11px] text-muted"><span>loss</span><span className="font-mono">θ ← θ − η·∇θ</span></div>
            <svg viewBox="0 0 360 120" className="w-full">
              <motion.polyline points={pts} fill="none" stroke="var(--purple)" strokeWidth={2.5} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, ease: 'easeOut' }} />
            </svg>
          </div>
        </div>
      );
    }
    default:
      return (
        <div className="flex flex-col items-center">
          <RiskGauge value={0.87} bands={DEFAULT_BANDS} threshold={0.5} size={280} />
          <RiskBadge band="high" size="lg" />
          <div className="mt-3 w-full max-w-sm space-y-1.5">
            {['Larger worst concave points raised the risk', 'Higher mean radius raised the risk', 'Lower texture slightly lowered it'].map((t, i) => (
              <motion.div key={t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + i * 0.2 }} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 text-xs text-fg-2 shadow-card">
                <span className={i < 2 ? 'text-danger' : 'text-ok'}>{i < 2 ? '▲' : '▼'}</span>{t}
              </motion.div>
            ))}
          </div>
        </div>
      );
  }
}

export function StoryScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [stage, setStage] = useState(0);
  // Progress bar is driven by a motion value (no React re-render per scroll frame);
  // React state only changes when the stage actually changes.
  const barScale = useTransform(scrollYProgress, [0, 1], [0, 1]);
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const next = Math.min(STAGES.length - 1, Math.floor(p * STAGES.length));
    setStage((s) => (s === next ? s : next));
  });
  return (
    <section ref={ref} className="relative" style={{ height: `${STAGES.length * 75}vh` }} aria-label="From patient to prediction">
      <div className="sticky top-20 grid min-h-[calc(100vh-7rem)] items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-quantum">Scroll · from patient to prediction</div>
          <h2 className="font-serif text-3xl font-semibold text-heading">What happens to one patient</h2>
          <div className="relative mt-6 space-y-2 pl-6">
            <div className="absolute bottom-2 left-2 top-2 w-0.5 rounded bg-line" />
            <motion.div className="absolute bottom-2 left-2 top-2 w-0.5 origin-top rounded bg-gradient-to-b from-[#0070C0] via-[#7B3FA0] to-[#1E9C48]" style={{ scaleY: barScale }} />
            {STAGES.map((s, i) => {
              const Icon = s.icon;
              const active = i === stage;
              return (
                <motion.div key={s.title} animate={{ opacity: active ? 1 : 0.45, x: active ? 4 : 0 }} className={cn('relative rounded-xl p-3 transition-colors', active && 'bg-surface shadow-card')}>
                  <span className="absolute -left-[22px] top-4 h-3 w-3 rounded-full border-2 border-surface" style={{ background: i <= stage ? s.color : 'var(--line-strong)' }} />
                  <div className="flex items-center gap-2 text-sm font-semibold text-fg"><Icon size={16} style={{ color: s.color }} />{s.title}</div>
                  <AnimatePresence initial={false}>
                    {active && <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-1 text-sm text-muted">{s.text}</motion.p>}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
        <div className="relative flex min-h-[420px] items-center justify-center rounded-3xl border border-line bg-surface/70 p-6 shadow-card">
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_50%_40%,rgba(123,63,160,0.12),transparent_60%)]" />
          <>
            <motion.div key={stage} initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -30, scale: 0.96 }} transition={{ duration: 0.4 }} className="relative flex w-full justify-center">
              <Visual stage={stage} />
            </motion.div>
          </>
          <div className="absolute bottom-3 right-4 font-mono text-[10px] text-muted">{stage + 1} / {STAGES.length}</div>
        </div>
      </div>
    </section>
  );
}
