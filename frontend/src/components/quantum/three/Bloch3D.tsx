/** Real 3D Bloch sphere (React Three Fiber). Lazy-loaded; renders only while on-screen. */
import { Html, Line, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

function circlePts(axis: 'xy' | 'xz' | 'yz', r = 1): [number, number, number][] {
  return Array.from({ length: 97 }, (_, i) => {
    const t = (i / 96) * Math.PI * 2;
    const a = Math.cos(t) * r, b = Math.sin(t) * r;
    return axis === 'xy' ? [a, 0, b] : axis === 'xz' ? [a, b, 0] : [0, a, b];
  });
}

function StateArrow({ animate }: { animate: boolean }) {
  const group = useRef<THREE.Group>(null);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(70 * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const line = useMemo(() => new THREE.Line(geom, new THREE.LineBasicMaterial({ color: '#c9a2e6', transparent: true, opacity: 0.8 })), [geom]);
  const count = useRef(0);
  const tick = useRef(0);
  useFrame((state) => {
    const t = animate ? state.clock.elapsedTime : 1.2;
    const theta = 0.95 + 0.55 * Math.sin(t * 0.45);
    const phi = t * 0.7;
    // three.js: y is up → Bloch z maps to y
    const v = new THREE.Vector3(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi));
    if (group.current) group.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    if (animate && ++tick.current % 2 === 0) {
      const arr = (geom.attributes.position as THREE.BufferAttribute).array as Float32Array;
      arr.copyWithin(0, 3);
      arr.set([v.x, v.y, v.z], 69 * 3);
      count.current = Math.min(70, count.current + 1);
      geom.setDrawRange(70 - count.current, count.current);
      (geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  });
  return (
    <>
      <group ref={group}>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.9, 16]} />
          <meshStandardMaterial color="#E8770E" emissive="#E8770E" emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0, 0.95, 0]}>
          <coneGeometry args={[0.065, 0.16, 24]} />
          <meshStandardMaterial color="#E8770E" emissive="#E8770E" emissiveIntensity={0.45} />
        </mesh>
      </group>
      <primitive object={line} />
    </>
  );
}

function Scene({ animate, dark }: { animate: boolean; dark: boolean }) {
  const eq = useMemo(() => circlePts('xy'), []);
  const m1 = useMemo(() => circlePts('xz'), []);
  const m2 = useMemo(() => circlePts('yz'), []);
  const lab = (t: string, p: [number, number, number]) => (
    <Html position={p} center style={{ pointerEvents: 'none' }}>
      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600, color: dark ? '#c3cfdf' : '#1F497D', whiteSpace: 'nowrap' }}>{t}</span>
    </Html>
  );
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 2]} intensity={1.1} />
      <pointLight position={[-3, -2, -3]} intensity={0.4} color="#7B3FA0" />
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhysicalMaterial color={dark ? '#3b2a5c' : '#c9b3e0'} transparent opacity={dark ? 0.22 : 0.2} roughness={0.15} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Line points={eq} color={dark ? '#8a9ab0' : '#7B3FA0'} lineWidth={1.4} transparent opacity={0.8} />
      <Line points={m1} color={dark ? '#5d6b80' : '#9aa7b8'} lineWidth={1} transparent opacity={0.6} />
      <Line points={m2} color={dark ? '#5d6b80' : '#9aa7b8'} lineWidth={1} transparent opacity={0.6} />
      <Line points={[[0, -1.15, 0], [0, 1.15, 0]]} color="#8a9ab0" lineWidth={1} />
      <Line points={[[-1.15, 0, 0], [1.15, 0, 0]]} color="#8a9ab0" lineWidth={1} />
      <Line points={[[0, 0, -1.15], [0, 0, 1.15]]} color="#8a9ab0" lineWidth={1} />
      {lab('|0⟩', [0, 1.32, 0])}
      {lab('|1⟩', [0, -1.32, 0])}
      {lab('|+⟩', [1.36, 0, 0])}
      {lab('|−⟩', [-1.36, 0, 0])}
      {lab('|+i⟩', [0, 0, 1.36])}
      <StateArrow animate={animate} />
      <OrbitControls enablePan={false} enableZoom={false} autoRotate={animate} autoRotateSpeed={0.8} />
    </>
  );
}

export default function Bloch3D({ reduced, dark, height = 320 }: { reduced: boolean; dark: boolean; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ height }} role="img" aria-label="Rotating 3D Bloch sphere showing a precessing qubit state">
      <Canvas camera={{ position: [2.3, 1.3, 2.3], fov: 42 }} frameloop={visible && !reduced ? 'always' : 'demand'} dpr={[1, 1.5]}>
        <Scene animate={!reduced} dark={dark} />
      </Canvas>
    </div>
  );
}
