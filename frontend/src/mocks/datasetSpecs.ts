/** Seeded benchmark dataset specifications (Section 6.5). Class-conditional means/SDs approximate the public datasets. */
import type { Dataset } from '@/types/api';

export interface FeatureSpec {
  name: string;
  unit?: string;
  group?: string;
  kind?: 'num' | 'int' | 'bin';
  neg: [number, number]; // mean, sd for class 0 (or base for regression)
  pos?: [number, number]; // class 1
  slope?: number; // regression: correlation with target
  latent?: 'size' | 'shape' | 'voice';
  missing?: number;
  min?: number;
  max?: number;
  description?: string;
}

export interface DatasetSpec {
  meta: Omit<Dataset, 'columns' | 'hash' | 'createdAt'>;
  nPos: number;
  features: FeatureSpec[];
  generatedGenes?: { total: number; informative: number };
  idColumn?: string;
  duplicates?: number;
  regression?: { mean: number; sd: number; min: number; max: number };
}

const wdbc = (base: string, unit: string, neg: [number, number], pos: [number, number], latent?: FeatureSpec['latent']): FeatureSpec[] => [
  { name: `${base}_mean`, unit, group: 'Mean', neg, pos, latent, min: 0 },
  { name: `${base}_se`, unit, group: 'Standard error', neg: [neg[0] * 0.07 + neg[1] * 0.05, neg[1] * 0.04 + neg[0] * 0.02], pos: [pos[0] * 0.09 + pos[1] * 0.06, pos[1] * 0.06 + pos[0] * 0.03], latent, min: 0 },
  { name: `${base}_worst`, unit, group: 'Worst', neg: [neg[0] * 1.12, neg[1] * 1.15], pos: [pos[0] * 1.22, pos[1] * 1.35], latent, min: 0 },
];

const WDBC_BASE: [string, string, [number, number], [number, number], FeatureSpec['latent']][] = [
  ['radius', 'mm', [12.15, 1.78], [17.46, 3.2], 'size'],
  ['texture', 'SD gray', [17.9, 4.0], [21.6, 3.8], undefined],
  ['perimeter', 'mm', [78.1, 11.8], [115.4, 21.9], 'size'],
  ['area', 'mm²', [463, 134], [978, 368], 'size'],
  ['smoothness', '', [0.0925, 0.0134], [0.1029, 0.0126], undefined],
  ['compactness', '', [0.08, 0.034], [0.145, 0.054], 'shape'],
  ['concavity', '', [0.046, 0.043], [0.161, 0.075], 'shape'],
  ['concave_points', '', [0.0257, 0.0159], [0.088, 0.034], 'shape'],
  ['symmetry', '', [0.174, 0.0248], [0.193, 0.0276], undefined],
  ['fractal_dimension', '', [0.0629, 0.0067], [0.0627, 0.0076], undefined],
];

// WDBC column order follows the UCI file: 10 means, 10 SEs, 10 worst.
const wdbcAll = WDBC_BASE.map(([b, u, n, p, l]) => wdbc(b, u, n, p, l));
const WDBC_FEATURES: FeatureSpec[] = [0, 1, 2].flatMap((k) => wdbcAll.map((triple) => triple[k]));
// Demo copy: inject a little missingness to exercise the D1 pipeline (documented in the UI).
WDBC_FEATURES[1].missing = 0.012;
WDBC_FEATURES[6].missing = 0.009;
WDBC_FEATURES[13].missing = 0.007;
WDBC_FEATURES[24].missing = 0.005;

