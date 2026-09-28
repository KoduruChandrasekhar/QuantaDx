/**
 * Full-bleed hero scene: a spiral "galaxy" of patient-data particles streaming into a glowing Bloch sphere,
 * entangled qubit pairs, a precessing state vector and mouse parallax.
 */
import { Sparkles } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const PALETTE = ['#0070C0', '#7B3FA0', '#0E8C8C', '#C08BDF', '#5AA9E6', '#E8770E'].map((c) => new THREE.Color(c));

function Galaxy({ count = 4200 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const arms = 4;
    for (let i = 0; i < count; i++) {
      const r = 1.6 + Math.pow(Math.random(), 1.4) * 5.2;
      const arm = (i % arms) / arms * Math.PI * 2;
      const spin = r * 0.85;
      const rnd = (s: number) => Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * s * r * 0.18;
      positions[i * 3] = Math.cos(arm + spin) * r + rnd(1);
      positions[i * 3 + 1] = rnd(0.35);
      positions[i * 3 + 2] = Math.sin(arm + spin) * r + rnd(1);
      const t = (r - 1.6) / 5.2;
      const c = PALETTE[Math.floor(t * 3.99)].clone().lerp(PALETTE[(Math.floor(t * 3.99) + 1) % PALETTE.length], (t * 4) % 1);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { positions, colors };
  }, [count]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.06;
  });
  return (
    <points ref={ref} rotation={[0.32, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
    </points>
  );
}

/** Particles spiralling inward and being "encoded" into the sphere. */
function DataStream({ count = 260 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const state = useMemo(() => Array.from({ length: count }, () => ({ r: 1.2 + Math.random() * 5, a: Math.random() * Math.PI * 2, y: (Math.random() - 0.5) * 1.2, v: 0.4 + Math.random() * 0.8 })), [count]);
  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  useFrame((_, dt) => {
    state.forEach((p, i) => {
      p.r -= dt * p.v * 0.9;
      p.a += dt * (1.6 / Math.max(0.6, p.r));
      p.y *= 0.985;
      if (p.r < 0.95) {
        p.r = 5 + Math.random() * 1.5;
        p.a = Math.random() * Math.PI * 2;
        p.y = (Math.random() - 0.5) * 1.5;
      }
      positions[i * 3] = Math.cos(p.a) * p.r;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = Math.sin(p.a) * p.r;
    });
    const g = ref.current?.geometry;
    if (g) (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });
  return (
    <points ref={ref} rotation={[0.32, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.07} color="#ffd9a8" transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function circle(axis: 'xz' | 'xy' | 'yz', r = 1): [number, number, number][] {
  return Array.from({ length: 97 }, (_, i) => {
    const t = (i / 96) * Math.PI * 2;
    const a = Math.cos(t) * r, b = Math.sin(t) * r;
    return axis === 'xz' ? [a, 0, b] : axis === 'xy' ? [a, b, 0] : [0, a, b];
  });
}

const TRAIL = 70;
const AXIS: [number, number, number][] = [[0, -1.25, 0], [0, 1.25, 0]];

function SimpleLine({ points, color, opacity }: { points: [number, number, number][]; color: string; opacity: number }) {
  const obj = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(points.map((q) => new THREE.Vector3(...q)));
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  }, [points, color, opacity]);
  return <primitive object={obj} />;
}

/** Fading trail updated imperatively (no React re-renders per frame). */
function useTrail() {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const count = useRef(0);
  const push = (v: THREE.Vector3) => {
    const arr = (geom.attributes.position as THREE.BufferAttribute).array as Float32Array;
    arr.copyWithin(0, 3);
    arr.set([v.x, v.y, v.z], (TRAIL - 1) * 3);
    count.current = Math.min(TRAIL, count.current + 1);
    geom.setDrawRange(TRAIL - count.current, count.current);
    (geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  };
  return { geom, push };
}

export type MeasureHandler = (outcome: 0 | 1, p0: number) => void;

function BlochCore({ onMeasure }: { onMeasure?: MeasureHandler }) {
  const arrow = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const hover = useRef(false);
  const theta = useRef(1);
  const collapse = useRef<{ start: number; outcome: 0 | 1 } | null>(null);
  const now = useRef(0);
  const trail = useTrail();
  const trailLine = useMemo(() => new THREE.Line(trail.geom, new THREE.LineBasicMaterial({ color: '#ffb366', transparent: true, opacity: 0.85 })), [trail.geom]);
  const tick = useRef(0);
  const eq = useMemo(() => circle('xz'), []);
  const m1 = useMemo(() => circle('xy'), []);
  const m2 = useMemo(() => circle('yz'), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    now.current = t;
    theta.current = 1.0 + 0.6 * Math.sin(t * 0.5);
    const phi = t * 0.9;
    let v = new THREE.Vector3(Math.sin(theta.current) * Math.cos(phi), Math.cos(theta.current), Math.sin(theta.current) * Math.sin(phi));
    const c = collapse.current;
    if (c) {
      const age = t - c.start;
      const pole = new THREE.Vector3(0, c.outcome === 0 ? 1 : -1, 0);
      // Snap to the measured pole, hold, then relax back into superposition.
      const w = age < 0.25 ? age / 0.25 : age < 1.6 ? 1 : Math.max(0, 1 - (age - 1.6) / 0.8);
      v = v.lerp(pole, w).normalize();
      if (ring.current && ringMat.current) {
        ring.current.scale.setScalar(1 + age * 2.4);
        ringMat.current.opacity = Math.max(0, 0.8 - age * 0.55);
      }
      if (age > 2.4) collapse.current = null;
    } else if (ringMat.current) ringMat.current.opacity = 0;
    arrow.current?.quaternion.setFromUnitVectors(up, v);
    if (glow.current) glow.current.scale.setScalar((hover.current ? 1.12 : 1) + 0.06 * Math.sin(t * 2.4));
    if (glowMat.current) glowMat.current.opacity += ((hover.current ? 0.22 : 0.08) - glowMat.current.opacity) * 0.15;
    if (++tick.current % 2 === 0) trail.push(v);
  });
  return (
    <group>
      <mesh
        ref={glow}
        onPointerOver={(e) => { e.stopPropagation(); hover.current = true; document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { hover.current = false; document.body.style.cursor = ''; }}
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta > 6) return; // it was a drag, not a click
          const p0 = Math.cos(theta.current / 2) ** 2;
          const outcome: 0 | 1 = Math.random() < p0 ? 0 : 1;
          collapse.current = { start: now.current, outcome };
          onMeasure?.(outcome, p0);
        }}>
        <sphereGeometry args={[1.18, 48, 48]} />
        <meshBasicMaterial ref={glowMat} color="#7B3FA0" transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.05, 1.12, 96]} />
        <meshBasicMaterial ref={ringMat} color="#FFB366" transparent opacity={0} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhysicalMaterial color="#b89ad6" transparent opacity={0.14} roughness={0.1} clearcoat={1} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.18, 32, 32]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.34, 32, 32]} />
        <meshBasicMaterial color="#c9a2e6" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <SimpleLine points={eq} color="#c9a2e6" opacity={0.95} />
      <SimpleLine points={m1} color="#5AA9E6" opacity={0.55} />
      <SimpleLine points={m2} color="#5AA9E6" opacity={0.55} />
      <SimpleLine points={AXIS} color="#8a9ab0" opacity={0.6} />
      <group ref={arrow}>
        <mesh position={[0, 0.48, 0]}>
          <cylinderGeometry args={[0.024, 0.024, 0.96, 12]} />
          <meshBasicMaterial color="#E8770E" />
        </mesh>
        <mesh position={[0, 1.02, 0]}>
          <coneGeometry args={[0.07, 0.17, 20]} />
          <meshBasicMaterial color="#E8770E" />
        </mesh>
        <mesh position={[0, 1.02, 0]}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshBasicMaterial color="#E8770E" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
      <primitive object={trailLine} />
    </group>
  );
}

