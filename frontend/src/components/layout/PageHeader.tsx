import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { ROUTE_TRACE } from '@/content/deliverables';
import { DeliverableBadges } from '../common/misc';
import { AtomMark, ScrambleText } from '../fx/Effects';

/** A long sine path (two periods of the tile) so a translateX(-50%) loop is seamless. */
function wave(amp: number, len: number, phase: number, y: number, width: number): string {
  let d = `M0,${y}`;
  for (let x = 0; x <= width * 2; x += 12) d += ` L${x},${(y + amp * Math.sin(((x + phase) / len) * Math.PI * 2)).toFixed(1)}`;
  return d;
}

function HeaderFx() {
  const W = 1600;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      <div className="orb-drift absolute -left-16 -top-24 h-64 w-96 rounded-full" style={{ background: 'radial-gradient(closest-side, rgb(0 112 192 / 0.16), transparent)' }} />
      <div className="orb-drift absolute -bottom-28 right-0 h-72 w-[26rem] rounded-full" style={{ background: 'radial-gradient(closest-side, rgb(123 63 160 / 0.2), transparent)', animationDelay: '-4s' }} />
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1600 140">
        <defs>
          <linearGradient id="hdr-w" x1="0" x2="1">
            <stop offset="0" stopColor="#0070C0" stopOpacity="0" />
            <stop offset="0.3" stopColor="#0070C0" />
            <stop offset="0.6" stopColor="#7B3FA0" />
            <stop offset="1" stopColor="#0E8C8C" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        {[
          { amp: 16, len: 200, ph: 0, y: 92, dur: 16, o: 0.35, w: 1.6 },
          { amp: 10, len: 160, ph: 40, y: 100, dur: 11, o: 0.25, w: 1.2 },
          { amp: 22, len: 400, ph: 90, y: 86, dur: 22, o: 0.18, w: 2 },
        ].map((l, i) => (
          <path key={i} className="wave-slide" style={{ ['--wave-dur' as string]: `${l.dur}s` }} d={wave(l.amp, l.len, l.ph, l.y, W)} fill="none" stroke="url(#hdr-w)" strokeWidth={l.w} opacity={l.o} />
        ))}
      </svg>
    </div>
  );
}

export function PageHeader({ title, description, trace, actions, eyebrow }: { title: ReactNode; description?: ReactNode; trace?: keyof typeof ROUTE_TRACE; actions?: ReactNode; eyebrow?: ReactNode }) {
  const t = trace ? ROUTE_TRACE[trace] : undefined;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="relative mb-6 overflow-hidden rounded-2xl border border-line bg-surface/95 px-5 py-5 shadow-card md:px-7">
      <HeaderFx />
      <div className="relative flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-classical">{eyebrow}</div>}
          <div className="flex flex-wrap items-center gap-3">
            <motion.span initial={{ scale: 0, rotate: -120 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}>
              <AtomMark size={36} className="shrink-0" />
            </motion.span>
            <h1 className="font-serif text-[30px] font-semibold leading-tight tracking-tight text-heading">
              {typeof title === 'string' ? <ScrambleText text={title} /> : title}
            </h1>
            {t && <DeliverableBadges d={t.d} o={t.o} />}
          </div>
          <motion.div className="mt-2 h-[3px] w-44 origin-left rounded-full bg-gradient-to-r from-[#0070C0] via-[#7B3FA0] to-transparent" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
          {description && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mt-2 max-w-3xl text-sm text-fg-2">{description}</motion.p>}
        </div>
        {actions && <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="flex flex-wrap items-center gap-2">{actions}</motion.div>}
      </div>
    </motion.div>
  );
}
