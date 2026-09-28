export type GateName =
  | 'H' | 'X' | 'Y' | 'Z' | 'S' | 'T'
  | 'RX' | 'RY' | 'RZ' | 'P' | 'U3' | 'Rot'
  | 'CNOT' | 'CZ' | 'SWAP' | 'CRZ' | 'MEASURE' | 'BARRIER'
  | 'STATEPREP'; // extension: amplitude-encoding state preparation box (DECISIONS.md)

export type GateRole = 'encoding' | 'variational' | 'entangling' | 'measurement';

export interface GateOp {
  id: string;
  name: GateName;
  wires: number[]; // [target] or [control, target]
  params?: number[]; // radians (for STATEPREP: real amplitudes)
  paramRefs?: string[]; // e.g. ['x₃'] (data) or ['θ₁₂'] (trainable)
  role: GateRole;
  layer: number;
  block?: string;
}

export type EncodingKind = 'angle_rx' | 'angle_ry' | 'zz_feature_map' | 'pauli_feature_map' | 'amplitude' | 'iqp';
export type AnsatzKind = 'real_amplitudes' | 'efficient_su2' | 'strongly_entangling' | 'basic_entangler';
export type Entanglement = 'linear' | 'circular' | 'full' | 'pairwise';

export interface CircuitBlock {
  label: string;
  start: number; // first layer
  end: number; // last layer (inclusive)
  role: GateRole;
}

export interface CircuitSpec {
  nQubits: number;
  ops: GateOp[];
  depth: number;
  twoQubitGateCount: number;
  nTrainableParams: number;
  encoding: EncodingKind;
  ansatz?: AnsatzKind;
  estimatedRuntimeSec?: number;
  qasm?: string;
  blocks?: CircuitBlock[];
}

export interface BlochVector {
  x: number;
  y: number;
  z: number;
}

export interface SimResult {
  re: Float64Array;
  im: Float64Array;
  probabilities: number[];
  bloch: BlochVector[];
}
