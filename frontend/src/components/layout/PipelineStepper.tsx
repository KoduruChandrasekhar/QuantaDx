import { motion } from 'framer-motion';
import { Check, Lock } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { PIPELINE_STEPS } from '@/content/nav';
import { usePipeline } from '@/store';
import { Tip, cn } from '../common/ui';

export function PipelineStepper() {
  const { pathname } = useLocation();
  const done = usePipeline((s) => s.completedSteps);
  const expId = usePipeline((s) => s.activeExperimentId);
  const activeIdx = PIPELINE_STEPS.findIndex((s) => (s.key === 'train' ? /\/train$/.test(pathname) : pathname.startsWith(s.to)));
  // A step is reachable if every previous step is done (the demo experiment counts as trained).
  const firstOpen = PIPELINE_STEPS.findIndex((s) => !done.includes(s.key as never));
  return (
    <div className="border-b border-line bg-surface/95 px-4 py-2 lg:px-6">
      <ol className="mx-auto flex max-w-[1440px] items-center gap-1 overflow-x-auto">
        {PIPELINE_STEPS.map((s, i) => {
          const isDone = done.includes(s.key as never);
          const locked = firstOpen >= 0 && i > firstOpen && !isDone && i !== activeIdx;
          const active = i === activeIdx;
          const Icon = s.icon;
          const to = s.key === 'train' ? `/experiments/${expId}/train` : s.to;
          const body = (
            <Link to={to} aria-current={active ? 'step' : undefined}
              className={cn('relative flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors', active ? 'text-classical' : isDone ? 'text-fg-2 hover:text-fg' : 'text-muted hover:text-fg', locked && 'opacity-60')}>
              {active && <motion.span layoutId="stepper-active" className="absolute inset-0 rounded-full bg-tint-blue ring-1 ring-classical/30" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <span className={cn('relative z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold', isDone ? 'bg-ok text-white' : active ? 'bg-classical text-white' : 'bg-surface-3 text-muted')}>
                {isDone ? (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}><Check size={11} strokeWidth={3} /></motion.span>
                ) : locked ? <Lock size={10} /> : i + 1}
              </span>
              <Icon size={13} className="relative z-10 hidden sm:block" />
              <span className="relative z-10 whitespace-nowrap">{s.label}</span>
            </Link>
          );
          return (
            <li key={s.key} className="flex items-center">
              {i > 0 && <span className={cn('mx-1 h-px w-4 sm:w-8', isDone || done.includes(PIPELINE_STEPS[i - 1].key as never) ? 'bg-ok' : 'bg-line-strong')} />}
              {locked ? <Tip text={`Complete “${PIPELINE_STEPS[firstOpen].label}” first — you can still peek at this step.`}>{body}</Tip> : body}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
