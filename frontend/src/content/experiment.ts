/** Default experiment configurations and Model Studio presets (D3). */
import type { ExperimentConfig, ModelKind, ModelSpec, QuantumConfig } from '@/types/api';
import { modelMeta } from './models';

export const POC_QUANTUM: QuantumConfig = {
  encoding: 'zz_feature_map',
  encodingReps: 2,
  kernelBandwidth: 0.2,
  bandwidthSearch: [0.05, 0.1, 0.2, 0.3, 0.5, 1.0],
  ansatz: 'real_amplitudes',
  layers: 2,
  entanglement: 'linear',
  optimizer: 'cobyla',
  maxIter: 100,
  learningRate: 0.05,
  gradient: 'parameter_shift',
  readout: 'expval_z0',
  execution: { backend: 'statevector', shots: 1024, noise: { depolarizing: 0.002, readout: 0.02, t1Us: 140, t2Us: 70, deviceModel: 'fake_manila' }, deviceName: 'ibm_brisbane', mitigation: { readout: true, zne: false } },
  seed: 42,
};

export function spec(kind: ModelKind, modelId: string = kind, label?: string): ModelSpec {
  const m = modelMeta(kind);
  return { modelId, kind, label: label ?? m.label, family: m.family, hyper: Object.fromEntries(m.hyper.map((h) => [h.key, h.value])) };
}

export const POC_MODELS: ModelSpec[] = [
  spec('logreg'), spec('svm_rbf'), spec('random_forest'), spec('xgboost'),
  spec('qsvm', 'qsvm_raw', 'QSVM · raw ZZ kernel (bw 1.0)'), spec('qsvm', 'qsvm_bw', 'QSVM · bandwidth-tuned'),
  spec('vqc'), spec('qnn'), spec('hybrid_nn'),
];

export const DEFAULT_PROTOCOL: ExperimentConfig['protocol'] = { folds: 5, repeats: 1, holdout: 0.15, primaryMetric: 'sens@spec≥0.90', noiseSweep: true, qubitScaling: true, externalDatasetId: undefined };

export function pocConfig(): ExperimentConfig {
  return { name: 'PoC · QSVM ZZ 6q bandwidth-tuned vs classical', datasetId: 'wdbc', taskType: 'classification', models: POC_MODELS, quantum: POC_QUANTUM, protocol: DEFAULT_PROTOCOL, nQubits: 6 };
}

export interface StudioPreset {
  id: string;
  label: string;
  description: string;
  models: ModelKind[];
  quantum: Partial<QuantumConfig>;
  protocol?: Partial<ExperimentConfig['protocol']>;
}

export const STUDIO_PRESETS: StudioPreset[] = [
  { id: 'poc', label: 'PoC: QSVM ZZ 6q bandwidth-tuned', description: 'Reproduces the Section 6.4 proof of concept.', models: ['logreg', 'svm_rbf', 'random_forest', 'qsvm'], quantum: { ...POC_QUANTUM } },
  { id: 'fast', label: 'Fast demo', description: 'Two baselines + VQC, 1 ansatz layer, 40 iterations.', models: ['logreg', 'random_forest', 'vqc'], quantum: { ansatz: 'real_amplitudes', layers: 1, maxIter: 40, encoding: 'angle_ry', encodingReps: 1 }, protocol: { folds: 3 } },
  { id: 'hardware', label: 'Hardware-friendly: shallow + SPSA', description: 'Angle encoding, 1 layer, SPSA, 4096 shots, readout mitigation + ZNE.', models: ['logreg', 'vqc'], quantum: { encoding: 'angle_ry', encodingReps: 1, layers: 1, optimizer: 'spsa', entanglement: 'linear', execution: { ...POC_QUANTUM.execution, backend: 'noisy', shots: 4096, mitigation: { readout: true, zne: true } } } },
  { id: 'full', label: 'Full benchmark', description: 'All classical + all quantum/hybrid models, 10-fold CV, noise + scaling studies.', models: ['logreg', 'svm_rbf', 'random_forest', 'xgboost', 'mlp', 'qsvm', 'vqc', 'qnn', 'hybrid_nn'], quantum: { ...POC_QUANTUM }, protocol: { folds: 10, noiseSweep: true, qubitScaling: true } },
];
