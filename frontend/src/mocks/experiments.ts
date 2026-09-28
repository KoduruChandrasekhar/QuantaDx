/** Experiment registry + simulated Celery job engine that streams TrainingEvents (mock WebSocket source). */
import type { DeployedModel, Experiment, ExperimentConfig, ExperimentResults, ModelFamily, ModelSpec, RegisteredModel, TrainingEvent } from '@/types/api';
import { gaussian, hashSeed, mulberry32, round } from '@/lib/prng';
import { ansatzParamCount, randomTheta } from '@/lib/quantum/circuits';
import { DEFAULT_PROTOCOL, POC_QUANTUM, pocConfig, spec } from '@/content/experiment';
import { getDataset, getSpec } from './data';
import { POC_PLANS, genericClassification, pocResults, regressionResults, type ModelPlan } from './results';

type Listener = (e: TrainingEvent) => void;
const experiments = new Map<string, Experiment>();
const results = new Map<string, ExperimentResults>();
const history = new Map<string, TrainingEvent[]>();
const listeners = new Map<string, Set<Listener>>();
const timers = new Map<string, number[]>();
const registry: RegisteredModel[] = [];
let initialised = false;

const LIBS = { pennylane: '0.38.0', qiskit: '1.2.4', 'qiskit-aer': '0.15.1', 'scikit-learn': '1.5.2', xgboost: '2.1.1', torch: '2.4.1', shap: '0.46.0', mlflow: '2.16.2' };

function emit(e: TrainingEvent): void {
  const h = history.get(e.experimentId) ?? [];
  h.push(e);
  history.set(e.experimentId, h);
  listeners.get(e.experimentId)?.forEach((l) => l(e));
  listeners.get('*')?.forEach((l) => l(e));
}

export function subscribe(experimentId: string, fn: Listener): () => void {
  if (!listeners.has(experimentId)) listeners.set(experimentId, new Set());
  listeners.get(experimentId)!.add(fn);
  return () => listeners.get(experimentId)?.delete(fn);
}

export function getHistory(id: string): TrainingEvent[] {
  return history.get(id) ?? [];
}

function backendLabel(cfg: ExperimentConfig): string {
  const e = cfg.quantum.execution;
  if (e.backend === 'hardware') return `IBM hardware · ${e.deviceName ?? 'ibm_brisbane'}`;
  if (e.backend === 'noisy') return `Noisy sim · ${e.noise?.deviceModel ?? 'fake_manila'}`;
  if (e.backend === 'shots') return `Aer shots · ${e.shots ?? 1024}`;
  return 'Aer statevector';
}

