/** Live quantum panel: circuit with streaming θ, shimmering parameter heatmap, Bloch grid for a validation patient, loss landscape. */
import { useEffect, useMemo, useRef } from 'react';
import type { Experiment, TrainingEvent } from '@/types/api';
import { buildCircuit } from '@/lib/quantum/circuits';
import { simulate } from '@/lib/quantum/simulator';
import { useLandscape } from '@/api/hooks';
import { Card, CardHeader } from '@/components/common/ui';
import { Skeleton } from '@/components/common/misc';
import { CircuitViewer } from '@/components/quantum/CircuitViewer';
import { BlochGrid } from '@/components/quantum/Bloch';
import { LossLandscape } from '@/components/quantum/Lazy3D';

function ParamHeatmap({ events }: { events: TrainingEvent[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rows = events.filter((e) => e.params?.length);
  useEffect(() => {
    const c = ref.current;
    if (!c || !rows.length) return;
    const ctx = c.getContext('2d')!;
    const P = rows[0].params!.length;
    const cols = Math.min(rows.length, 120);
    const data = rows.slice(-cols);
    c.width = cols * 4;
    c.height = P * 5;
    data.forEach((e, x) => e.params!.forEach((v, y) => {
      const t = (((v % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI);
      ctx.fillStyle = `hsl(${270 - t * 200} 65% ${38 + t * 22}%)`;
      ctx.fillRect(x * 4, y * 5, 4, 5);
    }));
  }, [rows]);
  if (!rows.length) return <div className="flex h-40 items-center justify-center text-xs text-muted">Kernel models have no trainable circuit parameters.</div>;
  return (
    <div className="relative overflow-hidden rounded-lg border border-line">
      <canvas ref={ref} className="h-44 w-full [image-rendering:pixelated]" role="img" aria-label={`Parameter heatmap: ${rows[0].params!.length} parameters × ${rows.length} iterations`} />
      <div className="skeleton pointer-events-none absolute inset-y-0 right-0 w-10 opacity-40" />
      <div className="absolute bottom-1 left-2 font-mono text-[9px] text-white/80 drop-shadow">θ (rows) × iteration (cols) · colour = θ mod 2π</div>
    </div>
  );
}

export function QuantumPanel({ exp, modelId, events }: { exp: Experiment; modelId: string; events: TrainingEvent[] }) {
  const cfg = exp.config;
  const model = cfg.models.find((m) => m.modelId === modelId);
  const isKernel = model?.kind === 'qsvm' || model?.kind === 'qsvr';
  const last = [...events].reverse().find((e) => e.params);
  const params = last?.params;
  const n = cfg.nQubits;
  const patient = useMemo(() => Array.from({ length: n }, (_, i) => 0.4 + ((i * 1.37) % 2.4)), [n]);
  const spec = useMemo(() => buildCircuit({ nQubits: n, encoding: cfg.quantum.encoding, encodingReps: cfg.quantum.encodingReps, bandwidth: cfg.quantum.kernelBandwidth ?? 1, entanglement: cfg.quantum.entanglement, ansatz: isKernel ? null : cfg.quantum.ansatz, layers: cfg.quantum.layers, x: patient, theta: params, seed: 3 }), [n, cfg, isKernel, patient, params]);
  // Bloch grid refreshes every 5 iterations to keep it readable.
  const snapIdx = Math.floor(events.length / 5);
  const bloch = useMemo(() => simulate(n, spec.ops.filter((o) => o.name !== 'MEASURE')).bloch, [snapIdx, n]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: landscape } = useLandscape(exp.id, modelId);
  const progressFrac = events.length ? (events[events.length - 1].iteration ?? 0) / (events[events.length - 1].maxIter ?? 1) : 0;
  const partial = landscape ? { ...landscape, path: landscape.path.slice(0, Math.max(2, Math.round(landscape.path.length * progressFrac))) } : null;
  return (
    <div className="grid gap-4 xl:grid-cols-2" data-tour="train-circuit">
      <Card className="xl:col-span-2">
        <CardHeader title="Live circuit" subtitle={isKernel ? 'Kernel circuit U(x)·U†(x′) — no trainable θ' : `${spec.nTrainableParams} trainable θ · fill intensity = θ · pulsing gates changed most`} />
        <div className="p-3"><CircuitViewer spec={spec} mode="live" params={params} maxHeight={330} compact={n > 6} title="live-circuit" /></div>
      </Card>
      <Card>
        <CardHeader title="Parameter heatmap" subtitle="θ × iteration, streaming" />
        <div className="p-3"><ParamHeatmap events={events} /></div>
      </Card>
      <Card>
        <CardHeader title="Validation patient · encoded + trained state" subtitle="Bloch grid refreshes every 5 iterations" />
        <div className="p-3"><BlochGrid vectors={bloch} size={92} /></div>
      </Card>
      <Card className="xl:col-span-2">
        <CardHeader title="Loss landscape · optimizer path so far" subtitle="2-parameter slice (θ₀, θ₁); flat regions = barren plateaus" />
        <div className="p-3">{partial ? <LossLandscape data={partial} height={300} /> : <Skeleton className="h-[300px]" />}</div>
      </Card>
    </div>
  );
}
