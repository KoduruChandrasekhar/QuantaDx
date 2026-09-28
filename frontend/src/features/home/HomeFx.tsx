/** Home-page showpieces: rotating headline, flowing circuit marquee, tech marquee, wavefunction-collapse toy, racing benchmark bars. */
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { Dices, RotateCcw, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildCircuit } from '@/lib/quantum/circuits';
import { mulberry32 } from '@/lib/prng';
import { gateColor } from '@/content/gates';
import { useReducedMotion } from '@/hooks';
import { Button, Slider } from '@/components/common/ui';
import { CountUp } from '@/components/common/misc';
import { Bloch } from '@/components/quantum/Bloch';

const WORD_COLORS = ['#FFB366', '#F28FB0', '#C08BDF', '#6FD49A', '#5AA9E6', '#15B0B0'];

export function RotatingWord({ words, className }: { words: string[]; className?: string }) {
  const [i, setI] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setI((x) => (x + 1) % words.length), 2400);
    return () => clearInterval(id);
  }, [words.length, reduced]);
  const color = WORD_COLORS[i % WORD_COLORS.length];
  // Pure CSS word swap (remount by key): cheap, and the word is always fully visible between swaps.
  return (
    <span className={`relative inline-flex overflow-hidden align-bottom ${className ?? ''}`}>
      <span key={words[i]} className="word-in inline-block whitespace-nowrap" style={{ color, textShadow: `0 0 24px ${color}55` }}>{words[i]}</span>
    </span>
  );
}

/** An endless band of a real ZZ-feature-map + RealAmplitudes circuit flowing past a "readout window". */
export function CircuitMarquee() {
  const spec = useMemo(() => buildCircuit({ nQubits: 4, encoding: 'zz_feature_map', encodingReps: 2, ansatz: 'real_amplitudes', layers: 3, measure: false, qasm: false }), []);
  const cols = spec.depth;
  const COL = 34, ROW = 26;
  const W = cols * COL + 20;
  const H = 4 * ROW + 8;
  const band = (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
      {[0, 1, 2, 3].map((q) => <line key={q} x1={0} x2={W} y1={14 + q * ROW} y2={14 + q * ROW} stroke="rgba(255,255,255,0.18)" />)}
      {spec.ops.map((g) => {
        const x = 10 + g.layer * COL + COL / 2;
        const c = gateColor(g.name);
        if (g.wires.length > 1) {
          const [a, b] = g.wires;
          return (
            <g key={g.id}>
              <line x1={x} x2={x} y1={14 + a * ROW} y2={14 + b * ROW} stroke="#9cc3f0" strokeWidth={1.5} />
              <circle cx={x} cy={14 + a * ROW} r={3.5} fill="#9cc3f0" />
              <circle cx={x} cy={14 + b * ROW} r={7} fill="none" stroke="#9cc3f0" strokeWidth={1.5} />
              <path d={`M${x - 7},${14 + b * ROW}H${x + 7}M${x},${14 + b * ROW - 7}V${14 + b * ROW + 7}`} stroke="#9cc3f0" strokeWidth={1.5} />
            </g>
          );
        }
        const y = 14 + g.wires[0] * ROW;
        return (
          <g key={g.id}>
            <rect x={x - 12} y={y - 10} width={24} height={20} rx={5} fill={g.role === 'encoding' ? 'transparent' : c} stroke={c} strokeWidth={1.5} />
            <text x={x} y={y + 3.5} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={g.role === 'encoding' ? c : '#fff'} fontFamily="JetBrains Mono">{g.name}</text>
          </g>
        );
      })}
    </svg>
  );
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]" aria-hidden>
      <div className="marquee flex w-max" style={{ ['--marquee-dur' as string]: `${cols * 0.9}s` }}>
        {band}
        {band}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-16 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#E8770E]/25 to-transparent" />
    </div>
  );
}

