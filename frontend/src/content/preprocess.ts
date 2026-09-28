/** D1 pipeline step catalogue, defaults and presets. */
import type { PreprocessConfig, PreprocessStep, PreprocessStepKind } from '@/types/api';

export interface StepMeta {
  kind: PreprocessStepKind;
  title: string;
  component: string; // D1 key component
  description: string;
  options: { key: string; label: string; type: 'select' | 'number' | 'bool'; choices?: { value: string; label: string }[]; min?: number; max?: number; step?: number }[];
}

export const STEP_META: StepMeta[] = [
  {
    kind: 'dedupe', title: 'Data cleaning', component: 'Data cleaning',
    description: 'Drop duplicate rows, fix types, drop constant / near-constant columns and trim invalid ranges.',
    options: [
      { key: 'dropDuplicates', label: 'Drop duplicate rows', type: 'bool' },
      { key: 'dropConstant', label: 'Drop constant columns', type: 'bool' },
      { key: 'trimInvalid', label: 'Trim physiologically invalid values', type: 'bool' },
    ],
  },
  {
    kind: 'impute', title: 'Missing values', component: 'Handling missing data',
    description: 'Fill gaps without leaking test information: statistics come from training rows only.',
    options: [
      { key: 'method', label: 'Strategy', type: 'select', choices: [
        { value: 'drop', label: 'Drop rows' }, { value: 'mean', label: 'Mean' }, { value: 'median', label: 'Median' },
        { value: 'most_frequent', label: 'Most frequent' }, { value: 'knn', label: 'KNN' }, { value: 'iterative', label: 'Iterative (MICE)' },
      ] },
      { key: 'k', label: 'KNN neighbours', type: 'number', min: 1, max: 15, step: 1 },
      { key: 'indicator', label: 'Add missing-indicator columns', type: 'bool' },
    ],
  },
  {
    kind: 'outliers', title: 'Noise & outliers', component: 'Handling noisy data',
    description: 'Clip or winsorise extreme values; optional smoothing for signal-type features.',
    options: [
      { key: 'method', label: 'Method', type: 'select', choices: [
        { value: 'none', label: 'None' }, { value: 'iqr', label: 'IQR clip' }, { value: 'zscore', label: 'z-score clip' }, { value: 'winsorize', label: 'Winsorise' },
      ] },
      { key: 'threshold', label: 'z threshold', type: 'number', min: 2, max: 5, step: 0.5 },
      { key: 'smoothing', label: 'Smooth signal features', type: 'bool' },
    ],
  },
  {
    kind: 'encode_categorical', title: 'Categorical encoding', component: 'Data cleaning',
    description: 'Turn categorical codes into model-ready numbers.',
    options: [{ key: 'method', label: 'Encoding', type: 'select', choices: [{ value: 'onehot', label: 'One-hot' }, { value: 'ordinal', label: 'Ordinal' }] }],
  },
  {
    kind: 'scale', title: 'Normalisation', component: 'Normalization',
    description: 'Rotation angles must be bounded — MinMax [0, π] maps every feature to a valid, non-wrapping rotation.',
    options: [{ key: 'method', label: 'Scaler', type: 'select', choices: [
      { value: 'standard', label: 'StandardScaler' }, { value: 'minmax01', label: 'MinMax [0, 1]' }, { value: 'minmax_pi', label: 'MinMax [0, π] (angle encoding)' }, { value: 'robust', label: 'RobustScaler' },
    ] }],
  },
  {
    kind: 'balance', title: 'Class imbalance', component: 'Handling noisy data',
    description: 'Applied to the training split only — resampling validation/test data would inflate metrics.',
    options: [
      { key: 'method', label: 'Method', type: 'select', choices: [{ value: 'none', label: 'None' }, { value: 'class_weights', label: 'Class weights' }, { value: 'smote', label: 'SMOTE' }] },
      { key: 'k', label: 'SMOTE k_neighbors', type: 'number', min: 1, max: 10, step: 1 },
    ],
  },
  {
    kind: 'feature_select', title: 'Feature selection', component: 'Feature selection',
    description: 'Rank features on the training split and keep the top-k.',
    options: [
      { key: 'method', label: 'Method', type: 'select', choices: [
        { value: 'variance', label: 'Variance threshold' }, { value: 'mi', label: 'Mutual information' }, { value: 'anova', label: 'ANOVA-F' }, { value: 'rfe', label: 'RFE' }, { value: 'lasso', label: 'LASSO' },
      ] },
      { key: 'k', label: 'Keep top-k', type: 'number', min: 2, max: 40, step: 1 },
      { key: 'C', label: 'LASSO C', type: 'number', min: 0.01, max: 5, step: 0.01 },
    ],
  },
  {
    kind: 'reduce', title: 'Dimensionality reduction', component: 'Dimensionality reduction',
    description: 'Compress features into as many components as there are qubits.',
    options: [
      { key: 'method', label: 'Method', type: 'select', choices: [{ value: 'none', label: 'None' }, { value: 'pca', label: 'PCA' }, { value: 'lda', label: 'LDA' }, { value: 'autoencoder', label: 'Autoencoder' }] },
      { key: 'k', label: 'Components / latent size', type: 'number', min: 1, max: 12, step: 1 },
    ],
  },
];

const step = (kind: PreprocessStepKind, enabled: boolean, params: PreprocessStep['params']): PreprocessStep => ({ id: kind, kind, enabled, params });

export function quantumReadyPreset(): PreprocessConfig {
  return {
    steps: [
      step('dedupe', true, { dropDuplicates: true, dropConstant: true, trimInvalid: true }),
      step('impute', true, { method: 'median', k: 5, indicator: false }),
      step('outliers', true, { method: 'iqr', threshold: 3, smoothing: false }),
      step('encode_categorical', true, { method: 'onehot' }),
      step('scale', true, { method: 'minmax_pi' }),
      step('balance', true, { method: 'class_weights', k: 5 }),
      step('feature_select', false, { method: 'anova', k: 12, C: 0.5 }),
      step('reduce', true, { method: 'pca', k: 6 }),
    ],
    split: { train: 70, val: 15, test: 15, stratified: true, seed: 42 },
    targetQubits: 6,
    encoding: 'zz_feature_map',
  };
}

export const PREPROCESS_PRESETS: { id: string; label: string; description: string; build: () => PreprocessConfig }[] = [
  { id: 'quantum', label: 'Quantum-ready', description: 'PCA → 6 qubits, [0, π]', build: quantumReadyPreset },
  {
    id: 'genomics', label: 'Genomics', description: 'variance + LASSO + PCA → 8',
    build: () => {
      const c = quantumReadyPreset();
      c.steps = c.steps.map((s) =>
        s.kind === 'feature_select' ? { ...s, enabled: true, params: { method: 'lasso', k: 40, C: 0.2 } } : s.kind === 'reduce' ? { ...s, params: { method: 'pca', k: 8 } } : s,
      );
      c.targetQubits = 8;
      return c;
    },
  },
  {
    id: 'classical', label: 'Classical baseline', description: 'standardise, keep all features',
    build: () => {
      const c = quantumReadyPreset();
      c.steps = c.steps.map((s) => (s.kind === 'scale' ? { ...s, params: { method: 'standard' } } : s.kind === 'reduce' ? { ...s, enabled: false } : s));
      c.encoding = 'angle_ry';
      return c;
    },
  },
];
