import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, GripVertical } from 'lucide-react';
import { useState } from 'react';
import type { PreprocessStep } from '@/types/api';
import { STEP_META } from '@/content/preprocess';
import { Badge, NumberField, Select, Switch, cn } from '@/components/common/ui';
import { Term } from '@/components/common/misc';

export function StepCard({ step, index, onChange }: { step: PreprocessStep; index: number; onChange: (s: PreprocessStep) => void }) {
  const meta = STEP_META.find((m) => m.kind === step.kind)!;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const [open, setOpen] = useState(index < 2);
  const set = (k: string, v: string | number | boolean) => onChange({ ...step, params: { ...step.params, [k]: v } });
  const visibleOpts = meta.options.filter((o) => {
    if (o.key === 'k' && step.kind === 'impute') return step.params.method === 'knn';
    if (o.key === 'k' && step.kind === 'balance') return step.params.method === 'smote';
    if (o.key === 'threshold') return step.params.method === 'zscore';
    if (o.key === 'C') return step.params.method === 'lasso';
    if (o.key === 'k' && step.kind === 'reduce') return step.params.method !== 'none';
    return true;
  });
  return (
    <div ref={setNodeRef} data-tour={`pp-step-${step.kind}`} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('card overflow-hidden transition-shadow', isDragging && 'z-10 shadow-pop ring-2 ring-classical', !step.enabled && 'opacity-60')}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button {...attributes} {...listeners} className="cursor-grab rounded p-0.5 text-muted hover:bg-surface-3 active:cursor-grabbing" aria-label={`Drag to reorder ${meta.title}`}><GripVertical size={16} /></button>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-3 font-mono text-[10px] font-bold text-muted">{index + 1}</span>
        <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="truncate text-sm font-semibold text-fg">{meta.title}</span>
          <Badge color="var(--blue)">D1 · {meta.component}</Badge>
          <ChevronDown size={14} className={cn('ml-auto shrink-0 text-muted transition', open && 'rotate-180')} />
        </button>
        <Switch checked={step.enabled} onChange={(v) => onChange({ ...step, enabled: v })} />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="space-y-3 border-t border-line bg-surface-2 px-3 py-3">
              <p className="text-xs text-muted">
                {meta.description}
                {step.kind === 'balance' && <> See <Term term="SMOTE" /> and <Term term="Leakage" />.</>}
                {step.kind === 'reduce' && <> See <Term term="PCA" />.</>}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {visibleOpts.map((o) =>
                  o.type === 'select' ? (
                    <Select key={o.key} label={o.label} value={String(step.params[o.key] ?? o.choices![0].value)} onChange={(v) => set(o.key, v)} options={o.choices!} />
                  ) : o.type === 'number' ? (
                    <NumberField key={o.key} label={o.label} value={Number(step.params[o.key] ?? o.min ?? 0)} min={o.min} max={o.max} step={o.step} onChange={(v) => set(o.key, v)} />
                  ) : (
                    <div key={o.key} className="col-span-2"><Switch checked={step.params[o.key] === true} onChange={(v) => set(o.key, v)} label={o.label} /></div>
                  ),
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
