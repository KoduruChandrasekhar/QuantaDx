/** Animated block diagram of the selected model (Section 8.9) with forward particles and gradient back-pulses. */
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { ModelKind } from '@/types/api';
import type { CircuitSpec } from '@/types/quantum';
import { useReducedMotion } from '@/hooks';
import { CircuitViewer } from './CircuitViewer';

type NodeKind = 'data' | 'classical' | 'quantum' | 'out';
const COLORS: Record<NodeKind, string> = { data: 'var(--muted)', classical: 'var(--blue)', quantum: 'var(--purple)', out: 'var(--green)' };

function nodesFor(kind: ModelKind, nq: number): { label: string; sub: string; kind: NodeKind; expand?: boolean }[] {
  switch (kind) {
    case 'hybrid_nn':
      return [
        { label: 'Input', sub: `x ∈ ℝ^${nq}`, kind: 'data' }, { label: 'Dense 16', sub: 'ReLU', kind: 'classical' },
        { label: 'Quantum layer', sub: `${nq}q · click to expand`, kind: 'quantum', expand: true }, { label: 'Dense 8', sub: 'ReLU', kind: 'classical' },
        { label: 'Sigmoid', sub: 'σ(z)', kind: 'classical' }, { label: 'P(disease)', sub: '0 … 1', kind: 'out' },
      ];
    case 'qsvm':
      return [
        { label: 'Features', sub: `${nq} scaled`, kind: 'data' }, { label: 'Quantum kernel', sub: 'K = |⟨φ(x)|φ(x′)⟩|²', kind: 'quantum', expand: true },
        { label: 'Classical SVM', sub: 'dual solver, C', kind: 'classical' }, { label: 'Decision', sub: 'sign(f(x))', kind: 'out' },
      ];
    case 'qsvr':
      return [
        { label: 'Features', sub: `${nq} scaled`, kind: 'data' }, { label: 'Quantum kernel', sub: 'fidelity K', kind: 'quantum', expand: true },
        { label: 'ε-SVR', sub: 'classical', kind: 'classical' }, { label: 'UPDRS', sub: 'predicted score', kind: 'out' },
      ];
    case 'vqr':
      return [
        { label: 'Scaled x', sub: '[0, π]', kind: 'data' }, { label: 'U_φ(x)', sub: 'encoding', kind: 'quantum', expand: true }, { label: 'W(θ)', sub: 'ansatz', kind: 'quantum', expand: true },
        { label: '⟨Z⟩', sub: 'expectation', kind: 'quantum' }, { label: 'Rescale', sub: 'a·⟨Z⟩ + b', kind: 'classical' }, { label: 'UPDRS', sub: 'score', kind: 'out' },
      ];
    case 'qnn':
      return [
        { label: 'Scaled x', sub: '[0, π]', kind: 'data' }, { label: 'QNode', sub: 'U_φ(x) · W(θ)', kind: 'quantum', expand: true },
        { label: '⟨Z₀⟩, ⟨Z₁⟩', sub: 'multi read-out', kind: 'quantum' }, { label: 'Classical head', sub: 'linear + σ', kind: 'classical' }, { label: 'P(disease)', sub: '0 … 1', kind: 'out' },
      ];
    default:
      return [
        { label: 'Scaled x', sub: '[0, π]', kind: 'data' }, { label: 'U_φ(x)', sub: 'feature map', kind: 'quantum', expand: true }, { label: 'W(θ)', sub: 'ansatz', kind: 'quantum', expand: true },
        { label: '⟨Z₀⟩', sub: 'measure', kind: 'quantum' }, { label: 'p = (1+⟨Z₀⟩)/2', sub: 'probability', kind: 'classical' }, { label: 'Threshold', sub: 'decision', kind: 'out' },
      ];
  }
}

export function HybridArchitecture({ kind, nQubits, circuit, training }: { kind: ModelKind; nQubits: number; circuit?: CircuitSpec; training?: boolean }) {
  const reduced = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const nodes = nodesFor(kind, nQubits);
  const W = 760, H = 150, pad = 20;
  const nw = (W - pad * 2 - (nodes.length - 1) * 22) / nodes.length;
  const cx = (i: number) => pad + i * (nw + 22) + nw / 2;
  const y = 64;
  const path = `M${cx(0)},${y} L${cx(nodes.length - 1)},${y}`;
  const back = `M${cx(nodes.length - 1)},${y + 34} L${cx(0)},${y + 34}`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Architecture: ${nodes.map((n) => n.label).join(' → ')}`}>
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--line-strong)" />
          </marker>
        </defs>
        {nodes.slice(0, -1).map((_, i) => (
          <line key={i} x1={cx(i) + nw / 2} y1={y} x2={cx(i + 1) - nw / 2 - 2} y2={y} stroke="var(--line-strong)" strokeWidth={1.6} markerEnd="url(#arr)" />
        ))}
        {nodes.map((n, i) => (
          <g key={i} onClick={() => n.expand && setExpanded((e) => !e)} style={{ cursor: n.expand ? 'pointer' : 'default' }}>
            <motion.rect x={cx(i) - nw / 2} y={y - 26} width={nw} height={52} rx={10} fill={`color-mix(in srgb, ${COLORS[n.kind]} 11%, var(--surface))`} stroke={COLORS[n.kind]} strokeWidth={n.expand ? 2 : 1.4}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} />
            <text x={cx(i)} y={y - 3} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={COLORS[n.kind]}>{n.label}</text>
            <text x={cx(i)} y={y + 13} textAnchor="middle" fontSize={9} fill="var(--muted)" fontFamily="JetBrains Mono">{n.sub}</text>
          </g>
        ))}
        {!reduced && [0, 1, 2].map((k) => (
          <circle key={k} r={3.5} fill="var(--blue)">
            <animateMotion dur="2.4s" begin={`${k * 0.8}s`} repeatCount="indefinite" path={path} />
          </circle>
        ))}
        {training && (
          <g>
            <path d={back} stroke="var(--saffron)" strokeWidth={1.2} strokeDasharray="4 4" fill="none" opacity={0.6} />
            {!reduced && (
              <circle r={4.5} fill="var(--saffron)">
                <animateMotion dur="1.6s" repeatCount="indefinite" path={back} />
              </circle>
            )}
            <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={10.5} fill="var(--saffron)" fontFamily="JetBrains Mono">
              parameter-shift: ∂f/∂θ = ½[f(θ + π/2) − f(θ − π/2)]
            </text>
          </g>
        )}
      </svg>
      <AnimatePresence>
        {expanded && circuit && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-2 rounded-lg border border-quantum/30 bg-tint-purple p-2">
              <div className="mb-1 text-[11px] font-semibold text-quantum">Inside the quantum block</div>
              <CircuitViewer spec={circuit} compact toolbar={false} maxHeight={260} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
