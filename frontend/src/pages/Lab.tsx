import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, ChevronLeft, ChevronRight, Download, Minus, Pause, Play, Plus, Redo2, Trash2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, IconButton, Slider, Tip, cn } from '@/components/common/ui';
import { Tex } from '@/components/common/misc';
import { BlochGrid } from '@/components/quantum/Bloch';
import { CircuitViewer } from '@/components/quantum/CircuitViewer';
import { EntanglementMap, MeasurementHistogram, StateBars } from '@/components/quantum/StateViews';
import { gateColor, gateInfo } from '@/content/gates';
import { COLS, LESSONS, PALETTE, PARAM, PRESETS, TWO, g, toOps, toSpec, type LabCircuit, type LabGate } from '@/features/lab/labState';
import { dirac, simulate } from '@/lib/quantum/simulator';
import { download } from '@/lib/export';
import { piFrac } from '@/lib/format';
import type { GateName } from '@/types/quantum';

const CELL = 52;

export default function Lab() {
  const [circ, setCirc] = useState<LabCircuit>(() => PRESETS[1].build());
  const [past, setPast] = useState<LabCircuit[]>([]);
  const [future, setFuture] = useState<LabCircuit[]>([]);
  const [tool, setTool] = useState<GateName>('H');
  const [pending, setPending] = useState<{ col: number; control: number } | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [step, setStep] = useState(COLS);
  const [playing, setPlaying] = useState(false);
  const [lesson, setLesson] = useState<string | null>('entanglement');
  const [shift, setShift] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const commit = useCallback((next: LabCircuit) => {
    setPast((p) => [...p.slice(-50), circ]);
    setFuture([]);
    setCirc(next);
  }, [circ]);
  const undo = useCallback(() => { if (!past.length) return; setFuture((f) => [circ, ...f]); setCirc(past[past.length - 1]); setPast((p) => p.slice(0, -1)); }, [past, circ]);
  const redo = useCallback(() => { if (!future.length) return; setPast((p) => [...p, circ]); setCirc(future[0]); setFuture((f) => f.slice(1)); }, [future, circ]);
  const selected = circ.gates.find((x) => x.id === sel);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      setShift(e.shiftKey);
      const typing = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) && (e.target as HTMLInputElement).type !== 'range';
      if (typing) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { commit({ ...circ, gates: circ.gates.filter((x) => x.id !== sel) }); setSel(null); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      if (e.key === 'Escape') setPending(null);
    };
    const up = (e: KeyboardEvent) => setShift(e.shiftKey);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [sel, circ, commit, undo, redo]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setStep((s) => { if (s >= COLS) { setPlaying(false); return s; } return s + 1; }), 450);
    return () => clearInterval(id);
  }, [playing]);

  const occupied = (q: number, col: number, ignore?: string) => circ.gates.some((x) => x.id !== ignore && x.col === col && (x.wires.length === 1 ? x.wires[0] === q : q >= Math.min(...x.wires) && q <= Math.max(...x.wires)));

  const place = (name: GateName, q: number, col: number) => {
    if (TWO.includes(name)) {
      if (circ.n < 2) return toast.error('Add a second qubit for two-qubit gates');
      if (!pending) { if (occupied(q, col)) return; setPending({ col, control: q }); return; }
      if (pending.col !== col || pending.control === q) { setPending(null); return; }
      const lo = Math.min(pending.control, q), hi = Math.max(pending.control, q);
      for (let w = lo; w <= hi; w++) if (occupied(w, col)) { setPending(null); return toast.error('Column is occupied between those qubits'); }
      commit({ ...circ, gates: [...circ.gates, g(name, [pending.control, q], col)] });
      setPending(null);
      return;
    }
    if (occupied(q, col)) return;
    const ng = g(name, [q], col, PARAM.includes(name) ? [Math.PI / 2] : undefined);
    commit({ ...circ, gates: [...circ.gates, ng] });
    if (ng.params) setSel(ng.id);
  };

  const ops = useMemo(() => toOps(circ), [circ]);
  const sim = useMemo(() => simulate(circ.n, ops, step - 1), [circ.n, ops, step]);
  const pairs = useMemo(() => circ.gates.filter((x) => x.wires.length > 1 && x.col < step).map((x) => x.wires as [number, number]), [circ, step]);
  const spec = useMemo(() => toSpec(circ), [circ]);
  const setParam = (v: number) => {
    if (!selected) return;
    const val = shift ? Math.round(v / (Math.PI / 4)) * (Math.PI / 4) : v;
    setCirc({ ...circ, gates: circ.gates.map((x) => (x.id === selected.id ? { ...x, params: [val] } : x)) });
  };
  const loadPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!;
    commit(p.build());
    setStep(COLS);
    setSel(null);
    setPending(null);
    if (p.lesson) setLesson(p.lesson);
  };

  return (
    <div>
      <PageHeader title="Quantum Lab" trace="lab" description="Build circuits by dragging gates onto wires. The in-browser statevector simulator updates every view instantly." actions={
        <>
          <Button size="sm" variant="outline" icon={<Download size={13} />} onClick={() => download('circuit.json', JSON.stringify(circ, null, 2), 'application/json')}>JSON</Button>
          <Button size="sm" variant="outline" icon={<Download size={13} />} onClick={() => download('circuit.qasm', spec.qasm ?? '')}>QASM</Button>
        </>
      } />
      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} key={p.id} onClick={() => loadPreset(p.id)} className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-fg-2 hover:border-quantum hover:text-quantum">{p.label}</motion.button>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Circuit canvas" subtitle={pending ? `Pick a target qubit in column ${pending.col} for ${tool} (Esc to cancel)` : 'Drag a gate onto a wire, or pick one and click a cell · Del delete · Ctrl Z / Y undo / redo · Shift snaps angles to π/4'} actions={
              <>
                <IconButton label="Remove qubit" onClick={() => circ.n > 1 && commit({ n: circ.n - 1, gates: circ.gates.filter((x) => x.wires.every((w) => w < circ.n - 1)) })}><Minus size={14} /></IconButton>
                <span className="tnum w-14 text-center text-xs text-muted">{circ.n} qubit{circ.n > 1 ? 's' : ''}</span>
                <IconButton label="Add qubit" onClick={() => circ.n < 6 && commit({ ...circ, n: circ.n + 1 })}><Plus size={14} /></IconButton>
                <IconButton label="Undo" onClick={undo}><Undo2 size={14} /></IconButton>
                <IconButton label="Redo" onClick={redo}><Redo2 size={14} /></IconButton>
                <IconButton label="Clear" onClick={() => commit({ ...circ, gates: [] })}><Trash2 size={14} /></IconButton>
              </>
            } />
            <div className="p-4">
              <div className="mb-3 flex flex-wrap gap-1.5" role="toolbar" aria-label="Gate palette">
                {PALETTE.map((name) => (
                  <Tip key={name} text={gateInfo(name)?.description ?? name}>
                    <button draggable onDragStart={(e) => { e.dataTransfer.setData('text/gate', name); setTool(name); }} onClick={() => { setTool(name); setPending(null); }} aria-pressed={tool === name}
                      className={cn('flex h-9 min-w-9 items-center justify-center rounded-lg px-2 font-mono text-xs font-bold text-white shadow-sm transition active:scale-95', tool === name && 'ring-2 ring-offset-2 ring-offset-surface')} style={{ background: gateColor(name), ['--tw-ring-color' as string]: gateColor(name) }}>
                      {name === 'MEASURE' ? 'M' : name === 'CNOT' ? '⊕' : name}
                    </button>
                  </Tip>
                ))}
              </div>
              <div className="overflow-x-auto rounded-xl border border-line bg-surface-2 p-3">
                <div className="relative" style={{ width: COLS * CELL + 60, height: circ.n * CELL }}>
                  {Array.from({ length: circ.n }, (_, q) => (
                    <div key={q} className="absolute left-0 flex items-center" style={{ top: q * CELL, height: CELL }}>
                      <span className="w-12 font-mono text-xs font-semibold text-fg-2">q{q} <span className="text-muted">|0⟩</span></span>
                    </div>
                  ))}
                  {Array.from({ length: circ.n }, (_, q) => <div key={q} className="absolute h-px bg-line-strong" style={{ left: 56, right: 0, top: q * CELL + CELL / 2 }} />)}
                  <motion.div className="absolute top-0 z-20 w-0.5 bg-saffron" style={{ height: circ.n * CELL }} animate={{ left: 56 + step * CELL }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
                  {Array.from({ length: circ.n }, (_, q) => Array.from({ length: COLS }, (_, col) => {
                    const key = `${q}-${col}`;
                    return (
                      <div key={key} className={cn('absolute rounded-md transition-colors', dragOver === key ? 'bg-quantum/20 ring-2 ring-quantum' : pending?.col === col ? 'bg-saffron/10 hover:bg-saffron/25' : 'hover:bg-classical/10')}
                        style={{ left: 56 + col * CELL + 4, top: q * CELL + 4, width: CELL - 8, height: CELL - 8 }}
                        onClick={() => place(tool, q, col)} onDragOver={(e) => { e.preventDefault(); setDragOver(key); }} onDragLeave={() => setDragOver(null)}
                        onDrop={(e) => { e.preventDefault(); setDragOver(null); const name = e.dataTransfer.getData('text/gate') as GateName; if (name) { setTool(name); place(name, q, col); } }} />
                    );
                  }))}
                  {pending && <div className="pointer-events-none absolute z-10 flex items-center justify-center rounded-full bg-navy text-[10px] text-white" style={{ left: 56 + pending.col * CELL + CELL / 2 - 7, top: pending.control * CELL + CELL / 2 - 7, width: 14, height: 14 }}>●</div>}
                  <AnimatePresence>
                    {circ.gates.map((x) => <GateChip key={x.id} gate={x} selected={sel === x.id} dim={x.col >= step} onSelect={() => setSel(x.id === sel ? null : x.id)} />)}
                  </AnimatePresence>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <IconButton label="Step back" onClick={() => setStep((s) => Math.max(0, s - 1))}><ChevronLeft size={16} /></IconButton>
                <IconButton label={playing ? 'Pause' : 'Play'} onClick={() => { if (step >= COLS) setStep(0); setPlaying((p) => !p); }}>{playing ? <Pause size={15} /> : <Play size={15} />}</IconButton>
                <IconButton label="Step forward" onClick={() => setStep((s) => Math.min(COLS, s + 1))}><ChevronRight size={16} /></IconButton>
                <span className="font-mono text-[11px] text-muted">playhead: after column {step}</span>
                {selected?.params && (
                  <div className="ml-auto flex min-w-[260px] items-end gap-2">
                    <Slider className="flex-1" label={`${selected.name} angle on q${selected.wires[0]}${shift ? ' (snap π/4)' : ''}`} value={selected.params[0]} min={0} max={2 * Math.PI} step={0.01} onChange={setParam} format={piFrac} accent="var(--blue)" />
                    <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => { commit({ ...circ, gates: circ.gates.filter((x) => x.id !== selected.id) }); setSel(null); }}>Delete</Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Rendered circuit" subtitle="Same circuit in the platform's CircuitViewer — export SVG / PNG / QASM" />
            <div className="p-3"><CircuitViewer spec={spec} mode="step" step={step} onStepChange={setStep} maxHeight={300} title="lab-circuit" /></div>
          </Card>
          <Card>
            <CardHeader title="Mini-lessons" icon={<BookOpen size={16} />} />
            <div className="grid gap-3 p-4 md:grid-cols-[220px_1fr]">
              <div className="space-y-1">
                {Object.entries(LESSONS).map(([k, l]) => <button key={k} onClick={() => { setLesson(k); loadPreset(l.preset); }} className={cn('w-full rounded-lg px-3 py-2 text-left text-sm transition', lesson === k ? 'bg-tint-purple font-semibold text-quantum' : 'text-fg-2 hover:bg-surface-2')}>{l.title}</button>)}
              </div>
              <>
                {lesson && <motion.div key={lesson} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="rounded-xl bg-surface-2 p-4 text-sm leading-relaxed text-fg-2"><div className="mb-1 font-serif text-lg font-semibold text-heading">{LESSONS[lesson].title}</div>{LESSONS[lesson].text}</motion.div>}
              </>
            </div>
          </Card>
        </div>
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <CardHeader title="State (Dirac notation)" subtitle="q0 is the leftmost bit" />
            <motion.div key={dirac(sim.re, sim.im, circ.n)} initial={{ opacity: 0.3, y: 4 }} animate={{ opacity: 1, y: 0 }} className="overflow-x-auto px-4 py-3 font-mono text-base font-semibold text-quantum">|ψ⟩ = {dirac(sim.re, sim.im, circ.n) || '0'}</motion.div>
          </Card>
          <Card><CardHeader title="Basis-state probabilities" /><div className="p-4"><StateBars re={sim.re} im={sim.im} n={circ.n} height={150} /></div></Card>
          <Card><CardHeader title="Bloch spheres" subtitle="Drag to rotate · shorter arrow = entangled" /><div className="p-3"><BlochGrid vectors={sim.bloch} size={circ.n > 3 ? 104 : 130} /></div></Card>
          <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
            <Card><CardHeader title="Measurement histogram" /><div className="p-4"><MeasurementHistogram probs={sim.probabilities} n={circ.n} /></div></Card>
            <Card><CardHeader title="Entanglement map" /><div className="flex justify-center p-3">{circ.n > 1 ? <EntanglementMap n={circ.n} pairs={pairs} size={170} /> : <div className="p-6 text-xs text-muted">1 qubit</div>}</div></Card>
          </div>
          <Card className="p-4 text-xs text-muted"><Tex>{'|\\psi\\rangle=\\sum_i \\alpha_i|i\\rangle,\\quad P(i)=|\\alpha_i|^2'}</Tex> · statevector simulated in your browser (≤ 8 qubits, exact).</Card>
        </div>
      </div>
    </div>
  );
}

