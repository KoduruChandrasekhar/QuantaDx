import { describe, expect, it } from 'vitest';
import type { GateOp } from '@/types/quantum';
import { StateVector, simulate, dirac } from './simulator';
import { buildCircuit } from './circuits';
import { fidelityKernel } from './kernel';
import { mulberry32 } from '../prng';

const op = (name: GateOp['name'], wires: number[], layer: number, params?: number[]): GateOp => ({
  id: `${name}${layer}${wires.join('')}`,
  name,
  wires,
  params,
  role: 'variational',
  layer,
});

describe('statevector simulator', () => {
  it('H|0⟩ gives [0.5, 0.5]', () => {
    const r = simulate(1, [op('H', [0], 0)]);
    expect(r.probabilities[0]).toBeCloseTo(0.5, 9);
    expect(r.probabilities[1]).toBeCloseTo(0.5, 9);
  });

  it('X|0⟩ = |1⟩', () => {
    const r = simulate(1, [op('X', [0], 0)]);
    expect(r.probabilities[1]).toBeCloseTo(1, 9);
  });

  it('RY(π/2)|0⟩ has Bloch vector (1,0,0)', () => {
    const r = simulate(1, [op('RY', [0], 0, [Math.PI / 2])]);
    expect(r.bloch[0].x).toBeCloseTo(1, 9);
    expect(r.bloch[0].y).toBeCloseTo(0, 9);
    expect(r.bloch[0].z).toBeCloseTo(0, 9);
  });

  it('Bell state: P(00)=P(11)=0.5 and both Bloch vectors ≈ 0', () => {
    const r = simulate(2, [op('H', [0], 0), op('CNOT', [0, 1], 1)]);
    expect(r.probabilities[0]).toBeCloseTo(0.5, 9);
    expect(r.probabilities[3]).toBeCloseTo(0.5, 9);
    for (const b of r.bloch) expect(Math.hypot(b.x, b.y, b.z)).toBeLessThan(1e-9);
    expect(dirac(r.re, r.im, 2)).toBe('0.707|00⟩ + 0.707|11⟩');
  });

  it('RZ on |0⟩ leaves probabilities unchanged', () => {
    const r = simulate(1, [op('RZ', [0], 0, [1.234])]);
    expect(r.probabilities[0]).toBeCloseTo(1, 9);
  });

  it('+i state has ⟨Y⟩ = +1', () => {
    const r = simulate(1, [op('H', [0], 0), op('S', [0], 1)]);
    expect(r.bloch[0].y).toBeCloseTo(1, 9);
  });

  it('norm stays 1 after random circuits', () => {
    const rand = mulberry32(3);
    const names: GateOp['name'][] = ['H', 'X', 'Y', 'Z', 'S', 'T', 'RX', 'RY', 'RZ', 'P', 'U3', 'Rot', 'CNOT', 'CZ', 'SWAP', 'CRZ'];
    for (let t = 0; t < 20; t++) {
      const n = 1 + Math.floor(rand() * 6);
      const sv = new StateVector(n);
      for (let k = 0; k < 40; k++) {
        const name = names[Math.floor(rand() * names.length)];
        const two = ['CNOT', 'CZ', 'SWAP', 'CRZ'].includes(name);
        if (two && n < 2) continue;
        const a = Math.floor(rand() * n);
        let b = Math.floor(rand() * n);
        if (b === a) b = (a + 1) % n;
        sv.applyOp(op(name, two ? [a, b] : [a], k, [rand() * 6, rand() * 6, rand() * 6]));
      }
      expect(Math.abs(sv.norm() - 1)).toBeLessThan(1e-9);
    }
  });

  it('GHZ(3) has P(000)=P(111)=0.5', () => {
    const r = simulate(3, [op('H', [0], 0), op('CNOT', [0, 1], 1), op('CNOT', [1, 2], 2)]);
    expect(r.probabilities[0]).toBeCloseTo(0.5, 9);
    expect(r.probabilities[7]).toBeCloseTo(0.5, 9);
  });
});

describe('quantum kernel', () => {
  it('diagonal = 1 and symmetric', () => {
    const rand = mulberry32(1);
    const xs = Array.from({ length: 8 }, () => Array.from({ length: 4 }, () => rand() * Math.PI));
    const K = fidelityKernel(xs, 'zz_feature_map', 0.3);
    for (let i = 0; i < 8; i++) {
      expect(K[i][i]).toBeCloseTo(1, 9);
      for (let j = 0; j < 8; j++) expect(K[i][j]).toBeCloseTo(K[j][i], 12);
    }
  });
  it('self-fidelity computed from states equals 1', () => {
    const K = fidelityKernel([[0.3, 1.2], [0.3, 1.2]], 'zz_feature_map', 1);
    expect(K[0][1]).toBeCloseTo(1, 9);
  });
});

describe('circuit builder', () => {
  it('ZZ feature map on 6 qubits with RealAmplitudes', () => {
    const spec = buildCircuit({ nQubits: 6, encoding: 'zz_feature_map', encodingReps: 2, ansatz: 'real_amplitudes', layers: 2 });
    expect(spec.nTrainableParams).toBe(18);
    expect(spec.ops.filter((o) => o.name === 'MEASURE')).toHaveLength(6);
    expect(spec.twoQubitGateCount).toBe(2 * 2 * 5 + 2 * 5);
    expect(spec.qasm).toContain('qreg q[6];');
  });
});
