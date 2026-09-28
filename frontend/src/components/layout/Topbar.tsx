/** Top navigation: prominent animated QuantaDx wordmark, grouped dropdown menus, live status, scroll progress, mobile menu. */
import { AnimatePresence, motion, useScroll, useSpring } from 'framer-motion';
import { Check, ChevronDown, Database, Menu, Moon, Play, Search, Settings, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useDatasets, useExperiments, useHealth } from '@/api/hooks';
import { USE_MOCK } from '@/api/client';
import { NAV, type NavItem } from '@/content/nav';
import { useDemo, usePipeline, useUi } from '@/store';
import { Button, IconButton, Kbd, Tip, cn } from '../common/ui';
import { LiveDot } from '../common/misc';
import { Logo } from './Logo';

function resolve(item: NavItem, expId: string): string {
  if (item.key === 'train' || item.key === 'results' || item.key === 'explain') return `/experiments/${expId}/${item.key}`;
  return item.to;
}

function isActive(item: NavItem, path: string): boolean {
  if (item.key === 'train') return /\/experiments\/[^/]+\/train/.test(path);
  if (item.key === 'results') return /\/experiments\/[^/]+\/results/.test(path);
  if (item.key === 'explain') return /\/experiments\/[^/]+\/explain/.test(path);
  if (item.key === 'experiments') return path === '/experiments';
  return item.to === '/' ? path === '/' : path.startsWith(item.to);
}

