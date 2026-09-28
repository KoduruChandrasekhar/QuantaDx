/** Home "try it live" showpieces: live risk predictor, bandwidth demo, live platform activity, animated API terminal. */
import { motion } from 'framer-motion';
import { Activity, Pause, Play, Terminal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/endpoints';
import { useExperiments } from '@/api/hooks';
import { Button, Card, CardHeader, Progress, Slider } from '@/components/common/ui';
import { LiveDot, RiskBadge } from '@/components/common/misc';
import { RiskGauge } from '@/components/common/RiskGauge';
import { KernelHeatmap } from '@/components/quantum/Kernel';
import { LiveTicker } from '@/features/dashboard/HeroBanner';
import { useDebounced, useReducedMotion } from '@/hooks';
import { fidelityKernel, offDiagonal, variance, CONCENTRATION_VAR_THRESHOLD } from '@/lib/quantum/kernel';
import { gaussian, mulberry32 } from '@/lib/prng';
import { BAND_META } from '@/lib/risk';
import { countdown } from '@/lib/format';
import { usePipeline } from '@/store';
import type { Prediction } from '@/types/api';

const KNOBS = [
  { key: 'radius_worst', label: 'Tumour radius (worst)', unit: 'mm', min: 8, max: 32, step: 0.1 },
  { key: 'concave_points_worst', label: 'Concave points (worst)', unit: '', min: 0, max: 0.29, step: 0.001 },
  { key: 'texture_mean', label: 'Texture (mean)', unit: 'SD gray', min: 9, max: 36, step: 0.1 },
] as const;

/** Drag three clinical features; the gauge re-scores through the same POST /predict the hospital API uses. */
export function LiveRiskDemo() {
  const bands = usePipeline((s) => s.riskBands);
  const [base, setBase] = useState<Record<string, number> | null>(null);
  const [vals, setVals] = useState<Record<string, number>>({ radius_worst: 21, concave_points_worst: 0.18, texture_mean: 21 });
  const [pred, setPred] = useState<Prediction | null>(null);
  const debounced = useDebounced(vals, 180);
  useEffect(() => {
    api.examples('wdbc').then((e) => setBase(e.healthy)).catch(() => setBase({}));
  }, []);
  useEffect(() => {
    if (!base) return;
    let alive = true;
    api.predict({ datasetId: 'wdbc', features: { ...base, ...debounced }, threshold: 0.5, bands }).then((p) => alive && setPred(p)).catch(() => undefined);
    return () => { alive = false; };
  }, [base, debounced, bands]);
  const preset = (kind: 'low' | 'high') => setVals(kind === 'low' ? { radius_worst: 13, concave_points_worst: 0.07, texture_mean: 17 } : { radius_worst: 26, concave_points_worst: 0.24, texture_mean: 27 });
  return (
    <Card className="h-full">
      <CardHeader title="Live risk predictor" subtitle="Drag a feature — POST /predict re-scores instantly" icon={<Activity size={16} />} actions={<><Button size="sm" variant="ghost" onClick={() => preset('low')}>Low risk</Button><Button size="sm" variant="ghost" onClick={() => preset('high')}>High risk</Button></>} />
      <div className="grid items-center gap-4 p-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          {KNOBS.map((k) => (
            <Slider key={k.key} label={`${k.label}${k.unit ? ` (${k.unit})` : ''}`} value={vals[k.key]} min={k.min} max={k.max} step={k.step} onChange={(v) => setVals((s) => ({ ...s, [k.key]: v }))} format={(v) => (k.max < 1 ? v.toFixed(3) : v.toFixed(1))} accent={pred?.riskBand ? BAND_META[pred.riskBand].color : 'var(--blue)'} />
          ))}
          {pred && <motion.p key={pred.topFactors[0]?.text} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-fg-2"><span className={pred.topFactors[0]?.contribution >= 0 ? 'text-danger' : 'text-ok'}>{pred.topFactors[0]?.contribution >= 0 ? '▲' : '▼'}</span> {pred.topFactors[0]?.text}</motion.p>}
        </div>
        <div className="flex flex-col items-center">
          <RiskGauge value={pred?.probability ?? 0} bands={bands} threshold={0.5} size={220} />
          {pred?.riskBand && <RiskBadge band={pred.riskBand} />}
          <span className="mt-1 text-[10px] text-muted">{pred ? `${pred.modelLabel} · deployed` : 'scoring…'}</span>
        </div>
      </div>
    </Card>
  );
}

