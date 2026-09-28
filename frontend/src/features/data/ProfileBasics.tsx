/** Profile tabs, part 1: virtualised preview, schema with sparklines, missing-data matrix. */
import { Hash, ToggleLeft, Type } from 'lucide-react';
import { useState } from 'react';
import type { DatasetProfile } from '@/types/api';
import { pct1 } from '@/lib/format';
import { Tip, cn } from '@/components/common/ui';

const ROW_H = 30;

export function PreviewTable({ p }: { p: DatasetProfile }) {
  const [top, setTop] = useState(0);
  const height = 360;
  const start = Math.max(0, Math.floor(top / ROW_H) - 5);
  const end = Math.min(p.previewRows.length, start + Math.ceil(height / ROW_H) + 10);
  const typeOf = (name: string) => p.columns.find((c) => c.name === name)?.type ?? 'categorical';
  const Icon = (t: string) => (t === 'binary' ? ToggleLeft : t === 'numeric' ? Hash : Type);
  return (
    <div>
      <div className="mb-2 text-xs text-muted">{p.rows.toLocaleString()} rows · {p.previewColumns.length} columns shown · virtualised (only visible rows are rendered)</div>
      <div className="overflow-auto rounded-lg border border-line" style={{ height }} onScroll={(e) => setTop(e.currentTarget.scrollTop)}>
        <table className="text-xs" style={{ minWidth: p.previewColumns.length * 110 }}>
          <thead className="sticky top-0 z-10 bg-surface-2">
            <tr>
              <th className="sticky left-0 z-20 bg-surface-2 px-2 py-2 text-left font-mono text-[10px] text-muted">#</th>
              {p.previewColumns.map((c, j) => {
                const I = Icon(j === 0 ? 'categorical' : typeOf(c));
                return <th key={c} className="whitespace-nowrap px-2 py-2 text-left font-semibold text-fg-2"><span className="flex items-center gap-1"><I size={11} className={j === 0 ? 'text-saffron' : 'text-muted'} />{c}{j === 0 && <span className="text-[9px] font-normal text-saffron">target</span>}</span></th>;
              })}
            </tr>
          </thead>
          <tbody>
            <tr style={{ height: start * ROW_H }} />
            {p.previewRows.slice(start, end).map((r, k) => (
              <tr key={start + k} className="border-t border-line hover:bg-surface-2" style={{ height: ROW_H }}>
                <td className="sticky left-0 bg-surface px-2 font-mono text-[10px] text-muted">{start + k}</td>
                {r.map((v, j) => (
                  <td key={j} className={cn('tnum whitespace-nowrap px-2', v === null && 'bg-tint-red text-danger')}>{v === null ? 'NaN' : typeof v === 'number' ? (Math.abs(v) < 0.01 && v !== 0 ? v.toExponential(2) : Number(v.toFixed(4))) : v}</td>
                ))}
              </tr>
            ))}
            <tr style={{ height: (p.previewRows.length - end) * ROW_H }} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Sparkline({ values, color = 'var(--blue)', w = 90, h = 22 }: { values: number[]; color?: string; w?: number; h?: number }) {
  const max = Math.max(...values, 1);
  const bw = w / values.length;
  return (
    <svg width={w} height={h} aria-hidden>
      {values.map((v, i) => <rect key={i} x={i * bw} y={h - (v / max) * h} width={bw - 1} height={(v / max) * h} fill={color} opacity={0.75} rx={1} />)}
    </svg>
  );
}

export function SchemaTable({ p }: { p: DatasetProfile }) {
  return (
    <div className="max-h-[420px] overflow-auto rounded-lg border border-line">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-surface-2 text-left text-muted">
          <tr>{['Column', 'Type', 'Missing', 'Unique', 'Min', 'Max', 'Mean', 'Std', 'Distribution'].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {p.columns.map((c) => (
            <tr key={c.name} className="border-t border-line hover:bg-surface-2">
              <td className="px-3 py-1.5 font-medium text-fg">{c.name}{c.unit && <span className="ml-1 text-[10px] text-muted">({c.unit})</span>}</td>
              <td className="px-3 py-1.5"><span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-fg-2">{c.type}</span></td>
              <td className={cn('tnum px-3 py-1.5', c.missingPct > 0.05 ? 'font-semibold text-danger' : c.missingPct > 0 ? 'text-saffron' : 'text-muted')}>{pct1(c.missingPct)}</td>
              <td className="tnum px-3 py-1.5 text-fg-2">{c.unique}</td>
              {[c.min, c.max, c.mean, c.std].map((v, i) => <td key={i} className="tnum px-3 py-1.5 text-fg-2">{Math.abs(v) < 0.01 && v !== 0 ? v.toExponential(2) : Number(v.toFixed(3))}</td>)}
              <td className="px-3 py-1.5"><Sparkline values={c.histogram} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MissingView({ p }: { p: DatasetProfile }) {
  const cols = p.columns.slice(0, p.missingMatrix[0]?.length ?? 0);
  const withMissing = [...p.columns].filter((c) => c.missingPct > 0).sort((a, b) => b.missingPct - a.missingPct);
  const total = p.columns.reduce((s, c) => s + c.missingPct * p.rows, 0);
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]" data-tour="data-missing">
      <div>
        <div className="mb-2 text-xs font-semibold text-fg-2">Missingness matrix <span className="font-normal text-muted">({p.missingMatrix.length} sampled rows × {cols.length} columns; red = missing)</span></div>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface-2 p-2">
          <svg width={cols.length * 14} height={p.missingMatrix.length * 4 + 70} role="img" aria-label={`Missingness matrix, ${Math.round(total)} missing cells in total`}>
            {cols.map((c, j) => <text key={c.name} x={j * 14 + 7} y={62} fontSize={8} fill="var(--muted)" transform={`rotate(-60 ${j * 14 + 7} 62)`}>{c.name.slice(0, 14)}</text>)}
            {p.missingMatrix.map((row, i) => row.map((v, j) => <rect key={`${i}-${j}`} x={j * 14 + 1} y={68 + i * 4} width={12} height={3.4} fill={v ? 'var(--red)' : 'var(--line)'} opacity={v ? 1 : 0.6} />))}
          </svg>
        </div>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-surface-2 p-3"><div className="text-[10px] text-muted">Missing cells</div><div className="tnum text-xl font-bold text-fg">{Math.round(total).toLocaleString()}</div></div>
          <div className="rounded-lg bg-surface-2 p-3"><div className="text-[10px] text-muted">Pattern</div><div className="text-sm font-semibold text-fg">{p.missingPattern}</div></div>
        </div>
        <p className="text-xs text-muted">{p.missingPattern === 'none' ? 'No missing values.' : 'Missing values are scattered without a strong row/column structure — consistent with missing-completely-at-random (MCAR). Median or KNN imputation is appropriate; add indicator columns if missingness may be informative.'}</p>
        <div className="space-y-1.5">
          {withMissing.length === 0 && <div className="text-xs text-ok">Every column is complete.</div>}
          {withMissing.slice(0, 12).map((c) => (
            <Tip key={c.name} text={`${Math.round(c.missingPct * p.rows)} of ${p.rows} rows missing`}>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-32 truncate text-fg-2">{c.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-danger" style={{ width: `${Math.max(2, c.missingPct * 100 * 2.5)}%` }} /></div>
                <span className="tnum w-12 text-right text-muted">{pct1(c.missingPct)}</span>
              </div>
            </Tip>
          ))}
        </div>
      </div>
    </div>
  );
}