/** Deterministic event script for one model; `t` is the wall-clock offset in ms at speed 1. */
function modelScript(expId: string, m: ModelSpec, cfg: ExperimentConfig, finalAcc: number, offsetMs: number): { t: number; e: TrainingEvent }[] {
  const rand = mulberry32(hashSeed(expId + m.modelId));
  const quantum = m.family !== 'classical';
  const exec = cfg.quantum.execution.backend;
  const noisy = quantum && (exec === 'noisy' || exec === 'hardware');
  const out: { t: number; e: TrainingEvent }[] = [];
  const base = { experimentId: expId, modelId: m.modelId };
  let t = offsetMs;
  out.push({ t, e: { ...base, type: 'status', status: 'queued' } });
  if (quantum && exec === 'hardware') {
    const pos = 4 + Math.floor(rand() * 6);
    for (let p = pos; p >= 1; p--) {
      t += 700 + rand() * 300;
      out.push({ t, e: { ...base, type: 'status', status: 'queued', queuePosition: p, message: `Queued on ${cfg.quantum.execution.deviceName ?? 'ibm_brisbane'}, position ${p}` } });
    }
  }
  t += 200;
  out.push({ t, e: { ...base, type: 'status', status: 'running' } });
  out.push({ t, e: { ...base, type: 'log', level: 'info', message: `${m.label}: starting on ${quantum ? backendLabel(cfg) : 'CPU worker (celery@worker-2)'}` } });
  if (quantum) {
    const enc = cfg.quantum.encoding === 'zz_feature_map' ? `ZZFeatureMap(reps=${cfg.quantum.encodingReps})` : cfg.quantum.encoding;
    out.push({ t: t + 50, e: { ...base, type: 'log', level: 'info', message: `Building ${cfg.nQubits}-qubit circuit: ${enc}${m.kind === 'qsvm' ? '' : ` + ${cfg.quantum.ansatz}×${cfg.quantum.layers}`} · transpiling (optimization_level=3)` } });
    if (m.kind === 'qsvm') out.push({ t: t + 80, e: { ...base, type: 'log', level: 'info', message: m.modelId === 'qsvm_raw' ? 'Kernel bandwidth fixed at 1.0 (no tuning)' : `Inner 3-fold CV over bandwidths {${(cfg.quantum.bandwidthSearch ?? [0.05, 0.1, 0.2, 0.3, 0.5, 1]).join(', ')}}` } });
  }
  const duration = quantum ? (10000 + rand() * 10000) * (noisy ? 1.15 : 1) : 2000 + rand() * 2000;
  const maxIter = quantum ? cfg.quantum.maxIter : 12;
  const nParams = quantum && m.kind !== 'qsvm' ? Math.min(96, ansatzParamCount(cfg.quantum.ansatz, cfg.nQubits, cfg.quantum.layers)) : 0;
  const theta0 = randomTheta(nParams, hashSeed(m.modelId));
  const thetaStar = theta0.map((v) => v + (rand() - 0.5) * 2.4);
  const floor = quantum ? (noisy ? 0.27 : 0.19) : 0.1;
  const jitter = quantum ? (noisy ? 0.05 : 0.025) : 0.006;
  const barren = quantum && cfg.quantum.layers >= 5 && m.kind !== 'qsvm';
  const shots = cfg.quantum.execution.backend === 'statevector' ? 0 : cfg.quantum.execution.shots ?? 1024;
  let execs = 0;
  let elapsed = 0;
  let k = 0;
  const start = t;
  let warnedPlateau = false;
  while (elapsed < duration) {
    const dt = 150 + rand() * 150;
    elapsed += dt;
    t += dt;
    k++;
    const frac = Math.min(1, elapsed / duration);
    const iteration = Math.max(1, Math.round(frac * maxIter));
    const decay = Math.exp(-frac * (barren ? 1.2 : 4.2));
    const loss = Math.max(0.02, floor + (0.69 - floor) * decay + gaussian(rand) * jitter * (0.4 + decay));
    const val = 0.5 + (finalAcc - 0.5) * (1 - decay) + gaussian(rand) * (quantum ? 0.012 : 0.004);
    const gradNorm = barren ? 8e-4 * (0.6 + rand() * 0.8) : Math.max(1e-3, (quantum ? 0.35 : 0.9) * decay + 0.004 + Math.abs(gaussian(rand)) * 0.01);
    execs += quantum ? (m.kind === 'qsvm' ? 2600 : (2 * nParams + 1) * 64) : 0;
    const params = nParams ? thetaStar.map((ts, i) => round(theta0[i] + (ts - theta0[i]) * (1 - decay) + gaussian(rand) * 0.02, 4)) : undefined;
    out.push({
      t,
      e: {
        ...base, type: 'progress', iteration, maxIter, loss: round(loss, 4), trainMetric: round(Math.min(1, val + (quantum ? 0.012 : 0.03) * (1 - decay)), 4),
        valMetric: round(Math.min(1, val), 4), gradNorm: round(gradNorm, 6), params, circuitExecutions: quantum ? execs : undefined,
        shotsUsed: quantum && shots ? execs * shots : undefined, elapsedSec: round((t - start) / 1000, 2), etaSec: round(Math.max(0, duration - elapsed) / 1000, 1), iterTimeMs: round(dt * (quantum ? 1 + rand() * 0.4 : 1), 1),
      },
    });
    if (k % 18 === 0) out.push({ t, e: { ...base, type: 'log', level: 'info', message: `iter ${iteration}/${maxIter} · loss ${loss.toFixed(4)} · val acc ${val.toFixed(3)}${quantum ? ` · ${execs.toLocaleString()} circuit execs` : ''}` } });
    if (barren && !warnedPlateau && k > 6) {
      warnedPlateau = true;
      out.push({ t, e: { ...base, type: 'log', level: 'warn', message: `‖∇θ‖ < 1e-3 for 5 consecutive iterations — possible barren plateau (${cfg.quantum.layers} layers). Try fewer layers, local cost, or layer-wise training.` } });
    }
    if (noisy && k === 10) out.push({ t, e: { ...base, type: 'log', level: 'warn', message: `Noise floor detected: loss plateau ≈ ${floor.toFixed(2)}. ${cfg.quantum.execution.mitigation?.zne ? 'ZNE enabled (scale factors 1, 3, 5).' : 'Consider enabling ZNE.'}` } });
  }
  out.push({ t: t + 60, e: { ...base, type: 'status', status: 'done', elapsedSec: round((t - start) / 1000, 2) } });
  out.push({ t: t + 60, e: { ...base, type: 'done', valMetric: round(finalAcc, 4), message: `${m.label} finished · val accuracy ${finalAcc.toFixed(3)}` } });
  return out;
}

