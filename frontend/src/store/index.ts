import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PreprocessConfig, QuantumConfig, TaskType } from '@/types/api';
import { DEFAULT_BANDS, type RiskBands } from '@/lib/risk';
import { quantumReadyPreset } from '@/content/preprocess';
import { POC_QUANTUM } from '@/content/experiment';

export type PipelineStep = 'data' | 'preprocess' | 'architecture' | 'models' | 'train';

interface PipelineState {
  activeDatasetId: string;
  taskType: TaskType;
  targetColumn: string;
  positiveClass: string;
  preprocessConfig: PreprocessConfig;
  processedDatasetId: string | null;
  quantumConfig: QuantumConfig;
  selectedModels: string[];
  activeExperimentId: string;
  deployedModelId: string | null;
  riskBands: RiskBands;
  decisionThreshold: number;
  completedSteps: PipelineStep[];
  units: Record<string, string>;
  setDataset: (id: string, taskType: TaskType, target: string, positive?: string) => void;
  setPreprocess: (c: PreprocessConfig) => void;
  setProcessed: (id: string | null) => void;
  setQuantum: (q: Partial<QuantumConfig>) => void;
  setSelectedModels: (m: string[]) => void;
  setActiveExperiment: (id: string) => void;
  setRiskBands: (b: RiskBands) => void;
  setThreshold: (t: number) => void;
  complete: (s: PipelineStep) => void;
  setUnit: (col: string, unit: string) => void;
  setTarget: (target: string, positive?: string, taskType?: TaskType) => void;
}

export const usePipeline = create<PipelineState>()(
  persist(
    (set) => ({
      activeDatasetId: 'wdbc',
      taskType: 'classification',
      targetColumn: 'diagnosis',
      positiveClass: 'M',
      preprocessConfig: quantumReadyPreset(),
      processedDatasetId: null,
      quantumConfig: POC_QUANTUM,
      selectedModels: ['logreg', 'svm_rbf', 'random_forest', 'qsvm', 'vqc'],
      activeExperimentId: 'exp-poc-001',
      deployedModelId: null,
      riskBands: DEFAULT_BANDS,
      decisionThreshold: 0.5,
      completedSteps: [],
      units: {},
      setDataset: (id, taskType, target, positive) =>
        set((s) => ({
          activeDatasetId: id,
          taskType,
          targetColumn: target,
          positiveClass: positive ?? '',
          processedDatasetId: null,
          completedSteps: s.completedSteps.includes('data') ? s.completedSteps : [...s.completedSteps, 'data'],
          selectedModels: taskType === 'regression' ? ['linreg', 'svr_rbf', 'rf_regressor', 'qsvr', 'vqr'] : ['logreg', 'svm_rbf', 'random_forest', 'qsvm', 'vqc'],
        })),
      setPreprocess: (c) => set({ preprocessConfig: c }),
      setProcessed: (id) => set((s) => ({ processedDatasetId: id, completedSteps: id && !s.completedSteps.includes('preprocess') ? [...s.completedSteps, 'preprocess'] : s.completedSteps })),
      setQuantum: (q) => set((s) => ({ quantumConfig: { ...s.quantumConfig, ...q, execution: { ...s.quantumConfig.execution, ...(q.execution ?? {}) } } })),
      setSelectedModels: (m) => set({ selectedModels: m }),
      setActiveExperiment: (id) => set({ activeExperimentId: id }),
      setRiskBands: (b) => set({ riskBands: b }),
      setThreshold: (t) => set({ decisionThreshold: t }),
      complete: (step) => set((s) => (s.completedSteps.includes(step) ? s : { completedSteps: [...s.completedSteps, step] })),
      setUnit: (col, unit) => set((s) => ({ units: { ...s.units, [col]: unit } })),
      setTarget: (target, positive, taskType) => set((s) => ({ targetColumn: target, positiveClass: positive ?? s.positiveClass, taskType: taskType ?? s.taskType })),
    }),
    { name: 'qdx-pipeline', storage: createJSONStorage(() => sessionStorage), version: 2 },
  ),
);

type Theme = 'light' | 'dark';
interface UiState {
  theme: Theme;
  sidebarCollapsed: boolean;
  reducedMotion: boolean;
  showBadges: boolean;
  density: 'comfortable' | 'compact';
  paletteOpen: boolean;
  glossaryOpen: boolean;
  shortcutsOpen: boolean;
  verified: string[];
  setTheme: (t: Theme) => void;
  toggleSidebar: () => void;
  setReducedMotion: (v: boolean) => void;
  setShowBadges: (v: boolean) => void;
  setDensity: (d: 'comfortable' | 'compact') => void;
  setPalette: (v: boolean) => void;
  setGlossary: (v: boolean) => void;
  setShortcuts: (v: boolean) => void;
  verify: (ids: string[]) => void;
  resetVerified: () => void;
}

const systemDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: systemDark() ? 'dark' : 'light',
      sidebarCollapsed: false,
      reducedMotion: false,
      showBadges: false,
      density: 'comfortable',
      paletteOpen: false,
      glossaryOpen: false,
      shortcutsOpen: false,
      verified: [],
      setTheme: (theme) => {
        try {
          localStorage.setItem('qdx-theme', theme);
        } catch {
          /* private mode */
        }
        set({ theme });
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setShowBadges: (showBadges) => set({ showBadges }),
      setDensity: (density) => set({ density }),
      setPalette: (paletteOpen) => set({ paletteOpen }),
      setGlossary: (glossaryOpen) => set({ glossaryOpen }),
      setShortcuts: (shortcutsOpen) => set({ shortcutsOpen }),
      verify: (ids) => set((s) => ({ verified: [...new Set([...s.verified, ...ids])] })),
      resetVerified: () => set({ verified: [] }),
    }),
    {
      name: 'qdx-ui-v3',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed, reducedMotion: s.reducedMotion, showBadges: s.showBadges, density: s.density, verified: s.verified }),
    },
  ),
);

interface SelectionState {
  highlightedModelId: string | null;
  selectedSampleIndex: number | null;
  threshold: number;
  setHighlighted: (id: string | null) => void;
  setSample: (i: number | null) => void;
  setThreshold: (t: number) => void;
}

export const useSelection = create<SelectionState>()((set) => ({
  highlightedModelId: null,
  selectedSampleIndex: null,
  threshold: 0.5,
  setHighlighted: (highlightedModelId) => set({ highlightedModelId }),
  setSample: (selectedSampleIndex) => set({ selectedSampleIndex }),
  setThreshold: (threshold) => set({ threshold }),
}));

interface DemoState {
  running: boolean;
  paused: boolean;
  step: number;
  start: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  togglePause: () => void;
  goto: (i: number) => void;
}

export const useDemo = create<DemoState>()((set) => ({
  running: false,
  paused: false,
  step: 0,
  start: () => set({ running: true, paused: false, step: 0 }),
  stop: () => set({ running: false, paused: false, step: 0 }),
  next: () => set((s) => ({ step: s.step + 1 })),
  prev: () => set((s) => ({ step: Math.max(0, s.step - 1) })),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  goto: (step) => set({ step }),
}));

/** Secrets live in memory only — never persisted (Section 15). */
interface SecretsState {
  ibmToken: string | null;
  setIbmToken: (t: string | null) => void;
}
export const useSecrets = create<SecretsState>()((set) => ({ ibmToken: null, setIbmToken: (ibmToken) => set({ ibmToken }) }));
