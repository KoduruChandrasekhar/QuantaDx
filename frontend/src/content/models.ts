/** Model catalogue (D3): classical baselines + quantum / hybrid models. */
import type { ModelFamily, ModelKind, TaskType } from '@/types/api';

export interface ModelMeta {
  kind: ModelKind;
  label: string;
  short: string;
  family: ModelFamily;
  task: TaskType;
  description: string;
  hyper: { key: string; label: string; type: 'number' | 'select' | 'bool'; value: number | string | boolean; min?: number; max?: number; step?: number; choices?: string[] }[];
  usesCircuit: boolean;
}

export const MODEL_CATALOG: ModelMeta[] = [
  { kind: 'logreg', label: 'Logistic Regression', short: 'LogReg', family: 'classical', task: 'classification', usesCircuit: false,
    description: 'L2-regularised linear baseline. Strong on well-separated tabular data.',
    hyper: [{ key: 'C', label: 'C (inverse regularisation)', type: 'number', value: 1, min: 0.01, max: 100, step: 0.01 }] },
  { kind: 'svm_rbf', label: 'SVM (RBF)', short: 'SVM-RBF', family: 'classical', task: 'classification', usesCircuit: false,
    description: 'Classical kernel machine — the fairest baseline for the quantum kernel.',
    hyper: [{ key: 'C', label: 'C', type: 'number', value: 1, min: 0.01, max: 100, step: 0.01 }, { key: 'gamma', label: 'γ', type: 'select', value: 'scale', choices: ['scale', 'auto', '0.1', '0.01'] }] },
  { kind: 'random_forest', label: 'Random Forest', short: 'RF', family: 'classical', task: 'classification', usesCircuit: false,
    description: 'Bagged decision trees; robust to noise and mixed feature types.',
    hyper: [{ key: 'n_estimators', label: 'Trees', type: 'number', value: 300, min: 10, max: 1000, step: 10 }, { key: 'max_depth', label: 'Max depth', type: 'number', value: 8, min: 2, max: 32, step: 1 }] },
  { kind: 'xgboost', label: 'XGBoost', short: 'XGB', family: 'classical', task: 'classification', usesCircuit: false,
    description: 'Gradient-boosted trees; typically the strongest tabular baseline.',
    hyper: [{ key: 'n_estimators', label: 'Rounds', type: 'number', value: 400, min: 50, max: 2000, step: 50 }, { key: 'learning_rate', label: 'η', type: 'number', value: 0.05, min: 0.005, max: 0.5, step: 0.005 }] },
  { kind: 'mlp', label: 'MLP', short: 'MLP', family: 'classical', task: 'classification', usesCircuit: false,
    description: 'Two-layer perceptron with early stopping.',
    hyper: [{ key: 'hidden', label: 'Hidden units', type: 'number', value: 32, min: 4, max: 256, step: 4 }] },
  { kind: 'qsvm', label: 'Quantum SVM', short: 'QSVM', family: 'quantum', task: 'classification', usesCircuit: true,
    description: 'Fidelity quantum kernel k(x,x′)=|⟨φ(x)|φ(x′)⟩|² fed to a classical SVM. Bandwidth-tuned to beat kernel concentration.',
    hyper: [{ key: 'C', label: 'SVM C', type: 'number', value: 1, min: 0.01, max: 100, step: 0.01 }, { key: 'bandwidth', label: 'Bandwidth mode', type: 'select', value: 'auto', choices: ['auto', 'fixed'] }] },
  { kind: 'vqc', label: 'Variational Quantum Classifier', short: 'VQC', family: 'quantum', task: 'classification', usesCircuit: true,
    description: 'U_φ(x) feature map + trainable ansatz W(θ); p = (1 + ⟨Z₀⟩)/2.',
    hyper: [] },
  { kind: 'qnn', label: 'Quantum Neural Network', short: 'QNN', family: 'quantum', task: 'classification', usesCircuit: true,
    description: 'PennyLane QNode as a model with multi-qubit expectation read-out and a classical head.',
    hyper: [{ key: 'outputs', label: 'Measured qubits', type: 'number', value: 2, min: 1, max: 6, step: 1 }] },
  { kind: 'hybrid_nn', label: 'Hybrid Neural Network', short: 'Hybrid NN', family: 'hybrid', task: 'classification', usesCircuit: true,
    description: 'Dense → quantum layer → Dense → sigmoid. Trained end-to-end with parameter-shift gradients.',
    hyper: [{ key: 'pre', label: 'Pre-dense units', type: 'number', value: 16, min: 4, max: 128, step: 4 }, { key: 'post', label: 'Post-dense units', type: 'number', value: 8, min: 2, max: 64, step: 2 }] },
  { kind: 'linreg', label: 'Linear Regression', short: 'LinReg', family: 'classical', task: 'regression', usesCircuit: false,
    description: 'Ordinary least squares baseline.', hyper: [] },
  { kind: 'svr_rbf', label: 'SVR (RBF)', short: 'SVR', family: 'classical', task: 'regression', usesCircuit: false,
    description: 'Classical kernel regression.', hyper: [{ key: 'C', label: 'C', type: 'number', value: 10, min: 0.1, max: 100, step: 0.1 }, { key: 'epsilon', label: 'ε', type: 'number', value: 0.5, min: 0.01, max: 5, step: 0.01 }] },
  { kind: 'rf_regressor', label: 'Random Forest Regressor', short: 'RF-R', family: 'classical', task: 'regression', usesCircuit: false,
    description: 'Bagged regression trees.', hyper: [{ key: 'n_estimators', label: 'Trees', type: 'number', value: 300, min: 10, max: 1000, step: 10 }] },
  { kind: 'qsvr', label: 'Quantum SVR', short: 'QSVR', family: 'quantum', task: 'regression', usesCircuit: true,
    description: 'Quantum fidelity kernel + classical ε-SVR.', hyper: [{ key: 'epsilon', label: 'ε', type: 'number', value: 0.5, min: 0.01, max: 5, step: 0.01 }] },
  { kind: 'vqr', label: 'Variational Quantum Regressor', short: 'VQR', family: 'quantum', task: 'regression', usesCircuit: true,
    description: 'Encoding + ansatz; ⟨Z⟩ rescaled to the target range.', hyper: [] },
];

