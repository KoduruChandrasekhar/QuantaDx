/** Training-event stream: WebSocket with backoff + heartbeat + Zod validation, polling fallback, or the mock source. */
import { z } from 'zod';
import type { TrainingEvent } from '@/types/api';
import { USE_MOCK, WS_URL } from './client';
import { api } from './endpoints';

export type StreamStatus = 'connecting' | 'open' | 'reconnecting' | 'closed' | 'polling';

const EventSchema = z.object({
  experimentId: z.string(),
  modelId: z.string(),
  type: z.enum(['progress', 'log', 'status', 'done', 'error']),
  iteration: z.number().optional(),
  maxIter: z.number().optional(),
  loss: z.number().optional(),
  trainMetric: z.number().optional(),
  valMetric: z.number().optional(),
  gradNorm: z.number().optional(),
  params: z.array(z.number()).optional(),
  circuitExecutions: z.number().optional(),
  shotsUsed: z.number().optional(),
  elapsedSec: z.number().optional(),
  etaSec: z.number().optional(),
  iterTimeMs: z.number().optional(),
  message: z.string().optional(),
  level: z.enum(['info', 'warn', 'error']).optional(),
  status: z.enum(['queued', 'running', 'done', 'failed', 'cancelled']).optional(),
  queuePosition: z.number().optional(),
});

export function openStream(experimentId: string, onEvent: (e: TrainingEvent) => void, onStatus: (s: StreamStatus) => void): () => void {
  let closed = false;
  if (USE_MOCK) {
    onStatus('connecting');
    let unsub: (() => void) | null = null;
    import('@/mocks/handlers').then(({ mockSubscribe }) => {
      if (closed) return;
      unsub = mockSubscribe(experimentId, onEvent);
      onStatus('open');
    });
    return () => {
      closed = true;
      unsub?.();
      onStatus('closed');
    };
  }

  let ws: WebSocket | null = null;
  let attempt = 0;
  let heartbeat: number | undefined;
  let pollTimer: number | undefined;
  let seen = 0;

  const poll = async () => {
    onStatus('polling');
    try {
      const h = await api.history(experimentId);
      h.slice(seen).forEach(onEvent);
      seen = h.length;
    } catch {
      /* keep polling */
    }
    if (!closed) pollTimer = window.setTimeout(poll, 3000);
  };

  const connect = () => {
    onStatus(attempt === 0 ? 'connecting' : 'reconnecting');
    ws = new WebSocket(`${WS_URL}/experiments/${encodeURIComponent(experimentId)}/stream`);
    ws.onopen = () => {
      attempt = 0;
      onStatus('open');
      heartbeat = window.setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send('ping'), 15000);
    };
    ws.onmessage = (m) => {
      try {
        const parsed = EventSchema.safeParse(JSON.parse(String(m.data)));
        if (parsed.success) onEvent(parsed.data);
      } catch {
        /* ignore non-JSON (pong) */
      }
    };
    ws.onclose = () => {
      clearInterval(heartbeat);
      if (closed) return;
      attempt++;
      if (attempt > 5) {
        poll();
        return;
      }
      window.setTimeout(connect, Math.min(15000, 500 * 2 ** attempt));
    };
  };
  connect();
  return () => {
    closed = true;
    clearInterval(heartbeat);
    clearTimeout(pollTimer);
    ws?.close();
    onStatus('closed');
  };
}
