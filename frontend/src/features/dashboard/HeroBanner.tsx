import { AnimatePresence, motion } from 'framer-motion';
import { Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import { openStream } from '@/api/ws';
import { QubitConstellation } from '@/components/quantum/Lazy3D';
import { CountUp, LiveDot } from '@/components/common/misc';
import type { TrainingEvent } from '@/types/api';

export function LiveTicker() {
  const [items, setItems] = useState<{ id: number; text: string; level: string }[]>([]);
  useEffect(() => {
    let id = 0;
    let lastProgress = 0;
    return openStream('*', (e: TrainingEvent) => {
      let text = '';
      if (e.type === 'log' && e.message) text = e.message;
      else if (e.type === 'status' && e.queuePosition) text = e.message ?? '';
      else if (e.type === 'done' && e.message) text = `✓ ${e.message}`;
      else if (e.type === 'progress' && Date.now() - lastProgress > 2500) {
        lastProgress = Date.now();
        text = `${e.modelId} · iter ${e.iteration}/${e.maxIter} · loss ${e.loss?.toFixed(3)}${e.circuitExecutions ? ` · ${e.circuitExecutions.toLocaleString()} circuit execs` : ''}`;
      }
      if (text) setItems((s) => [{ id: id++, text, level: e.level ?? 'info' }, ...s].slice(0, 4));
    }, () => undefined);
  }, []);
  return (
    <div className="space-y-1" aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map((it, i) => (
          <motion.div key={it.id} layout initial={{ opacity: 0, x: -20, height: 0 }} animate={{ opacity: 1 - i * 0.22, x: 0, height: 'auto' }} exit={{ opacity: 0 }}
            className="truncate font-mono text-[11px]" style={{ color: it.level === 'warn' ? 'var(--saffron)' : i === 0 ? 'var(--fg)' : 'var(--muted)' }}>
            › {it.text}
          </motion.div>
        ))}
      </AnimatePresence>
      {items.length === 0 && <div className="font-mono text-[11px] text-muted">› waiting for training events…</div>}
    </div>
  );
}

export function HeroBanner({ running, experiments, qubits }: { running: number; experiments: number; qubits: number }) {
  return (
    <div className="gradient-border card mb-5 overflow-hidden rounded-2xl">
      <div className="grid items-center md:grid-cols-[1fr_380px]">
        <div className="relative p-6">
          <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-classical/10 blur-3xl" />
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-quantum"><Radio size={14} /> Mission control <LiveDot color="var(--green)" /></div>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-heading">Hybrid pipeline is <span className="text-shimmer">live</span></h2>
          <div className="mt-4 flex gap-8">
            {[['jobs running', running, 'var(--saffron)'], ['experiments', experiments, 'var(--blue)'], ['qubits in play', qubits, 'var(--purple)']].map(([l, v, c]) => (
              <div key={l as string}>
                <div className="metric text-3xl font-bold" style={{ color: c as string }}><CountUp value={v as number} /></div>
                <div className="text-[11px] text-muted">{l as string}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-line bg-surface-2/80 p-2.5"><LiveTicker /></div>
        </div>
        <div className="relative h-[260px] bg-[radial-gradient(circle_at_center,rgba(123,63,160,0.18),transparent_65%)]">
          <QubitConstellation n={qubits || 6} height={260} />
        </div>
      </div>
    </div>
  );
}
