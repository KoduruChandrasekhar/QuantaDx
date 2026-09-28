import { useEffect, useMemo, useState } from 'react';
import type { GateOp } from '@/types/quantum';
import { gateColor, gateInfo } from '@/content/gates';
import { simulate } from '@/lib/quantum/simulator';
import { Badge, Drawer } from '../common/ui';
import { Tex } from '../common/misc';
import { Bloch } from './Bloch';

const ROLE_TEXT: Record<GateOp['role'], string> = {
  encoding: 'Loads patient data into the quantum state (data-dependent angle — outlined/hatched in the circuit).',
  variational: 'Trainable parameter θ updated by the classical optimizer (solid in the circuit).',
  entangling: 'Creates correlations between qubits so the model can capture feature interactions.',
  measurement: 'Reads out ⟨Z⟩ used to form the probability p = (1 + ⟨Z₀⟩)/2.',
};

export function GateDrawer({ gate, onClose }: { gate: GateOp | null; onClose: () => void }) {
  const info = gate ? gateInfo(gate.name === 'STATEPREP' ? 'H' : gate.name) : undefined;
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!gate) return;
    const id = setInterval(() => setPhase((p) => 1 - p), 1600);
    return () => clearInterval(id);
  }, [gate]);
  const demo = useMemo(() => {
    if (!gate) return null;
    const two = ['CNOT', 'CZ', 'SWAP', 'CRZ'].includes(gate.name);
    if (two) {
      const r = simulate(2, [
        { id: 'a', name: 'H', wires: [0], role: 'variational', layer: 0 },
        { id: 'b', name: gate.name, wires: [0, 1], params: gate.params, role: 'entangling', layer: 1 },
      ]);
      return { two: true, before: [{ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }], after: r.bloch };
    }
    if (gate.name === 'MEASURE' || gate.name === 'STATEPREP') return null;
    const r = simulate(1, [{ id: 'g', name: gate.name, wires: [0], params: gate.params ?? [Math.PI / 2, 0, 0], role: gate.role, layer: 0 }]);
    return { two: false, before: [{ x: 0, y: 0, z: 1 }], after: r.bloch };
  }, [gate]);

  return (
    <Drawer open={!!gate} onClose={onClose} title={gate ? `${info?.title ?? gate.name} gate` : ''}>
      {gate && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge solid color={gateColor(gate.name)}>{gate.name}</Badge>
            <Badge>{gate.role}</Badge>
            <span className="font-mono text-xs text-muted">wires {gate.wires.map((w) => `q${w}`).join(' → ')} · column {gate.layer}</span>
          </div>
          {info && <p className="text-sm text-fg-2">{info.description}</p>}
          {info && (
            <div className="rounded-xl border border-line bg-surface-2 p-4 text-center">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Matrix</div>
              <Tex block>{`${gate.name === 'CNOT' ? '\\mathrm{CNOT}' : gate.name}${info.params ? '(\\theta)' : ''} = ${info.matrix}`}</Tex>
            </div>
          )}
          {gate.params && gate.name !== 'STATEPREP' && (
            <div className="rounded-lg bg-surface-3 p-3 font-mono text-xs">
              {gate.paramRefs?.map((r, i) => <div key={i}>{r} = {gate.params![i]?.toFixed(4)} rad ({((gate.params![i] / Math.PI) || 0).toFixed(3)}π)</div>)}
            </div>
          )}
          {demo && (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{demo.two ? `H on q0, then ${gate.name}(q0 → q1)` : `Acting on |0⟩ ${phase ? '→ after' : '← before'}`}</div>
              <div className="flex justify-center gap-4">
                {(phase ? demo.after : demo.before).map((v, i) => <Bloch key={i} vector={v} size={150} label={`q${i}`} readout />)}
              </div>
              {info && <p className="mt-2 text-center text-xs text-muted">{info.bloch}</p>}
            </div>
          )}
          <div className="rounded-xl border border-line p-4">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Role in this model</div>
            <p className="text-sm text-fg-2">{ROLE_TEXT[gate.role]}</p>
            {gate.block && <p className="mt-1 text-xs text-muted">Block: {gate.block}</p>}
            {info && <p className="mt-2 text-sm text-fg-2"><span className="font-medium">Typical QML use:</span> {info.qml}</p>}
          </div>
        </div>
      )}
    </Drawer>
  );
}
