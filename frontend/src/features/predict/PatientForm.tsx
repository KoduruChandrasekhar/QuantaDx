/** Patient form generated from the dataset schema: units, training ranges, grouped + collapsible, Zod validation, animated example fill. */
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, HeartPulse, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import type { DatasetProfile } from '@/types/api';
import { prettyName } from '@/lib/format';
import { Button, Card, CardHeader, cn } from '@/components/common/ui';

export function buildSchema(p: DatasetProfile) {
  return z.object(Object.fromEntries(p.columns.map((c) => [c.name, z.number({ invalid_type_error: 'Required' }).refine(Number.isFinite, 'Must be a number').refine((v) => v >= Math.min(0, c.min) - Math.abs(c.max) * 2 && v <= c.max * 3 + 1, `Outside plausible range (training ${c.min.toPrecision(3)}–${c.max.toPrecision(3)})`)])));
}

export function PatientForm({ profile, values, onChange, onPredict, onExample, busy, units }: {
  profile: DatasetProfile;
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  onPredict: (v: Record<string, number>) => void;
  onExample: (kind: 'healthy' | 'atRisk') => void;
  busy: boolean;
  units: Record<string, string>;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const groups = useMemo(() => {
    const m = new Map<string, DatasetProfile['columns']>();
    profile.columns.slice(0, 40).forEach((c) => {
      const g = c.name.endsWith('_mean') ? 'Mean values' : c.name.endsWith('_se') ? 'Standard error' : c.name.endsWith('_worst') ? 'Worst values' : 'Clinical features';
      m.set(g, [...(m.get(g) ?? []), c]);
    });
    return [...m.entries()];
  }, [profile]);
  const [open, setOpen] = useState<string[]>(() => [groups[0]?.[0] ?? '']);
  const submit = () => {
    const parsed = Object.fromEntries(profile.columns.slice(0, 40).map((c) => [c.name, values[c.name] === '' || values[c.name] === undefined ? NaN : Number(values[c.name])]));
    const r = buildSchema(profile).safeParse(parsed);
    if (!r.success) {
      const errs: Record<string, string> = {};
      r.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      setErrors(errs);
      setOpen(groups.filter(([, cols]) => cols.some((c) => errs[c.name])).map(([g]) => g));
      return;
    }
    setErrors({});
    onPredict(r.data as Record<string, number>);
  };
  return (
    <Card data-tour="predict-form">
      <CardHeader title="Single patient" subtitle="Form generated from the dataset schema · ranges from training data" icon={<HeartPulse size={16} />} actions={
        <>
          <Button size="sm" variant="outline" onClick={() => onExample('healthy')}>Example: healthy</Button>
          <Button size="sm" variant="outline" onClick={() => onExample('atRisk')} icon={<Sparkles size={13} />}>Example: at-risk</Button>
        </>
      } />
      <div className="space-y-2 p-4">
        {groups.map(([g, cols]) => {
          const isOpen = open.includes(g);
          const nErr = cols.filter((c) => errors[c.name]).length;
          return (
            <div key={g} className="rounded-xl border border-line">
              <button className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-fg" onClick={() => setOpen((o) => (isOpen ? o.filter((x) => x !== g) : [...o, g]))} aria-expanded={isOpen}>
                {g}<span className="text-xs font-normal text-muted">{cols.length} fields</span>
                {nErr > 0 && <span className="rounded bg-tint-red px-1.5 text-[10px] text-danger">{nErr} to fix</span>}
                <ChevronDown size={15} className={cn('ml-auto text-muted transition', isOpen && 'rotate-180')} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="grid grid-cols-1 gap-3 border-t border-line p-3 sm:grid-cols-2 xl:grid-cols-3">
                      {cols.map((c) => {
                        const unit = units[c.name] ?? c.unit;
                        return (
                          <label key={c.name} className="flex flex-col gap-1">
                            <span className="truncate text-[11px] font-medium text-muted" title={c.name}>{prettyName(c.name)}{unit ? ` (${unit})` : ''}</span>
                            <motion.input key={values[c.name] ? `f-${values[c.name]}` : 'empty'} initial={values[c.name] ? { backgroundColor: 'var(--tint-purple)' } : false} animate={{ backgroundColor: 'var(--surface)' }} transition={{ duration: 0.8 }}
                              type="number" step="any" inputMode="decimal" value={values[c.name] ?? ''} placeholder={c.median.toPrecision(3)} aria-invalid={!!errors[c.name]}
                              onChange={(e) => onChange({ ...values, [c.name]: e.target.value })}
                              className={cn('tnum h-9 rounded-lg border px-2.5 text-sm text-fg outline-none focus:border-classical', errors[c.name] ? 'border-danger' : 'border-line')} />
                            <span className={cn('text-[10px]', errors[c.name] ? 'text-danger' : 'text-muted')}>{errors[c.name] ?? `range ${Number(c.min.toPrecision(3))} – ${Number(c.max.toPrecision(3))}`}</span>
                          </label>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        <div className="flex items-center gap-2 pt-1">
          <span className="flex items-center gap-1 text-[11px] text-muted"><ShieldCheck size={12} /> No identifiers are collected.</span>
          <Button className="ml-auto" size="lg" onClick={submit} disabled={busy} icon={busy ? <Loader2 size={15} className="animate-spin" /> : <HeartPulse size={15} />}>Predict</Button>
        </div>
      </div>
    </Card>
  );
}
