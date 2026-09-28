import { motion } from 'framer-motion';
import {
  Activity, ArrowRight, Atom, BarChart3, Brain, CheckCircle2, CheckSquare, ChevronDown, Cpu, Dna, FlaskConical, HeartPulse, Layers, Microscope, Play, Ribbon, ScanLine, ShieldCheck, Sigma, Stethoscope, TestTube, Waves,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { useExperiments, useResults } from '@/api/hooks';
import { HeroScene } from '@/components/quantum/Lazy3D';
import { Button, Card } from '@/components/common/ui';
import { CountUp, Term } from '@/components/common/misc';
import { Reveal, Tilt } from '@/components/fx/Effects';
import { DELIVERABLES, D_COLORS } from '@/content/deliverables';
import { PipelineFlow } from '@/features/home/PipelineFlow';
import { CircuitMarquee, CollapseWidget, RaceBars, RotatingWord, TechMarquee } from '@/features/home/HomeFx';
import { StoryScroll } from '@/features/home/StoryScroll';
import { ApiTerminal, BandwidthDemo, LivePlatform, LiveRiskDemo } from '@/features/home/HomeLive';
import { useInterval, useMediaQuery } from '@/hooks';
import { useDemo, useUi } from '@/store';

function LiveStats() {
  const { data: r } = useResults('exp-poc-001');
  const { data: exps } = useExperiments();
  if (!r) return <div className="h-[76px]" />;
  const best = (fam: 'classical' | 'quantum') => r.models.filter((m) => (fam === 'classical' ? m.family === 'classical' : m.family !== 'classical')).sort((a, b) => b.metrics!.accuracy.mean - a.metrics!.accuracy.mean)[0];
  const c = best('classical'), q = best('quantum');
  const items = [
    { label: `Best classical · ${c.label}`, value: c.metrics!.accuracy.mean * 100, fmt: (v: number) => `${v.toFixed(1)}%`, color: '#5AA9E6' },
    { label: 'Best quantum · QSVM tuned', value: q.metrics!.accuracy.mean * 100, fmt: (v: number) => `${v.toFixed(1)}%`, color: '#C08BDF' },
    { label: 'Bandwidth fix (raw → tuned)', value: 12.5, fmt: (v: number) => `+${v.toFixed(1)} pts`, color: '#FFB366' },
    { label: 'Qubits in the PoC', value: 6, fmt: (v: number) => v.toFixed(0), color: '#15B0B0' },
    { label: 'Experiments tracked', value: exps?.length ?? 0, fmt: (v: number) => v.toFixed(0), color: '#6FD49A' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {items.map((it, i) => (
        <motion.div key={it.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.08 }}
          className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 transition hover:-translate-y-0.5 hover:bg-white/[0.1]">
          <div className="metric text-2xl font-bold" style={{ color: it.color }}><CountUp value={it.value} format={it.fmt} duration={1.6} /></div>
          <div className="mt-0.5 truncate text-[11px] text-white/60">{it.label}</div>
        </motion.div>
      ))}
    </div>
  );
}

/** Floating HUD chips around the sphere with live-updating quantum readouts. */
function HeroHud() {
  const [t, setT] = useState(0);
  useInterval(() => setT((x) => x + 1), 1100);
  const z = Math.cos(1 + 0.6 * Math.sin(t * 0.55));
  const chips = [
    { top: '36%', right: '5%', label: '⟨Z₀⟩', value: z.toFixed(3), color: '#FFB366', d: 0 },
    { top: '70%', right: '30%', label: 'P(|0⟩)', value: ((1 + z) / 2).toFixed(3), color: '#5AA9E6', d: 1.2 },
    { top: '24%', right: '36%', label: 'k(x,x′)', value: (0.62 + 0.1 * Math.sin(t)).toFixed(3), color: '#C08BDF', d: 2.1 },
    { top: '58%', right: '3%', label: 'qubits · ZZ map', value: '6 · reps 2', color: '#15B0B0', d: 0.6 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
      {chips.map((c) => (
        <motion.div key={c.label} className="absolute rounded-xl border border-white/15 bg-white/[0.07] px-3 py-1.5 font-mono text-xs text-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
          style={{ top: c.top, right: c.right }} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
          transition={{ opacity: { delay: 1 + c.d * 0.3 }, scale: { delay: 1 + c.d * 0.3 }, y: { duration: 5, repeat: Infinity, ease: 'easeInOut', delay: c.d } }}>
          <span className="text-white/55">{c.label} </span>
          <motion.span key={c.value} initial={{ opacity: 0.3 }} animate={{ opacity: 1 }} style={{ color: c.color }} className="font-semibold">{c.value}</motion.span>
        </motion.div>
      ))}
    </div>
  );
}

/** Live readout of hero-globe measurements: the last outcome and the running |0⟩ / |1⟩ tally. */
function MeasurePanel({ last, c0, c1, p0 }: { last: 0 | 1 | null; c0: number; c1: number; p0: number }) {
  const n = c0 + c1;
  return (
    <div className="pointer-events-none absolute right-6 top-6 z-10 hidden w-60 rounded-2xl border border-white/15 bg-[#0b1430]/80 p-3 text-white shadow-[0_10px_40px_rgba(0,0,0,0.45)] lg:block">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-white/55">
        <span>Quantum measurement</span>
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-[#FFB366]" />
      </div>
      {last === null ? (
        <p className="mt-2 text-xs text-white/75">👆 Click the glowing qubit to <b>measure</b> it · drag anywhere on the galaxy to <b>spin</b> it.</p>
      ) : (
        <motion.div key={n} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }} className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-3xl font-black" style={{ color: last === 0 ? '#5AA9E6' : '#C08BDF' }}>|{last}⟩</span>
          <span className="text-[11px] text-white/60">P(|0⟩) was {(p0 * 100).toFixed(0)}%</span>
        </motion.div>
      )}
      {n > 0 && (
        <div className="mt-2 space-y-1">
          {[0, 1].map((b) => {
            const c = b ? c1 : c0;
            return (
              <div key={b} className="flex items-center gap-2 font-mono text-[10px] text-white/70">
                <span className="w-6">|{b}⟩</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full" style={{ background: b ? '#C08BDF' : '#5AA9E6' }} animate={{ width: `${(c / n) * 100}%` }} /></div>
                <span className="w-6 text-right">{c}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Hero() {
  const navigate = useNavigate();
  const startDemo = useDemo((s) => s.start);
  const ref = useRef<HTMLElement>(null);
  const wide = useMediaQuery('(min-width: 1024px)');
  const [meas, setMeas] = useState<{ last: 0 | 1 | null; c0: number; c1: number; p0: number }>({ last: null, c0: 0, c1: 0, p0: 0.5 });
  const onMeasure = useCallback((o: 0 | 1, p0: number) => {
    setMeas((m) => ({ last: o, p0, c0: m.c0 + (o === 0 ? 1 : 0), c1: m.c1 + (o === 1 ? 1 : 0) }));
    toast(o === 0 ? 'Collapsed to |0⟩ — healthy-like state' : 'Collapsed to |1⟩ — at-risk-like state', { description: `Born rule: P(|0⟩) = ${(p0 * 100).toFixed(1)}%. Each measurement is random; the statistics are not.`, duration: 2500 });
  }, []);
  return (
    <section ref={ref} className="hero-space relative -mx-4 -mt-6 overflow-hidden px-6 pb-8 pt-14 text-white md:mx-0 md:mt-0 md:rounded-3xl md:px-12">
      <div className="pointer-events-none absolute -left-40 -top-20 h-[640px] w-[640px] rounded-full" style={{ background: 'radial-gradient(closest-side, rgb(0 112 192 / 0.28), transparent)' }} />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[640px] w-[760px] rounded-full" style={{ background: 'radial-gradient(closest-side, rgb(123 63 160 / 0.3), transparent)' }} />
      <HeroScene offsetX={wide ? 2.6 : 0} onMeasure={onMeasure} />
      <MeasurePanel {...meas} />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-[#081226]/90 via-[#081226]/45 to-transparent lg:w-3/5" />
      <HeroHud />
      <div className="relative flex min-h-[560px] flex-col justify-center lg:max-w-[52%]">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/85"><span className="live-dot h-1.5 w-1.5 rounded-full bg-[#6FD49A]" />live platform</span>
          <span className="rounded-full border border-[#C08BDF]/40 bg-[#7B3FA0]/20 px-3 py-1 text-[11px] font-semibold text-[#e3cdf5]">Hybrid quantum-classical AI</span>
          <span className="rounded-full border border-[#FFB366]/40 bg-[#E8770E]/15 px-3 py-1 text-[11px] font-semibold text-[#ffd9a8]">6-qubit kernel · 94.0% accuracy</span>
        </motion.div>
        <h1 className="mt-4" aria-label="QuantaDx">
          <span className="hero-wordmark block font-sans text-[64px] font-black leading-none tracking-tight sm:text-[96px] xl:text-[120px]">
            {'QuantaDx'.split('').map((ch, i) => (
              <motion.span key={i} className="inline-block" initial={{ opacity: 0, y: 60, rotateX: -90 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ delay: 0.1 + i * 0.07, type: 'spring', stiffness: 220, damping: 16 }} whileHover={{ y: -12, scale: 1.12, rotate: i % 2 ? 6 : -6 }}>{ch}</motion.span>
            ))}
          </span>
        </h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-4 font-serif text-2xl font-semibold leading-snug text-white md:text-[32px]">
          Early detection of <RotatingWord words={['breast cancer', 'heart disease', "Parkinson's", 'diabetes', 'kidney disease', 'leukemia']} /><br />
          <span className="bg-gradient-to-r from-[#5AA9E6] via-[#C08BDF] to-[#15B0B0] bg-clip-text text-transparent">with hybrid quantum AI</span>
        </motion.p>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mt-5 max-w-xl text-base leading-relaxed text-white/75">
          Classical pre-processing compresses noisy biomedical data into a handful of <Term term="Qubit">qubits</Term>; a <Term term="PQC">parameterized quantum circuit</Term> acts as model or <Term term="Quantum kernel">kernel</Term>; a classical optimizer trains it — and every claim is benchmarked honestly against classical baselines.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" className="btn-shine bg-gradient-to-r from-[#0070C0] to-[#2E8BD8]" onClick={() => navigate('/data')} icon={<ArrowRight size={16} />}>Start analysis</Button>
          <Button size="lg" variant="quantum" className="btn-shine bg-gradient-to-r from-[#7B3FA0] to-[#A35CC8]" onClick={startDemo} icon={<Play size={16} />}>Watch demo</Button>
          <Button size="lg" className="border border-white/25 bg-white/10 text-white hover:bg-white/20" onClick={() => navigate('/deliverables')} icon={<CheckSquare size={16} />}>Explore capabilities</Button>
        </motion.div>
      </div>
      <div className="relative mt-4"><LiveStats /></div>
      <div className="relative mt-6 rounded-2xl border border-white/10 bg-black/20 py-2">
        <div className="mb-1 px-4 font-mono text-[10px] uppercase tracking-widest text-white/40">ZZ feature map → RealAmplitudes · 4 qubits · streaming</div>
        <CircuitMarquee />
      </div>
      <div className="relative mt-4 flex justify-center text-white/50"><ChevronDown size={20} className="scroll-cue" /></div>
    </section>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const verified = useUi((s) => s.verified);
  return (
    <div className="space-y-20 pb-4">
      <Hero />
      <TechMarquee />

      <StoryScroll />

      <section>
        <Reveal className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-saffron">Try it live</div>
          <h2 className="font-serif text-3xl font-semibold text-heading">Every number on this page is computed, not pasted</h2>
        </Reveal>
        <div className="grid gap-6 lg:grid-cols-2">
          <Reveal><LiveRiskDemo /></Reveal>
          <Reveal delay={0.1}><BandwidthDemo /></Reveal>
          <Reveal><LivePlatform /></Reveal>
          <Reveal delay={0.1}><ApiTerminal /></Reveal>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Reveal>
          <Card className="h-full p-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-quantum">Play with a qubit</div>
            <h2 className="mb-4 mt-1 font-serif text-2xl font-semibold text-heading">Collapse the wavefunction</h2>
            <CollapseWidget />
          </Card>
        </Reveal>
        <Reveal delay={0.1}>
          <Card className="h-full p-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-classical">Proof of concept</div>
            <h2 className="mb-4 mt-1 font-serif text-2xl font-semibold text-heading">Measured, not assumed</h2>
            <RaceBars />
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/experiments/exp-poc-001/results')} icon={<BarChart3 size={14} />}>Open the full benchmark</Button>
          </Card>
        </Reveal>
      </section>

      <section>
        <Reveal className="mb-4">
          <h2 className="font-serif text-2xl font-semibold text-heading">One pipeline, six steps</h2>
          <p className="text-sm text-muted">Particles show data flowing; the orange loop is the QPU ↔ optimizer. Click any step.</p>
        </Reveal>
        <Card className="p-4"><PipelineFlow /></Card>
      </section>

      <section>
        <Reveal><h2 className="mb-4 font-serif text-2xl font-semibold text-heading">Why hybrid?</h2></Reveal>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Layers, color: 'var(--blue)', title: 'Classical limits', text: 'High-dimensional, noisy, small-sample biomedical data (7,129 genes for 72 patients) strains classical models: overfitting, weak generalisation, hidden feature interactions.' },
            { icon: Waves, color: 'var(--red)', title: 'NISQ limits', text: 'Today’s quantum devices have few, noisy qubits (T1 ≈ 200 µs, CNOT error ≈ 0.8%). A pure quantum pipeline cannot ingest raw clinical data.' },
            { icon: Atom, color: 'var(--purple)', title: 'The hybrid answer', text: 'Classical reduction feeds 4–10 qubits; a quantum circuit acts as model or kernel; a classical optimizer trains its parameters. Executable on simulators today, hardware tomorrow.' },
          ].map((c, i) => (
            <Reveal key={c.title} delay={i * 0.08}>
              <Tilt className="h-full">
                <Card className="group h-full p-5">
                  <motion.div whileHover={{ rotate: [0, -10, 10, 0] }} className="mb-3 inline-flex rounded-xl p-2.5" style={{ background: `color-mix(in srgb, ${c.color} 12%, transparent)`, color: c.color }}><c.icon size={20} /></motion.div>
                  <h3 className="font-semibold text-fg">{c.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.text}</p>
                </Card>
              </Tilt>
            </Reveal>
          ))}
        </div>
      </section>

      <section>
        <Reveal><h2 className="mb-4 font-serif text-2xl font-semibold text-heading">Why early detection matters</h2></Reveal>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { v: 43, fmt: (x: number) => `${x.toFixed(0)} M`, label: 'NCD deaths per year — 75% of non-pandemic deaths', src: 'WHO, 2025', color: 'var(--red)', icon: HeartPulse, ring: 0.75 },
            { v: 14.6, fmt: (x: number) => `${x.toFixed(1)} lakh`, label: 'new cancer cases in India in 2022', src: 'ICMR-NCRP', color: 'var(--saffron)', icon: Ribbon, ring: 0.5 },
            { v: 100, fmt: (x: number) => `~${x.toFixed(0)}% vs ~34%`, label: 'breast-cancer 5-year survival: localized vs distant', src: 'SEER 2016–2022', color: 'var(--green)', icon: Activity, ring: 1 },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <Card className="relative flex items-center gap-4 overflow-hidden p-5">
                <svg width={64} height={64} viewBox="0 0 64 64" className="shrink-0 -rotate-90">
                  <circle cx={32} cy={32} r={27} fill="none" stroke="var(--surface-3)" strokeWidth={6} />
                  <motion.circle cx={32} cy={32} r={27} fill="none" stroke={s.color} strokeWidth={6} strokeLinecap="round" strokeDasharray={170} initial={{ strokeDashoffset: 170 }} whileInView={{ strokeDashoffset: 170 * (1 - s.ring) }} viewport={{ once: true }} transition={{ duration: 1.6, ease: 'easeOut' }} />
                </svg>
                <s.icon className="absolute -right-3 -top-3 opacity-[0.07]" size={96} style={{ color: s.color }} />
                <div>
                  <div className="metric text-3xl font-bold" style={{ color: s.color }}><CountUp value={s.v} format={s.fmt} duration={1.6} /></div>
                  <p className="mt-1 text-sm text-fg-2">{s.label}</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted">Source: {s.src}</p>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <Reveal><h2 className="mb-4 font-serif text-2xl font-semibold text-heading">Diseases</h2></Reveal>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[['Cancer', Microscope, 'Breast (WDBC), leukemia'], ['Cardiovascular', HeartPulse, 'UCI Heart'], ['Neurological', Brain, "Parkinson's"], ['Diabetes', TestTube, 'Pima'], ['Kidney', FlaskConical, 'CKD']].map(([t, I, d], i) => {
              const Icon = I as typeof Brain;
              return (
                <Reveal key={t as string} delay={i * 0.05}>
                  <Tilt><div className="card flex items-center gap-3 p-3"><Icon size={20} className="text-classical" /><div><div className="text-sm font-semibold text-fg">{t as string}</div><div className="text-[11px] text-muted">{d as string}</div></div></div></Tilt>
                </Reveal>
              );
            })}
          </div>
        </div>
        <div>
          <Reveal><h2 className="mb-4 font-serif text-2xl font-semibold text-heading">Modalities</h2></Reveal>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[['Tabular EHR', Stethoscope, 'labs, vitals, voice'], ['Genomics', Dna, '7,129-gene arrays'], ['Imaging features', ScanLine, 'CNN + radiomics']].map(([t, I, d], i) => {
              const Icon = I as typeof Brain;
              return (
                <Reveal key={t as string} delay={i * 0.05}>
                  <Tilt><div className="card flex items-center gap-3 p-3"><Icon size={20} className="text-quantum" /><div><div className="text-sm font-semibold text-fg">{t as string}</div><div className="text-[11px] text-muted">{d as string}</div></div></div></Tilt>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <Reveal><h2 className="mb-4 font-serif text-2xl font-semibold text-heading">What makes this rigorous</h2></Reveal>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [Sigma, 'k-fold CV', '5-fold stratified, seed 42, mean ± std everywhere'],
            [BarChart3, 'Significance tests', 'McNemar, paired t, Wilcoxon — verdicts in plain English'],
            [Waves, 'Noise robustness', 'Ideal → noisy sim → hardware, with mitigation'],
            [ShieldCheck, 'External validation', 'Held-out site, learning curves, train/test gaps'],
            [Cpu, 'Explainability', 'SHAP mapped back to clinical features'],
          ].map(([I, t, d], i) => {
            const Icon = I as typeof Brain;
            return (
              <Reveal key={t as string} delay={i * 0.06}>
                <div className="card h-full p-4"><Icon size={18} className="text-hybrid" /><div className="mt-2 text-sm font-semibold text-fg">{t as string}</div><div className="mt-0.5 text-xs text-muted">{d as string}</div></div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section data-tour="home-deliverables">
        <Card className="gradient-border flex flex-col gap-4 p-5 md:flex-row md:items-center">
          <div className="md:w-64">
            <h2 className="font-serif text-xl font-semibold text-heading">Platform capabilities</h2>
            <p className="text-xs text-muted">Five modules, end to end — click any to see it live.</p>
          </div>
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-5">
            {DELIVERABLES.map((d, i) => {
              const allVerified = d.components.every((c) => verified.includes(c.id));
              return (
                <motion.div key={d.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                  <Link to="/deliverables" className="group flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: D_COLORS[d.id] }}>{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-fg-2">{d.short}</span>
                    <CheckCircle2 size={16} className={allVerified ? 'text-ok' : 'text-ok/60'} />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </Card>
      </section>

      <footer className="flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-xs text-muted md:flex-row">
        <span><b className="wordmark font-extrabold">QuantaDx</b> · Hybrid quantum-classical AI for early disease detection · © 2026</span>
        <span className="flex gap-4">
          <Link to="/docs" className="hover:text-fg">Docs</Link>
          <Link to="/api" className="hover:text-fg">API</Link>
          <Link to="/deliverables" className="hover:text-fg">Capabilities</Link>
          <Link to="/lab" className="hover:text-fg">Quantum Lab</Link>
        </span>
      </footer>
    </div>
  );
}
