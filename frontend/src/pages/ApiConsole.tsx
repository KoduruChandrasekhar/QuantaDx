import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, KeyRound, Loader2, Play, Send, Terminal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/api/endpoints';
import { API_URL, getApiKeyMasked, request, USE_MOCK } from '@/api/client';
import { useOpenApi } from '@/api/hooks';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Segmented, cn } from '@/components/common/ui';
import { CopyButton, RiskBadge, Skeleton } from '@/components/common/misc';
import { RiskGauge } from '@/components/common/RiskGauge';
import { usePipeline } from '@/store';
import type { Prediction } from '@/types/api';

const METHOD_COLOR: Record<string, string> = { get: 'var(--blue)', post: 'var(--green)', delete: 'var(--red)' };

type Lang = 'curl' | 'python' | 'js';
const TASKS: { title: string; method: string; path: string; body?: string }[] = [
  { title: 'Upload a dataset', method: 'POST', path: '/datasets/upload', body: 'multipart: file=@wdbc.csv, mode=tabular' },
  { title: 'Start an experiment', method: 'POST', path: '/experiments', body: '{"name":"PoC","datasetId":"wdbc","models":[{"kind":"qsvm"},{"kind":"logreg"}]}' },
  { title: 'Stream training progress', method: 'WS', path: '/experiments/{id}/stream' },
  { title: 'Predict a single patient', method: 'POST', path: '/predict', body: '{"datasetId":"wdbc","features":{"radius_mean":17.99,"concave_points_worst":0.2654},"threshold":0.35}' },
  { title: 'Batch predict', method: 'POST', path: '/predict/batch', body: '{"datasetId":"wdbc","rows":[{"patientId":"P-1","features":{...}}],"threshold":0.35}' },
];

function snippet(t: (typeof TASKS)[number], lang: Lang): string {
  const url = `${API_URL}${t.path}`;
  if (t.method === 'WS') {
    if (lang === 'curl') return `websocat ${url.replace('http', 'ws')} -H "X-API-Key: $QDX_KEY"`;
    if (lang === 'python') return `import websockets, asyncio, json\nasync def main():\n    async with websockets.connect("${url.replace('http', 'ws')}") as ws:\n        async for msg in ws:\n            print(json.loads(msg))\nasyncio.run(main())`;
    return `const ws = new WebSocket("${url.replace('http', 'ws')}");\nws.onmessage = (m) => console.log(JSON.parse(m.data));`;
  }
  if (t.path.endsWith('upload')) {
    if (lang === 'curl') return `curl -X POST ${url} \\\n  -H "X-API-Key: $QDX_KEY" \\\n  -F file=@wdbc.csv -F mode=tabular`;
    if (lang === 'python') return `import requests\nr = requests.post("${url}", headers={"X-API-Key": KEY},\n                  files={"file": open("wdbc.csv", "rb")}, data={"mode": "tabular"})\nprint(r.json())`;
    return `const fd = new FormData();\nfd.append("file", fileInput.files[0]);\nfd.append("mode", "tabular");\nconst r = await fetch("${url}", { method: "POST", headers: { "X-API-Key": KEY }, body: fd });`;
  }
  if (lang === 'curl') return `curl -X ${t.method} ${url} \\\n  -H "Content-Type: application/json" -H "X-API-Key: $QDX_KEY" \\\n  -d '${t.body ?? '{}'}'`;
  if (lang === 'python') return `import requests\nr = requests.${t.method.toLowerCase()}("${url}", headers={"X-API-Key": KEY},\n                  json=${(t.body ?? '{}').replace(/true/g, 'True')})\nprint(r.json())`;
  return `const r = await fetch("${url}", {\n  method: "${t.method}",\n  headers: { "Content-Type": "application/json", "X-API-Key": KEY },\n  body: JSON.stringify(${t.body ?? '{}'}),\n});\nconsole.log(await r.json());`;
}

interface OpenApiDoc { paths: Record<string, Record<string, { summary: string; tags: string[]; 'x-deliverable': string; parameters: { name: string; in: string }[]; requestBody?: { content: { 'application/json': { example: unknown } } } }>> }

