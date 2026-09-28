/** Execution targets with circuit-compatibility checks (O4), and the scalability panel. */
import { motion } from 'framer-motion';
import { CheckCircle2, Cloud, Cpu, Server, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useBackends, useExperiments } from '@/api/hooks';
import { Badge, Card, CardHeader } from '@/components/common/ui';
import { Skeleton } from '@/components/common/misc';
import { AXIS, tooltipStyle } from '@/components/charts/ChartCard';
import type { CircuitSpec } from '@/types/quantum';
import { bytes } from '@/lib/format';

export function ExecutionTargets({ spec }: { spec: CircuitSpec }) {
  const { data } = useBackends();
  const needsFull = spec.ops.some((o) => (o.name === 'CNOT' || o.name === 'CZ') && Math.abs(o.wires[0] - o.wires[1]) > 1);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-tour="arch-backends">
      {!data && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-48" />)}
      {data?.filter((b) => ['aer_statevector', 'aer_shots', 'aer_noisy_manila', 'ibm_brisbane'].includes(b.id)).map((b, i) => {
        const checks = [
          { ok: spec.nQubits <= b.qubits, text: `${spec.nQubits} ≤ ${b.qubits} qubits` },
          { ok: !b.maxDepth || spec.depth <= b.maxDepth, text: `depth ${spec.depth}${b.maxDepth ? ` ≤ ${b.maxDepth}` : ''}` },
          { ok: b.connectivity === 'all-to-all' || !needsFull, text: b.connectivity === 'all-to-all' ? 'all-to-all connectivity' : needsFull ? `${b.connectivity}: SWAPs needed` : `${b.connectivity}: linear entanglement maps natively` },
        ];
        const ok = checks.every((c) => c.ok);
        const Icon = b.kind === 'hardware' ? Cloud : b.kind === 'noisy' ? Server : Cpu;
        return (
          <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card className="h-full p-4">
              <div className="flex items-start gap-2">
                <div className="rounded-lg bg-tint-purple p-2 text-quantum"><Icon size={16} /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-fg">{b.name}</div>
                  <div className="text-[10px] text-muted">{b.provider} · {b.kind}</div>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: b.status === 'online' ? 'var(--green)' : 'var(--saffron)' }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />{b.status}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px]">
                <div className="rounded bg-surface-2 py-1"><div className="tnum text-xs font-semibold">{b.qubits}</div>qubits</div>
                <div className="rounded bg-surface-2 py-1"><div className="tnum text-xs font-semibold">{b.queue}</div>queue</div>
                <div className="rounded bg-surface-2 py-1"><div className="tnum text-xs font-semibold">{b.readoutError ? `${(b.readoutError * 100).toFixed(1)}%` : '—'}</div>readout err</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">{b.basisGates.slice(0, 6).map((g) => <span key={g} className="rounded bg-surface-3 px-1 font-mono text-[9px] text-muted">{g}</span>)}</div>
              <div className="mt-3 space-y-1">
                {checks.map((c) => <div key={c.text} className="flex items-center gap-1.5 text-[11px]">{c.ok ? <CheckCircle2 size={12} className="text-ok" /> : <XCircle size={12} className="text-saffron" />}<span className="text-fg-2">{c.text}</span></div>)}
              </div>
              <div className="mt-3"><Badge color={ok ? 'var(--green)' : 'var(--saffron)'}>{ok ? 'Compatible with current circuit' : 'Runs after transpilation'}</Badge></div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

export function Scalability() {
  const { data: exps } = useExperiments(true);
  const [series, setSeries] = useState<{ t: number; jobs: number }[]>([]);
  useEffect(() => {
    if (!exps) return;
    const jobs = exps.filter((e) => e.status === 'running' || e.status === 'queued').reduce((s, e) => s + e.models.filter((m) => m.status !== 'done').length, 0);
    setSeries((s) => [...s.slice(-29), { t: (s[s.length - 1]?.t ?? 0) + 1, jobs }]);
  }, [exps]);
  const mem = Array.from({ length: 36 }, (_, i) => ({ q: i + 4, gb: (16 * 2 ** (i + 4)) / 2 ** 30 }));
  return (
    <div className="grid gap-4 lg:grid-cols-3" data-tour="arch-scalability">
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-fg">How jobs scale</h3>
        <ul className="mt-2 space-y-2 text-xs text-fg-2">
          <li><b>Celery worker pool</b> — each model × fold is an independent task; add workers to scale horizontally.</li>
          <li><b>Batched circuit execution</b> — kernel rows and parameter-shift pairs are submitted as batches (PennyLane batch_execute / Qiskit Runtime sessions).</li>
          <li><b>Kernel-matrix caching</b> — K(x,x′) keyed by (dataset hash, feature map, bandwidth) is reused across folds and C values.</li>
          <li><b>Redis pub/sub → WebSocket</b> streams progress without polling.</li>
        </ul>
      </Card>
      <Card>
        <CardHeader title="Jobs in queue (live)" subtitle="Model tasks not yet finished" />
        <div className="p-2">
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={series} margin={{ left: -25, right: 8, top: 8 }}>
              <defs><linearGradient id="jq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--saffron)" stopOpacity={0.5} /><stop offset="1" stopColor="var(--saffron)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="t" hide />
              <YAxis allowDecimals={false} {...AXIS} />
              <Tooltip {...tooltipStyle()} />
              <Area type="monotone" dataKey="jobs" stroke="var(--saffron)" fill="url(#jq)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <CardHeader title="Simulator memory vs qubits" subtitle="16 B × 2ⁿ — exponential" />
        <div className="p-2">
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={mem} margin={{ left: -5, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="q" {...AXIS} />
              <YAxis scale="log" domain={[1e-6, 1e3]} {...AXIS} tickFormatter={(v: number) => bytes(v * 2 ** 30)} width={56} />
              <ReferenceArea x1={33} x2={39} fill="var(--red)" fillOpacity={0.08} />
              <ReferenceLine x={32} stroke="var(--red)" strokeDasharray="4 3" label={{ value: 'hardware needed', fontSize: 9, fill: 'var(--red)', position: 'insideTopRight' }} />
              <ReferenceLine x={6} stroke="var(--purple)" strokeDasharray="4 3" label={{ value: 'PoC', fontSize: 9, fill: 'var(--purple)', position: 'insideTopLeft' }} />
              <Tooltip {...tooltipStyle()} formatter={(v: number) => bytes(v * 2 ** 30)} labelFormatter={(l) => `${l} qubits`} />
              <Line dataKey="gb" stroke="var(--purple)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
