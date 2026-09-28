/** Small, accessible UI primitives (shadcn-style, hand-rolled on Tailwind tokens). */
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import {
  cloneElement, forwardRef, isValidElement, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type CSSProperties, type ReactElement, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export const cn = clsx;

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'quantum' | 'danger' | 'outline' | 'success';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-classical text-white hover:brightness-110 shadow-sm',
  quantum: 'bg-quantum text-white hover:brightness-110 shadow-sm',
  success: 'bg-ok text-white hover:brightness-110 shadow-sm',
  secondary: 'bg-surface-3 text-fg hover:bg-line',
  outline: 'border border-line-strong bg-surface text-fg hover:bg-surface-2',
  ghost: 'text-fg-2 hover:bg-surface-3',
  danger: 'bg-danger text-white hover:brightness-110',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode }>(
  function Button({ variant = 'primary', size = 'md', icon, className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
          size === 'sm' ? 'h-8 px-3 text-xs' : size === 'lg' ? 'h-11 px-5 text-sm' : 'h-9 px-4 text-sm',
          BTN[variant],
          className,
        )}
        {...rest}
      >
        {icon}
        {children}
      </button>
    );
  },
);

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <Tip text={label}>
      <button aria-label={label} className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-2 transition hover:bg-surface-3 hover:text-fg', className)} {...rest}>
        {children}
      </button>
    </Tip>
  );
}

export function Card({ children, className, style, ...rest }: { children: ReactNode; className?: string; style?: CSSProperties } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} style={style} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, icon, actions, className }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b border-line px-4 py-3', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <div className="mt-0.5 text-muted">{icon}</div>}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-fg">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}

