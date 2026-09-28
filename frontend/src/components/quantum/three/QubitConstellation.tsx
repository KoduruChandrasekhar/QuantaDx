/** 3D "quantum core": a distorting glowing core, qubits orbiting on tilted rings with trails, pulsing entanglement links, sparkles. */
import { Float, MeshDistortMaterial, OrbitControls, Sparkles } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const QCOL = ['#0070C0', '#7B3FA0', '#0E8C8C', '#E8770E', '#5AA9E6', '#C08BDF', '#15B0B0', '#1E9C48'];

function Qubit({ i, n, positions }: { i: number; n: number; positions: React.MutableRefObject<THREE.Vector3[]> }) {
  const ref = useRef<THREE.Mesh>(null);
  const tilt = useMemo(() => new THREE.Euler((i * 0.9) % Math.PI, (i * 1.7) % Math.PI, 0), [i]);
  const radius = 1.5 + (i % 3) * 0.32;
  const speed = 0.35 + (i % 4) * 0.09;
  const offset = (i / n) * Math.PI * 2;
  useFrame((s) => {
    const t = s.clock.elapsedTime * speed + offset;
    const v = new THREE.Vector3(Math.cos(t) * radius, 0, Math.sin(t) * radius).applyEuler(tilt);
    ref.current?.position.copy(v);
    positions.current[i] = v;
  });
  return (
      <mesh ref={ref}>
        <sphereGeometry args={[0.09, 24, 24]} />
        <meshStandardMaterial color={QCOL[i % QCOL.length]} emissive={QCOL[i % QCOL.length]} emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
  );
}

function Links({ n, positions, pairs }: { n: number; positions: React.MutableRefObject<THREE.Vector3[]>; pairs: [number, number][] }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(pairs.length * 6), 3));
    return g;
  }, [pairs]);
  const mat = useRef<THREE.LineBasicMaterial>(null);
  useFrame((s) => {
    const arr = geom.attributes.position as THREE.BufferAttribute;
    pairs.forEach(([a, b], k) => {
      const pa = positions.current[a], pb = positions.current[b];
      if (!pa || !pb) return;
      arr.setXYZ(k * 2, pa.x, pa.y, pa.z);
      arr.setXYZ(k * 2 + 1, pb.x, pb.y, pb.z);
    });
    arr.needsUpdate = true;
    if (mat.current) mat.current.opacity = 0.25 + 0.2 * Math.sin(s.clock.elapsedTime * 2);
  });
  void n;
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial ref={mat} color="#c9a2e6" transparent opacity={0.35} />
    </lineSegments>
  );
}

function Core({ dark }: { dark: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.z += dt * 0.4;
    if (ring2.current) ring2.current.rotation.x += dt * 0.3;
  });
  return (
    <Float speed={1.4} rotationIntensity={0.6} floatIntensity={0.6}>
      <mesh>
        <icosahedronGeometry args={[0.62, 5]} />
        <MeshDistortMaterial color={dark ? '#6b3fa0' : '#7B3FA0'} emissive="#3d1a55" emissiveIntensity={0.6} distort={0.38} speed={2.2} roughness={0.15} metalness={0.3} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.95, 1]} />
        <meshBasicMaterial color="#0070C0" wireframe transparent opacity={0.22} />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[1.12, 0.012, 16, 120]} />
        <meshBasicMaterial color="#E8770E" transparent opacity={0.7} />
      </mesh>
      <mesh ref={ring2} rotation={[0, Math.PI / 3, 0]}>
        <torusGeometry args={[1.22, 0.008, 16, 120]} />
        <meshBasicMaterial color="#0E8C8C" transparent opacity={0.6} />
      </mesh>
    </Float>
  );
}

export default function QubitConstellation({ n = 6, height = 280, reduced, dark }: { n?: number; height?: number; reduced: boolean; dark: boolean }) {
  const positions = useRef<THREE.Vector3[]>([]);
  const pairs = useMemo(() => Array.from({ length: n }, (_, i) => [i, (i + 1) % n] as [number, number]), [n]);
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={box} style={{ height }} role="img" aria-label={`${n} qubits orbiting an entangled quantum core`}>
      <Canvas camera={{ position: [0, 1.2, 4.4], fov: 45 }} frameloop={visible && !reduced ? 'always' : 'demand'} dpr={[1, 1.25]} gl={{ antialias: false, alpha: true }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[3, 3, 3]} intensity={30} color="#ffffff" />
        <pointLight position={[-3, -2, 1]} intensity={20} color="#0070C0" />
        <Core dark={dark} />
        {Array.from({ length: n }, (_, i) => <Qubit key={i} i={i} n={n} positions={positions} />)}
        <Links n={n} positions={positions} pairs={pairs} />
        <Sparkles count={40} scale={5} size={2.2} speed={0.4} color="#c9a2e6" opacity={0.7} />
        <OrbitControls enablePan={false} enableZoom={false} autoRotate={!reduced} autoRotateSpeed={0.6} />
      </Canvas>
    </div>
  );
}
