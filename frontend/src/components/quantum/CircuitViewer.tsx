/** Hand-written SVG circuit renderer (Section 8.3): blocks, filters, zoom/pan, minimap, export, build/step/live modes. */
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, Maximize2, Pause, Play, ZoomIn, ZoomOut } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CircuitSpec, GateOp, GateRole } from '@/types/quantum';
import { gateColor } from '@/content/gates';
import { download, exportPng, exportSvg } from '@/lib/export';
import { useReducedMotion } from '@/hooks';
import { IconButton, cn } from '../common/ui';
import { GateDrawer } from './GateDrawer';

export type CircuitMode = 'static' | 'build' | 'step' | 'live';

const ROLE_COLOR: Record<GateRole, string> = { encoding: 'var(--saffron)', variational: 'var(--blue)', entangling: 'var(--navy)', measurement: 'var(--green)' };
const ROLE_LABEL: Record<GateRole, string> = { encoding: 'Encoding', variational: 'Variational', entangling: 'Entangling', measurement: 'Measurement' };

const thetaIndex = (ref?: string) => {
  if (!ref || !ref.startsWith('θ')) return -1;
  const digits = ref.slice(1).replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080));
  return Number(digits);
};

export interface CircuitViewerProps {
  spec: CircuitSpec;
  mode?: CircuitMode;
  step?: number;
  onStepChange?: (s: number) => void;
  params?: number[];
  onGateClick?: (g: GateOp) => void;
  featureLabels?: string[];
  qubitImportance?: number[];
  compact?: boolean;
  toolbar?: boolean;
  maxHeight?: number;
  title?: string;
}

