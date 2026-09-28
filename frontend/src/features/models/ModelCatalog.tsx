import { AnimatePresence, motion } from 'framer-motion';
import { Atom, Check, ChevronDown, Cpu, Layers } from 'lucide-react';
import { useState } from 'react';
import { MODEL_CATALOG, type ModelMeta } from '@/content/models';
import type { ModelKind, TaskType } from '@/types/api';
import { NumberField, Select, Slider, cn } from '@/components/common/ui';
import { FamilyBadge } from '@/components/common/misc';

export type Hypers = Record<string, Record<string, string | number | boolean>>;

function ModelCard({ m, selected, onToggle, hyper, onHyper, bandwidth, onBandwidth }: { m: ModelMeta; selected: boolean; onToggle: () => void; hyper: Record<string, string | number | boolean>; onHyper: (k: string, v: string | number | boolean) => void; bandwidth?: number; onBandwidth?: (b: number) => void }) {
  const [open, setOpen] = useState(false);
  const color = m.family === 'classical' ? 'var(--blue)' : m.family === 'hybrid' ? 'var(--teal)' : 'var(--purple)';
  const Icon = m.family === 'classical' ? Cpu : m.family === 'hybrid' ? Layers : Atom;
  return (
    <motion.div layout className={cn('card overflow-hidden transition', selected && 'ring-2')} style={selected ? ({ '--tw-ring-color': color } as React.CSSProperties) : undefined}>
      <div className="flex items-start gap-2.5 p-3">
        <button onClick={onToggle} aria-pressed={selected} aria-label={`${selected ? 'Remove' : 'Add'} ${m.label}`}
          className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition', selected ? 'border-transparent text-white' : 'border-line-strong')} style={selected ? { background: color } : undefined}>
          {selected && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={12} strokeWidth={3} /></motion.span>}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Icon size={14} style={{ color }} />
            <span className="truncate text-sm font-semibold text-fg">{m.label}</span>
            <FamilyBadge family={m.family} />
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-muted">{m.description}</p>
        </div>
        {(m.hyper.length > 0 || m.kind === 'qsvm') && <button onClick={() => setOpen((o) => !o)} aria-label="Hyperparameters" className="text-muted hover:text-fg"><ChevronDown size={15} className={cn('transition', open && 'rotate-180')} /></button>}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="grid grid-cols-2 gap-2 border-t border-line bg-surface-2 p-3">
              {m.hyper.map((h) =>
                h.type === 'select' ? (
                  <Select key={h.key} label={h.label} value={String(hyper[h.key] ?? h.value)} onChange={(v) => onHyper(h.key, v)} options={(h.choices ?? []).map((c) => ({ value: c, label: c }))} />
                ) : (
                  <NumberField key={h.key} label={h.label} value={Number(hyper[h.key] ?? h.value)} min={h.min} max={h.max} step={h.step} onChange={(v) => onHyper(h.key, v)} />
                ),
              )}
              {m.kind === 'qsvm' && onBandwidth && (
                <div className="col-span-2">
                  {(hyper.bandwidth ?? 'auto') === 'auto' ? (
                    <div className="rounded-md bg-tint-purple p-2 text-[11px] text-fg-2">Auto: inner 3-fold CV over <span className="font-mono">{'{0.05, 0.1, 0.2, 0.3, 0.5, 1.0}'}</span> on the training data only.</div>
                  ) : (
                    <Slider label="Fixed bandwidth" value={bandwidth ?? 0.2} min={0.05} max={1} step={0.05} onChange={onBandwidth} format={(v) => v.toFixed(2)} accent="var(--purple)" />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ModelCatalog({ task, selected, onChange, hypers, onHypers, bandwidth, onBandwidth }: { task: TaskType; selected: ModelKind[]; onChange: (k: ModelKind[]) => void; hypers: Hypers; onHypers: (h: Hypers) => void; bandwidth: number; onBandwidth: (b: number) => void }) {
  const list = MODEL_CATALOG.filter((m) => m.task === task);
  const groups: [string, ModelMeta[]][] = [['Classical baselines', list.filter((m) => m.family === 'classical')], ['Quantum & hybrid', list.filter((m) => m.family !== 'classical')]];
  return (
    <div className="space-y-4" data-tour="models-catalog">
      {groups.map(([g, ms]) => (
        <div key={g}>
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">{g}<span className="font-normal normal-case">{ms.filter((m) => selected.includes(m.kind)).length}/{ms.length} selected</span></div>
          <div className="space-y-2">
            {ms.map((m) => (
              <ModelCard key={m.kind} m={m} selected={selected.includes(m.kind)} onToggle={() => onChange(selected.includes(m.kind) ? selected.filter((k) => k !== m.kind) : [...selected, m.kind])}
                hyper={hypers[m.kind] ?? {}} onHyper={(k, v) => onHypers({ ...hypers, [m.kind]: { ...(hypers[m.kind] ?? {}), [k]: v } })}
                bandwidth={bandwidth} onBandwidth={onBandwidth} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
