import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_STEPS } from '@/content/demo';
import { DELIVERABLES } from '@/content/deliverables';
import { useDemo, usePipeline, useUi } from '@/store';
import { Badge, Button, IconButton } from '../common/ui';

function findTarget(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${id}"]`);
}

export function DemoTour() {
  const { running, paused, step, next, prev, stop, togglePause } = useDemo();
  const verify = useUi((s) => s.verify);
  const resetVerified = useUi((s) => s.resetVerified);
  const setDataset = usePipeline((s) => s.setDataset);
  const complete = usePipeline((s) => s.complete);
  const setActiveExperiment = usePipeline((s) => s.setActiveExperiment);
  const navigate = useNavigate();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const raf = useRef(0);
  const s = DEMO_STEPS[step];

  useEffect(() => {
    if (running && step === 0) {
      resetVerified();
      setDataset('wdbc', 'classification', 'diagnosis', 'M');
      setActiveExperiment('exp-poc-001');
    }
  }, [running, step, resetVerified, setDataset, setActiveExperiment]);

  useEffect(() => {
    if (!running) return;
    if (!s) {
      verify(DELIVERABLES.flatMap((d) => d.components.map((c) => c.id)));
      stop();
      navigate('/deliverables');
      return;
    }
    navigate(s.route);
    setElapsed(0);
    setRect(null);
    if (s.verify.length) verify(s.verify);
    if (s.route.startsWith('/preprocess')) complete('preprocess');
    let tries = 0;
    let scrolled = false;
    let last: DOMRect | null = null;
    const track = () => {
      const el = findTarget(s.target);
      if (el) {
        if (!scrolled) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          scrolled = true;
        }
        const r = el.getBoundingClientRect();
        if (!last || Math.abs(r.top - last.top) + Math.abs(r.left - last.left) + Math.abs(r.height - last.height) + Math.abs(r.width - last.width) > 1) {
          last = r;
          setRect(r);
        }
      } else if (tries++ > 200) setRect(null);
      raf.current = requestAnimationFrame(track);
    };
    const t = setTimeout(() => (raf.current = requestAnimationFrame(track)), 350);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, step]);

  useEffect(() => {
    if (!running || paused || !s) return;
    const id = setInterval(() => setElapsed((e) => e + 100), 100);
    return () => clearInterval(id);
  }, [running, paused, s]);

  useEffect(() => {
    if (running && s && elapsed >= s.ms) next();
  }, [elapsed, running, s, next]);

  useEffect(() => {
    if (!running) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === ' ' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [running, next, prev, stop, togglePause]);

  if (!running || !s) return null;
  const pad = 10;
  return (
    <div className="pointer-events-none fixed inset-0 z-[150]" aria-live="polite">
      {rect ? (
        <motion.div className="absolute rounded-xl ring-2 ring-[#E8770E]"
          animate={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: Math.min(rect.height + pad * 2, window.innerHeight - 40) }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          style={{ boxShadow: '0 0 0 9999px rgb(10 15 24 / 0.55)' }} />
      ) : (
        <div className="absolute inset-0 bg-[#0a0f18]/40" />
      )}
      <>
        <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          className="pointer-events-auto absolute bottom-6 left-1/2 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-[#0f1b2d]/95 text-white shadow-pop backdrop-blur">
          <div className="h-1 bg-white/10">
            <div className="h-full bg-gradient-to-r from-[#E8770E] to-[#c9a2e6] transition-[width] duration-100" style={{ width: `${Math.min(100, (elapsed / s.ms) * 100)}%` }} />
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <Badge solid color="#E8770E">{s.tag}</Badge>
              <span>Step {step + 1} of {DEMO_STEPS.length}</span>
              <span className="ml-auto hidden sm:inline">← → navigate · space pause · esc exit</span>
            </div>
            <h3 className="mt-2 font-serif text-lg font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-white/80">{s.caption}</p>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex gap-1">
                {DEMO_STEPS.map((_, i) => <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === step ? 18 : 6, background: i <= step ? '#E8770E' : 'rgb(255 255 255 / 0.2)' }} />)}
              </div>
              <div className="ml-auto flex items-center gap-1">
                <IconButton label="Previous step" className="text-white/70 hover:bg-white/10 hover:text-white" onClick={prev} disabled={step === 0}><ChevronLeft size={16} /></IconButton>
                <IconButton label={paused ? 'Resume' : 'Pause'} className="text-white/70 hover:bg-white/10 hover:text-white" onClick={togglePause}>{paused ? <Play size={15} /> : <Pause size={15} />}</IconButton>
                <Button size="sm" variant="quantum" onClick={next}>{step === DEMO_STEPS.length - 1 ? 'Finish' : 'Next'} <ChevronRight size={14} /></Button>
                <IconButton label="Exit demo" className="text-white/70 hover:bg-white/10 hover:text-white" onClick={stop}><X size={16} /></IconButton>
              </div>
            </div>
          </div>
        </motion.div>
      </>
    </div>
  );
}