function EntangledPair({ radius, speed, tilt, color }: { radius: number; speed: number; tilt: number; color: string }) {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  const line = useRef<THREE.BufferGeometry>(null);
  const mat = useRef<THREE.LineBasicMaterial>(null);
  const pos = useMemo(() => new Float32Array(6), []);
  const e = useMemo(() => new THREE.Euler(tilt, tilt * 0.7, 0), [tilt]);
  useFrame((s) => {
    const t = s.clock.elapsedTime * speed;
    const pa = new THREE.Vector3(Math.cos(t) * radius, 0, Math.sin(t) * radius).applyEuler(e);
    const pb = pa.clone().multiplyScalar(-1);
    a.current?.position.copy(pa);
    b.current?.position.copy(pb);
    pos.set([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z]);
    if (line.current) (line.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    if (mat.current) mat.current.opacity = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(s.clock.elapsedTime * 3 + tilt * 5));
  });
  return (
    <group>
      {[a, b].map((r, i) => (
        <mesh key={i} ref={r}>
          <sphereGeometry args={[0.07, 20, 20]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
      <lineSegments>
        <bufferGeometry ref={line}>
          <bufferAttribute attach="attributes-position" args={[pos, 3]} />
        </bufferGeometry>
        <lineBasicMaterial ref={mat} color={color} transparent opacity={0.3} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </group>
  );
}

function Rig({ offsetX }: { offsetX: number }) {
  const { camera, pointer } = useThree();
  useFrame(() => {
    camera.position.x += (offsetX * -1 + pointer.x * 0.35 - camera.position.x) * 0.04;
    camera.position.y += (1.35 + pointer.y * 0.25 - camera.position.y) * 0.04;
    camera.lookAt(-offsetX, 0, 0);
  });
  return null;
}

interface Spin { vx: number; vy: number; dragging: boolean; lastX: number; lastY: number }

/** Rotates the whole scene from drag velocity, with inertia and a gentle idle spin. */
function Spinner({ spin, children }: { spin: React.MutableRefObject<Spin>; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const s = spin.current;
    if (!g.current) return;
    g.current.rotation.y += s.vx + (s.dragging ? 0 : 0.0012);
    g.current.rotation.x = Math.max(-0.6, Math.min(0.6, g.current.rotation.x + s.vy));
    if (!s.dragging) {
      s.vx *= 0.95;
      s.vy *= 0.9;
      g.current.rotation.x *= 0.985;
    }
  });
  return <group ref={g}>{children}</group>;
}

export default function HeroScene({ reduced, offsetX = 2.4, onMeasure }: { reduced: boolean; offsetX?: number; onMeasure?: MeasureHandler }) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const spin = useRef<Spin>({ vx: 0, vy: 0, dragging: false, lastX: 0, lastY: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([en]) => setVisible(en.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={box} className="absolute inset-x-0 top-0 h-[640px] cursor-grab touch-pan-y [mask-image:linear-gradient(to_bottom,#000_78%,transparent)] active:cursor-grabbing"
      onPointerDown={(e) => { spin.current = { ...spin.current, dragging: true, lastX: e.clientX, lastY: e.clientY, vx: 0, vy: 0 }; }}
      onPointerMove={(e) => {
        const s = spin.current;
        if (!s.dragging) return;
        s.vx = (e.clientX - s.lastX) * 0.006;
        s.vy = (e.clientY - s.lastY) * 0.004;
        s.lastX = e.clientX;
        s.lastY = e.clientY;
      }}
      onPointerUp={() => { spin.current.dragging = false; }}
      onPointerLeave={() => { spin.current.dragging = false; }}>
      <Canvas camera={{ position: [-offsetX, 1.35, 7], fov: 46 }} frameloop={visible && !reduced ? 'always' : 'demand'} dpr={[1, 1.25]} gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[3, 4, 4]} intensity={40} />
        <Rig offsetX={offsetX} />
        <Spinner spin={spin}>
          <Galaxy />
          <DataStream />
          <BlochCore onMeasure={onMeasure} />
          <EntangledPair radius={1.75} speed={0.8} tilt={0.3} color="#5AA9E6" />
          <EntangledPair radius={2.1} speed={-0.6} tilt={1.1} color="#15B0B0" />
          <EntangledPair radius={2.45} speed={0.45} tilt={2.0} color="#C08BDF" />
          <Sparkles count={50} scale={[12, 5, 12]} size={2.4} speed={0.3} color="#ffffff" opacity={0.6} />
        </Spinner>
      </Canvas>
    </div>
  );
}