export function Badge({ children, color = 'var(--muted)', tint, className, solid }: { children: ReactNode; color?: string; tint?: string; className?: string; solid?: boolean }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-4 whitespace-nowrap', className)}
      style={solid ? { background: color, color: '#fff' } : { color, background: tint ?? `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      {children}
    </span>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md', className, layoutId }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: ReactNode }[]; size?: 'sm' | 'md'; className?: string; layoutId?: string }) {
  const id = useId();
  return (
    <div role="tablist" className={cn('inline-flex rounded-lg bg-surface-3 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('relative flex items-center gap-1.5 rounded-md font-medium transition-colors', size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm', value === o.value ? 'text-fg' : 'text-muted hover:text-fg')}
        >
          {value === o.value && <motion.span layoutId={layoutId ?? `seg-${id}`} className="absolute inset-0 rounded-md bg-surface shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="relative z-10 flex items-center gap-1.5">
            {o.icon}
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; icon?: ReactNode; count?: number }[]; className?: string }) {
  const id = useId();
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto border-b border-line', className)}>
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={cn('relative flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors', value === t.value ? 'text-classical' : 'text-muted hover:text-fg')}>
          {t.icon}
          {t.label}
          {t.count !== undefined && <span className="rounded bg-surface-3 px-1 text-[10px] text-muted">{t.count}</span>}
          {value === t.value && <motion.span layoutId={`tab-${id}`} className="absolute inset-x-1 -bottom-px h-0.5 rounded bg-classical" />}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled, color = 'var(--blue)' }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean; color?: string }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm select-none', disabled && 'opacity-50 pointer-events-none')}>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className="relative h-5 w-9 shrink-0 rounded-full transition-colors" style={{ background: checked ? color : 'var(--line-strong)' }}>
        <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 35 }} className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow" style={{ left: checked ? 18 : 2 }} />
      </button>
      {label && <span className="text-fg-2">{label}</span>}
    </label>
  );
}

export function Select<T extends string>({ value, onChange, options, label, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label?: string; className?: string }) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && <label htmlFor={id} className="text-xs font-medium text-muted">{label}</label>}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}
        className="h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-fg outline-none transition focus:border-classical">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function Slider({ value, onChange, min, max, step = 1, label, format, accent = 'var(--blue)', className, hint }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; label?: ReactNode; format?: (v: number) => string; accent?: string; className?: string; hint?: ReactNode }) {
  const id = useId();
  const pct = ((value - min) / (max - min || 1)) * 100;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <div className="flex items-center justify-between text-xs">
          <label htmlFor={id} className="font-medium text-muted">{label}</label>
          <span className="tnum font-mono font-semibold text-fg">{format ? format(value) : value}</span>
        </div>
      )}
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--pct': `${pct}%`, '--accent': accent } as CSSProperties} className="w-full" />
      {hint && <div className="text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

export function NumberField({ value, onChange, label, min, max, step = 1, className, suffix }: { value: number; onChange: (v: number) => void; label?: string; min?: number; max?: number; step?: number; className?: string; suffix?: string }) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && <label htmlFor={id} className="text-xs font-medium text-muted">{label}</label>}
      <div className="flex items-center rounded-lg border border-line bg-surface focus-within:border-classical">
        <input id={id} type="number" value={value} min={min} max={max} step={step}
          onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))}
          className="tnum h-9 w-full min-w-0 bg-transparent px-2.5 text-sm text-fg outline-none" />
        {suffix && <span className="pr-2.5 text-xs text-muted">{suffix}</span>}
      </div>
    </div>
  );
}

export function Progress({ value, color = 'var(--blue)', className, striped, height = 6 }: { value: number; color?: string; className?: string; striped?: boolean; height?: number }) {
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-surface-3', className)} style={{ height }} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className="h-full rounded-full" style={{ background: striped ? `repeating-linear-gradient(45deg, ${color} 0 8px, color-mix(in srgb, ${color} 75%, white) 8px 16px)` : color }}
        initial={false} animate={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">{children}</kbd>;
}

/** Portal tooltip — never clipped by overflow containers. */
export function Tip({ text, children, side = 'top' }: { text: ReactNode; children: ReactElement; side?: 'top' | 'bottom' | 'right' }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const timer = useRef<number>();
  if (!isValidElement(children)) return children;
  const show = (e: React.SyntheticEvent<HTMLElement>) => {
    const el = e.currentTarget;
    timer.current = window.setTimeout(() => setRect(el.getBoundingClientRect()), 250);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setRect(null);
  };
  const props = children.props as Record<string, unknown>;
  const child = cloneElement(children as ReactElement<Record<string, unknown>>, {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { show(e); (props.onMouseEnter as ((e: unknown) => void) | undefined)?.(e); },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { hide(); (props.onMouseLeave as ((e: unknown) => void) | undefined)?.(e); },
    onFocus: (e: React.FocusEvent<HTMLElement>) => { show(e); (props.onFocus as ((e: unknown) => void) | undefined)?.(e); },
    onBlur: (e: React.FocusEvent<HTMLElement>) => { hide(); (props.onBlur as ((e: unknown) => void) | undefined)?.(e); },
  });
  const style: CSSProperties = rect
    ? side === 'right'
      ? { left: rect.right + 8, top: rect.top + rect.height / 2, transform: 'translateY(-50%)' }
      : side === 'bottom'
        ? { left: rect.left + rect.width / 2, top: rect.bottom + 8, transform: 'translateX(-50%)' }
        : { left: rect.left + rect.width / 2, top: rect.top - 8, transform: 'translate(-50%, -100%)' }
    : {};
  return (
    <>
      {child}
      {rect && text &&
        createPortal(
          <div role="tooltip" className="pointer-events-none fixed z-[200] max-w-xs rounded-lg bg-[#0f1b2d] px-2.5 py-1.5 text-xs leading-snug text-white shadow-pop dark:bg-[#e6edf7] dark:text-[#0f1b2d]" style={style}>
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}

export function Modal({ open, onClose, title, children, width = 560, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[120] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#0a0f18]/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Dialog'} className="card relative flex max-h-[90vh] w-full flex-col overflow-hidden shadow-pop" style={{ maxWidth: width }}
            initial={{ y: 16, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 16, scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 32 }}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="font-semibold text-fg">{title}</h2>
              <IconButton label="Close" onClick={onClose}><X size={16} /></IconButton>
            </div>
            <div className="overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children, width = 440 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[110] bg-[#0a0f18]/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside role="dialog" aria-label={typeof title === 'string' ? title : 'Panel'} className="fixed inset-y-0 right-0 z-[111] flex w-full flex-col border-l border-line bg-surface shadow-pop" style={{ maxWidth: width }}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 38 }}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="font-semibold text-fg">{title}</h2>
              <IconButton label="Close" onClick={onClose}><X size={16} /></IconButton>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
  );
}

export function SectionTitle({ children, sub, id, right }: { children: ReactNode; sub?: ReactNode; id?: string; right?: ReactNode }) {
  return (
    <div id={id} className="mb-3 mt-8 flex scroll-mt-24 items-end justify-between gap-3 first:mt-0">
      <div>
        <h2 className="font-serif text-xl font-semibold text-heading">{children}</h2>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