export function CircuitViewer({ spec, mode = 'static', step, onStepChange, params, onGateClick, featureLabels, qubitImportance, compact, toolbar = true, maxHeight, title = 'circuit' }: CircuitViewerProps) {
  const reduced = useReducedMotion();
  const COL = compact ? 38 : 46;
  const ROW = compact ? 34 : 44;
  const LEFT = featureLabels ? (compact ? 120 : 168) : 52;
  const TOP = 26;
  const [hidden, setHidden] = useState<GateRole[]>([]);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [hoverWire, setHoverWire] = useState<number | null>(null);
  const [tip, setTip] = useState<{ g: GateOp; x: number; y: number } | null>(null);
  const [drawer, setDrawer] = useState<GateOp | null>(null);
  const [playing, setPlaying] = useState(false);
  const [innerStep, setInnerStep] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ left: 0, width: 1, total: 1 });
  const maxLayer = spec.ops.reduce((m, o) => Math.max(m, o.layer), 0);
  const cur = step ?? innerStep;
  const setStep = (s: number) => (onStepChange ? onStepChange(s) : setInnerStep(s));

  const layout = useMemo(() => {
    const blocks = spec.blocks ?? [];
    const blockOf = (L: number) => blocks.find((b) => L >= b.start && L <= b.end);
    const col: number[] = [];
    let c = 0;
    for (let L = 0; L <= maxLayer; L++) {
      const b = blockOf(L);
      if (b && collapsed.includes(b.label)) {
        if (L === b.start) {
          col[L] = c;
          c += 2;
        } else col[L] = col[b.start];
      } else col[L] = c++;
    }
    return { col, cols: c, blockOf };
  }, [spec, collapsed, maxLayer]);

  const W = LEFT + layout.cols * COL + 40;
  const H = TOP + spec.nQubits * ROW + 8;
  const x = (L: number) => LEFT + layout.col[L] * COL + COL / 2;
  const y = (q: number) => TOP + q * ROW + ROW / 2;

  // Live mode: pulse the gates whose parameters changed most.
  const prev = useRef<number[] | undefined>(undefined);
  const [pulse, setPulse] = useState<{ ids: Set<number>; key: number }>({ ids: new Set(), key: 0 });
  useEffect(() => {
    if (mode !== 'live' || !params) return;
    const p = prev.current;
    if (p && p.length === params.length) {
      const d = params.map((v, i) => ({ i, d: Math.abs(v - p[i]) })).sort((a, b) => b.d - a.d).slice(0, 3).filter((o) => o.d > 1e-3);
      setPulse((s) => ({ ids: new Set(d.map((o) => o.i)), key: s.key + 1 }));
    }
    prev.current = params;
  }, [params, mode]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const nxt = cur + 1;
      if (nxt > maxLayer + 1) {
        setPlaying(false);
        return;
      }
      setStep(nxt);
    }, 520);
    return () => clearInterval(id);
  }); // re-armed each render with the latest step

  const syncView = () => {
    const el = scroller.current;
    if (el) setView({ left: el.scrollLeft, width: el.clientWidth, total: el.scrollWidth });
  };
  useEffect(syncView, [zoom, W]);

  const fit = () => {
    const el = scroller.current;
    if (el) setZoom(Math.max(0.35, Math.min(1.6, (el.clientWidth - 8) / W)));
  };

  const opacityFor = (g: GateOp) => {
    if (hidden.includes(g.role)) return 0.1;
    if (mode === 'step' && g.layer >= cur) return 0.22;
    return 1;
  };

  const renderGate = (g: GateOp) => {
    const b = layout.blockOf(g.layer);
    if (b && collapsed.includes(b.label)) return null;
    const gx = x(g.layer);
    const color = gateColor(g.name);
    const op = opacityFor(g);
    const handlers = {
      onMouseEnter: (e: React.MouseEvent) => setTip({ g, x: e.clientX, y: e.clientY }),
      onMouseMove: (e: React.MouseEvent) => setTip({ g, x: e.clientX, y: e.clientY }),
      onMouseLeave: () => setTip(null),
      onClick: () => (onGateClick ? onGateClick(g) : setDrawer(g)),
      style: { cursor: 'pointer' },
    };
    // Build-in animation is pure CSS (see .circuit-build) — far cheaper than a spring per gate.
    const anim = { initial: false as const, animate: { opacity: op } };
    const key = g.id;
    if (g.name === 'CNOT' || g.name === 'CZ' || g.name === 'SWAP' || g.name === 'CRZ') {
      const [c, t] = g.wires;
      const yc = y(c), yt = y(t);
      return (
        <motion.g key={key} {...anim} {...handlers} style={{ animationDelay: `${Math.min(1.2, g.layer * 0.018)}s`, transformOrigin: `${gx}px ${(yc + yt) / 2}px`, cursor: 'pointer' }}>
          <line x1={gx} x2={gx} y1={yc} y2={yt} stroke={color} strokeWidth={2} />
          {g.name === 'SWAP' ? (
            [yc, yt].map((yy, k) => <path key={k} d={`M${gx - 6},${yy - 6}L${gx + 6},${yy + 6}M${gx + 6},${yy - 6}L${gx - 6},${yy + 6}`} stroke={color} strokeWidth={2.2} />)
          ) : (
            <circle cx={gx} cy={yc} r={4.5} fill={color} />
          )}
          {g.name === 'CNOT' && (
            <g>
              <circle cx={gx} cy={yt} r={10} fill="var(--surface)" stroke={color} strokeWidth={2} />
              <path d={`M${gx - 10},${yt}H${gx + 10}M${gx},${yt - 10}V${yt + 10}`} stroke={color} strokeWidth={2} />
            </g>
          )}
          {g.name === 'CZ' && <circle cx={gx} cy={yt} r={4.5} fill={color} />}
          {g.name === 'CRZ' && (
            <g>
              <rect x={gx - 16} y={yt - 13} width={32} height={26} rx={6} fill={color} />
              <text x={gx} y={yt + 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#fff" fontFamily="JetBrains Mono">RZ</text>
            </g>
          )}
          <rect x={gx - 14} y={Math.min(yc, yt) - 14} width={28} height={Math.abs(yt - yc) + 28} fill="transparent" />
        </motion.g>
      );
    }
    const gy = y(g.wires[0]);
    if (g.name === 'MEASURE') {
      return (
        <motion.g key={key} {...anim} {...handlers} style={{ animationDelay: `${Math.min(1.2, g.layer * 0.018)}s`, transformOrigin: `${gx}px ${gy}px`, cursor: 'pointer' }}>
          <rect x={gx - 15} y={gy - 13} width={30} height={26} rx={5} fill="var(--tint-green)" stroke={color} strokeWidth={1.6} />
          <path d={`M${gx - 9},${gy + 6} A10,10 0 0 1 ${gx + 9},${gy + 6}`} fill="none" stroke={color} strokeWidth={1.6} />
          <line x1={gx} y1={gy + 6} x2={gx + 7} y2={gy - 6} stroke={color} strokeWidth={1.6} />
          <path d={`M${gx + 15},${gy - 1.5}H${W - 12}M${gx + 15},${gy + 1.5}H${W - 12}`} stroke={color} strokeWidth={1} opacity={0.6} />
        </motion.g>
      );
    }
    if (g.name === 'STATEPREP') {
      const y0 = y(0) - 16, y1 = y(spec.nQubits - 1) + 16;
      return (
        <motion.g key={key} {...anim} {...handlers} style={{ animationDelay: `${Math.min(1.2, g.layer * 0.018)}s`, transformOrigin: `${gx}px ${(y0 + y1) / 2}px`, cursor: 'pointer' }}>
          <rect x={gx - 18} y={y0} width={36} height={y1 - y0} rx={7} fill="var(--tint-teal)" stroke={color} strokeWidth={1.6} strokeDasharray="4 2" />
          <text x={gx} y={(y0 + y1) / 2 - 4} textAnchor="middle" fontSize={10} fontWeight={700} fill={color} fontFamily="JetBrains Mono">Amp</text>
          <text x={gx} y={(y0 + y1) / 2 + 9} textAnchor="middle" fontSize={10} fill={color} fontFamily="JetBrains Mono">|x⟩</text>
        </motion.g>
      );
    }
    const isData = g.role === 'encoding' && !!g.params?.length;
    const tIdx = thetaIndex(g.paramRefs?.[0]);
    const live = mode === 'live' && params && tIdx >= 0 ? params[tIdx] : undefined;
    const intensity = live !== undefined ? 0.35 + 0.65 * (((live % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) : 1;
    const pulsing = mode === 'live' && tIdx >= 0 && pulse.ids.has(tIdx);
    const label: string = g.name;
    return (
      <motion.g key={pulsing ? `${key}-p${pulse.key}` : key} {...anim} {...handlers} style={{ animationDelay: `${Math.min(1.2, g.layer * 0.018)}s`, transformOrigin: `${gx}px ${gy}px`, cursor: 'pointer' }} className={pulsing ? 'gate-pulse' : undefined}>
        {isData ? (
          <>
            <rect x={gx - 16} y={gy - 14} width={32} height={28} rx={6} fill="var(--surface)" stroke={color} strokeWidth={1.8} />
            <rect x={gx - 16} y={gy - 14} width={32} height={28} rx={6} fill="url(#hatch)" style={{ color }} opacity={0.45} />
          </>
        ) : (
          <rect x={gx - 16} y={gy - 14} width={32} height={28} rx={6} fill={color} opacity={intensity} />
        )}
        <text x={gx} y={g.paramRefs && !compact ? gy - 1 : gy + 4} textAnchor="middle" fontSize={label.length > 2 ? 9.5 : 11} fontWeight={700} fill={isData ? color : '#fff'} fontFamily="JetBrains Mono">{label}</text>
        {g.paramRefs && !compact && (
          <text x={gx} y={gy + 9} textAnchor="middle" fontSize={7.5} fill={isData ? color : '#fff'} opacity={0.9} fontFamily="JetBrains Mono">
            {(g.paramRefs[0].length > 6 ? `${g.paramRefs[0].slice(0, 5)}…` : g.paramRefs[0])}
          </text>
        )}
      </motion.g>
    );
  };

  const roles: GateRole[] = ['encoding', 'variational', 'entangling', 'measurement'];
  return (
    <div className="relative">
      {toolbar && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {roles.map((r) => {
            const count = spec.ops.filter((g) => g.role === r).length;
            if (!count) return null;
            const off = hidden.includes(r);
            return (
              <button key={r} onClick={() => setHidden((h) => (off ? h.filter((x) => x !== r) : [...h, r]))} aria-pressed={!off}
                className={cn('flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition', off ? 'border-line text-muted line-through' : 'border-transparent text-fg-2')}
                style={off ? undefined : { background: `color-mix(in srgb, ${ROLE_COLOR[r]} 12%, transparent)` }}>
                <span className="h-2 w-2 rounded-full" style={{ background: ROLE_COLOR[r] }} />
                {ROLE_LABEL[r]} <span className="tnum text-muted">{count}</span>
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-0.5">
            <IconButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.35, z - 0.15))}><ZoomOut size={15} /></IconButton>
            <span className="tnum w-10 text-center text-[11px] text-muted">{Math.round(zoom * 100)}%</span>
            <IconButton label="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}><ZoomIn size={15} /></IconButton>
            <IconButton label="Fit to screen" onClick={fit}><Maximize2 size={14} /></IconButton>
            <ExportMenu onSvg={() => svgRef.current && exportSvg(svgRef.current, title)} onPng={() => svgRef.current && exportPng(svgRef.current, title)} onQasm={() => download(`${title}.qasm`, spec.qasm ?? '')} />
          </div>
        </div>
      )}
      <div ref={scroller} onScroll={syncView} className="overflow-auto rounded-lg border border-line bg-surface-2" style={{ maxHeight }}
        onPointerDown={(e) => {
          if ((e.target as Element).closest('g')) return;
          const el = scroller.current!;
          const sx = e.clientX, sl = el.scrollLeft;
          const move = (ev: PointerEvent) => (el.scrollLeft = sl - (ev.clientX - sx));
          const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
          };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        }}>
        <svg ref={svgRef} width={W * zoom} height={H * zoom} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Quantum circuit: ${spec.nQubits} qubits, depth ${spec.depth}, ${spec.ops.length} gates, ${spec.twoQubitGateCount} two-qubit gates, ${spec.nTrainableParams} trainable parameters`}>
          <defs>
            <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeWidth="1.6" />
            </pattern>
          </defs>
          {(spec.blocks ?? []).map((b) => {
            const isCol = collapsed.includes(b.label);
            const x0 = x(b.start) - COL / 2 + 3;
            const x1 = isCol ? x0 + COL * 2 - 6 : x(b.end) + COL / 2 - 3;
            const c = ROLE_COLOR[b.role];
            return (
              <g key={b.label}>
                <rect x={x0} y={TOP - 20} width={x1 - x0} height={H - TOP + 16} rx={8} fill={c} opacity={0.06} />
                <rect x={x0} y={TOP - 20} width={x1 - x0} height={H - TOP + 16} rx={8} fill="none" stroke={c} strokeOpacity={0.35} strokeDasharray="3 3" />
                <text x={x0 + 6} y={TOP - 8} fontSize={9} fontWeight={600} fill={c} style={{ cursor: 'pointer' }} onClick={() => setCollapsed((s) => (isCol ? s.filter((l) => l !== b.label) : [...s, b.label]))}>
                  {isCol ? '▸ ' : '▾ '}
                  {(() => {
                    const max = Math.max(4, Math.floor((x1 - x0 - 18) / 5.2));
                    return b.label.length > max ? `${b.label.slice(0, max - 1)}…` : b.label;
                  })()}
                </text>
                {isCol && (
                  <g>
                    <rect x={x0 + 6} y={y(0) - 16} width={x1 - x0 - 12} height={y(spec.nQubits - 1) - y(0) + 32} rx={8} fill={c} opacity={0.85} />
                    <text x={(x0 + x1) / 2} y={(y(0) + y(spec.nQubits - 1)) / 2 + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff" fontFamily="JetBrains Mono">
                      {spec.ops.filter((g) => g.layer >= b.start && g.layer <= b.end).length} gates
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          {Array.from({ length: spec.nQubits }, (_, q) => (
            <g key={q} onMouseEnter={() => setHoverWire(q)} onMouseLeave={() => setHoverWire(null)}>
              {hoverWire === q && <rect x={0} y={y(q) - ROW / 2 + 2} width={W} height={ROW - 4} fill="var(--blue)" opacity={0.07} />}
              {qubitImportance && <rect x={4} y={y(q) - 8} width={Math.max(2, qubitImportance[q] * 28)} height={16} rx={3} fill="var(--purple)" opacity={0.25 + qubitImportance[q] * 0.6} />}
              <text x={qubitImportance ? 36 : 8} y={y(q) - (featureLabels ? 3 : -4)} fontSize={11} fontWeight={600} fill="var(--fg-2)" fontFamily="JetBrains Mono">q{q} <tspan fill="var(--muted)" fontWeight={400}>|0⟩</tspan></text>
              {featureLabels?.[q] && (
                <text x={qubitImportance ? 36 : 8} y={y(q) + 10} fontSize={9} fill={hoverWire === q ? 'var(--blue)' : 'var(--muted)'} fontWeight={hoverWire === q ? 600 : 400}>
                  ← {featureLabels[q].length > 22 ? `${featureLabels[q].slice(0, 21)}…` : featureLabels[q]}
                </text>
              )}
              <line x1={LEFT - 4} x2={W - 12} y1={y(q)} y2={y(q)} stroke="var(--line-strong)" strokeWidth={hoverWire === q ? 2 : 1.2} />
            </g>
          ))}
          <g className={mode === 'build' && !reduced ? 'circuit-build' : undefined}>{spec.ops.map((g) => renderGate(g))}</g>
          {mode === 'step' && (
            <motion.g initial={false} animate={{ x: (cur === 0 ? LEFT - 6 : x(Math.min(cur, maxLayer + 1) - 1) + COL / 2) - LEFT }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
              <line x1={LEFT} x2={LEFT} y1={TOP - 22} y2={H} stroke="var(--saffron)" strokeWidth={2.5} />
              <circle cx={LEFT} cy={TOP - 22} r={4} fill="var(--saffron)" />
            </motion.g>
          )}
        </svg>
      </div>
      {view.total > view.width + 4 && (
        <div className="relative mt-1.5 h-5 cursor-pointer overflow-hidden rounded border border-line bg-surface-2" aria-label="Circuit minimap"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const el = scroller.current!;
            el.scrollLeft = ((e.clientX - r.left) / r.width) * el.scrollWidth - el.clientWidth / 2;
          }}>
          {(spec.blocks ?? []).map((b) => (
            <div key={b.label} className="absolute inset-y-1 rounded-sm" style={{ left: `${((x(b.start) - COL / 2) / W) * 100}%`, width: `${((x(b.end) - x(b.start) + COL) / W) * 100}%`, background: ROLE_COLOR[b.role], opacity: 0.45 }} />
          ))}
          <div className="absolute inset-y-0 rounded border-2 border-classical bg-classical/10" style={{ left: `${(view.left / view.total) * 100}%`, width: `${(view.width / view.total) * 100}%` }} />
        </div>
      )}
      {mode === 'step' && (
        <div className="mt-2 flex items-center gap-2">
          <IconButton label="Step back" onClick={() => setStep(Math.max(0, cur - 1))}><ChevronLeft size={16} /></IconButton>
          <IconButton label={playing ? 'Pause' : 'Play'} onClick={() => { if (cur > maxLayer) setStep(0); setPlaying((p) => !p); }}>{playing ? <Pause size={15} /> : <Play size={15} />}</IconButton>
          <IconButton label="Step forward" onClick={() => setStep(Math.min(maxLayer + 1, cur + 1))}><ChevronRight size={16} /></IconButton>
          <input type="range" min={0} max={maxLayer + 1} value={cur} onChange={(e) => setStep(Number(e.target.value))} aria-label="Scrub circuit columns" className="flex-1"
            style={{ '--pct': `${(cur / (maxLayer + 1)) * 100}%`, '--accent': 'var(--saffron)' } as React.CSSProperties} />
          <span className="tnum w-20 text-right font-mono text-[11px] text-muted">col {cur}/{maxLayer + 1}</span>
        </div>
      )}
      {tip && createPortal(
        <div className="pointer-events-none fixed z-[200] rounded-lg bg-[#0f1b2d] px-2.5 py-1.5 text-xs text-white shadow-pop" style={{ left: tip.x + 12, top: tip.y + 12 }}>
          <div className="font-mono font-semibold">{tip.g.name}{tip.g.paramRefs ? `(${tip.g.paramRefs.join(', ')})` : ''} <span className="font-normal text-white/60">on q{tip.g.wires.join(' → q')}</span></div>
          {tip.g.params && tip.g.name !== 'STATEPREP' && <div className="font-mono text-white/80">= {tip.g.params.map((p) => `${p.toFixed(3)} rad`).join(', ')}</div>}
          {mode === 'live' && params && thetaIndex(tip.g.paramRefs?.[0]) >= 0 && <div className="font-mono text-[#c9a2e6]">live θ = {params[thetaIndex(tip.g.paramRefs?.[0])]?.toFixed(3)}</div>}
          <div className="text-white/60">{tip.g.block} · {tip.g.role} · click for details</div>
        </div>,
        document.body,
      )}
      <GateDrawer gate={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

function ExportMenu({ onSvg, onPng, onQasm }: { onSvg: () => void; onPng: () => void; onQasm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <IconButton label="Export circuit" onClick={() => setOpen((o) => !o)}><Download size={15} /></IconButton>
      {open && (
        <div className="card absolute right-0 top-9 z-30 w-36 p-1 shadow-pop" onMouseLeave={() => setOpen(false)}>
          {[['SVG', onSvg], ['PNG', onPng], ['OpenQASM', onQasm]].map(([l, fn]) => (
            <button key={l as string} className="w-full rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-surface-3" onClick={() => { (fn as () => void)(); setOpen(false); }}>
              Export {l as string}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