export function TechMarquee() {
  const items = ['Qiskit', 'PennyLane', 'IBM Quantum', 'Qiskit Aer', 'scikit-learn', 'XGBoost', 'PyTorch', 'SHAP', 'MLflow', 'FastAPI', 'Celery', 'Redis', 'PostgreSQL', 'Docker', 'React', 'Three.js'];
  const row = items.map((t) => (
    <span key={t} className="mx-2 inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-4 py-1.5 text-sm font-medium text-fg-2">
      <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-[#0070C0] to-[#7B3FA0]" />{t}
    </span>
  ));
  return (
    <div className="relative overflow-hidden py-1 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]" aria-label="Technology stack">
      <div className="marquee flex w-max" style={{ ['--marquee-dur' as string]: '38s' }}>{row}{row}</div>
    </div>
  );
}

/** Interactive toy: set θ, φ, then measure — watch the state collapse and the histogram converge to cos²(θ/2). */
export function CollapseWidget() {
  const [theta, setTheta] = useState(Math.PI / 2);
  const [phi, setPhi] = useState(Math.PI / 4);
  const [collapsed, setCollapsed] = useState<0 | 1 | null>(null);
  const [counts, setCounts] = useState<[number, number]>([0, 0]);
  const [flash, setFlash] = useState(0);
  const rand = useRef(mulberry32(123));
  const p0 = Math.cos(theta / 2) ** 2;
  const vec = collapsed === null ? { x: Math.sin(theta) * Math.cos(phi), y: Math.sin(theta) * Math.sin(phi), z: Math.cos(theta) } : { x: 0, y: 0, z: collapsed === 0 ? 1 : -1 };
  const measure = (n = 1) => {
    let c0 = 0, last: 0 | 1 = 0;
    for (let i = 0; i < n; i++) {
      last = rand.current() < p0 ? 0 : 1;
      if (last === 0) c0++;
    }
    setCounts(([a, b]) => [a + c0, b + n - c0]);
    setCollapsed(last);
    setFlash((f) => f + 1);
  };
  const total = counts[0] + counts[1];
  return (
    <div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
      <div className="relative">
        <AnimatePresence>
          <motion.div key={flash} className="pointer-events-none absolute inset-0 m-auto rounded-full border-2 border-saffron" style={{ width: 120, height: 120 }}
            initial={{ scale: 0.3, opacity: flash ? 0.9 : 0 }} animate={{ scale: 2, opacity: 0 }} transition={{ duration: 0.7 }} />
        </AnimatePresence>
        <Bloch vector={vec} size={230} readout trail />
      </div>
      <div className="space-y-4">
        <div className="font-mono text-sm text-fg-2">
          |ψ⟩ = <span className="text-classical">{Math.cos(theta / 2).toFixed(3)}</span>|0⟩ + e<sup>i{(phi / Math.PI).toFixed(2)}π</sup> <span className="text-quantum">{Math.sin(theta / 2).toFixed(3)}</span>|1⟩
        </div>
        <Slider label="θ (polar angle)" value={theta} min={0} max={Math.PI} step={0.01} onChange={(v) => { setTheta(v); setCollapsed(null); }} format={(v) => `${(v / Math.PI).toFixed(2)}π`} accent="var(--purple)" />
        <Slider label="φ (phase)" value={phi} min={0} max={2 * Math.PI} step={0.01} onChange={(v) => { setPhi(v); setCollapsed(null); }} format={(v) => `${(v / Math.PI).toFixed(2)}π`} accent="var(--teal)" />
        <div className="flex flex-wrap gap-2">
          <Button variant="quantum" icon={<Zap size={14} />} onClick={() => measure(1)}>Measure</Button>
          <Button variant="outline" icon={<Dices size={14} />} onClick={() => measure(100)}>Measure ×100</Button>
          <Button variant="ghost" icon={<RotateCcw size={14} />} onClick={() => { setCounts([0, 0]); setCollapsed(null); }}>Reset</Button>
        </div>
        <div className="space-y-1.5">
          {[0, 1].map((b) => {
            const emp = total ? counts[b] / total : 0;
            const ideal = b === 0 ? p0 : 1 - p0;
            return (
              <div key={b} className="flex items-center gap-2 text-xs">
                <span className="w-8 font-mono font-semibold text-fg">|{b}⟩</span>
                <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-surface-3">
                  <motion.div className="h-full rounded-md" style={{ background: b ? 'var(--purple)' : 'var(--blue)' }} animate={{ width: `${emp * 100}%` }} transition={{ type: 'spring', stiffness: 160, damping: 20 }} />
                  <motion.div className="absolute inset-y-0 w-0.5 bg-saffron" animate={{ left: `${ideal * 100}%` }} />
                </div>
                <span className="tnum w-24 text-right text-muted">{counts[b]} · {(emp * 100).toFixed(0)}%</span>
              </div>
            );
          })}
          <p className="text-[11px] text-muted">Orange tick = Born-rule prediction cos²(θ/2) = {(p0 * 100).toFixed(1)}%. {total} shots so far — the histogram converges as 1/√shots.</p>
        </div>
      </div>
    </div>
  );
}

/** Racing bars: the honest PoC benchmark, animated on scroll. */
export function RaceBars() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const rows = [
    { label: 'Logistic Regression', v: 0.961, c: 'var(--blue)' },
    { label: 'SVM (RBF)', v: 0.961, c: '#2E8BD8' },
    { label: 'Random Forest', v: 0.953, c: '#0A4F8A' },
    { label: 'QSVM · raw ZZ kernel', v: 0.808, c: '#C08BDF' },
    { label: 'QSVM · bandwidth-tuned', v: 0.94, c: 'var(--purple)' },
  ];
  const lo = 0.75;
  return (
    <div ref={ref} className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-48 shrink-0 truncate text-sm text-fg-2">{r.label}</span>
          <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-surface-3">
            <motion.div className="flex h-full items-center justify-end rounded-lg pr-2" style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${r.c} 55%, transparent), ${r.c})` }}
              initial={{ width: 0 }} animate={inView ? { width: `${((r.v - lo) / (1 - lo)) * 100}%` } : {}} transition={{ delay: 0.15 + i * 0.12, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}>
              <span className="metric text-xs font-bold text-white">{inView && <CountUp value={r.v * 100} format={(v) => `${v.toFixed(1)}%`} duration={1.2} />}</span>
            </motion.div>
          </div>
        </div>
      ))}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 1.1 }} className="flex flex-wrap items-center gap-2 pt-1 text-xs">
        <span className="rounded-full bg-tint-saffron px-2.5 py-1 font-semibold text-saffron">Bandwidth tuning: 81.5% → 94.0%</span>
        <span className="rounded-full bg-tint-purple px-2.5 py-1 font-semibold text-quantum">Specificity tied at 96.9%</span>
        <span className="rounded-full bg-surface-3 px-2.5 py-1 font-semibold text-fg-2">Sensitivity ▼ 5.6 pts — next: threshold tuning + hybrid models</span>
      </motion.div>
      <p className="text-[11px] text-muted">Wisconsin Breast Cancer · 569 patients · PCA → 6 qubits · 5-fold stratified CV (seed 42). Quantum advantage is measured, not assumed.</p>
    </div>
  );
}
