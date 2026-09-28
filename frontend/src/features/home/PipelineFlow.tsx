/** Animated 6-step pipeline (dynamic element #1): particles along edges, QPU ↔ optimizer loop, real progress, click to navigate. */
import { motion } from 'framer-motion';
import { Brain, Cpu, Database, Lightbulb, Stethoscope, Workflow } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useReducedMotion } from '@/hooks';
import { usePipeline } from '@/store';

const STEPS = [
  { key: 'data', label: 'Ingest', sub: 'EHR · genomics · imaging', icon: Database, to: '/data', color: 'var(--blue)' },
  { key: 'preprocess', label: 'Pre-process', sub: 'clean · scale · PCA', icon: Workflow, to: '/preprocess', color: 'var(--blue)' },
  { key: 'architecture', label: 'Quantum encode', sub: 'U_φ(x) feature map', icon: Cpu, to: '/architecture', color: 'var(--purple)' },
  { key: 'train', label: 'Hybrid train', sub: 'QPU ↔ optimizer', icon: Brain, to: '/models', color: 'var(--purple)' },
  { key: 'explain', label: 'Explain', sub: 'SHAP · kernels', icon: Lightbulb, to: '/explain', color: 'var(--teal)' },
  { key: 'predict', label: 'Decision support', sub: 'risk · threshold', icon: Stethoscope, to: '/predict', color: 'var(--green)' },
];

export function PipelineFlow({ compact }: { compact?: boolean }) {
  const reduced = useReducedMotion();
  const done = usePipeline((s) => s.completedSteps);
  const navigate = useNavigate();
  const W = 1000, H = compact ? 170 : 210;
  const nodeW = 132, nodeH = 74, y = 58;
  const gap = (W - 40 - nodeW * STEPS.length) / (STEPS.length - 1);
  const x = (i: number) => 20 + i * (nodeW + gap);
  const mainPath = `M${x(0) + nodeW},${y + nodeH / 2} L${x(STEPS.length - 1)},${y + nodeH / 2}`;
  const tx = x(3);
  const loop = `M${tx + 18},${y + nodeH} C${tx + 18},${y + nodeH + 58} ${tx + nodeW - 18},${y + nodeH + 58} ${tx + nodeW - 18},${y + nodeH}`;
  const isLit = (k: string) => done.includes(k as never) || (k === 'explain' && done.includes('train')) || (k === 'predict' && done.includes('train'));
  return (
    <div className="w-full overflow-x-auto" data-tour="home-pipeline">
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[720px]" role="img" aria-label="Pipeline: Ingest, Pre-process, Quantum encode, Hybrid train with QPU-optimizer loop, Explain, Decision support">
        <defs>
          <linearGradient id="flow-g" x1="0" x2="1">
            <stop offset="0" stopColor="var(--blue)" />
            <stop offset="0.5" stopColor="var(--purple)" />
            <stop offset="1" stopColor="var(--green)" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path d={mainPath} stroke="url(#flow-g)" strokeWidth={3} fill="none" opacity={0.35} />
        <path d={mainPath} stroke="url(#flow-g)" strokeWidth={2} fill="none" className={reduced ? '' : 'flow-dash'} />
        {!reduced && Array.from({ length: 6 }, (_, k) => (
          <circle key={k} r={4} fill={['var(--blue)', 'var(--purple)', 'var(--teal)'][k % 3]} filter="url(#glow)">
            <animateMotion dur="5s" begin={`${k * 0.83}s`} repeatCount="indefinite" path={mainPath} />
          </circle>
        ))}
        <path d={loop} stroke="var(--saffron)" strokeWidth={1.8} fill="none" strokeDasharray="5 4" className={reduced ? '' : 'flow-dash'} />
        {!reduced && (
          <circle r={4} fill="var(--saffron)" filter="url(#glow)">
            <animateMotion dur="2.2s" repeatCount="indefinite" path={loop} />
          </circle>
        )}
        <text x={tx + nodeW / 2} y={y + nodeH + 52} textAnchor="middle" fontSize={11} fill="var(--saffron)" fontWeight={600}>Classical optimizer ↻ θ</text>
        <text x={tx + nodeW / 2} y={y + nodeH + 66} textAnchor="middle" fontSize={9.5} fill="var(--muted)" fontFamily="JetBrains Mono">⟨Z⟩, loss ↓ · θ update ↑</text>
        {STEPS.map((s, i) => {
          const lit = isLit(s.key);
          const Icon = s.icon;
          return (
            <motion.g key={s.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              onClick={() => navigate(s.to)} style={{ cursor: 'pointer' }} role="link" aria-label={`${s.label}: ${s.sub}`} tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate(s.to)} whileHover={{ scale: 1.04 }}>
              <rect x={x(i)} y={y} width={nodeW} height={nodeH} rx={14} fill="var(--surface)" stroke={s.color} strokeWidth={lit ? 2.4 : 1.3} filter={lit ? 'url(#glow)' : undefined} />
              <rect x={x(i)} y={y} width={nodeW} height={nodeH} rx={14} fill={s.color} opacity={lit ? 0.1 : 0.04} />
              <foreignObject x={x(i) + 10} y={y + 12} width={28} height={28}>
                <div style={{ color: s.color }} className="flex h-7 w-7 items-center justify-center rounded-lg" >
                  <Icon size={18} />
                </div>
              </foreignObject>
              <text x={x(i) + 42} y={y + 30} fontSize={13} fontWeight={700} fill="var(--fg)">{s.label}</text>
              <text x={x(i) + 12} y={y + 58} fontSize={10} fill="var(--muted)">{s.sub}</text>
              <circle cx={x(i) + nodeW - 12} cy={y + 12} r={5} fill={lit ? 'var(--green)' : 'var(--line-strong)'} />
              <text x={x(i) + nodeW / 2} y={y - 10} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--muted)">{i + 1}</text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
