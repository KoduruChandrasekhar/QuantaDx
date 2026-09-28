/** Typed fetch wrapper. With VITE_USE_MOCK=true requests go to the in-process mock backend instead. */

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
export const WS_URL: string = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000';
export const USE_MOCK: boolean = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let apiKey: string | null = null;
/** Kept in memory only — never written to localStorage (Section 15). */
export const setApiKey = (k: string | null) => {
  apiKey = k;
};
export const getApiKeyMasked = () => (apiKey ? `${apiKey.slice(0, 4)}••••••••${apiKey.slice(-4)}` : 'qdx_live_••••••••3f9a (demo)');

type Method = 'GET' | 'POST' | 'DELETE';

export async function request<T>(method: Method, path: string, body?: unknown, opts: { timeoutMs?: number; retry?: boolean } = {}): Promise<T> {
  if (USE_MOCK) {
    const { mockRequest, MockHttpError } = await import('@/mocks/handlers');
    try {
      return (await mockRequest(method, path, body)) as T;
    } catch (e) {
      if (e instanceof MockHttpError) throw new ApiError(e.status, e.code, e.message);
      throw new ApiError(500, 'mock_error', (e as Error).message);
    }
  }
  const { timeoutMs = 20000, retry = true } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'X-API-Key': apiKey } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data: unknown = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const d = data as { detail?: string; code?: string } | null;
      throw new ApiError(res.status, d?.code ?? `http_${res.status}`, d?.detail ?? res.statusText, data);
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (retry && (e as Error).name !== 'AbortError') return request<T>(method, path, body, { ...opts, retry: false });
    throw new ApiError(0, (e as Error).name === 'AbortError' ? 'timeout' : 'network', (e as Error).name === 'AbortError' ? 'Request timed out' : 'Network error — is the backend running?');
  } finally {
    clearTimeout(timer);
  }
}

export async function upload<T>(path: string, file: File, fields: Record<string, string>, onProgress: (pct: number) => void): Promise<T> {
  if (USE_MOCK) {
    const { mockUpload, MockHttpError } = await import('@/mocks/handlers');
    try {
      return (await mockUpload(file, fields.mode as 'tabular', onProgress)) as T;
    } catch (e) {
      if (e instanceof MockHttpError) throw new ApiError(e.status, e.code, e.message);
      throw e;
    }
  }
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);
    Object.entries(fields).forEach(([k, v]) => form.append(k, v));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress((e.loaded / e.total) * 100);
    xhr.onload = () => {
      const data: unknown = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else reject(new ApiError(xhr.status, `http_${xhr.status}`, (data as { detail?: string })?.detail ?? xhr.statusText));
    };
    xhr.onerror = () => reject(new ApiError(0, 'network', 'Upload failed — network error'));
    xhr.open('POST', `${API_URL}${path}`);
    if (apiKey) xhr.setRequestHeader('X-API-Key', apiKey);
    xhr.send(form);
  });
}
