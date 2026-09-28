/** SHAP visuals: importance bars, beeswarm, classical-vs-quantum slope chart, local waterfall. */
import { motion } from 'framer-motion';
import type { FeatureImportance, GlobalExplanation, LocalExplanation } from '@/types/api';
import { prettyName } from '@/lib/format';

export function ShapBars({ items, color = 'var(--purple)', max = 10, pretty = true }: { items: FeatureImportance[]; color?: string; max?: number; pretty?: boolean }) {
  const top = items.slice(0, max);
  const m = Math.max(...top.map((t) => t.importance), 1e-9);
  return (
    <div className="space-y-1.5" role="img" aria-label={`Feature importance: ${top.map((t) => t.feature).join(', ')}`}>
      {top.map((t, i) => (
        <div key={t.feature} className="flex items-center gap-2 text-xs">
          <span className="w-40 truncate text-right text-fg-2" title={t.feature}>{pretty ? prettyName(t.feature) : t.feature}</span>
          <div className="h-4 flex-1 rounded bg-surface-2">
            <motion.div className="h-full rounded" style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${color} 50%, transparent), ${color})` }} initial={{ width: 0 }} animate={{ width: `${(t.importance / m) * 100}%` }} transition={{ delay: i * 0.04, duration: 0.6, ease: [0.16, 1, 0.3, 1] }} />
          </div>
          <span className="tnum w-12 text-right text-muted">{t.importance.toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
}

export function Beeswarm({ g }: { g: GlobalExplanation }) {
  const all = g.beeswarm.flatMap((b) => b.points.map((p) => Math.abs(p.shap)));
  const lim = Math.max(...all, 1e-6);
  const W = 520, rowH = 30;
  const x = (v: number) => W / 2 + (v / lim) * (W / 2 - 10);
  return (
    <svg viewBox={`0 0 ${W + 150} ${g.beeswarm.length * rowH + 30}`} className="w-full" role="img" aria-label="SHAP beeswarm: each dot is a patient; colour = feature value (blue low, red high)">
      <line x1={150 + W / 2} x2={150 + W / 2} y1={0} y2={g.beeswarm.length * rowH} stroke="var(--line-strong)" />
      {g.beeswarm.map((b, i) => (
        <g key={b.feature}>
          <text x={144} y={i * rowH + 18} textAnchor="end" fontSize={10.5} fill="var(--fg-2)">{prettyName(b.feature).slice(0, 24)}</text>
          {b.points.map((p, k) => (
            <motion.circle key={k} cx={150 + x(p.shap)} cy={i * rowH + 15 + (((k * 7919) % 17) - 8) * 0.9} r={2.6}
              fill={`color-mix(in srgb, var(--red) ${Math.round(((p.value + 2.5) / 5) * 100)}%, var(--blue))`} fillOpacity={0.8}
              initial={{ opacity: 0, cx: 150 + W / 2 }} animate={{ opacity: 1, cx: 150 + x(p.shap) }} transition={{ delay: i * 0.05 + k * 0.002, duration: 0.5 }} />
          ))}
        </g>
      ))}
      <text x={150} y={g.beeswarm.length * rowH + 22} fontSize={10} fill="var(--muted)">← lowers risk</text>
      <text x={150 + W} y={g.beeswarm.length * rowH + 22} fontSize={10} fill="var(--muted)" textAnchor="end">raises risk →</text>
    </svg>
  );
}

export function SlopeChart({ a, b, aLabel, bLabel }: { a: FeatureImportance[]; b: FeatureImportance[]; aLabel: string; bLabel: string }) {
  const feats = [...new Set([...a.slice(0, 8), ...b.slice(0, 8)].map((f) => f.feature))].slice(0, 10);
  const rank = (arr: FeatureImportance[], f: string) => { const i = arr.findIndex((x) => x.feature === f); return i < 0 ? arr.length : i; };
  const H = 26 * 10 + 30;
  const y = (r: number) => 24 + Math.min(r, 10) * 26;
  return (
    <svg viewBox={`0 0 560 ${H}`} className="w-full" role="img" aria-label={`Feature ranking comparison between ${aLabel} and ${bLabel}`}>
      <text x={150} y={12} fontSize={11} fontWeight={700} fill="var(--blue)" textAnchor="middle">{aLabel}</text>
      <text x={410} y={12} fontSize={11} fontWeight={700} fill="var(--purple)" textAnchor="middle">{bLabel}</text>
      {feats.map((f, i) => {
        const ra = rank(a, f), rb = rank(b, f);
        const moved = Math.abs(ra - rb) >= 2;
        return (
          <g key={f}>
            <motion.line x1={210} x2={350} y1={y(ra)} y2={y(rb)} stroke={moved ? 'var(--saffron)' : 'var(--line-strong)'} strokeWidth={moved ? 2.2 : 1.3} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: i * 0.05 }} />
            <circle cx={210} cy={y(ra)} r={4} fill="var(--blue)" />
            <circle cx={350} cy={y(rb)} r={4} fill="var(--purple)" />
            {ra < 10 && <text x={202} y={y(ra) + 3.5} fontSize={10} textAnchor="end" fill="var(--fg-2)">{ra + 1}. {prettyName(f).slice(0, 22)}</text>}
            {rb < 10 && <text x={358} y={y(rb) + 3.5} fontSize={10} fill="var(--fg-2)">{rb + 1}. {prettyName(f).slice(0, 22)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function Waterfall({ l }: { l: LocalExplanation }) {
  const items = l.contributions;
  let run = l.baseValue;
  const steps = items.map((c) => { const s = run; run += c.contribution; return { ...c, start: s, end: run }; });
  const lo = Math.min(0, ...steps.map((s) => Math.min(s.start, s.end))), hi = Math.max(1, ...steps.map((s) => Math.max(s.start, s.end)));
  const W = 360;
  const sx = (v: number) => ((v - lo) / (hi - lo)) * W;
  return (
    <svg viewBox={`0 0 ${W + 190} ${(steps.length + 2) * 24 + 10}`} className="w-full" role="img" aria-label={`SHAP waterfall from base value ${l.baseValue.toFixed(2)} to probability ${l.probability.toFixed(2)}`}>
      <text x={182} y={16} textAnchor="end" fontSize={10.5} fill="var(--muted)">base value E[f(x)]</text>
      <rect x={190} y={6} width={Math.max(2, sx(l.baseValue))} height={14} rx={3} fill="var(--line-strong)" />
      <text x={194 + sx(l.baseValue)} y={17} fontSize={10} fill="var(--muted)">{l.baseValue.toFixed(3)}</text>
      {steps.map((s, i) => {
        const yy = (i + 1) * 24 + 6;
        const pos = s.contribution >= 0;
        return (
          <g key={s.feature}>
            <text x={182} y={yy + 11} textAnchor="end" fontSize={10.5} fill="var(--fg-2)">{s.feature === 'other features' ? 'other features' : prettyName(s.feature).slice(0, 24)}</text>
            <motion.rect y={yy} height={14} rx={3} fill={pos ? 'var(--red)' : 'var(--blue)'} initial={{ x: 190 + sx(s.start), width: 0 }} animate={{ x: 190 + sx(Math.min(s.start, s.end)), width: Math.max(1.5, Math.abs(sx(s.end) - sx(s.start))) }} transition={{ delay: 0.1 + i * 0.07, duration: 0.4 }} />
            <text x={196 + sx(Math.max(s.start, s.end))} y={yy + 11} fontSize={9.5} fill={pos ? 'var(--red)' : 'var(--blue)'} className="tnum">{pos ? '+' : ''}{s.contribution.toFixed(3)}</text>
          </g>
        );
      })}
      <text x={182} y={(steps.length + 1) * 24 + 22} textAnchor="end" fontSize={10.5} fontWeight={700} fill="var(--fg)">prediction f(x)</text>
      <rect x={190} y={(steps.length + 1) * 24 + 12} width={sx(l.probability)} height={14} rx={3} fill="var(--purple)" />
      <text x={196 + sx(l.probability)} y={(steps.length + 1) * 24 + 23} fontSize={10} fontWeight={700} fill="var(--purple)">{l.probability.toFixed(3)}</text>
    </svg>
  );
}