function planFor(cfg: ExperimentConfig, m: ModelSpec): ModelPlan {
  const byId = POC_PLANS.find((p) => p.modelId === m.modelId);
  if (byId) return byId;
  if (m.kind === 'qsvm') {
    const fixed = m.hyper.bandwidth === 'fixed' && (cfg.quantum.kernelBandwidth ?? 1) >= 0.9;
    return { ...POC_PLANS.find((p) => p.modelId === (fixed ? 'qsvm_raw' : 'qsvm_bw'))!, modelId: m.modelId, label: m.label };
  }
  const k = POC_PLANS.find((p) => p.kind === m.kind);
  return k ? { ...k, modelId: m.modelId } : { modelId: m.modelId, kind: m.kind, sens: 0.934, spec: 0.958 };
}

const computed = new Map<string, ExperimentResults>();

/** Results are deterministic per experiment, so compute them once. */
function computeResults(exp: Experiment): ExperimentResults {
  const hit = computed.get(exp.id);
  if (hit) return hit;
  const r = computeResultsUncached(exp);
  computed.set(exp.id, r);
  return r;
}

function computeResultsUncached(exp: Experiment): ExperimentResults {
  const cfg = exp.config;
  if (cfg.taskType === 'regression') return regressionResults(exp.id, cfg.models.map((m) => ({ modelId: m.modelId, kind: m.kind })), cfg.protocol.folds);
  if (cfg.datasetId === 'wdbc') return pocResults(exp.id, cfg.models.map((m) => planFor(cfg, m)));
  const s = getSpec(cfg.datasetId);
  const ds = getDataset(cfg.datasetId);
  const nPos = s?.nPos ?? ds.classBalance?.positive ?? Math.round(ds.rows / 2);
  return genericClassification(exp.id, cfg.datasetId, cfg.models.map((m) => ({ modelId: m.modelId, kind: m.kind })), nPos, ds.rows - nPos, cfg.protocol.folds);
}

function finalAccuracies(exp: Experiment): Record<string, number> {
  const r = computeResults(exp);
  return Object.fromEntries(r.models.map((m) => [m.modelId, m.metrics?.accuracy.mean ?? Math.max(0.2, m.regression?.r2.mean ?? 0.5)]));
}

function makeExperiment(id: string, cfg: ExperimentConfig, createdAt: string, tags: string[]): Experiment {
  const ds = getDataset(cfg.datasetId);
  return {
    id, name: cfg.name, datasetId: cfg.datasetId, datasetName: ds.shortName, taskType: cfg.taskType, status: 'queued', createdAt, durationSec: 0,
    backend: backendLabel(cfg), tags, config: cfg,
    models: cfg.models.map((m) => ({ modelId: m.modelId, kind: m.kind, label: m.label, family: m.family, status: 'queued', progress: 0 })),
    bestByFamily: {}, mlflowRunId: `mlf-${hashSeed(id).toString(16)}`, seeds: [cfg.quantum.seed, 42, 7], libraryVersions: LIBS,
  };
}

