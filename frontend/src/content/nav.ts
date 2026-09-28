import {
  Activity, Atom, BarChart3, BookOpen, Boxes, BrainCircuit, CheckSquare, Cpu, Database, FlaskConical, Gauge, Home, Lightbulb, Network, Settings, Sparkles, Stethoscope, Terminal, Workflow,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  key: string;
  desc?: string;
}

export const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Overview', items: [
    { to: '/', label: 'Home', icon: Home, key: 'home', desc: 'The QuantaDx story' },
    { to: '/dashboard', label: 'Dashboard', icon: Gauge, key: 'dashboard', desc: 'Live jobs, KPIs and backends' },
  ] },
  { group: 'Pipeline', items: [
    { to: '/data', label: 'Data', icon: Database, key: 'data', desc: 'Upload & profile patient data' },
    { to: '/preprocess', label: 'Pre-process', icon: Workflow, key: 'preprocess', desc: 'Clean, select, compress to qubits' },
    { to: '/architecture', label: 'Architecture', icon: Network, key: 'architecture', desc: 'Hybrid system & data encoding' },
    { to: '/models', label: 'Models', icon: BrainCircuit, key: 'models', desc: 'QSVM, VQC, QNN & baselines' },
    { to: '/train', label: 'Train', icon: Activity, key: 'train', desc: 'Live hybrid training monitor' },
  ] },
  { group: 'Analysis', items: [
    { to: '/results', label: 'Results', icon: BarChart3, key: 'results', desc: 'Honest quantum vs classical benchmark' },
    { to: '/explain', label: 'Explain', icon: Lightbulb, key: 'explain', desc: 'SHAP, kernels, patient-level reasons' },
    { to: '/predict', label: 'Predict', icon: Stethoscope, key: 'predict', desc: 'Risk scores & decision support' },
  ] },
  { group: 'Platform', items: [
    { to: '/experiments', label: 'Experiments', icon: Boxes, key: 'experiments', desc: 'Runs, models & reproducibility' },
    { to: '/api', label: 'API', icon: Terminal, key: 'api', desc: 'REST + WebSocket for hospitals' },
    { to: '/deliverables', label: 'Capabilities', icon: CheckSquare, key: 'deliverables', desc: 'Every module, verified live' },
  ] },
  { group: 'Learn', items: [
    { to: '/lab', label: 'Quantum Lab', icon: Atom, key: 'lab', desc: 'Build circuits, see qubits' },
    { to: '/docs', label: 'Docs', icon: BookOpen, key: 'docs', desc: 'Architecture, math & methods' },
  ] },
];

export const EXTRA_NAV: NavItem[] = [
  { to: '/settings', label: 'Settings', icon: Settings, key: 'settings', desc: 'Connection, defaults, appearance' },
];

export const PIPELINE_STEPS = [
  { key: 'data', label: 'Ingest', to: '/data', icon: Database },
  { key: 'preprocess', label: 'Pre-process', to: '/preprocess', icon: Workflow },
  { key: 'architecture', label: 'Quantum encode', to: '/architecture', icon: Cpu },
  { key: 'models', label: 'Configure models', to: '/models', icon: FlaskConical },
  { key: 'train', label: 'Hybrid train', to: '/train', icon: Sparkles },
] as const;
