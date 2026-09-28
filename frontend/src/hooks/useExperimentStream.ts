/** History + live WebSocket events for one experiment, batched to ≤ 10 renders per second. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/api/endpoints';
import { openStream, type StreamStatus } from '@/api/ws';
import type { TrainingEvent } from '@/types/api';

export interface StreamState {
  progress: Record<string, TrainingEvent[]>;
  logs: TrainingEvent[];
  status: Record<string, TrainingEvent>;
  done: boolean;
  version: number;
}

const empty = (): StreamState => ({ progress: {}, logs: [], status: {}, done: false, version: 0 });

function apply(s: StreamState, events: TrainingEvent[]): StreamState {
  const progress = { ...s.progress };
  const logs = [...s.logs];
  const status = { ...s.status };
  let done = s.done;
  for (const e of events) {
    if (e.type === 'progress') progress[e.modelId] = [...(progress[e.modelId] ?? []), e];
    else if (e.type === 'log' || e.type === 'error' || e.type === 'done') logs.push(e);
    if (e.type === 'status') {
      status[e.modelId] = e;
      if (e.message) logs.push({ ...e, type: 'log', level: e.status === 'cancelled' ? 'warn' : 'info' });
      if (e.modelId === '*' && (e.status === 'done' || e.status === 'cancelled')) done = true;
    }
  }
  return { progress, logs: logs.slice(-800), status, done, version: s.version + 1 };
}

export function useExperimentStream(id: string | undefined, isDone: boolean) {
  const [state, setState] = useState<StreamState>(empty);
  const [conn, setConn] = useState<StreamStatus>('connecting');
  const buffer = useRef<TrainingEvent[]>([]);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setState(empty);
    buffer.current = [];
    api.history(id).then((h) => alive && setState((s) => ({ ...apply(s, h), done: isDone || s.done })));
    const close = openStream(id, (e) => buffer.current.push(e), setConn);
    const flush = setInterval(() => {
      if (!buffer.current.length) return;
      const batch = buffer.current;
      buffer.current = [];
      setState((s) => apply(s, batch));
    }, 250);
    return () => {
      alive = false;
      close();
      clearInterval(flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, epoch]);

  const reset = useCallback(() => {
    buffer.current = [];
    setState(empty);
  }, []);
  const reconnect = useCallback(() => setEpoch((e) => e + 1), []);
  return { ...state, conn, reset, reconnect };
}
