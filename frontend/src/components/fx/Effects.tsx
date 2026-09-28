/** Small global effects: cursor-tracking card glow, route progress bar, 3D tilt, scroll reveal, animated atom mark. */
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useReducedMotion } from '@/hooks';
import { cn } from '../common/ui';

/** One document listener feeds --mx / --my into whichever .card is under the pointer. */
export function useCardGlow(): void {
  useEffect(() => {
    let last: HTMLElement | null = null;
    let pending: PointerEvent | null = null;
    let raf = 0;
    // At most one style update per animation frame keeps the glow smooth.
    const apply = () => {
      raf = 0;
      const e = pending;
      if (!e) return;
      const el = (e.target as HTMLElement | null)?.closest?.('.card') as HTMLElement | null;
      if (last && last !== el) last.style.removeProperty('--glow');
      last = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${Math.round(e.clientX - r.left)}px`);
      el.style.setProperty('--my', `${Math.round(e.clientY - r.top)}px`);
      el.style.setProperty('--glow', '1');
    };
    const h = (e: PointerEvent) => {
      pending = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    document.addEventListener('pointermove', h, { passive: true });
    return () => {
      document.removeEventListener('pointermove', h);
      cancelAnimationFrame(raf);
    };
  }, []);
}

export function RouteProgress() {
  const { pathname } = useLocation();
  const [key, setKey] = useState(0);
  useEffect(() => setKey((k) => k + 1), [pathname]);
  return (
    <motion.div key={key} className="pointer-events-none fixed inset-x-0 top-0 z-[90] h-[3px] origin-left bg-gradient-to-r from-[#0070C0] via-[#7B3FA0] to-[#E8770E]"
      initial={{ scaleX: 0, opacity: 1 }} animate={{ scaleX: [0, 0.7, 1], opacity: [1, 1, 0] }} transition={{ duration: 0.9, times: [0, 0.6, 1] }} />
  );
}

export function Tilt({ children, className, max = 8 }: { children: ReactNode; className?: string; max?: number }) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0.5), y = useMotionValue(0.5);
  const rx = useSpring(useTransform(y, [0, 1], [max, -max]), { stiffness: 200, damping: 18 });
  const ry = useSpring(useTransform(x, [0, 1], [-max, max]), { stiffness: 200, damping: 18 });
  const ref = useRef<HTMLDivElement>(null);
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div ref={ref} className={cn('[transform-style:preserve-3d]', className)} style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - r.left) / r.width);
        y.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => { x.set(0.5); y.set(0.5); }}>
      {children}
    </motion.div>
  );
}

export function Reveal({ children, delay = 0, className, y = 18 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}

/** Animated atom: three electron orbits (used next to page titles). */
export function AtomMark({ size = 26, className }: { size?: number; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <svg width={size} height={size} viewBox="-20 -20 40 40" className={className} aria-hidden>
      {[0, 60, 120].map((a, i) => (
        <g key={a} transform={`rotate(${a})`}>
          <ellipse rx={17} ry={6.5} fill="none" stroke={['#0070C0', '#7B3FA0', '#0E8C8C'][i]} strokeWidth={1.3} opacity={0.75} />
          {!reduced && (
            <circle r={2} fill={['#0070C0', '#7B3FA0', '#0E8C8C'][i]}>
              <animateMotion dur={`${1.6 + i * 0.35}s`} repeatCount="indefinite" path="M17,0 A17,6.5 0 1,1 -17,0 A17,6.5 0 1,1 17,0" />
            </circle>
          )}
        </g>
      ))}
      <circle r={3.2} fill="#E8770E" />
    </svg>
  );
}

/** Text that "decoheres" in: characters resolve from random glyphs. */
export function ScrambleText({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  const [out, setOut] = useState(reduced ? text : '');
  useEffect(() => {
    if (reduced) {
      setOut(text);
      return;
    }
    const glyphs = '01|ψ⟩⟨φθ∑∂πℏ';
    let frame = 0;
    const id = setInterval(() => {
      frame++;
      const done = Math.floor(frame / 1.6);
      setOut(text.split('').map((ch, i) => (i < done || ch === ' ' ? ch : glyphs[Math.floor(Math.random() * glyphs.length)])).join(''));
      if (done >= text.length) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [text, reduced]);
  return <span className={className}>{out}</span>;
}

/** One-shot particle burst (success celebration). Re-triggers when `fire` changes. */
export function Burst({ fire }: { fire: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!fire || reduced) return;
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const w = (c.width = window.innerWidth), h = (c.height = window.innerHeight);
    const cols = ['#0070C0', '#7B3FA0', '#0E8C8C', '#E8770E', '#1E9C48', '#C08BDF'];
    const ps = Array.from({ length: 160 }, () => {
      const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9;
      return { x: w / 2, y: h / 2.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, r: 2 + Math.random() * 3.5, c: cols[Math.floor(Math.random() * cols.length)], life: 1 };
    });
    let raf = 0;
    const step = () => {
      ctx.clearRect(0, 0, w, h);
      let alive = false;
      for (const p of ps) {
        p.vy += 0.22; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.life -= 0.012;
        if (p.life > 0) {
          alive = true;
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (alive) raf = requestAnimationFrame(step);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [fire, reduced]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[140]" aria-hidden />;
}

/**
 * Renders heavy sections progressively: when scrolled near, or after a staggered delay —
 * so opening a data-dense page never blocks the main thread in one long task.
 */
export function Defer({ children, minHeight = 260, delay = 0 }: { children: ReactNode; minHeight?: number; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (show) return;
    const t = setTimeout(() => setShow(true), 250 + delay);
    const el = ref.current;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShow(true), { rootMargin: '500px' });
    if (el) io.observe(el);
    return () => {
      clearTimeout(t);
      io.disconnect();
    };
  }, [show, delay]);
  if (show) return <>{children}</>;
  return <div ref={ref} className="skeleton" style={{ minHeight }} aria-busy="true" />;
}