function Explorer() {
  const { data } = useOpenApi();
  const [open, setOpen] = useState<string | null>(null);
  const [resp, setResp] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const doc = data as unknown as OpenApiDoc | undefined;
  const byTag = useMemo(() => {
    const m = new Map<string, { path: string; method: string; op: OpenApiDoc['paths'][string][string] }[]>();
    if (!doc) return m;
    Object.entries(doc.paths).forEach(([path, ops]) => Object.entries(ops).forEach(([method, op]) => m.set(op.tags[0], [...(m.get(op.tags[0]) ?? []), { path, method, op }])));
    return m;
  }, [doc]);
  const tryIt = async (method: string, path: string, body: unknown) => {
    const key = `${method}${path}`;
    setBusy(key);
    const concrete = path.replace('{id}', path.startsWith('/datasets') ? 'wdbc' : 'exp-poc-001');
    try {
      const r = await request<unknown>(method.toUpperCase() as 'GET', `${concrete}${path.endsWith('/circuit') || path.endsWith('/explain') || path.endsWith('/kernel') || path.endsWith('/landscape') ? '?model_id=qsvm_bw' : ''}`, method === 'get' ? undefined : body);
      setResp((s) => ({ ...s, [key]: JSON.stringify(r, null, 2).slice(0, 4000) }));
    } catch (e) {
      setResp((s) => ({ ...s, [key]: `Error: ${(e as Error).message}` }));
    } finally {
      setBusy(null);
    }
  };
  if (!doc) return <Skeleton className="h-96" />;
  return (
    <Card data-tour="api-explorer">
      <CardHeader title="OpenAPI explorer" subtitle={`GET /openapi.json · ${Object.keys(doc.paths).length} paths · QuantaDx API v1.0.0`} icon={<Terminal size={16} />} />
      <div className="divide-y divide-line">
        {[...byTag.entries()].map(([tag, ops]) => (
          <div key={tag} className="p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{tag}</div>
            <div className="space-y-1.5">
              {ops.map(({ path, method, op }) => {
                const key = `${method}${path}`;
                const isOpen = open === key;
                const example = op.requestBody?.content['application/json'].example;
                const noTry = path.includes('upload') || path.endsWith('/stream') || method === 'delete' || path.endsWith('/cancel') || (method === 'post' && path === '/experiments');
                return (
                  <div key={key} className="overflow-hidden rounded-lg border border-line">
                    <button className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2" onClick={() => setOpen(isOpen ? null : key)} aria-expanded={isOpen}>
                      <span className="w-14 rounded px-1.5 py-0.5 text-center font-mono text-[10px] font-bold uppercase text-white" style={{ background: METHOD_COLOR[method] }}>{method}</span>
                      <span className="font-mono text-xs text-fg">{path}</span>
                      <span className="hidden truncate text-xs text-muted md:inline">{op.summary}</span>
                      <Badge color="var(--purple)" className="ml-auto">{op.tags[0]}</Badge>
                      <ChevronDown size={14} className={cn('text-muted transition', isOpen && 'rotate-180')} />
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                          <div className="space-y-2 border-t border-line bg-surface-2 p-3 text-xs">
                            <p className="text-fg-2">{op.summary}</p>
                            {op.parameters.length > 0 && <div className="font-mono text-[11px] text-muted">params: {op.parameters.map((p) => `${p.name} (${p.in})`).join(', ')}</div>}
                            {example !== undefined && <pre className="overflow-x-auto rounded bg-[#0b1220] p-2 font-mono text-[10px] text-[#c3cfdf]">{JSON.stringify(example, null, 2)}</pre>}
                            {!noTry && <Button size="sm" variant="outline" icon={busy === key ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} onClick={() => tryIt(method, path, example)}>Try it</Button>}
                            {resp[key] && <pre className="max-h-64 overflow-auto rounded bg-[#0b1220] p-2 font-mono text-[10px] text-[#6FD49A]">{resp[key]}</pre>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TryPredict() {
  const [params, setParams] = useSearchParams();
  const datasetId = usePipeline((s) => s.activeDatasetId);
  const bands = usePipeline((s) => s.riskBands);
  const [body, setBody] = useState('');
  const [resp, setResp] = useState<Prediction | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ms, setMs] = useState(0);
  const auto = useRef(false);
  useEffect(() => {
    api.examples(datasetId).then((ex) => setBody(JSON.stringify({ datasetId, features: ex.atRisk, threshold: 0.35, bands }, null, 2)));
  }, [datasetId]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = async () => {
    setBusy(true);
    setErr('');
    const t0 = performance.now();
    try {
      const r = await request<Prediction>('POST', '/predict', JSON.parse(body));
      setResp(r);
      setMs(performance.now() - t0);
    } catch (e) {
      setErr((e as Error).message);
      setResp(null);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (params.get('demo') === '1' && body && !auto.current) {
      auto.current = true;
      send();
      const n = new URLSearchParams(params);
      n.delete('demo');
      setParams(n, { replace: true });
    }
  });
  return (
    <Card data-tour="api-try">
      <CardHeader title="Try it · POST /predict" subtitle="Edit the JSON and send — exactly what a hospital system would do" icon={<Send size={16} />} actions={<Button size="sm" icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} onClick={send} disabled={busy || !body}>Send</Button>} />
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div className="relative">
          <textarea aria-label="Request JSON" value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} className="h-80 w-full resize-none rounded-lg bg-[#0b1220] p-3 font-mono text-[11px] leading-relaxed text-[#c3cfdf] outline-none focus:ring-2 focus:ring-classical" />
          <span className="absolute right-2 top-2 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/60">application/json</span>
        </div>
        <div>
          {err && <div className="rounded-lg bg-tint-red p-3 font-mono text-xs text-danger">{err}</div>}
          {resp ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className="flex items-center gap-2 text-xs"><Badge solid color="var(--green)">200 OK</Badge><span className="tnum text-muted">{ms.toFixed(0)} ms{USE_MOCK ? ' (mock)' : ''}</span></div>
              <div className="flex flex-wrap items-center gap-4">
                {resp.probability !== undefined && <RiskGauge value={resp.probability} bands={bands} threshold={resp.threshold} size={200} />}
                <div className="space-y-2">{resp.riskBand && <RiskBadge band={resp.riskBand} />}<div className="text-xs text-muted">{resp.modelLabel}</div></div>
              </div>
              <ul className="space-y-1 text-xs text-fg-2">{resp.topFactors.slice(0, 3).map((f) => <li key={f.feature}>• {f.text}</li>)}</ul>
              <pre className="max-h-40 overflow-auto rounded-lg bg-[#0b1220] p-2 font-mono text-[10px] text-[#6FD49A]">{JSON.stringify({ ...resp, encodedX: undefined }, null, 2)}</pre>
            </motion.div>
          ) : !err && <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed border-line text-sm text-muted">Response appears here</div>}
        </div>
      </div>
    </Card>
  );
}

export default function ApiConsole() {
  const [lang, setLang] = useState<Lang>('curl');
  return (
    <div>
      <PageHeader title="API console" trace="api" description="Hospitals integrate through the REST + WebSocket API. Everything in this UI is available programmatically." />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <TryPredict />
          <Card>
            <CardHeader title="Quick start" subtitle="Copy-paste snippets" actions={<Segmented size="sm" value={lang} onChange={setLang} options={[{ value: 'curl', label: 'curl' }, { value: 'python', label: 'Python' }, { value: 'js', label: 'JavaScript' }]} />} />
            <div className="grid gap-3 p-4 md:grid-cols-2">
              {TASKS.map((t) => (
                <div key={t.title} className="overflow-hidden rounded-lg border border-line">
                  <div className="flex items-center gap-2 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-fg"><span className="font-mono text-[10px] text-muted">{t.method}</span>{t.title}<CopyButton className="ml-auto" text={snippet(t, lang)} label="" /></div>
                  <pre className="max-h-40 overflow-auto bg-[#0b1220] p-3 font-mono text-[10px] leading-relaxed text-[#c3cfdf]">{snippet(t, lang)}</pre>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="space-y-5">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-fg"><KeyRound size={16} className="text-saffron" /> API key</div>
            <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm tracking-wider text-fg">{getApiKeyMasked()}</div>
            <p className="mt-2 text-xs text-muted">Send as <span className="font-mono">X-API-Key</span>. Keys are issued and rate-limited by the backend (default 60 requests/min per key); the UI keeps them in memory only.</p>
          </Card>
          <Explorer />
          <Card>
            <CardHeader title="EHR integration · FHIR-style mapping" subtitle={<span><Badge color="var(--saffron)">Roadmap</Badge> — not implemented in this prototype</span>} />
            <table className="w-full text-xs">
              <thead className="bg-surface-2 text-left text-muted"><tr><th className="px-3 py-2">FHIR resource</th><th className="px-3 py-2">Field</th><th className="px-3 py-2">QuantaDx feature</th></tr></thead>
              <tbody>
                {[['Observation', 'code: glucose (LOINC 2345-7)', 'Glucose'], ['Observation', 'code: BMI (39156-5)', 'BMI'], ['Observation', 'code: systolic BP (8480-6)', 'trestbps / BloodPressure'], ['Patient', 'birthDate → age', 'age / Age'], ['DiagnosticReport', 'cytology measurements', 'radius_mean … fractal_dimension_worst'], ['RiskAssessment', 'prediction.probability', '← QuantaDx output']].map((r) => (
                  <tr key={r.join()} className="border-t border-line">{r.map((c, i) => <td key={i} className={cn('px-3 py-1.5', i === 0 ? 'font-mono text-quantum' : 'text-fg-2')}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}