function finalize(exp: Experiment): void {
  const r = computeResults(exp);
  results.set(exp.id, r);
  exp.status = 'done';
  const best: Experiment['bestByFamily'] = {};
  for (const m of r.models) {
    const fam: ModelFamily = m.family;
    const metric = exp.taskType === 'regression' ? 'RMSE' : 'ROC-AUC';
    const value = exp.taskType === 'regression' ? m.regression!.rmse.mean : m.metrics!.rocAuc.mean;
    const cur = best[fam];
    if (!cur || (exp.taskType === 'regression' ? value < cur.value : value > cur.value)) best[fam] = { label: m.label, metric, value };
  }
  exp.bestByFamily = best;
}

function applyEvent(exp: Experiment, e: TrainingEvent): void {
  const run = exp.models.find((m) => m.modelId === e.modelId);
  if (run) {
    if (e.type === 'status' && e.status) run.status = e.status;
    if (e.type === 'progress') {
      run.progress = (e.iteration ?? 0) / (e.maxIter ?? 1);
      run.etaSec = e.etaSec;
      run.status = 'running';
    }
    if (e.type === 'done') run.progress = 1;
  }
  if (exp.status === 'queued' && e.status === 'running') exp.status = 'running';
}

/** Runs the scripted events on timers. speed > 1 = faster (demo replay). */
function run(exp: Experiment, speed = 1, replay = false): void {
  const acc = finalAccuracies(exp);
  const scripts = exp.config.models.flatMap((m, i) => modelScript(exp.id, m, exp.config, acc[m.modelId] ?? 0.9, (m.family === 'classical' ? 0 : 400) + i * 120));
  scripts.sort((a, b) => a.t - b.t);
  if (replay) history.set(exp.id, []);
  const ids: number[] = [];
  const startedAt = Date.now();
  exp.status = 'running';
  if (!replay) exp.models.forEach((m) => ((m.status = 'queued'), (m.progress = 0)));
  for (const { t, e } of scripts)
    ids.push(window.setTimeout(() => {
      if (!replay) applyEvent(exp, e);
      emit(e);
    }, t / speed));
  const end = scripts[scripts.length - 1].t / speed + 80;
  ids.push(window.setTimeout(() => {
    if (!replay) {
      exp.durationSec = round((Date.now() - startedAt) / 1000, 1);
      finalize(exp);
    } else exp.status = 'done';
    emit({ experimentId: exp.id, modelId: '*', type: 'status', status: 'done', message: `${exp.name} complete` });
  }, end));
  timers.set(exp.id, ids);
}

function seedCompleted(id: string, cfg: ExperimentConfig, createdAt: string, tags: string[], durationSec: number): void {
  const exp = makeExperiment(id, cfg, createdAt, tags);
  const acc = finalAccuracies(exp);
  const events = cfg.models.flatMap((m, i) => modelScript(id, m, cfg, acc[m.modelId] ?? 0.9, i * 120)).sort((a, b) => a.t - b.t).map((s) => s.e);
  history.set(id, events);
  exp.models.forEach((m) => ((m.status = 'done'), (m.progress = 1)));
  exp.durationSec = durationSec;
  experiments.set(id, exp);
  finalize(exp);
}

function cfgFor(datasetId: string, name: string, kinds: ModelSpec[], extra: Partial<ExperimentConfig> = {}): ExperimentConfig {
  const ds = getDataset(datasetId);
  return { name, datasetId, taskType: ds.taskType, models: kinds, quantum: { ...POC_QUANTUM }, protocol: { ...DEFAULT_PROTOCOL }, nQubits: 6, ...extra };
}

