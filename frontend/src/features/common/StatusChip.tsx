import type { JobStatus } from '@/types/api';
import { LiveDot } from '@/components/common/misc';

const META: Record<JobStatus, { label: string; color: string }> = {
  queued: { label: 'Queued', color: 'var(--saffron)' },
  running: { label: 'Running', color: 'var(--blue)' },
  done: { label: 'Done', color: 'var(--green)' },
  failed: { label: 'Failed', color: 'var(--red)' },
  cancelled: { label: 'Cancelled', color: 'var(--muted)' },
};

export function StatusChip({ status }: { status: JobStatus }) {
  const m = META[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: m.color, background: `color-mix(in srgb, ${m.color} 12%, transparent)` }}>
      {status === 'running' || status === 'queued' ? <LiveDot color={m.color} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />}
      {m.label}
    </span>
  );
}
