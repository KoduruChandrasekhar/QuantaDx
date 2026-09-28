import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import katex from 'katex';
import { AlertOctagon, AlertTriangle, Check, CheckCircle2, Copy, Inbox, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { findTerm } from '@/content/glossary';
import { FAMILY_META } from '@/content/models';
import { D_COLORS, type DeliverableId, type ObjectiveId } from '@/content/deliverables';
import { BAND_META, type RiskBand } from '@/lib/risk';
import type { ModelFamily } from '@/types/api';
import { useReducedMotion } from '@/hooks';
import { useUi } from '@/store';
import { Badge, Button, Card, Tip, cn } from './ui';

export function CountUp({ value, format = (v) => v.toFixed(0), duration = 0.9, className }: { value: number; format?: (v: number) => string; duration?: number; className?: string }) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(reduced ? value : 0);
  const text = useTransform(mv, (v) => format(v));
  const [out, setOut] = useState(format(reduced ? value : 0));
  useEffect(() => text.on('change', setOut), [text]);
  useEffect(() => {
    if (reduced) {
      mv.set(value);
      setOut(format(value));
      return;
    }
    const c = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced]);
  return <span className={cn('tnum', className)}>{out}</span>;
}

export function MetricCard({ label, value, format, sub, icon, color = 'var(--blue)', delta, className, tourId }: { label: ReactNode; value: number; format?: (v: number) => string; sub?: ReactNode; icon?: ReactNode; color?: string; delta?: ReactNode; className?: string; tourId?: string }) {
  return (
    <Card className={cn('relative overflow-hidden p-4', className)} data-tour={tourId}>
      <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: color }} />
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        {icon && <span className="rounded-lg p-1.5" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>{icon}</span>}
      </div>
      <div className="metric mt-1.5 text-2xl font-bold tracking-tight text-fg">
        <CountUp value={value} format={format} />
      </div>
      {(sub || delta) && <div className="mt-1 flex items-center gap-2 text-xs text-muted">{delta}{sub}</div>}
    </Card>
  );
}

export function RiskBadge({ band, size = 'md' }: { band: RiskBand; size?: 'sm' | 'md' | 'lg' }) {
  const m = BAND_META[band];
  const Icon = band === 'low' ? CheckCircle2 : band === 'moderate' ? AlertTriangle : AlertOctagon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full font-semibold', size === 'lg' ? 'px-3.5 py-1.5 text-sm' : size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs')}
      style={{ color: m.color, background: m.tint, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${m.color} 35%, transparent)` }}>
      <Icon size={size === 'lg' ? 16 : 12} aria-hidden />
      {m.label}
    </span>
  );
}

export function FamilyBadge({ family }: { family: ModelFamily }) {
  const m = FAMILY_META[family];
  return <Badge color={m.color} tint={m.tint}>{m.label}</Badge>;
}

export function Tex({ children, block }: { children: string; block?: boolean }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(children, { displayMode: !!block, throwOnError: false, output: 'html' });
    } catch {
      return children;
    }
  }, [children, block]);
  // KaTeX output from our own static strings — safe to inject.
  return <span className={block ? 'block overflow-x-auto py-1' : ''} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Glossary hover card for a technical term. */
export function Term({ children, term }: { children?: ReactNode; term: string }) {
  const t = findTerm(term);
  if (!t) return <>{children ?? term}</>;
  return (
    <Tip text={<span><b className="font-semibold">{t.term}.</b> {t.short}</span>}>
      <span tabIndex={0} className="cursor-help border-b border-dotted border-current/50 decoration-dotted">{children ?? term}</span>
    </Tip>
  );
}

export function CopyButton({ text, label = 'Copy', className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted transition hover:bg-surface-3 hover:text-fg', className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          toast.success('Copied to clipboard');
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error('Clipboard is unavailable in this context');
        }
      }}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
      {label}
    </button>
  );
}

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('skeleton', className)} style={style} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-72" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-classical/10 blur-xl" />
        <div className="relative rounded-2xl border border-line bg-surface-2 p-4 text-muted">{icon ?? <Inbox size={28} />}</div>
      </div>
      <div>
        <h3 className="font-semibold text-fg">{title}</h3>
        {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }: { error: unknown; onRetry?: () => void; title?: string }) {
  const [open, setOpen] = useState(false);
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-danger/30 bg-tint-red px-6 py-8 text-center">
      <AlertOctagon className="text-danger" size={28} />
      <div>
        <h3 className="font-semibold text-fg">{title}</h3>
        <p className="mt-1 text-sm text-fg-2">{msg}</p>
      </div>
      <div className="flex gap-2">
        {onRetry && <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={onRetry}>Retry</Button>}
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'Details'}</Button>
      </div>
      {open && <pre className="max-w-full overflow-x-auto rounded-lg bg-surface p-3 text-left font-mono text-[11px] text-muted">{JSON.stringify(error, Object.getOwnPropertyNames(error ?? {}), 2)}</pre>}
    </div>
  );
}

const D_COMPONENTS: Record<DeliverableId, string> = {
  D1: 'Data pre-processing & feature engineering: cleaning, normalization, dimensionality reduction, feature selection, missing/noisy data',
  D2: 'Hybrid quantum-classical architecture: classical front-end, QPU/simulator, data encoding',
  D3: 'Quantum ML models: VQC, QSVM, QNN, parameterized quantum circuits',
  D4: 'Prediction & decision support: probability scores, risk stratification, threshold tuning',
  D5: 'Software platform: UI/API, dataset upload, training & evaluation dashboard, result visualization',
};
const O_TEXT: Record<ObjectiveId, string> = {
  O1: 'Hybrid quantum-classical architecture for early detection',
  O2: 'Quantum-enhanced classification/regression on high-dimensional data',
  O3: 'Accuracy, sensitivity & specificity vs classical baselines',
  O4: 'Scalable, interpretable, NISQ-compatible',
  O5: 'Pre-processing, feature selection & explainability',
  O6: 'Benchmark accuracy, efficiency & generalization',
};

export function DeliverableBadges({ d, o }: { d: DeliverableId[]; o: ObjectiveId[] }) {
  const show = useUi((s) => s.showBadges);
  if (!show) return null;
  return (
    <div className="flex flex-wrap items-center gap-1" aria-label="Deliverables and objectives delivered on this page">
      {d.map((id) => (
        <Tip key={id} text={<span><b>{id}</b> · {D_COMPONENTS[id]}</span>}>
          <span tabIndex={0}><Badge solid color={D_COLORS[id]}>{id}</Badge></span>
        </Tip>
      ))}
      {o.map((id) => (
        <Tip key={id} text={<span><b>{id}</b> · {O_TEXT[id]}</span>}>
          <span tabIndex={0}><Badge color="var(--fg-2)" tint="var(--surface-3)">{id}</Badge></span>
        </Tip>
      ))}
    </div>
  );
}

export function LiveDot({ color = 'var(--green)' }: { color?: string }) {
  return <span className="live-dot inline-block h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />;
}

export function Stagger({ children, className, delay = 0.04 }: { children: ReactNode[]; className?: string; delay?: number }) {
  return (
    <div className={className}>
      {children.map((c, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * delay, duration: 0.3 }}>
          {c}
        </motion.div>
      ))}
    </div>
  );
}