export function init(): void {
  if (initialised) return;
  initialised = true;
  seedCompleted('exp-poc-001', pocConfig(), '2026-09-18T10:42:00.000Z', ['poc', 'wdbc', 'bandwidth'], 1874);
  seedCompleted('exp-heart-014', cfgFor('heart', 'Heart · VQC vs baselines', [spec('logreg'), spec('random_forest'), spec('xgboost'), spec('vqc'), spec('hybrid_nn')]), '2026-09-21T14:05:00.000Z', ['cardio'], 1310);
  seedCompleted('exp-pima-009', cfgFor('pima', 'Pima · noisy-sim QSVM', [spec('logreg'), spec('svm_rbf'), spec('qsvm'), spec('qnn')], { quantum: { ...POC_QUANTUM, execution: { ...POC_QUANTUM.execution, backend: 'noisy' } } }), '2026-09-23T09:20:00.000Z', ['diabetes', 'noise'], 2210);
  seedCompleted('exp-pd-006', cfgFor('parkinsons', "Parkinson's voice · hybrid", [spec('logreg'), spec('random_forest'), spec('vqc'), spec('hybrid_nn')]), '2026-09-24T16:48:00.000Z', ['neuro'], 980);
  seedCompleted('exp-leuk-002', cfgFor('leukemia', 'Leukemia · genomics PCA→8', [spec('logreg'), spec('svm_rbf'), spec('qsvm')], { nQubits: 8 }), '2026-09-25T11:30:00.000Z', ['genomics', 'high-dim'], 760);
  seedCompleted('exp-updrs-003', cfgFor('telemonitoring', 'UPDRS regression · QSVR/VQR', [spec('linreg'), spec('svr_rbf'), spec('rf_regressor'), spec('qsvr'), spec('vqr')]), '2026-09-26T08:15:00.000Z', ['regression', 'neuro'], 3120);

  const reg = (expId: string, modelId: string, version: string, stage: RegisteredModel['stage'], deployed: boolean, threshold = 0.5) => {
    const r = results.get(expId)!;
    const m = r.models.find((x) => x.modelId === modelId)!;
    const exp = experiments.get(expId)!;
    registry.push({
      modelId: `${expId}:${modelId}`, experimentId: expId, label: m.label, kind: m.kind, family: m.family, version, stage, datasetId: r.datasetId,
      metrics: m.metrics ? { sensitivity: m.metrics.sensitivity.mean, specificity: m.metrics.specificity.mean, rocAuc: m.metrics.rocAuc.mean } : { rmse: m.regression!.rmse.mean },
      threshold, backend: m.family === 'classical' ? 'CPU · sklearn' : exp.backend, deployedAt: '2026-09-26T12:00:00.000Z', deployed,
    });
  };
  reg('exp-poc-001', 'logreg', 'v3', 'production', true);
  reg('exp-poc-001', 'qsvm_bw', 'v2', 'staging', false);
  reg('exp-poc-001', 'hybrid_nn', 'v1', 'staging', false);
  reg('exp-heart-014', 'xgboost', 'v1', 'production', true);
  reg('exp-heart-014', 'vqc', 'v1', 'staging', false);
  reg('exp-pima-009', 'logreg', 'v2', 'production', true, 0.35);
  reg('exp-pd-006', 'hybrid_nn', 'v1', 'production', true);
  reg('exp-leuk-002', 'svm_rbf', 'v1', 'production', true);
  reg('exp-updrs-003', 'rf_regressor', 'v1', 'production', true);
  reg('exp-updrs-003', 'qsvr', 'v1', 'staging', false);

  // A long-running hardware job so the dashboard has live activity.
  const hw = cfgFor('ckd', 'CKD · hardware validation run', [spec('logreg'), spec('qsvm'), spec('vqc')], {
    quantum: { ...POC_QUANTUM, execution: { ...POC_QUANTUM.execution, backend: 'hardware', deviceName: 'ibm_brisbane', shots: 4096, mitigation: { readout: true, zne: true } } },
  });
  const exp = makeExperiment('exp-ckd-hw-021', hw, new Date().toISOString(), ['hardware', 'kidney']);
  experiments.set(exp.id, exp);
  run(exp, 0.3);
}

