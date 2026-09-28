import { Download, Pause, Play, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { TrainingEvent } from '@/types/api';
import { Card, CardHeader, IconButton, Segmented, cn } from '@/components/common/ui';
import { CopyButton } from '@/components/common/misc';
import { download } from '@/lib/export';

export function LogConsole({ logs }: { logs: TrainingEvent[] }) {
  const [paused, setPaused] = useState(false);
  const [level, setLevel] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const shown = logs.filter((l) => (level === 'all' || (l.level ?? 'info') === level) && (!q || (l.message ?? '').toLowerCase().includes(q.toLowerCase())));
  useEffect(() => {
    if (!paused && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [shown.length, paused]);
  const text = shown.map((l) => `[${(l.level ?? 'info').toUpperCase()}] ${l.modelId} ${l.message ?? ''}`).join('\n');
  return (
    <Card data-tour="train-log">
      <CardHeader title="Log console" subtitle={`${logs.length} lines`} actions={
        <>
          <div className="mr-1 flex items-center gap-1 rounded-md border border-line px-2"><Search size={12} className="text-muted" /><input aria-label="Search logs" value={q} onChange={(e) => setQ(e.target.value)} className="h-7 w-28 bg-transparent text-xs outline-none" placeholder="search" /></div>
          <Segmented size="sm" value={level} onChange={setLevel} options={[{ value: 'all', label: 'All' }, { value: 'info', label: 'Info' }, { value: 'warn', label: 'Warn' }, { value: 'error', label: 'Err' }]} />
          <IconButton label={paused ? 'Resume auto-scroll' : 'Pause auto-scroll'} onClick={() => setPaused((p) => !p)}>{paused ? <Play size={14} /> : <Pause size={14} />}</IconButton>
          <CopyButton text={text} label="" />
          <IconButton label="Download log" onClick={() => download('training.log', text)}><Download size={14} /></IconButton>
        </>
      } />
      <div ref={box} className="h-64 overflow-y-auto bg-[#0b1220] p-3 font-mono text-[11px] leading-relaxed" role="log" aria-live="polite">
        {shown.map((l, i) => (
          <div key={i} className={cn('whitespace-pre-wrap', l.level === 'warn' ? 'text-[#FFB366]' : l.level === 'error' ? 'text-[#ff7b6b]' : l.type === 'done' ? 'text-[#6FD49A]' : 'text-[#c3cfdf]')}>
            <span className="text-[#5d6b80]">{String(i).padStart(4, '0')} </span>
            <span className="text-[#5AA9E6]">{l.modelId.padEnd(14).slice(0, 14)}</span> {l.message}
          </div>
        ))}
        {!shown.length && <div className="text-[#5d6b80]">No log lines yet…</div>}
      </div>
    </Card>
  );
}
