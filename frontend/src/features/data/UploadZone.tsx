/** Dataset upload (D5 "Dataset upload"): local preview + validation + PHI check; nothing is sent until the user confirms. */
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, FileArchive, FileSpreadsheet, Dna, ShieldAlert, UploadCloud, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { ApiError } from '@/api/client';
import { Button, Card, Progress, Segmented, cn } from '@/components/common/ui';
import { PHI_PATTERN } from '@/lib/phi';
import { usePipeline } from '@/store';
import type { Dataset } from '@/types/api';

type Mode = 'tabular' | 'genomics' | 'imaging';
interface Check { ok: boolean; warn?: boolean; text: string }

export function UploadZone() {
  const [mode, setMode] = useState<Mode>('tabular');
  const [file, setFile] = useState<File | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [phi, setPhi] = useState<string[]>([]);
  const [dropPhi, setDropPhi] = useState(true);
  const [head, setHead] = useState<string[][]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [extracting, setExtracting] = useState<number | null>(null);
  const [imageDs, setImageDs] = useState<Dataset | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const setDataset = usePipeline((s) => s.setDataset);

  const inspect = async (f: File) => {
    setFile(f);
    setImageDs(null);
    const c: Check[] = [];
    if (f.size === 0) c.push({ ok: false, text: 'The file is empty.' });
    if (f.size > 50 * 1024 * 1024) c.push({ ok: false, text: 'File exceeds the 50 MB limit.' });
    if (mode === 'imaging') {
      c.push({ ok: /\.zip$/i.test(f.name), text: /\.zip$/i.test(f.name) ? 'ZIP archive detected — expecting images + labels.csv' : 'Imaging mode expects a .zip of images with labels.csv' });
      setChecks(c);
      setPhi([]);
      setHead([]);
      return;
    }
    if (/\.xlsx?$/i.test(f.name)) {
      c.push({ ok: true, warn: true, text: 'XLSX will be parsed server-side (preview unavailable offline).' });
      setChecks(c);
      return;
    }
    const text = await f.slice(0, 200_000).text();
    const Papa = (await import('papaparse')).default;
    const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
    const rows = parsed.data.slice(0, 200);
    const cols = rows[0] ?? [];
    const body = rows.slice(1);
    const numeric = cols.filter((_, j) => body.length > 0 && body.every((r) => r[j] === '' || r[j] === undefined || !Number.isNaN(Number(r[j]))));
    c.push({ ok: cols.length > 1, text: `${cols.length} columns · ~${Math.max(0, parsed.data.length - 1)} rows in the first 200 KB` });
    c.push({ ok: numeric.length > 0, text: numeric.length ? `${numeric.length} numeric columns` : 'No numeric columns found' });
    const keys = body.map((r) => r.join('|'));
    const dupRate = body.length ? 1 - new Set(keys).size / body.length : 0;
    c.push({ ok: dupRate <= 0.3, warn: dupRate > 0.05, text: dupRate > 0.3 ? `${(dupRate * 100).toFixed(0)}% duplicate rows (> 30%)` : `${(dupRate * 100).toFixed(1)}% duplicate rows` });
    const target = cols.find((x) => /^(target|label|class|diagnosis|outcome|status|y|num|total_updrs)$/i.test(x));
    c.push({ ok: true, warn: !target, text: target ? `Target column detected: “${target}”` : 'Target missing by name — the last column will be used (change it below)' });
    if (target) {
      const j = cols.indexOf(target);
      const uniq = new Set(body.map((r) => r[j]));
      c.push({ ok: uniq.size > 1, text: uniq.size > 1 ? `${uniq.size} distinct target values` : 'Target has a single class — cannot train a classifier' });
    }
    if (mode === 'genomics') c.push({ ok: true, warn: cols.length < 500, text: cols.length >= 500 ? `Wide matrix: ${cols.length} columns (column-virtualised preview)` : 'Genomics mode expects thousands of gene columns' });
    setPhi(cols.filter((x) => PHI_PATTERN.test(x)));
    setHead(rows.slice(0, 6).map((r) => r.slice(0, 10)));
    setChecks(c);
  };

  const confirm = async () => {
    if (!file) return;
    setProgress(0);
    try {
      let f = file;
      if (phi.length && dropPhi && mode !== 'imaging' && !/\.xlsx?$/i.test(file.name)) {
        const Papa = (await import('papaparse')).default;
        const parsed = Papa.parse<Record<string, string>>(await file.text(), { header: true, skipEmptyLines: true });
        const keep = (parsed.meta.fields ?? []).filter((x) => !phi.includes(x));
        f = new File([Papa.unparse(parsed.data.map((r) => Object.fromEntries(keep.map((k) => [k, r[k]]))))], file.name, { type: 'text/csv' });
      }
      const ds = await api.upload(f, mode, (p) => setProgress(p));
      setProgress(100);
      await qc.invalidateQueries({ queryKey: ['datasets'] });
      toast.success(`Uploaded ${ds.name}`, { description: `${ds.rows} rows · ${ds.features} features${phi.length && dropPhi ? ` · ${phi.length} PHI column(s) dropped` : ''}` });
      if (mode === 'imaging') setImageDs(ds);
      else {
        setDataset(ds.id, ds.taskType, ds.target, ds.positiveClass);
        setFile(null);
        setChecks([]);
      }
    } catch (e) {
      toast.error('Upload failed', { description: e instanceof ApiError ? e.message : String(e) });
    } finally {
      setTimeout(() => setProgress(null), 600);
    }
  };

  const extract = async () => {
    if (!imageDs) return;
    setExtracting(0);
    const timer = setInterval(() => setExtracting((p) => Math.min(95, (p ?? 0) + 7)), 180);
    try {
      const r = await api.extractFeatures(imageDs.id);
      await new Promise((res) => setTimeout(res, 1800));
      setExtracting(100);
      await qc.invalidateQueries({ queryKey: ['datasets'] });
      qc.removeQueries({ queryKey: ['profile', imageDs.id] });
      toast.success('Feature extraction complete', { description: `${r.features} features · ${r.method}` });
      setDataset(imageDs.id, 'classification', 'label', 'malignant');
      setImageDs(null);
      setFile(null);
    } finally {
      clearInterval(timer);
      setTimeout(() => setExtracting(null), 500);
    }
  };

  const blocking = checks.some((c) => !c.ok);
  const Icon = mode === 'imaging' ? FileArchive : mode === 'genomics' ? Dna : FileSpreadsheet;
  return (
    <Card className="p-4" data-tour="data-upload">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">Upload a dataset</h3>
        <Segmented size="sm" value={mode} onChange={(m) => { setMode(m); setFile(null); setChecks([]); }} options={[
          { value: 'tabular', label: 'Tabular EHR', icon: <FileSpreadsheet size={13} /> },
          { value: 'genomics', label: 'Genomics', icon: <Dna size={13} /> },
          { value: 'imaging', label: 'Imaging ZIP', icon: <FileArchive size={13} /> },
        ]} />
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) inspect(f); }}
        onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
        className={cn('flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition', drag ? 'border-classical bg-tint-blue' : 'border-line-strong hover:border-classical/60 hover:bg-surface-2')}>
        <motion.div animate={drag ? { y: -4, scale: 1.1 } : { y: 0, scale: 1 }}><UploadCloud size={30} className="text-classical" /></motion.div>
        <div className="text-sm font-medium text-fg">Drop a {mode === 'imaging' ? 'ZIP of images + labels.csv' : mode === 'genomics' ? 'wide gene-expression CSV' : 'CSV or XLSX'} here, or click to browse</div>
        <div className="text-xs text-muted">≤ 50 MB · parsed in your browser first — nothing leaves the device until you confirm</div>
        <input ref={input} type="file" hidden accept={mode === 'imaging' ? '.zip' : '.csv,.xlsx,.xls'} onChange={(e) => e.target.files?.[0] && inspect(e.target.files[0])} />
      </div>
      <AnimatePresence>
        {file && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-3 space-y-3 rounded-xl border border-line bg-surface-2 p-3">
              <div className="flex items-center gap-2 text-sm">
                <Icon size={16} className="text-classical" />
                <span className="font-medium text-fg">{file.name}</span>
                <span className="text-xs text-muted">{(file.size / 1024).toFixed(1)} KB</span>
                <button className="ml-auto text-muted hover:text-fg" onClick={() => { setFile(null); setChecks([]); }} aria-label="Remove file"><X size={15} /></button>
              </div>
              <ul className="space-y-1">
                {checks.map((c, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-2 text-xs">
                    {!c.ok ? <X size={13} className="text-danger" /> : c.warn ? <AlertTriangle size={13} className="text-saffron" /> : <CheckCircle2 size={13} className="text-ok" />}
                    <span className={c.ok ? 'text-fg-2' : 'text-danger'}>{c.text}</span>
                  </motion.li>
                ))}
              </ul>
              {phi.length > 0 && (
                <div className="rounded-lg border border-danger/40 bg-tint-red p-2.5 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-danger"><ShieldAlert size={14} /> Possible PHI columns: {phi.join(', ')}</div>
                  <label className="mt-1.5 flex items-center gap-2 text-fg-2"><input type="checkbox" checked={dropPhi} onChange={(e) => setDropPhi(e.target.checked)} /> Drop these columns before upload (recommended · DPDP Act 2023)</label>
                  <p className="mt-1 text-muted">De-identify records before sharing; QuantaDx never needs names, phone numbers, emails or Aadhaar IDs.</p>
                </div>
              )}
              {head.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-lg border border-line bg-surface">
                  <table className="w-full font-mono text-[10px]"><tbody>
                    {head.map((r, i) => <tr key={i} className={i === 0 ? 'bg-surface-3 font-semibold' : 'border-t border-line'}>{r.map((v, j) => <td key={j} className={cn('whitespace-nowrap px-2 py-1', i === 0 && phi.includes(v) && 'text-danger line-through')}>{v}</td>)}</tr>)}
                  </tbody></table>
                </div>
              )}
              {progress !== null && <Progress value={progress / 100} striped />}
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setFile(null); setChecks([]); }}>Cancel</Button>
                <Button size="sm" disabled={blocking || progress !== null} onClick={confirm} icon={<UploadCloud size={14} />}>Confirm upload</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {imageDs && (
        <div className="mt-3 rounded-xl border border-quantum/30 bg-tint-purple p-3">
          <div className="text-sm font-medium text-fg">{imageDs.rows} images registered. Next: extract CNN / radiomics features.</div>
          {extracting !== null && <Progress className="mt-2" value={extracting / 100} color="var(--purple)" striped />}
          <Button size="sm" variant="quantum" className="mt-2" onClick={extract} disabled={extracting !== null}>{extracting !== null ? `Extracting… ${Math.round(extracting)}%` : 'Extract features'}</Button>
        </div>
      )}
    </Card>
  );
}
