import { Command } from 'cmdk';
import { BookMarked, Boxes, CheckSquare, Database, FlaskConical, Moon, Play, Search, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useDatasets, useExperiments } from '@/api/hooks';
import { GLOSSARY } from '@/content/glossary';
import { EXTRA_NAV, NAV } from '@/content/nav';
import { useDemo, usePipeline, useUi } from '@/store';

const itemCls = 'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-fg-2 aria-selected:bg-tint-blue aria-selected:text-fg';
const groupCls = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted';

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPalette);
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const navigate = useNavigate();
  const { data: exps } = useExperiments();
  const { data: datasets } = useDatasets();
  const setDataset = usePipeline((s) => s.setDataset);
  const expId = usePipeline((s) => s.activeExperimentId);
  const setActiveExperiment = usePipeline((s) => s.setActiveExperiment);
  const startDemo = useDemo((s) => s.start);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };
  const resolve = (key: string, to: string) => (['train', 'results', 'explain'].includes(key) ? `/experiments/${expId}/${key}` : to);

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label="Command palette"
      overlayClassName="fixed inset-0 z-[130] bg-[#0a0f18]/50 backdrop-blur-sm"
      contentClassName="fixed left-1/2 top-[12vh] z-[131] w-[min(640px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
      <div className="flex items-center gap-2 border-b border-line px-4">
        <Search size={16} className="text-muted" />
        <Command.Input placeholder="Search pages, experiments, datasets, glossary, actions…" className="h-12 w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted" />
      </div>
      <Command.List className="max-h-[60vh] overflow-y-auto p-2">
        <Command.Empty className="py-8 text-center text-sm text-muted">No results.</Command.Empty>
        <Command.Group heading="Actions" className={groupCls}>
          <Command.Item className={itemCls} onSelect={() => go('/models')}><FlaskConical size={15} className="text-quantum" /> New experiment</Command.Item>
          <Command.Item className={itemCls} onSelect={() => { setOpen(false); navigate('/'); startDemo(); }}><Play size={15} className="text-saffron" /> Start guided demo</Command.Item>
          <Command.Item className={itemCls} onSelect={() => go('/api')}><Terminal size={15} className="text-classical" /> Open API console</Command.Item>
          <Command.Item className={itemCls} onSelect={() => go('/deliverables')}><CheckSquare size={15} className="text-ok" /> Show capabilities</Command.Item>
          <Command.Item className={itemCls} onSelect={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setOpen(false); }}><Moon size={15} /> Toggle theme</Command.Item>
        </Command.Group>
        <Command.Group heading="Pages" className={groupCls}>
          {[...NAV.flatMap((g) => g.items), ...EXTRA_NAV].map((i) => (
            <Command.Item key={i.key} value={`page ${i.label}`} className={itemCls} onSelect={() => go(resolve(i.key, i.to))}>
              <i.icon size={15} className="text-muted" /> {i.label}
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Experiments" className={groupCls}>
          {exps?.map((e) => (
            <Command.Item key={e.id} value={`experiment ${e.id} ${e.name}`} className={itemCls} onSelect={() => { setActiveExperiment(e.id); go(`/experiments/${e.id}/${e.status === 'done' ? 'results' : 'train'}`); }}>
              <Boxes size={15} className="text-muted" /> <span className="truncate">{e.name}</span>
              <span className="ml-auto font-mono text-[10px] text-muted">{e.id}</span>
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Datasets" className={groupCls}>
          {datasets?.map((d) => (
            <Command.Item key={d.id} value={`dataset ${d.name}`} className={itemCls} onSelect={() => { setDataset(d.id, d.taskType, d.target, d.positiveClass); go('/data'); }}>
              <Database size={15} className="text-classical" /> {d.name}
              <span className="ml-auto text-[10px] text-muted">{d.rows} × {d.features}</span>
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Glossary" className={groupCls}>
          {GLOSSARY.map((g) => (
            <Command.Item key={g.term} value={`glossary ${g.term} ${g.short}`} className={itemCls} onSelect={() => { setOpen(false); toast(g.term, { description: g.short, duration: 7000 }); }}>
              <BookMarked size={15} className="text-quantum" /> <span className="font-medium">{g.term}</span>
              <span className="truncate text-xs text-muted">{g.short}</span>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
