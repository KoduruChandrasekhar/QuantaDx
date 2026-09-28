/** 3D loss surface over two trainable parameters with the optimizer path (Section 8.10). Lazy-loaded. */
import { Line, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { LossLandscape } from '@/types/api';

const SCALE = 1.6;

function Surface({ data }: { data: LossLandscape }) {
  const geom = useMemo(() => {
    const n = data.grid.length;
    const g = new THREE.PlaneGeometry(2 * SCALE, 2 * SCALE, n - 1, n - 1);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const flat = data.grid.flat();
    const min = Math.min(...flat), max = Math.max(...flat);
    const colors: number[] = [];
    const lo = new THREE.Color('#0E8C8C'), mid = new THREE.Color('#7B3FA0'), hi = new THREE.Color('#E8770E');
    for (let k = 0; k < pos.count; k++) {
      const i = k % n, j = Math.floor(k / n);
      const v = data.grid[i][n - 1 - j];
      const t = (v - min) / (max - min || 1);
      pos.setZ(k, t * 1.1);
      const c = t < 0.5 ? lo.clone().lerp(mid, t * 2) : mid.clone().lerp(hi, (t - 0.5) * 2);
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return { g, min, max };
  }, [data.grid]); // path updates must not rebuild the mesh
  const toXYZ = (a: number, b: number, loss: number): [number, number, number] => {
    const [r0, r1] = data.range;
    const x = ((a - r0) / (r1 - r0) - 0.5) * 2 * SCALE;
    const y = ((b - r0) / (r1 - r0) - 0.5) * 2 * SCALE;
    return [x, ((loss - geom.min) / (geom.max - geom.min || 1)) * 1.1 + 0.03, -y];
  };
  const pts = data.path.map((p) => toXYZ(p.a, p.b, p.loss));
  const ball = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = (s.clock.elapsedTime * 6) % (pts.length + 12);
    const p = pts[Math.min(pts.length - 1, Math.floor(t))];
    if (ball.current && p) ball.current.position.set(...p);
  });
  return (
    <group>
      <mesh geometry={geom.g} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh geometry={geom.g} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <meshBasicMaterial wireframe color="#ffffff" transparent opacity={0.08} />
      </mesh>
      {pts.length > 1 && <Line points={pts} color="#ffffff" lineWidth={2.5} />}
      <mesh ref={ball}>
        <sphereGeometry args={[0.055, 20, 20]} />
        <meshStandardMaterial color="#E8770E" emissive="#E8770E" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

export default function LossLandscape3D({ data, height = 300, animate = true }: { data: LossLandscape; height?: number; animate?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={box} style={{ height }} className="overflow-hidden rounded-lg bg-[#0f1b2d]" role="img" aria-label={`Loss landscape over ${data.params.join(' and ')} with ${data.path.length}-step optimizer path`}>
      <Canvas camera={{ position: [2.6, 2.4, 2.8], fov: 40 }} frameloop={animate && visible ? 'always' : 'demand'} dpr={[1, 1.5]}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 2]} intensity={1.2} />
        <Surface data={data} />
        <OrbitControls enablePan={false} autoRotate={animate} autoRotateSpeed={0.5} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
    </div>
  );
}
