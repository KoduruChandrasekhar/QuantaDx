/** Lazy wrappers + WebGL fallback for the Three.js visuals (kept out of the initial bundle). */
import { Suspense, lazy, useMemo } from 'react';
import type { LossLandscape } from '@/types/api';
import { useReducedMotion } from '@/hooks';
import { useUi } from '@/store';
import { Skeleton } from '../common/misc';
import { Bloch } from './Bloch';

const Bloch3DImpl = lazy(() => import('./three/Bloch3D'));
const Landscape3DImpl = lazy(() => import('./three/LossLandscape3D'));
const ConstellationImpl = lazy(() => import('./three/QubitConstellation'));
const HeroSceneImpl = lazy(() => import('./three/HeroScene'));

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function Bloch3D({ height = 320 }: { height?: number }) {
  const reduced = useReducedMotion();
  const dark = useUi((s) => s.theme === 'dark');
  const gl = useMemo(hasWebGL, []);
  if (!gl) return <div className="flex justify-center"><Bloch vector={{ x: 0.6, y: 0.4, z: 0.69 }} size={height - 20} readout /></div>;
  return (
    <Suspense fallback={<Skeleton className="mx-auto rounded-full" style={{ height: height - 40, width: height - 40 }} />}>
      <Bloch3DImpl reduced={reduced} dark={dark} height={height} />
    </Suspense>
  );
}

export function QubitConstellation({ n = 6, height = 280 }: { n?: number; height?: number }) {
  const reduced = useReducedMotion();
  const dark = useUi((s) => s.theme === 'dark');
  const gl = useMemo(hasWebGL, []);
  if (!gl) return null;
  return (
    <Suspense fallback={<div style={{ height }} />}>
      <ConstellationImpl n={n} height={height} reduced={reduced} dark={dark} />
    </Suspense>
  );
}

export function HeroScene({ offsetX = 2.4, onMeasure }: { offsetX?: number; onMeasure?: (outcome: 0 | 1, p0: number) => void }) {
  const reduced = useReducedMotion();
  const gl = useMemo(hasWebGL, []);
  if (!gl) return null;
  return (
    <Suspense fallback={null}>
      <HeroSceneImpl reduced={reduced} offsetX={offsetX} onMeasure={onMeasure} />
    </Suspense>
  );
}

export function LossLandscape({ data, height = 300 }: { data: LossLandscape; height?: number }) {
  const reduced = useReducedMotion();
  const gl = useMemo(hasWebGL, []);
  if (!gl) return <LandscapeHeat data={data} />;
  return (
    <Suspense fallback={<Skeleton style={{ height }} />}>
      <Landscape3DImpl data={data} height={height} animate={!reduced} />
    </Suspense>
  );
}

/** 2D fallback: contour-like heatmap with the optimizer path. */
function LandscapeHeat({ data }: { data: LossLandscape }) {
  const n = data.grid.length;
  const flat = data.grid.flat();
  const min = Math.min(...flat), max = Math.max(...flat);
  const s = 240 / n;
  const [r0, r1] = data.range;
  const toXY = (a: number, b: number) => [((a - r0) / (r1 - r0)) * 240, 240 - ((b - r0) / (r1 - r0)) * 240];
  return (
    <svg viewBox="0 0 240 240" className="w-full max-w-[300px]" role="img" aria-label="Loss landscape heatmap">
      {data.grid.map((row, i) => row.map((v, j) => <rect key={`${i}-${j}`} x={i * s} y={240 - (j + 1) * s} width={s + 0.3} height={s + 0.3} fill={`hsl(${280 - ((v - min) / (max - min || 1)) * 250} 60% 50%)`} />))}
      <polyline points={data.path.map((p) => toXY(p.a, p.b).join(',')).join(' ')} fill="none" stroke="#fff" strokeWidth={2} />
    </svg>
  );
}
