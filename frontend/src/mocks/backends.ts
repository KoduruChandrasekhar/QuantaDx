import type { QuantumBackend } from '@/types/api';

const SIM_GATES = ['h', 'x', 'y', 'z', 's', 't', 'rx', 'ry', 'rz', 'p', 'u3', 'cx', 'cz', 'swap', 'crz'];
const HW_GATES = ['ecr', 'id', 'rz', 'sx', 'x'];

let tick = 0;

export function listBackends(): QuantumBackend[] {
  tick++;
  const q = (base: number, amp: number) => Math.max(0, Math.round(base + Math.sin(tick / 3) * amp));
  return [
    { id: 'aer_statevector', name: 'Aer statevector', provider: 'Qiskit Aer', kind: 'statevector', qubits: 30, status: 'online', queue: 0, basisGates: SIM_GATES, connectivity: 'all-to-all', requiresToken: false },
    { id: 'default_qubit', name: 'default.qubit (adjoint)', provider: 'PennyLane', kind: 'statevector', qubits: 26, status: 'online', queue: 0, basisGates: SIM_GATES, connectivity: 'all-to-all', requiresToken: false },
    { id: 'aer_shots', name: 'Aer shots (qasm)', provider: 'Qiskit Aer', kind: 'shots', qubits: 30, status: 'online', queue: q(1, 1), basisGates: SIM_GATES, connectivity: 'all-to-all', requiresToken: false },
    { id: 'aer_noisy_manila', name: 'Aer noisy · fake_manila', provider: 'Qiskit Aer', kind: 'noisy', qubits: 5, status: 'online', queue: q(2, 2), basisGates: HW_GATES, connectivity: 'linear', readoutError: 0.021, cxError: 0.0085, t1Us: 142, t2Us: 71, requiresToken: false },
    { id: 'aer_noisy_brisbane', name: 'Aer noisy · fake_brisbane', provider: 'Qiskit Aer', kind: 'noisy', qubits: 127, status: 'online', queue: q(1, 1), basisGates: HW_GATES, connectivity: 'heavy-hex', readoutError: 0.013, cxError: 0.0074, t1Us: 228, t2Us: 146, requiresToken: false },
    { id: 'ibm_brisbane', name: 'ibm_brisbane', provider: 'IBM Quantum', kind: 'hardware', qubits: 127, status: 'online', queue: q(12, 4), basisGates: HW_GATES, maxDepth: 300, connectivity: 'heavy-hex', readoutError: 0.014, cxError: 0.0077, t1Us: 221, t2Us: 139, requiresToken: true },
    { id: 'ibm_kyiv', name: 'ibm_kyiv', provider: 'IBM Quantum', kind: 'hardware', qubits: 127, status: tick % 40 < 36 ? 'online' : 'maintenance', queue: q(31, 6), basisGates: HW_GATES, maxDepth: 300, connectivity: 'heavy-hex', readoutError: 0.011, cxError: 0.0069, t1Us: 262, t2Us: 118, requiresToken: true },
  ];
}
