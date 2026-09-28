/** "Follow one patient": raw → cleaned → scaled → PCA → angles → encoded state → circuit → ⟨Z₀⟩ → probability → risk band. */
import { motion } from 'framer-motion';
import { Loader2, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { PreprocessPreview } from '@/types/api';
import { buildCircuit } from '@/lib/quantum/circuits';
import { encodeAll, trainTinyVqc, vqcProbability, type TinyVqc } from '@/lib/quantum/tinyVqc';
import { assignBand, BAND_META } from '@/lib/risk';
import { usePipeline } from '@/store';
import { useReducedMotion } from '@/hooks';
import { Button, Card, Select, cn } from '@/components/common/ui';
import { RiskBadge, Tex } from '@/components/common/misc';
import { BlochGrid } from '@/components/quantum/Bloch';
import { CircuitViewer } from '@/components/quantum/CircuitViewer';

const HOPS = ['Raw record', 'Cleaned', 'Scaled', 'PCA', 'Angles', 'Encoded state', 'Circuit', '⟨Z₀⟩', 'Probability', 'Risk band'];
let cached: TinyVqc | null = null;

export function FollowPatient({ sample, featureLabels, autoPlay }: { sample: PreprocessPreview['encodedSample']; featureLabels: string[]; autoPlay?: boolean }) {
  const reduced = useReducedMotion();
  const bands = usePipeline((s) => s.riskBands);
  const [hop, setHop] = useState(0);
  const [playing, setPlaying] = useState(!!autoPlay);
  const [patient, setPatient] = useState(() => Math.max(0, sample.y.findIndex((v) => v === 1)));
  const [model, setModel] = useState<TinyVqc | null>(cached);
  const [trainIter, setTrainIter] = useState(0);

  useEffect(() => {
    if (cached) return;
    let alive = true;
    trainTinyVqc(sample.x, sample.y, { onIter: (i) => alive && setTrainIter(i + 1) }).then((m) => {
      cached = m;
      if (alive) setModel(m);
    });
    return () => { alive = false; };
  }, [sample]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setHop((h) => {
      if (h >= HOPS.length - 1) { setPlaying(false); return h; }
      return h + 1;
    }), reduced ? 600 : 1250);
    return () => clearInterval(id);
  }, [playing, reduced]);

  const raw = sample.raw[patient] ?? [];
  const names = sample.rawNames.slice(0, 6);
  const stats = useMemo(() => names.map((_, j) => {
    const col = sample.raw.map((r) => r[j]).filter((v): v is number => v !== null && v !== undefined).sort((a, b) => a - b);
    const m = col.reduce((s, v) => s + v, 0) / (col.length || 1);
    const sd = Math.sqrt(col.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, col.length - 1)) || 1;
    return { med: col[Math.floor(col.length / 2)] ?? 0, m, sd };
  }), [sample, names]);
  const x = useMemo(() => sample.x[patient] ?? [], [sample, patient]);
  const bw = model?.bandwidth ?? 0.35;
  const enc = useMemo(() => (x.length ? encodeAll([x], bw)[0] : null), [x, bw]);
  const blochs = useMemo(() => (enc ? Array.from({ length: enc.n }, (_, q) => enc.bloch(q)) : []), [enc]);
  const p = model && enc ? vqcProbability(enc, model.theta, model.layers) : null;
  const band = p !== null ? assignBand(p, bands) : null;
  const circuit = useMemo(() => buildCircuit({ nQubits: x.length || 6, encoding: 'zz_feature_map', encodingReps: 2, bandwidth: bw, x, ansatz: 'real_amplitudes', layers: model?.layers ?? 1, theta: model?.theta, measure: true }), [x, bw, model]);

  const view = () => {
    switch (hop) {
      case 0: case 1: case 2:
        return (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {names.map((n, j) => {
              const v = raw[j];
              const cleaned = v === null || v === undefined ? stats[j].med : v;
              const val = hop === 0 ? v : hop === 1 ? cleaned : (cleaned - stats[j].m) / stats[j].sd;
              const imputed = hop >= 1 && (v === null || v === undefined);
              return (
                <motion.div key={n} layout className={cn('rounded-lg border p-2.5', imputed ? 'border-saffron/50 bg-tint-saffron' : 'border-line bg-surface-2')}>
                  <div className="truncate text-[10px] text-muted">{n}</div>
                  <motion.div key={`${hop}-${j}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="tnum font-mono text-base font-semibold text-fg">
                    {val === null || val === undefined ? <span className="text-danger">NaN</span> : Number(val.toFixed(hop === 2 ? 3 : 4))}
                  </motion.div>
                  {imputed && <div className="text-[9px] font-semibold text-saffron">imputed (median)</div>}
                  {hop === 2 && <div className="text-[9px] text-muted">z-score</div>}
                </motion.div>
              );
            })}
          </div>
        );
      case 3: case 4:
        return (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {x.map((v, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="rounded-lg border border-quantum/30 bg-tint-purple p-2.5">
                <div className="truncate text-[10px] text-muted">{featureLabels[i] ?? `PC${i + 1}`}</div>
                <div className="tnum font-mono text-base font-semibold text-quantum">{hop === 3 ? `PC${i + 1}` : `${(v * bw).toFixed(3)} rad`}</div>
                <div className="text-[9px] text-muted">{hop === 3 ? `scaled ${v.toFixed(3)} ∈ [0, π]` : `= ${v.toFixed(2)} × bw ${bw}`}</div>
              </motion.div>
            ))}
          </div>
        );
      case 5:
        return <BlochGrid vectors={blochs} size={112} sublabels={featureLabels.map((f) => f.split(' · ')[0])} />;
      case 6:
        return <CircuitViewer spec={circuit} mode="build" compact maxHeight={300} title="follow-patient" />;
      case 7: case 8: case 9: {
        const z = p !== null ? 2 * p - 1 : 0;
        return (
          <div className="grid items-center gap-6 md:grid-cols-3">
            <div className="rounded-xl bg-surface-2 p-4 text-center"><div className="text-xs text-muted">⟨Z₀⟩ from the circuit</div><div className="metric text-3xl font-bold text-quantum">{z.toFixed(3)}</div></div>
            <div className={cn('rounded-xl p-4 text-center transition', hop >= 8 ? 'bg-tint-blue' : 'bg-surface-2 opacity-40')}>
              <div className="text-xs text-muted"><Tex>{'p=(1+\\langle Z_0\\rangle)/2'}</Tex></div>
              <div className="metric text-3xl font-bold text-classical">{p !== null ? `${(p * 100).toFixed(1)}%` : '…'}</div>
            </div>
            <div className={cn('flex flex-col items-center gap-2 rounded-xl p-4 transition', hop >= 9 ? '' : 'opacity-40')} style={hop >= 9 && band ? { background: BAND_META[band].tint } : undefined}>
              {band && <RiskBadge band={band} size="lg" />}
              <div className="text-center text-xs text-fg-2">{band ? BAND_META[band].action : ''}</div>
              <div className="text-[10px] text-muted">true label: {sample.y[patient] ? 'positive' : 'negative'}</div>
            </div>
          </div>
        );
      }
    }
  };

  return (
    <Card className="p-4" data-tour="arch-follow">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg"><Sparkles size={15} className="text-saffron" /> Follow one patient</h3>
        <Select className="w-56" value={String(patient)} onChange={(v) => { setPatient(Number(v)); setHop(0); }} options={sample.ids.slice(0, 20).map((id, i) => ({ value: String(i), label: `${id} · ${sample.y[i] ? 'positive' : 'negative'}` }))} />
        <div className="text-[11px] text-muted">
          {model ? <>VQC trained <b>in your browser</b> (SPSA, {model.history.length} iters, ZZ bw {model.bandwidth}) · accuracy {(model.accuracy * 100).toFixed(0)}% on these {sample.x.length} patients</> : <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> training a tiny VQC in-browser… {trainIter}/70</span>}
        </div>
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" variant="outline" icon={<RotateCcw size={13} />} onClick={() => { setHop(0); setPlaying(false); }}>Reset</Button>
          <Button size="sm" variant="quantum" icon={playing ? <Pause size={13} /> : <Play size={13} />} onClick={() => { if (hop >= HOPS.length - 1) setHop(0); setPlaying((v) => !v); }}>{playing ? 'Pause' : 'Play trace'}</Button>
        </div>
      </div>
      <div className="relative mb-5">
        <div className="absolute left-0 right-0 top-3.5 h-0.5 bg-line" />
        <motion.div className="absolute left-0 top-3.5 h-0.5 bg-gradient-to-r from-[#0070C0] via-[#7B3FA0] to-[#1E9C48]" animate={{ width: `${(hop / (HOPS.length - 1)) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        <div className="relative flex justify-between">
          {HOPS.map((h, i) => (
            <button key={h} onClick={() => { setHop(i); setPlaying(false); }} className="flex flex-col items-center gap-1" aria-current={i === hop ? 'step' : undefined}>
              <motion.span animate={{ scale: i === hop ? 1.25 : 1 }} className={cn('flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold', i <= hop ? 'border-transparent text-white' : 'border-line bg-surface text-muted')}
                style={i <= hop ? { background: i < 3 ? 'var(--blue)' : i < 8 ? 'var(--purple)' : 'var(--green)' } : undefined}>{i + 1}</motion.span>
              <span className={cn('hidden text-center text-[10px] lg:block', i === hop ? 'font-semibold text-fg' : 'text-muted')}>{h}</span>
            </button>
          ))}
        </div>
      </div>
      <>
        <motion.div key={hop < 3 ? 'tab' : hop < 5 ? 'pc' : hop} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }} className="min-h-[220px]">
          <div className="mb-2 text-xs font-semibold text-muted">Hop {hop + 1} · {HOPS[hop]}</div>
          {view()}
        </motion.div>
      </>
    </Card>
  );
}