export function listExperiments(): Experiment[] {
  init();
  return [...experiments.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getExperiment(id: string): Experiment {
  init();
  const e = experiments.get(id);
  if (!e) throw Object.assign(new Error(`Experiment ${id} not found`), { status: 404 });
  return e;
}

export function startExperiment(cfg: ExperimentConfig): { experiment_id: string } {
  init();
  const id = `exp-${cfg.datasetId}-${(hashSeed(JSON.stringify(cfg) + Date.now()) % 100000).toString().padStart(5, '0')}`;
  const exp = makeExperiment(id, cfg, new Date().toISOString(), ['studio']);
  experiments.set(id, exp);
  history.set(id, []);
  run(exp, cfg.speed ?? 1);
  return { experiment_id: id };
}

export function replayExperiment(id: string, speed = 3): void {
  const exp = getExperiment(id);
  (timers.get(id) ?? []).forEach((t) => clearTimeout(t));
  run(exp, speed, true);
}

export function cancelExperiment(id: string): Experiment {
  const exp = getExperiment(id);
  (timers.get(id) ?? []).forEach((t) => clearTimeout(t));
  exp.status = 'cancelled';
  exp.models.forEach((m) => m.status !== 'done' && (m.status = 'cancelled'));
  emit({ experimentId: id, modelId: '*', type: 'status', status: 'cancelled', message: 'Cancelled by user' });
  return exp;
}

export function deleteExperiment(id: string): { deleted: boolean } {
  (timers.get(id) ?? []).forEach((t) => clearTimeout(t));
  return { deleted: experiments.delete(id) };
}

export function getResults(id: string): ExperimentResults {
  const exp = getExperiment(id);
  const r = results.get(id);
  if (!r) throw Object.assign(new Error(exp.status === 'running' || exp.status === 'queued' ? 'Results not ready — experiment still running' : 'No results'), { status: 409 });
  return r;
}

export function listRegistered(): RegisteredModel[] {
  init();
  return registry;
}

export function deployModel(registeredId: string): DeployedModel {
  init();
  let target = registry.find((m) => m.modelId === registeredId);
  if (!target) {
    // allow deploying straight from an experiment ("expId:modelId")
    const [expId, modelId] = registeredId.split(':');
    const r = results.get(expId);
    const m = r?.models.find((x) => x.modelId === modelId);
    if (!r || !m) throw Object.assign(new Error('Model not found'), { status: 404 });
    target = {
      modelId: registeredId, experimentId: expId, label: m.label, kind: m.kind, family: m.family, version: 'v1', stage: 'production', datasetId: r.datasetId,
      metrics: m.metrics ? { sensitivity: m.metrics.sensitivity.mean, specificity: m.metrics.specificity.mean, rocAuc: m.metrics.rocAuc.mean } : { rmse: m.regression?.rmse.mean },
      threshold: 0.5, backend: m.family === 'classical' ? 'CPU · sklearn' : getExperiment(expId).backend, deployedAt: new Date().toISOString(), deployed: false,
    };
    registry.push(target);
  }
  for (const m of registry) if (m.datasetId === target.datasetId) m.deployed = false;
  target.deployed = true;
  target.stage = 'production';
  target.deployedAt = new Date().toISOString();
  return target;
}

export function getDeployed(datasetId?: string): DeployedModel[] {
  init();
  const found = registry.filter((m) => m.deployed && (!datasetId || m.datasetId === datasetId));
  if (found.length || !datasetId) return found;
  return [autoDeploy(datasetId)];
}

/**
 * Every dataset can be scored end to end: if nothing is deployed yet, promote the best model of the
 * latest finished experiment on that dataset; with no experiment at all, serve a transparent baseline.
 */
function autoDeploy(datasetId: string): DeployedModel {
  const exp = [...experiments.values()].filter((e) => e.datasetId === datasetId && e.status === 'done' && results.has(e.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (exp) {
    const r = results.get(exp.id)!;
    const score = (m: ExperimentResults['models'][number]) => m.metrics?.rocAuc.mean ?? -(m.regression?.rmse.mean ?? 0);
    const best = [...r.models].sort((a, b) => score(b) - score(a))[0];
    return deployModel(`${exp.id}:${best.modelId}`);
  }
  const regression = getDataset(datasetId).taskType === 'regression';
  return {
    modelId: `baseline:${datasetId}`, experimentId: '', label: regression ? 'Linear baseline (auto)' : 'Logistic baseline (auto)', kind: regression ? 'linreg' : 'logreg',
    family: 'classical', version: 'v0', stage: 'staging', datasetId, metrics: {}, threshold: 0.5, backend: 'CPU · auto-baseline — train a model to replace it', deployedAt: new Date().toISOString(),
  };
}

export function runningCount(): number {
  return [...experiments.values()].filter((e) => e.status === 'running' || e.status === 'queued').length;
}
