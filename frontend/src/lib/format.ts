/** Number / percent / time formatting used by every metric in the UI. */

export const fmt3 = (x: number | undefined | null): string =>
  x === undefined || x === null || Number.isNaN(x) ? '—' : x.toFixed(3);

export const fmt2 = (x: number | undefined | null): string =>
  x === undefined || x === null || Number.isNaN(x) ? '—' : x.toFixed(2);

/** Clinical percentage with 1 decimal: 0.9687 → "96.9%". */
export const pct1 = (x: number | undefined | null): string =>
  x === undefined || x === null || Number.isNaN(x) ? '—' : `${(x * 100).toFixed(1)}%`;

export const pct0 = (x: number): string => `${Math.round(x * 100)}%`;

/** Signed delta in percentage points: -0.021 → "▼ 2.1 pts". */
export function deltaPts(d: number): string {
  const v = Math.abs(d * 100);
  if (v < 0.05) return '● tied';
  return `${d > 0 ? '▲' : '▼'} ${v.toFixed(1)} pts`;
}

export const meanStd = (m: number, s: number): string => `${m.toFixed(3)} ± ${s.toFixed(3)}`;

export function int(x: number): string {
  return Math.round(x).toLocaleString('en-US');
}

export function compact(x: number): string {
  const a = Math.abs(x);
  if (a >= 1e9) return `${(x / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(x / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(x / 1e3).toFixed(1)}k`;
  return `${Math.round(x)}`;
}

/** Duration in seconds → "420 ms" / "3.2 s" / "4.5 min" / "1.2 h". */
export function duration(sec: number): string {
  if (!Number.isFinite(sec)) return '—';
  if (sec < 1) return `${Math.round(sec * 1000)} ms`;
  if (sec < 60) return `${sec.toFixed(sec < 10 ? 1 : 0)} s`;
  if (sec < 3600) return `${(sec / 60).toFixed(1)} min`;
  return `${(sec / 3600).toFixed(1)} h`;
}

export function ms(msVal: number): string {
  if (msVal < 1) return `${msVal.toFixed(2)} ms`;
  if (msVal < 1000) return `${msVal.toFixed(msVal < 10 ? 1 : 0)} ms`;
  return duration(msVal / 1000);
}

export function bytes(b: number): string {
  if (b < 1024) return `${b} B`;
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function countdown(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function dateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function pValue(p: number): string {
  if (p < 0.001) return '< 0.001';
  return p.toFixed(3);
}

export const rad = (x: number): string => `${x.toFixed(2)} rad`;

export function piFrac(x: number): string {
  const r = x / Math.PI;
  const known: [number, string][] = [
    [0, '0'], [0.25, 'π/4'], [0.5, 'π/2'], [0.75, '3π/4'], [1, 'π'], [1.25, '5π/4'], [1.5, '3π/2'], [1.75, '7π/4'], [2, '2π'],
  ];
  for (const [v, s] of known) if (Math.abs(r - v) < 1e-6) return s;
  return x.toFixed(2);
}

/** radius_worst → "radius (worst)" — clinician-friendly feature names. */
export function prettyName(f: string): string {
  return f.replace(/_mean$/, ' (mean)').replace(/_se$/, ' (SE)').replace(/_worst$/, ' (worst)').replace(/_/g, ' ');
}
