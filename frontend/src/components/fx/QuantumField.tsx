/**
 * Site-wide animated background: drifting "qubits" linked by entanglement lines, reacting to the cursor,
 * with occasional measurement flashes. Tuned for smoothness: pre-rendered glow sprites, ≤ 30 fps,
 * device-pixel-ratio 1, capped particle count, paused when the tab is hidden.
 */
import { useEffect, useRef } from 'react';
import { useUi } from '@/store';

interface P { x: number; y: number; vx: number; vy: number; r: number; c: number; flash: number }

const COLORS = [[0, 112, 192], [123, 63, 160], [14, 140, 140], [232, 119, 14]];
const LINK = 120;
const FRAME_MS = 1000 / 24;

function sprite(rgb: number[], alpha: number): HTMLCanvasElement {
  const s = document.createElement('canvas');
  s.width = s.height = 32;
  const g = s.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`);
  grad.addColorStop(0.25, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha * 0.55})`);
  grad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return s;
}

export function QuantumField({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useUi((s) => s.reducedMotion);
  const dark = useUi((s) => s.theme === 'dark');
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !ctx) return;
    const alpha = dark ? 0.6 : 0.4;
    const sprites = COLORS.map((c) => sprite(c, alpha));
    let w = 0, h = 0, raf = 0, last = 0;
    const mouse = { x: -9999, y: -9999 };
    let ps: P[] = [];
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      const n = Math.round(Math.min(45, (w * h) / 32000));
      ps = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
        r: 1.2 + Math.random() * 1.8, c: Math.floor(Math.random() * COLORS.length), flash: 0,
      }));
    };
    resize();
    const onMove = (e: PointerEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    // Skip drawing while the page is scrolling so scroll stays buttery.
    let scrollingUntil = 0;
    const onScroll = () => { scrollingUntil = performance.now() + 180; };
    window.addEventListener('scroll', onScroll, { passive: true });

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        if (!reduced) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 19600) { p.vx += dx * 0.0006; p.vy += dy * 0.0006; }
          p.vx = p.vx * 0.99 + (Math.random() - 0.5) * 0.02;
          p.vy = p.vy * 0.99 + (Math.random() - 0.5) * 0.02;
          p.x += p.vx; p.y += p.vy;
          if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
          if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;
          if (Math.random() < 0.0015) p.flash = 1;
          p.flash *= 0.93;
        }
      }
      ctx.lineWidth = 0.8;
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i];
        for (let j = i + 1; j < ps.length; j++) {
          const b = ps[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK * LINK) continue;
          const c = COLORS[a.c];
          ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(1 - Math.sqrt(d2) / LINK) * alpha * 0.45})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      for (const p of ps) {
        const s = p.r * 6 * (1 + p.flash * 1.5);
        ctx.drawImage(sprites[p.c], p.x - s, p.y - s, s * 2, s * 2);
        if (p.flash > 0.08) {
          const c = COLORS[p.c];
          ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${p.flash * 0.5})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, (1 - p.flash) * 34 + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    };
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < FRAME_MS || t < scrollingUntil) return;
      last = t;
      draw();
    };
    if (!enabled) {
      ctx.clearRect(0, 0, w, h);
    } else if (reduced) draw();
    else raf = requestAnimationFrame(loop);
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced && enabled) raf = requestAnimationFrame(loop);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reduced, dark, enabled]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-0" aria-hidden />;
}
