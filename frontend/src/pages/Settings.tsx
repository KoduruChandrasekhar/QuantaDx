import { CheckCircle2, KeyRound, Loader2, Monitor, Plug, Server, SlidersHorizontal, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/api/endpoints';
import { API_URL, USE_MOCK, WS_URL } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, NumberField, Segmented, Select, Slider, Switch } from '@/components/common/ui';
import { bandsFromCuts } from '@/lib/risk';
import { usePipeline, useSecrets, useUi } from '@/store';

export default function Settings() {
  const ui = useUi();
  const pipe = usePipeline();
  const { ibmToken, setIbmToken } = useSecrets();
  const [conn, setConn] = useState<{ ok: boolean; ms: number; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [token, setToken] = useState('');
  const [folds, setFolds] = useState('5');
  const [metric, setMetric] = useState('sens@spec≥0.90');
  const q = pipe.quantumConfig;

  const test = async () => {
    setTesting(true);
    const t0 = performance.now();
    try {
      const h = await api.health();
      setConn({ ok: true, ms: performance.now() - t0, msg: `API ${h.status} · ${Object.entries(h.versions).map(([k, v]) => `${k} ${v}`).join(' · ')}` });
    } catch (e) {
      setConn({ ok: false, ms: performance.now() - t0, msg: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };
  const saveToken = () => {
    if (token.trim().length < 20) return toast.error('That does not look like an IBM Quantum API token (too short)');
    setIbmToken(token.trim());
    setToken('');
    toast.success('Token held in memory for this session', { description: USE_MOCK ? 'Mock mode: hardware runs are simulated.' : 'Sent to the backend only when submitting hardware jobs.' });
  };

  return (
    <div>
      <PageHeader title="Settings" trace="settings" description="Connection, defaults, quantum hardware credentials and appearance." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Connection" icon={<Plug size={16} />} actions={<Badge color={USE_MOCK ? 'var(--saffron)' : 'var(--green)'}>{USE_MOCK ? 'Mock mode (offline)' : 'Live backend'}</Badge>} />
          <div className="space-y-3 p-4 text-sm">
            <div className="grid grid-cols-[110px_1fr] gap-2 font-mono text-xs"><span className="text-muted">VITE_API_URL</span><span>{API_URL}</span><span className="text-muted">VITE_WS_URL</span><span>{WS_URL}</span><span className="text-muted">VITE_USE_MOCK</span><span>{String(USE_MOCK)}</span></div>
            <p className="text-xs text-muted">Switch to the FastAPI backend by setting <span className="font-mono">VITE_USE_MOCK=false</span> in <span className="font-mono">.env</span> — no code changes.</p>
            <Button size="sm" variant="outline" icon={testing ? <Loader2 size={13} className="animate-spin" /> : <Server size={13} />} onClick={test}>Test connection</Button>
            {conn && <div className={`flex items-start gap-2 rounded-lg p-2.5 text-xs ${conn.ok ? 'bg-tint-green' : 'bg-tint-red'}`}>{conn.ok ? <CheckCircle2 size={14} className="text-ok" /> : <XCircle size={14} className="text-danger" />}<span>{conn.msg} · {conn.ms.toFixed(0)} ms</span></div>}
          </div>
        </Card>
        <Card>
          <CardHeader title="IBM Quantum credentials" icon={<KeyRound size={16} />} actions={<Badge color={ibmToken ? 'var(--green)' : 'var(--muted)'}>{ibmToken ? 'token set' : 'no token'}</Badge>} />
          <div className="space-y-3 p-4">
            <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder={ibmToken ? '•••••••••••••••• (set)' : 'Paste IBM Quantum API token'} aria-label="IBM Quantum API token" className="h-9 w-full rounded-lg border border-line bg-surface px-3 font-mono text-sm outline-none focus:border-classical" />
            <div className="flex gap-2"><Button size="sm" onClick={saveToken}>Use token</Button>{ibmToken && <Button size="sm" variant="ghost" onClick={() => { setIbmToken(null); toast('Token cleared'); }}>Clear</Button>}</div>
            <p className="text-xs text-muted">Held in memory only (never localStorage), sent only to the backend for hardware jobs. Enables the “Hardware” execution target in Model Studio.</p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Defaults" icon={<SlidersHorizontal size={16} />} />
          <div className="grid grid-cols-2 gap-3 p-4">
            <Select label="Backend" value={q.execution.backend} onChange={(v) => pipe.setQuantum({ execution: { ...q.execution, backend: v } })} options={[{ value: 'statevector', label: 'Statevector' }, { value: 'shots', label: 'Shots' }, { value: 'noisy', label: 'Noisy simulator' }, ...(ibmToken ? [{ value: 'hardware' as const, label: 'IBM hardware' }] : [])]} />
            <NumberField label="Shots" value={q.execution.shots ?? 1024} min={128} max={8192} step={128} onChange={(v) => pipe.setQuantum({ execution: { ...q.execution, shots: v } })} />
            <NumberField label="Seed" value={q.seed} onChange={(v) => pipe.setQuantum({ seed: v })} />
            <Select label="CV folds" value={folds} onChange={setFolds} options={['3', '5', '10'].map((f) => ({ value: f, label: `${f}-fold` }))} />
            <Select className="col-span-2" label="Primary metric" value={metric} onChange={setMetric} options={[{ value: 'sens@spec≥0.90', label: 'Sensitivity @ specificity ≥ 0.90' }, { value: 'roc_auc', label: 'ROC-AUC' }, { value: 'rmse', label: 'RMSE (regression)' }]} />
            <Slider className="col-span-2" label="Decision threshold" value={pipe.decisionThreshold} min={0.05} max={0.95} step={0.01} onChange={pipe.setThreshold} format={(v) => v.toFixed(2)} accent="var(--saffron)" />
            <Slider label="Low / moderate cut" value={pipe.riskBands.low[1]} min={0.05} max={0.6} step={0.01} onChange={(v) => pipe.setRiskBands(bandsFromCuts(v, pipe.riskBands.moderate[1]))} format={(v) => v.toFixed(2)} accent="var(--green)" />
            <Slider label="Moderate / high cut" value={pipe.riskBands.moderate[1]} min={0.4} max={0.95} step={0.01} onChange={(v) => pipe.setRiskBands(bandsFromCuts(pipe.riskBands.low[1], v))} format={(v) => v.toFixed(2)} accent="var(--red)" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Appearance & accessibility" icon={<Monitor size={16} />} />
          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between"><span className="text-sm text-fg-2">Theme</span><Segmented value={ui.theme} onChange={ui.setTheme} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} /></div>
            <div className="flex items-center justify-between"><span className="text-sm text-fg-2">Density</span><Segmented value={ui.density} onChange={ui.setDensity} options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} /></div>
            <Switch checked={ui.reducedMotion} onChange={ui.setReducedMotion} label="Reduce motion (disables particles, count-ups and gate animations)" />
            <Switch checked={ui.showBadges} onChange={ui.setShowBadges} label="Show module &amp; objective codes on page headers" />
          </div>
        </Card>
      </div>
    </div>
  );
}
