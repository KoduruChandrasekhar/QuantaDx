/** Qubit Budget meter (dynamic element #5): reacts to feature selection / PCA, shakes when over budget, curved feature→qubit connectors. */
import { motion } from 'framer-motion';
import { AlertTriangle, Cpu } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { EncodingKind } from '@/types/quantum';
import { encodingQubits } from '@/lib/quantum/circuits';
import { bytes, duration } from '@/lib/format';
import { Select, Slider, cn } from '@/components/common/ui';
import { CountUp } from '@/components/common/misc';

const ENC: { value: EncodingKind; label: string }[] = [
  { value: 'zz_feature_map', label: 'ZZ feature map (angle-type)' }, { value: 'angle_ry', label: 'Angle RY' }, { value: 'angle_rx', label: 'Angle RX' },
  { value: 'pauli_feature_map', label: 'Pauli feature map' }, { value: 'iqp', label: 'IQP' }, { value: 'amplitude', label: 'Amplitude (log₂ n)' },
];

export function QubitBudget({ features, encoding, onEncoding, budget, onBudget }: { features: string[]; encoding: EncodingKind; onEncoding: (e: EncodingKind) => void; budget: number; onBudget: (b: number) => void }) {
  const n = features.length;
  const q = encodingQubits(encoding, n);
  const over = q > budget;
  const [shakeKey, setShakeKey] = useState(0);
  const prevOver = useRef(over);
  useEffect(() => {
    if (over && !prevOver.current) setShakeKey((k) => k + 1);
    prevOver.current = over;
  }, [over]);
  const color = over ? 'var(--red)' : q > budget * 0.8 ? 'var(--saffron)' : 'var(--green)';
  const mem = 16 * 2 ** Math.min(q, 60);
  const simSec = (2 ** Math.min(q, 40) * 60 * 500 * 100) / 4e9 + 0.4;
  const shown = features.slice(0, 16);
  const qubitsShown = Math.min(q, 16);
  const H = Math.max(shown.length, qubitsShown) * 22 + 10;
  return (
    <div className="card overflow-hidden" data-tour="pp-qubit-budget">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <Cpu size={16} className="text-quantum" />
        <h3 className="text-sm font-semibold text-fg">Qubit budget</h3>
        <span className="ml-auto text-[11px] text-muted">updates instantly</span>
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Encoding" value={encoding} onChange={onEncoding} options={ENC} />
          <Slider label="Budget (qubits)" value={budget} min={2} max={20} onChange={onBudget} accent="var(--purple)" />
        </div>
        <div key={shakeKey} className={cn('flex items-center gap-4 rounded-xl border p-3', over ? 'shake border-danger/50 bg-tint-red' : 'border-line bg-surface-2')}>
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
              <circle cx={40} cy={40} r={32} fill="none" stroke="var(--surface-3)" strokeWidth={8} />
              <motion.circle cx={40} cy={40} r={32} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" strokeDasharray={201} animate={{ strokeDashoffset: 201 * (1 - Math.min(1, q / budget)) }} transition={{ type: 'spring', stiffness: 120, damping: 18 }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="metric text-xl font-bold" style={{ color }}><CountUp value={q} duration={0.4} /></span>
              <span className="text-[9px] text-muted">/ {budget}</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-1 text-xs">
            <div className="text-fg-2"><b className="tnum">{n}</b> final features → <b className="tnum" style={{ color }}>{q}</b> qubits ({encoding === 'amplitude' ? '⌈log₂ n⌉' : 'n → n'})</div>
            <div className="text-muted">Statevector memory <b className="tnum text-fg-2">{bytes(mem)}</b> · sim ≈ <b className="text-fg-2">{duration(simSec)}</b> / run</div>
            {over ? (
              <div className="flex items-center gap-1 font-semibold text-danger"><AlertTriangle size={12} /> Over budget — enable PCA / feature selection or amplitude encoding</div>
            ) : q > 12 ? (
              <div className="text-saffron">Above 12 qubits: kernel concentration risk grows; hardware queue times rise.</div>
            ) : <div className="text-ok">Within budget · compatible with Aer and ibm_brisbane (127q)</div>}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-medium text-muted">Feature → qubit mapping</div>
          <svg viewBox={`0 0 320 ${H}`} className="w-full" role="img" aria-label={`${n} features mapped onto ${q} qubits`}>
            {shown.map((f, i) => {
              const target = encoding === 'amplitude' ? i % Math.max(1, qubitsShown) : i;
              if (target >= qubitsShown) return null;
              const y1 = 12 + i * 22, y2 = 12 + target * 22;
              return (
                <motion.path key={`${f}-${encoding}`} d={`M122,${y1} C190,${y1} 200,${y2} 250,${y2}`} fill="none" stroke={encoding === 'amplitude' ? 'var(--teal)' : 'var(--purple)'} strokeWidth={1.5} strokeOpacity={0.55}
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: i * 0.03, duration: 0.4 }} />
              );
            })}
            {shown.map((f, i) => (
              <g key={f}>
                <rect x={0} y={3 + i * 22} width={120} height={18} rx={5} fill="var(--tint-blue)" />
                <text x={6} y={15.5 + i * 22} fontSize={9.5} fill="var(--blue)" fontFamily="JetBrains Mono">{f.length > 18 ? `${f.slice(0, 17)}…` : f}</text>
              </g>
            ))}
            {Array.from({ length: qubitsShown }, (_, k) => (
              <g key={k}>
                <circle cx={262} cy={12 + k * 22} r={9} fill="var(--tint-purple)" stroke={k >= budget ? 'var(--red)' : 'var(--purple)'} strokeWidth={1.6} />
                <text x={262} y={15.5 + k * 22} fontSize={8.5} textAnchor="middle" fontWeight={700} fill="var(--purple)" fontFamily="JetBrains Mono">q{k}</text>
              </g>
            ))}
            {n > 16 && <text x={0} y={H - 1} fontSize={9} fill="var(--muted)">+ {n - 16} more features</text>}
          </svg>
        </div>
      </div>
    </div>
  );
}
