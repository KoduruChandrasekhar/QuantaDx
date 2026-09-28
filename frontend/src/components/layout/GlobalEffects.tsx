/** Keyboard shortcuts, "Show me" spotlight, theme + reduced-motion classes, shortcut help. */
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { usePipeline, useUi } from '@/store';
import { Kbd, Modal } from '../common/ui';

export function GlobalEffects() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const theme = useUi((s) => s.theme);
  const reduced = useUi((s) => s.reducedMotion);
  const density = useUi((s) => s.density);
  const setPalette = useUi((s) => s.setPalette);
  const shortcutsOpen = useUi((s) => s.shortcutsOpen);
  const setShortcuts = useUi((s) => s.setShortcuts);
  const expId = usePipeline((s) => s.activeExperimentId);
  const pendingG = useRef(0);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('reduce-motion', reduced);
    document.documentElement.dataset.density = density;
  }, [theme, reduced, density]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(true);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '?') {
        setShortcuts(true);
        return;
      }
      if (e.key === 'g') {
        pendingG.current = Date.now();
        return;
      }
      if (Date.now() - pendingG.current < 1200) {
        const map: Record<string, string> = { d: '/dashboard', m: '/models', r: `/experiments/${expId}/results`, p: '/predict', h: '/', l: '/lab', e: '/experiments' };
        if (map[e.key]) navigate(map[e.key]);
        pendingG.current = 0;
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [navigate, setPalette, setShortcuts, expId]);

  // "Show me": /route?spotlight=<data-tour id>
  const spot = params.get('spotlight');
  useEffect(() => {
    if (!spot) return;
    let tries = 0;
    const id = setInterval(() => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${spot}"]`);
      if (el || tries++ > 40) {
        clearInterval(id);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('spotlight-pulse');
        setTimeout(() => el.classList.remove('spotlight-pulse'), 3800);
        const next = new URLSearchParams(params);
        next.delete('spotlight');
        setParams(next, { replace: true });
      }
    }, 100);
    return () => clearInterval(id);
  }, [spot, params, setParams]);

  const rows: [string, string][] = [
    ['Ctrl / ⌘ K', 'Command palette'], ['g then d', 'Dashboard'], ['g then m', 'Model Studio'], ['g then r', 'Results'], ['g then p', 'Predict'],
    ['g then l', 'Quantum Lab'], ['g then e', 'Experiments'], ['?', 'This help'], ['← / → / space / esc', 'Demo: navigate, pause, exit'], ['Del · Ctrl Z · Ctrl Y', 'Quantum Lab: delete, undo, redo'],
  ];
  return (
    <Modal open={shortcutsOpen} onClose={() => setShortcuts(false)} title="Keyboard shortcuts" width={460}>
      <ul className="divide-y divide-line">
        {rows.map(([k, v]) => (
          <li key={k} className="flex items-center justify-between py-2 text-sm">
            <span className="text-fg-2">{v}</span>
            <span className="flex gap-1">{k.split(' then ').map((p, i) => <Kbd key={i}>{p}</Kbd>)}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