function DatasetChip() {
  const { data } = useDatasets();
  const active = usePipeline((s) => s.activeDatasetId);
  const setDataset = usePipeline((s) => s.setDataset);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const ds = data?.find((d) => d.id === active);
  // Uploaded datasets live in memory; after a reload fall back to the default benchmark.
  useEffect(() => {
    if (!data?.length || data.some((d) => d.id === active)) return;
    const fallback = data.find((d) => d.id === 'wdbc') ?? data[0];
    setDataset(fallback.id, fallback.taskType, fallback.target, fallback.positiveClass);
  }, [data, active, setDataset]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface/80 px-3 text-xs font-medium text-fg-2 transition hover:border-classical" aria-haspopup="listbox" aria-expanded={open}>
        <Database size={13} className="text-classical" />
        <span className="max-w-[120px] truncate">{ds?.shortName ?? active}</span>
        <ChevronDown size={12} className={cn('text-muted transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul role="listbox" initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} className="card absolute right-0 top-11 z-50 w-72 overflow-hidden p-1 shadow-pop">
            {data?.map((d) => (
              <li key={d.id}>
                <button role="option" aria-selected={d.id === active} onClick={() => { setDataset(d.id, d.taskType, d.target, d.positiveClass); setOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-3">
                  <span className="w-4">{d.id === active && <Check size={14} className="text-classical" />}</span>
                  <span className="flex-1 truncate">{d.shortName}</span>
                  <span className="text-[10px] text-muted">{d.taskType === 'regression' ? 'regression' : 'classification'} · {d.rows}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function BackendPill() {
  const { data: health, isError } = useHealth();
  const { data: exps } = useExperiments(true);
  const q = usePipeline((s) => s.quantumConfig.execution);
  const running = exps?.filter((e) => e.status === 'running' || e.status === 'queued') ?? [];
  const label = q.backend === 'hardware' ? `IBM · ${q.deviceName ?? 'ibm_brisbane'}` : q.backend === 'noisy' ? `Noisy sim · ${q.noise?.deviceModel ?? 'fake_manila'}` : q.backend === 'shots' ? `Simulator · ${q.shots} shots` : 'Simulator · statevector';
  const color = isError ? 'var(--red)' : running.length ? 'var(--saffron)' : 'var(--green)';
  return (
    <Tip text={<span>{isError ? 'Backend unreachable' : `API ${health?.status ?? '…'}${USE_MOCK ? ' (offline demo backend)' : ''}`} · {running.length} job(s) running · polled every 15 s</span>} side="bottom">
      <Link to="/dashboard" className="hidden h-9 items-center gap-2 rounded-xl border border-line bg-surface/80 px-3 text-xs font-medium text-fg-2 2xl:flex">
        <LiveDot color={color} />
        <span className="tnum">{label}</span>
        {running.length > 0 && <motion.span key={running.length} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="rounded-full bg-tint-saffron px-1.5 text-[10px] font-semibold text-saffron">{running.length} running</motion.span>}
      </Link>
    </Tip>
  );
}

function Wordmark() {
  return (
    <Link to="/" className="group flex shrink-0 items-center gap-2.5 whitespace-nowrap" aria-label="QuantaDx home">
      <motion.span whileHover={{ rotate: 20, scale: 1.08 }} transition={{ type: 'spring', stiffness: 300 }}><Logo size={38} /></motion.span>
      <span className="leading-none">
        <span className="wordmark block whitespace-nowrap text-[26px] font-extrabold tracking-tight">
          {'QuantaDx'.split('').map((ch, i) => (
            <motion.span key={i} className="inline-block" whileHover={{ y: -4, scale: 1.15 }} transition={{ type: 'spring', stiffness: 500, damping: 12 }}>{ch}</motion.span>
          ))}
        </span>
        <span className="mt-0.5 hidden whitespace-nowrap text-[9.5px] font-semibold uppercase tracking-[0.18em] text-muted 2xl:block">Hybrid quantum AI · early detection</span>
      </span>
    </Link>
  );
}

function NavGroup({ group, items, expId, path, onGo }: { group: string; items: NavItem[]; expId: string; path: string; onGo: () => void }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number>();
  const active = items.some((i) => isActive(i, path));
  const single = items.length === 1;
  const box = useRef<HTMLDivElement>(null);
  const enter = () => { clearTimeout(timer.current); setOpen(true); };
  const leave = () => { timer.current = window.setTimeout(() => setOpen(false), 160); };
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', out);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', out);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  if (single) {
    const it = items[0];
    return (
      <NavLink to={resolve(it, expId)} onClick={onGo} className={cn('relative rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors', active ? 'text-white' : 'text-fg-2 hover:text-fg')}>
        {active && <motion.span layoutId="topnav-active" className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#0070C0] to-[#7B3FA0] shadow-[0_6px_20px_-6px_rgba(123,63,160,0.6)]" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
        <span className="relative">{it.label}</span>
      </NavLink>
    );
  }
  return (
    <div ref={box} className="relative" onMouseEnter={enter} onMouseLeave={leave}>
      <button onClick={enter} aria-expanded={open} aria-haspopup="menu" className={cn('relative flex items-center gap-1 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors', active ? 'text-white' : 'text-fg-2 hover:text-fg')}>
        {active && <motion.span layoutId="topnav-active" className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#0070C0] to-[#7B3FA0] shadow-[0_6px_20px_-6px_rgba(123,63,160,0.6)]" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
        <span className="relative">{group}</span>
        <ChevronDown size={14} className={cn('relative transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ duration: 0.16 }}
            className="card absolute left-1/2 top-12 z-50 w-[330px] -translate-x-1/2 p-2 shadow-pop">
            {items.map((it, i) => {
              const Icon = it.icon;
              const on = isActive(it, path);
              return (
                <motion.div key={it.key} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.035 }}>
                  <NavLink to={resolve(it, expId)} onClick={() => { setOpen(false); onGo(); }} className={cn('group flex items-center gap-3 rounded-xl p-2.5 transition', on ? 'bg-tint-blue' : 'hover:bg-surface-2')}>
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition group-hover:scale-110', on ? 'bg-gradient-to-br from-[#0070C0] to-[#7B3FA0] text-white' : 'bg-surface-3 text-classical')}><Icon size={17} /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-fg">{it.label}</span>
                      <span className="block truncate text-xs text-muted">{it.desc}</span>
                    </span>
                  </NavLink>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TopNav() {
  const { pathname } = useLocation();
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const setPalette = useUi((s) => s.setPalette);
  const startDemo = useDemo((s) => s.start);
  const demoRunning = useDemo((s) => s.running);
  const expId = usePipeline((s) => s.activeExperimentId);
  const setActiveExperiment = usePipeline((s) => s.setActiveExperiment);
  const { data: exps } = useExperiments();
  // Experiments started before a reload are gone from the in-memory backend: fall back to the PoC run.
  useEffect(() => {
    if (exps?.length && !exps.some((e) => e.id === expId)) setActiveExperiment('exp-poc-001');
  }, [exps, expId, setActiveExperiment]);
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 8);
    h();
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  useEffect(() => setMobile(false), [pathname]);

  return (
    <header className={cn('sticky top-0 z-50 transition-[background-color,box-shadow] duration-300', scrolled ? 'bg-surface shadow-card' : 'bg-surface/95')}>
      <div className="mx-auto flex h-[70px] max-w-[1600px] items-center gap-3 px-4 lg:px-8">
        <Wordmark />
        <nav aria-label="Main navigation" className="mx-auto hidden items-center gap-0.5 xl:flex">
          {NAV.map((g) => (g.group === 'Overview'
            ? g.items.map((it) => <NavGroup key={it.key} group={it.label} items={[it]} expId={expId} path={pathname} onGo={() => undefined} />)
            : <NavGroup key={g.group} group={g.group} items={g.items} expId={expId} path={pathname} onGo={() => undefined} />))}
        </nav>
        <div className="ml-auto flex items-center gap-2 xl:ml-0">
          <DatasetChip />
          <BackendPill />
          <button onClick={() => setPalette(true)} className="hidden h-9 items-center gap-2 rounded-xl border border-line bg-surface/80 px-3 text-xs text-muted transition hover:border-classical lg:flex" aria-label="Open search">
            <Search size={14} /> Search <Kbd>Ctrl K</Kbd>
          </button>
          {!demoRunning && (
            <Button size="sm" variant="quantum" className="btn-shine h-9 rounded-xl bg-gradient-to-r from-[#7B3FA0] to-[#A35CC8]" icon={<Play size={13} />} onClick={() => { navigate('/'); startDemo(); }} data-tour="demo-button">
              <span className="hidden sm:inline">Live demo</span>
            </Button>
          )}
          <IconButton label={theme === 'dark' ? 'Light theme' : 'Dark theme'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            <motion.span key={theme} initial={{ rotate: -90, scale: 0.5 }} animate={{ rotate: 0, scale: 1 }}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</motion.span>
          </IconButton>
          <IconButton label="Settings" className="hidden sm:inline-flex" onClick={() => navigate('/settings')}><Settings size={17} /></IconButton>
          <IconButton label={mobile ? 'Close menu' : 'Open menu'} className="xl:hidden" onClick={() => setMobile((m) => !m)}>{mobile ? <X size={19} /> : <Menu size={19} />}</IconButton>
        </div>
      </div>
      <span aria-hidden className="topbar-line pointer-events-none absolute inset-x-0 bottom-0 h-px" />
      <motion.div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-gradient-to-r from-[#0070C0] via-[#7B3FA0] to-[#E8770E]" style={{ scaleX: progress }} />
      <AnimatePresence>
        {mobile && (
          <motion.nav aria-label="Mobile navigation" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-line bg-surface xl:hidden">
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {NAV.map((g) => (
                <div key={g.group}>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">{g.group}</div>
                  {g.items.map((it) => {
                    const Icon = it.icon;
                    return (
                      <NavLink key={it.key} to={resolve(it, expId)} className={cn('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium', isActive(it, pathname) ? 'bg-tint-blue text-classical' : 'text-fg-2 hover:bg-surface-2')}>
                        <Icon size={16} /> {it.label}
                      </NavLink>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