function GateChip({ gate, selected, dim, onSelect }: { gate: LabGate; selected: boolean; dim: boolean; onSelect: () => void }) {
  const two = gate.wires.length > 1;
  const color = gateColor(gate.name);
  const left = 56 + gate.col * CELL;
  if (two) {
    const [c, t] = gate.wires;
    const top = Math.min(c, t) * CELL + CELL / 2, h = Math.abs(t - c) * CELL;
    return (
      <motion.div initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: dim ? 0.3 : 1, scale: 1 }} exit={{ opacity: 0, scale: 0.4 }} className="absolute z-10 cursor-pointer" style={{ left, top: 0, width: CELL, height: '100%' }} onClick={onSelect}>
        <div className="absolute left-1/2 w-0.5 -translate-x-1/2" style={{ top, height: h, background: color }} />
        {gate.name === 'SWAP' ? [c, t].map((w) => <span key={w} className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-lg font-bold" style={{ top: w * CELL + CELL / 2, color }}>✕</span>) : <span className="absolute left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ top: c * CELL + CELL / 2, background: color }} />}
        {gate.name === 'CNOT' && <span className="absolute left-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-surface text-sm font-bold" style={{ top: t * CELL + CELL / 2, borderColor: color, color }}>+</span>}
        {gate.name === 'CZ' && <span className="absolute left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ top: t * CELL + CELL / 2, background: color }} />}
        {selected && <span className="absolute inset-x-1 rounded-md ring-2 ring-saffron" style={{ top: Math.min(c, t) * CELL + 4, height: h + CELL - 8 }} />}
      </motion.div>
    );
  }
  return (
    <motion.button layout initial={{ opacity: 0, scale: 0.3, rotate: -20 }} animate={{ opacity: dim ? 0.3 : 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.3 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      onClick={onSelect} aria-label={`${gate.name} on q${gate.wires[0]}, column ${gate.col}`}
      className={cn('absolute z-10 flex flex-col items-center justify-center rounded-lg font-mono text-xs font-bold text-white shadow-md', selected && 'ring-2 ring-saffron ring-offset-2 ring-offset-surface-2')}
      style={{ left: left + 7, top: gate.wires[0] * CELL + 7, width: CELL - 14, height: CELL - 14, background: color }}>
      {gate.name === 'MEASURE' ? 'M' : gate.name}
      {gate.params && <span className="text-[8px] font-medium opacity-90">{piFrac(gate.params[0])}</span>}
    </motion.button>
  );
}