/** Tiny in-browser kernel demo: two patient clusters, 4 qubits — watch concentration disappear as bandwidth shrinks. */
export function BandwidthDemo() {
  const reduced = useReducedMotion();
  const [bw, setBw] = useState(1);
  const [playing, setPlaying] = useState(!reduced);
  const data = useMemo(() => {
    const r = mulberry32(8);
    const xs: number[][] = [], ys: number[] = [];
    for (let i = 0; i < 20; i++) {
      const y = i < 10 ? 0 : 1;
      xs.push(Array.from({ length: 4 }, (_, j) => Math.min(Math.PI, Math.max(0, (y ? 2.2 : 0.9) + (j % 2 ? 0.3 : -0.2) * (y ? 1 : -1) + gaussian(r) * 0.35))));
      ys.push(y);
    }
    return { xs, ys };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setBw((b) => (b <= 0.12 ? 1 : Number((b - 0.04).toFixed(2)))), 220);
    return () => clearInterval(id);
  }, [playing]);
  const K = useMemo(() => fidelityKernel(data.xs, 'zz_feature_map', bw, 2), [data, bw]);
  const v = variance(offDiagonal(K));
  const concentrated = v < CONCENTRATION_VAR_THRESHOLD;
  return (
    <Card className="h-full">
      <CardHeader title="Bandwidth beats kernel concentration" subtitle="20 patients · 4-qubit ZZ kernel · computed live in your browser" actions={<Button size="sm" variant="ghost" icon={playing ? <Pause size={13} /> : <Play size={13} />} onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Sweep'}</Button>} />
      <div className="grid items-center gap-4 p-4 sm:grid-cols-[auto_1fr]">
        <KernelHeatmap matrix={K} labels={data.ys} sorted size={190} compact />
        <div className="space-y-3">
          <Slider label="Bandwidth b" value={bw} min={0.1} max={1} step={0.01} onChange={(x) => { setPlaying(false); setBw(x); }} format={(x) => x.toFixed(2)} accent="var(--purple)" />
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-surface-2 p-2"><div className="text-[10px] text-muted">off-diag variance</div><div className={`tnum font-mono text-sm font-bold ${concentrated ? 'text-saffron' : 'text-ok'}`}>{v.toFixed(4)}</div></div>
            <div className="rounded-lg bg-surface-2 p-2"><div className="text-[10px] text-muted">state</div><div className={`text-sm font-bold ${concentrated ? 'text-saffron' : 'text-ok'}`}>{concentrated ? 'concentrated' : 'separable'}</div></div>
          </div>
          <p className="text-xs text-muted">{concentrated ? 'At large bandwidth every patient looks orthogonal to every other — the kernel is almost the identity.' : 'Two class blocks appear: same-class patients look alike. This is why tuned QSVM reached 94.0% vs 81.5%.'}</p>
        </div>
      </div>
    </Card>
  );
}

export function LivePlatform() {
  const { data: exps } = useExperiments(true);
  const running = exps?.filter((e) => e.status === 'running' || e.status === 'queued') ?? [];
  return (
    <Card className="h-full">
      <CardHeader title="Live platform activity" subtitle="Real jobs streaming from the training engine" icon={<LiveDot color="var(--green)" />} actions={<Link to="/dashboard" className="text-xs font-medium text-classical hover:underline">Dashboard →</Link>} />
      <div className="space-y-3 p-4">
        {running.length === 0 && <div className="text-sm text-muted">No jobs running — start one in Model Studio.</div>}
        {running.slice(0, 2).map((e) => (
          <div key={e.id} className="rounded-lg border border-line p-3">
            <div className="mb-2 flex items-center justify-between text-xs"><Link to={`/experiments/${e.id}/train`} className="font-semibold text-fg hover:text-classical">{e.name}</Link><span className="text-muted">{e.backend}</span></div>
            {e.models.map((m) => (
              <div key={m.modelId} className="mb-1.5 flex items-center gap-2 text-[11px]">
                <span className="w-32 truncate text-fg-2">{m.label}</span>
                <Progress className="flex-1" value={m.status === 'done' ? 1 : m.progress} striped={m.status === 'running'} color={m.family === 'classical' ? 'var(--blue)' : 'var(--purple)'} />
                <span className="tnum w-14 text-right text-muted">{m.status === 'done' ? 'done' : m.status === 'queued' ? 'queued' : countdown(m.etaSec ?? 0)}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="rounded-lg bg-[#0b1220] p-3"><LiveTicker /></div>
      </div>
    </Card>
  );
}

const SCRIPT = [
  { t: '$ curl -X POST https://api.quantadx.in/predict \\', c: '#c3cfdf' },
  { t: '    -H "X-API-Key: $QDX_KEY" -d @patient.json', c: '#c3cfdf' },
  { t: '{', c: '#6FD49A' },
  { t: '  "probability": 0.912,', c: '#6FD49A' },
  { t: '  "riskBand": "high",', c: '#FFB366' },
  { t: '  "uncertainty": { "lower": 0.874, "upper": 0.951 },', c: '#6FD49A' },
  { t: '  "topFactors": ["concave points (worst) ▲", "radius (worst) ▲"],', c: '#C08BDF' },
  { t: '  "backend": "Aer statevector · QSVM bw 0.2"', c: '#6FD49A' },
  { t: '}', c: '#6FD49A' },
];

export function ApiTerminal() {
  const reduced = useReducedMotion();
  const total = SCRIPT.reduce((s, l) => s + l.t.length, 0);
  const [n, setN] = useState(reduced ? total : 0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setN((x) => (x >= total + 60 ? 0 : x + 3)), 30);
    return () => clearInterval(id);
  }, [reduced, total]);
  let left = n;
  return (
    <Card className="h-full overflow-hidden">
      <CardHeader title="Hospital integration" subtitle="Same prediction over REST — see /api" icon={<Terminal size={16} />} actions={<Link to="/api" className="text-xs font-medium text-classical hover:underline">Try it →</Link>} />
      <div className="h-[250px] bg-[#0b1220] p-4 font-mono text-[11.5px] leading-relaxed">
        <div className="mb-2 flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" /></div>
        {SCRIPT.map((l, i) => {
          const shown = l.t.slice(0, Math.max(0, left));
          left -= l.t.length;
          if (!shown) return null;
          return <div key={i} style={{ color: l.c }} className="whitespace-pre">{shown}{left < 0 && left > -l.t.length && <span className="live-dot ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 bg-[#c3cfdf]" />}</div>;
        })}
      </div>
    </Card>
  );
}