export const SPECS: DatasetSpec[] = [
  {
    meta: {
      id: 'wdbc', name: 'Wisconsin Breast Cancer (Diagnostic)', shortName: 'Breast Cancer (WDBC)', disease: 'cancer', modality: 'imaging_features',
      rows: 569, features: 30, taskType: 'classification', target: 'diagnosis', positiveClass: 'M',
      classBalance: { positive: 212, negative: 357, positiveLabel: 'Malignant (M)', negativeLabel: 'Benign (B)' },
      source: 'UCI ML Repository · FNA digitised images', benchmark: true,
    },
    nPos: 212, features: WDBC_FEATURES, idColumn: 'patient_id', duplicates: 3,
  },
  {
    meta: {
      id: 'heart', name: 'UCI Heart Disease (Cleveland)', shortName: 'Heart Disease', disease: 'cardiovascular', modality: 'tabular_ehr',
      rows: 303, features: 13, taskType: 'classification', target: 'num', positiveClass: '1',
      classBalance: { positive: 139, negative: 164, positiveLabel: 'Disease', negativeLabel: 'No disease' }, source: 'UCI ML Repository', benchmark: true,
    },
    nPos: 139,
    features: [
      { name: 'age', unit: 'years', neg: [52.6, 9.5], pos: [56.6, 8], kind: 'int', min: 29, max: 77, group: 'Demographics' },
      { name: 'sex', neg: [0.56, 0], pos: [0.82, 0], kind: 'bin', group: 'Demographics', description: '1 = male' },
      { name: 'cp', neg: [2.8, 0.9], pos: [3.6, 0.8], kind: 'int', min: 1, max: 4, group: 'Symptoms', description: 'Chest-pain type' },
      { name: 'trestbps', unit: 'mm Hg', neg: [129, 16], pos: [134, 19], kind: 'int', group: 'Vitals' },
      { name: 'chol', unit: 'mg/dL', neg: [242, 53], pos: [251, 49], kind: 'int', group: 'Labs' },
      { name: 'fbs', neg: [0.14, 0], pos: [0.16, 0], kind: 'bin', group: 'Labs', description: 'Fasting blood sugar > 120 mg/dL' },
      { name: 'restecg', neg: [0.45, 0.5], pos: [1.2, 0.8], kind: 'int', min: 0, max: 2, group: 'ECG' },
      { name: 'thalach', unit: 'bpm', neg: [158, 19], pos: [139, 22], kind: 'int', group: 'ECG' },
      { name: 'exang', neg: [0.14, 0], pos: [0.55, 0], kind: 'bin', group: 'ECG' },
      { name: 'oldpeak', unit: 'mm', neg: [0.59, 0.78], pos: [1.58, 1.3], min: 0, group: 'ECG' },
      { name: 'slope', neg: [1.4, 0.6], pos: [1.8, 0.55], kind: 'int', min: 1, max: 3, group: 'ECG' },
      { name: 'ca', neg: [0.27, 0.6], pos: [1.13, 1], kind: 'int', min: 0, max: 3, missing: 0.013, group: 'Imaging' },
      { name: 'thal', neg: [3.8, 1.4], pos: [5.8, 1.6], kind: 'int', min: 3, max: 7, missing: 0.007, group: 'Imaging' },
    ],
    idColumn: 'record_id', duplicates: 1,
  },
  {
    meta: {
      id: 'pima', name: 'Pima Indians Diabetes', shortName: 'Pima Diabetes', disease: 'diabetes', modality: 'tabular_ehr',
      rows: 768, features: 8, taskType: 'classification', target: 'Outcome', positiveClass: '1',
      classBalance: { positive: 268, negative: 500, positiveLabel: 'Diabetic', negativeLabel: 'Non-diabetic' }, source: 'NIDDK via UCI', benchmark: true,
    },
    nPos: 268,
    features: [
      { name: 'Pregnancies', neg: [3.3, 3], pos: [4.9, 3.7], kind: 'int', min: 0 },
      { name: 'Glucose', unit: 'mg/dL', neg: [110, 26], pos: [141, 32], min: 40, missing: 0.006 },
      { name: 'BloodPressure', unit: 'mm Hg', neg: [70, 12], pos: [75, 12], min: 30, missing: 0.046 },
      { name: 'SkinThickness', unit: 'mm', neg: [27, 10], pos: [33, 10], min: 7, missing: 0.2 },
      { name: 'Insulin', unit: 'µU/mL', neg: [130, 100], pos: [206, 130], min: 14, missing: 0.3 },
      { name: 'BMI', unit: 'kg/m²', neg: [30.9, 6.5], pos: [35.4, 6.6], min: 18, missing: 0.014 },
      { name: 'DiabetesPedigreeFunction', neg: [0.43, 0.3], pos: [0.55, 0.37], min: 0.08 },
      { name: 'Age', unit: 'years', neg: [31, 11.7], pos: [37, 11], kind: 'int', min: 21 },
    ],
    idColumn: 'patient_no', duplicates: 2,
  },
  {
    meta: {
      id: 'parkinsons', name: "Parkinson's Disease (UCI voice)", shortName: "Parkinson's Voice", disease: 'neurological', modality: 'tabular_ehr',
      rows: 195, features: 22, taskType: 'classification', target: 'status', positiveClass: '1',
      classBalance: { positive: 147, negative: 48, positiveLabel: "Parkinson's", negativeLabel: 'Healthy' }, source: 'Little et al. 2008 · UCI', benchmark: true,
    },
    nPos: 147,
    features: [
      ['MDVP_Fo', 'Hz', [181, 52], [145, 33]], ['MDVP_Fhi', 'Hz', [223, 96], [188, 88]], ['MDVP_Flo', 'Hz', [145, 58], [106, 32]],
      ['Jitter_pct', '%', [0.0039, 0.0021], [0.007, 0.0051]], ['Jitter_Abs', 's', [0.000023, 0.000015], [0.000051, 0.000037]],
      ['RAP', '', [0.0019, 0.001], [0.0038, 0.0032]], ['PPQ', '', [0.0021, 0.0011], [0.0038, 0.0029]], ['DDP', '', [0.0058, 0.003], [0.0113, 0.0095]],
      ['Shimmer', '', [0.0176, 0.0055], [0.0337, 0.0195]], ['Shimmer_dB', 'dB', [0.163, 0.057], [0.321, 0.21]], ['APQ3', '', [0.0095, 0.0031], [0.0177, 0.0106]],
      ['APQ5', '', [0.0107, 0.0035], [0.0205, 0.0132]], ['APQ', '', [0.0133, 0.0042], [0.0277, 0.0185]], ['DDA', '', [0.0285, 0.0093], [0.0532, 0.0318]],
      ['NHR', '', [0.0115, 0.019], [0.029, 0.047]], ['HNR', 'dB', [24.7, 3.4], [20.97, 4.3]], ['RPDE', '', [0.44, 0.09], [0.52, 0.1]],
      ['DFA', '', [0.696, 0.052], [0.725, 0.055]], ['spread1', '', [-6.76, 0.64], [-5.33, 0.97]], ['spread2', '', [0.16, 0.06], [0.25, 0.08]],
      ['D2', '', [2.15, 0.31], [2.46, 0.37]], ['PPE', '', [0.12, 0.04], [0.23, 0.08]],
    ].map(([name, unit, neg, pos]) => ({ name: name as string, unit: unit as string, neg: neg as [number, number], pos: pos as [number, number], latent: 'voice' as const })),
    idColumn: 'recording', duplicates: 0,
  },
  {
    meta: {
      id: 'ckd', name: 'Chronic Kidney Disease', shortName: 'Chronic Kidney Disease', disease: 'kidney', modality: 'tabular_ehr',
      rows: 400, features: 24, taskType: 'classification', target: 'class', positiveClass: 'ckd',
      classBalance: { positive: 250, negative: 150, positiveLabel: 'CKD', negativeLabel: 'Not CKD' }, source: 'Apollo Hospitals via UCI', benchmark: true,
    },
    nPos: 250,
    features: (
      [
        ['age', 'years', [46, 16], [55, 17], 0.02], ['bp', 'mm Hg', [71, 8.5], [79, 15], 0.03], ['sg', '', [1.022, 0.0025], [1.014, 0.004], 0.12],
        ['al', '', [0.02, 0.2], [1.7, 1.3], 0.11], ['su', '', [0.02, 0.2], [0.75, 1.3], 0.12], ['bgr', 'mg/dL', [107, 18], [175, 92], 0.11],
        ['bu', 'mg/dL', [33, 11], [72, 58], 0.05], ['sc', 'mg/dL', [0.87, 0.26], [4.4, 7], 0.04], ['sod', 'mEq/L', [141, 4.8], [133, 12], 0.22],
        ['pot', 'mEq/L', [4.3, 0.6], [4.9, 4], 0.22], ['hemo', 'g/dL', [15.2, 1.3], [10.6, 2.2], 0.13], ['pcv', '%', [46, 4.2], [33, 7.3], 0.18],
        ['wc', 'cells/µL', [7700, 1800], [9000, 3500], 0.26], ['rc', 'M/µL', [5.4, 0.6], [3.9, 0.85], 0.33],
      ] as [string, string, [number, number], [number, number], number][]
    )
      .map(([name, unit, neg, pos, missing]): FeatureSpec => ({ name, unit, neg, pos, missing, min: 0, group: 'Labs & vitals' }))
      .concat(
        (
          [
            ['rbc', [0.02, 0], [0.3, 0], 0.38], ['pc', [0.02, 0], [0.4, 0], 0.16], ['pcc', [0.0, 0], [0.17, 0], 0.01], ['ba', [0.0, 0], [0.09, 0], 0.01],
            ['htn', [0.0, 0], [0.59, 0], 0.005], ['dm', [0.0, 0], [0.55, 0], 0.005], ['cad', [0.0, 0], [0.14, 0], 0.005], ['appet', [0.0, 0], [0.33, 0], 0.003],
            ['pe', [0.0, 0], [0.3, 0], 0.003], ['ane', [0.0, 0], [0.24, 0], 0.003],
          ] as [string, [number, number], [number, number], number][]
        ).map(([name, neg, pos, missing]): FeatureSpec => ({ name, neg, pos, missing, kind: 'bin', group: 'Clinical flags' })),
      ),
    idColumn: 'patient_id', duplicates: 0,
  },
  {
    meta: {
      id: 'leukemia', name: 'Leukemia gene expression (ALL/AML)', shortName: 'Leukemia ALL/AML', disease: 'cancer', modality: 'genomics',
      rows: 72, features: 7129, taskType: 'classification', target: 'cancer_type', positiveClass: 'AML',
      classBalance: { positive: 25, negative: 47, positiveLabel: 'AML', negativeLabel: 'ALL' }, source: 'Golub et al. 1999', benchmark: true,
    },
    nPos: 25, features: [], generatedGenes: { total: 7129, informative: 60 }, idColumn: 'sample_id', duplicates: 0,
  },
  {
    meta: {
      id: 'telemonitoring', name: "Parkinson's Telemonitoring (UPDRS)", shortName: 'PD Telemonitoring', disease: 'neurological', modality: 'tabular_ehr',
      rows: 5875, features: 16, taskType: 'regression', target: 'total_UPDRS', targetRange: [7, 55], source: 'Tsanas et al. 2010 · UCI', benchmark: true,
    },
    nPos: 0,
    regression: { mean: 29, sd: 10.7, min: 7, max: 55 },
    features: (
      [
        ['Jitter_pct', '%', [0.0062, 0.0056], 0.12], ['Jitter_Abs', 's', [0.000044, 0.000036], 0.1], ['Jitter_RAP', '', [0.003, 0.0031], 0.1],
        ['Jitter_PPQ5', '', [0.0033, 0.0037], 0.11], ['Jitter_DDP', '', [0.009, 0.0094], 0.1], ['Shimmer', '', [0.034, 0.026], 0.1],
        ['Shimmer_dB', 'dB', [0.31, 0.23], 0.11], ['Shimmer_APQ3', '', [0.017, 0.013], 0.09], ['Shimmer_APQ5', '', [0.02, 0.017], 0.1],
        ['Shimmer_APQ11', '', [0.028, 0.02], 0.14], ['Shimmer_DDA', '', [0.051, 0.04], 0.09], ['NHR', '', [0.032, 0.06], 0.06],
        ['HNR', 'dB', [21.7, 4.3], -0.16], ['RPDE', '', [0.54, 0.1], 0.16], ['DFA', '', [0.65, 0.07], -0.11], ['PPE', '', [0.22, 0.09], 0.16],
      ] as [string, string, [number, number], number][]
    ).map(([name, unit, neg, slope]) => ({ name, unit, neg, slope, min: 0, latent: 'voice' as const })),
    idColumn: 'subject_visit', duplicates: 4,
  },
];
