/** Wrapper for every chart (Section 12): title, info tooltip, PNG/SVG export, view-as-table, fullscreen. */
import { Download, Info, Maximize2, Table2 } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { exportPng, exportSvg } from '@/lib/export';
import { Card, IconButton, Modal, Tip, cn } from '../common/ui';

export interface TableData {
  columns: string[];
  rows: (string | number)[][];
}

export function ChartCard({ title, info, children, table, className, actions, summary, tourId, bodyClassName, height }: {
  title: ReactNode;
  info?: ReactNode;
  children: ReactNode;
  table?: TableData;
  className?: string;
  actions?: ReactNode;
  summary?: string;
  tourId?: string;
  bodyClassName?: string;
  height?: number;
}) {
  const [asTable, setAsTable] = useState(false);
  const [full, setFull] = useState(false);
  const [menu, setMenu] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const fileName = typeof title === 'string' ? title.toLowerCase().replace(/[^\w]+/g, '-') : 'chart';
  const svg = () => body.current?.querySelector<SVGSVGElement>('svg.recharts-surface, svg[role="img"], svg');
  const doExport = async (kind: 'png' | 'svg') => {
    const s = svg();
    setMenu(false);
    if (!s) return toast.error('Nothing to export in this view');
    try {
      if (kind === 'svg') exportSvg(s, fileName);
      else await exportPng(s, fileName);
      toast.success(`Exported ${fileName}.${kind}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Card className={cn('flex flex-col', className)} data-tour={tourId}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="truncate text-sm font-semibold text-fg">{title}</h3>
          {info && (
            <Tip text={info}>
              <button aria-label="About this chart" className="text-muted hover:text-fg"><Info size={13} /></button>
            </Tip>
          )}
        </div>
        <div className="flex shrink-0 items-center">
          {actions}
          {table && (
            <IconButton label={asTable ? 'View as chart' : 'View as table'} onClick={() => setAsTable((v) => !v)} className={asTable ? 'bg-tint-blue text-classical' : ''}>
              <Table2 size={14} />
            </IconButton>
          )}
          <div className="relative">
            <IconButton label="Export" onClick={() => setMenu((m) => !m)}><Download size={14} /></IconButton>
            {menu && (
              <div className="card absolute right-0 top-9 z-30 w-32 p-1 shadow-pop" onMouseLeave={() => setMenu(false)}>
                <button className="w-full rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-surface-3" onClick={() => doExport('png')}>Export PNG</button>
                <button className="w-full rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-surface-3" onClick={() => doExport('svg')}>Export SVG</button>
              </div>
            )}
          </div>
          <IconButton label="Fullscreen" onClick={() => setFull(true)}><Maximize2 size={13} /></IconButton>
        </div>
      </div>
      <div ref={body} className={cn('flex-1 p-4', bodyClassName)} role="img" aria-label={summary ?? (typeof title === 'string' ? title : 'Chart')} style={height ? { minHeight: height } : undefined}>
        {asTable && table ? <DataTable table={table} /> : children}
      </div>
      <Modal open={full} onClose={() => setFull(false)} title={title} width={1100}>
        <div className="min-h-[60vh]">{asTable && table ? <DataTable table={table} /> : children}</div>
      </Modal>
    </Card>
  );
}

export function DataTable({ table }: { table: TableData }) {
  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-line">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-surface-2">
          <tr>{table.columns.map((c) => <th key={c} className="px-3 py-2 text-left font-semibold text-muted">{c}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((v, j) => <td key={j} className="tnum px-3 py-1.5 text-fg-2">{typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(3)) : v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function tooltipStyle() {
  return {
    contentStyle: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 12, boxShadow: 'var(--shadow)', color: 'var(--fg)' },
    labelStyle: { color: 'var(--muted)', fontWeight: 600 },
    itemStyle: { padding: 0 },
  };
}

export const AXIS = { stroke: 'var(--line-strong)', tick: { fontSize: 11, fill: 'var(--muted)' }, tickLine: false } as const;