export const modelMeta = (kind: ModelKind): ModelMeta => MODEL_CATALOG.find((m) => m.kind === kind)!;

export const FAMILY_META: Record<ModelFamily, { label: string; color: string; tint: string; text: string }> = {
  classical: { label: 'Classical', color: 'var(--blue)', tint: 'var(--tint-blue)', text: 'text-classical' },
  quantum: { label: 'Quantum', color: 'var(--purple)', tint: 'var(--tint-purple)', text: 'text-quantum' },
  hybrid: { label: 'Hybrid', color: 'var(--teal)', tint: 'var(--tint-teal)', text: 'text-hybrid' },
};

/** Per-model colour + dash so models within a family are distinguishable without colour alone. */
const SHADES: Record<ModelFamily, string[]> = {
  classical: ['#0070C0', '#2E8BD8', '#0A4F8A', '#5AA9E6', '#1B6FA8'],
  quantum: ['#7B3FA0', '#A35CC8', '#5B2A7A', '#C08BDF', '#8E4DB5'],
  hybrid: ['#0E8C8C', '#15B0B0', '#0A6666'],
};
const DASHES = ['0', '6 3', '2 3', '10 3 2 3', '1 2'];

export function modelStyle(family: ModelFamily, indexInFamily: number): { color: string; dash: string } {
  const s = SHADES[family];
  return { color: s[indexInFamily % s.length], dash: DASHES[indexInFamily % DASHES.length] };
}

export function stylesFor(models: { modelId: string; family: ModelFamily }[]): Record<string, { color: string; dash: string }> {
  const counters: Record<ModelFamily, number> = { classical: 0, quantum: 0, hybrid: 0 };
  const out: Record<string, { color: string; dash: string }> = {};
  for (const m of models) out[m.modelId] = modelStyle(m.family, counters[m.family]++);
  return out;
}
