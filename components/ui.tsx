'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '@/store/toast';
import type { Tab } from '@/store/nav';

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');
export const GUTTER = 'px-[22px]';

export const tap = () => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(8);
};

// ---- Text ---------------------------------------------------------------------
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cx('text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink', className)}>{children}</span>;
}

/** "Training *Insights.*" → serif title with the starred words in italic. */
export function Title({ children, size = 44 }: { children: string; size?: number }) {
  return (
    <h1 className="mb-1.5 mt-[18px] font-serif font-normal text-ink" style={{ fontSize: size, lineHeight: 0.98, letterSpacing: '-0.02em' }}>
      {children.split('*').map((p, i) => (i % 2 ? <em key={i}>{p}</em> : <span key={i}>{p}</span>))}
    </h1>
  );
}

export function Hero({ value, unit, size = 68 }: { value: string; unit?: string; size?: number }) {
  return (
    <div className="flex items-baseline">
      <span className="num text-ink" style={{ fontSize: size, lineHeight: 0.92 }}>
        {value}
      </span>
      {unit ? <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-mute">{unit}</span> : null}
    </div>
  );
}

// ---- Layout ---------------------------------------------------------------------
export function Screen({ children, footer, bottomPad = 40 }: { children: React.ReactNode; footer?: React.ReactNode; bottomPad?: number }) {
  return (
    <div className="relative flex h-full flex-col bg-bg" style={{ paddingTop: 'calc(var(--safe-top) + 6px)' }}>
      <div className={cx('scroll-hide min-h-0 flex-1 overflow-y-auto', GUTTER)} style={{ paddingBottom: bottomPad }}>
        {children}
      </div>
      {footer}
    </div>
  );
}

export function MetaRow({ left, right, onBack }: { left: string; right?: string; onBack?: () => void }) {
  return (
    <div>
      {onBack ? (
        <button onClick={onBack} className="bare -ml-1 py-2 pl-1 pr-3 text-[12.5px] font-medium text-mute" aria-label="Back">
          ← Back
        </button>
      ) : null}
      <div className="flex items-baseline justify-between border-t border-ink pt-2.5">
        <Eyebrow>{left}</Eyebrow>
        {right ? <span className="font-serif text-[16px] italic text-ink">{right}</span> : null}
      </div>
    </div>
  );
}

export function Section({ n, title, action, onAction }: { n: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mt-[30px] flex items-baseline justify-between border-t border-ink pb-3 pt-2.5">
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-[15px] italic text-mute">{n}</span>
        <Eyebrow>{title}</Eyebrow>
      </div>
      {action ? (
        <button onClick={onAction} className="bare text-[12px] font-medium text-ink underline">
          {action}
        </button>
      ) : null}
    </div>
  );
}

export function Stats({ items }: { items: { label: string; value: string; unit?: string }[] }) {
  return (
    <div className="flex border-y border-line">
      {items.map((it, i) => (
        <div key={it.label} className={cx('min-w-0 flex-1 px-3 py-3.5', i > 0 && 'border-l border-line')}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">{it.label}</div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="num truncate text-[32px] leading-none text-ink">{it.value}</span>
            {it.unit ? <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">{it.unit}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export const Rule = ({ ink }: { ink?: boolean }) => <div className={cx('h-px', ink ? 'bg-ink' : 'bg-line')} />;

export function Row({
  index,
  title,
  sub,
  right,
  onPress,
}: {
  index?: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const Tag = onPress ? 'div' : 'div';
  return (
    <Tag
      role={onPress ? 'button' : undefined}
      tabIndex={onPress ? 0 : undefined}
      onClick={onPress}
      onKeyDown={onPress ? (e) => (e.key === 'Enter' || e.key === ' ') && onPress() : undefined}
      className={cx('flex items-center gap-3.5 border-b border-line py-3.5', onPress && 'cursor-pointer active:bg-soft')}
    >
      {index ? <span className="w-[26px] font-serif text-[15px] italic text-faint">{index}</span> : null}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium text-ink">{title}</div>
        {sub ? <div className="mt-[3px] text-[12.5px] leading-[17px] text-mute">{sub}</div> : null}
      </div>
      {right}
    </Tag>
  );
}

// ---- Controls ---------------------------------------------------------------------
export function Btn({
  label,
  onPress,
  variant = 'primary',
  disabled,
  className,
  small,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'out';
  disabled?: boolean;
  className?: string;
  small?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={() => {
        tap();
        onPress();
      }}
      className={cx(
        'flex w-full items-center justify-center rounded-btn border text-[13.5px] font-semibold uppercase tracking-[0.04em] transition-opacity',
        small ? 'h-[42px]' : 'h-[50px]',
        variant === 'primary' ? 'border-ink bg-ink text-white active:opacity-85' : 'border-line bg-transparent text-ink active:border-ink',
        disabled && 'opacity-35',
        className,
      )}
    >
      {label}
    </button>
  );
}

export function TextLink({ label, onPress, className }: { label: string; onPress: () => void; className?: string }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onPress();
      }}
      className={cx('bare py-1 text-[12px] font-medium text-ink underline', className)}
    >
      {label}
    </button>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div className="scroll-hide -mx-[22px] flex gap-2 overflow-x-auto px-[22px] py-0.5" role="group">
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            aria-pressed={on}
            onClick={() => {
              tap();
              onChange(o);
            }}
            className={cx(
              'bare h-[34px] shrink-0 rounded-btn border px-3.5 text-[12.5px] font-medium',
              on ? 'border-ink bg-ink text-white' : 'border-line text-ink',
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex overflow-hidden rounded-btn border border-line" role="group">
      {options.map((o, i) => {
        const on = o === value;
        return (
          <button
            key={o}
            aria-pressed={on}
            onClick={() => {
              tap();
              onChange(o);
            }}
            className={cx(
              'bare h-9 flex-1 text-[11px] font-semibold uppercase tracking-[0.08em]',
              i > 0 && 'border-l border-line',
              on ? 'bg-ink text-white' : 'text-ink',
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">{label}</div>
      <div className="flex items-center">
        <button aria-label={`Decrease ${label}`} className="bare h-9 w-9 rounded-btn border border-line text-[18px]" onClick={() => onChange(Math.max(min, value - 1))}>
          −
        </button>
        <span className="num min-w-[42px] text-center text-[26px]">{value}</span>
        <button aria-label={`Increase ${label}`} className="bare h-9 w-9 rounded-btn border border-line text-[18px]" onClick={() => onChange(Math.min(max, value + 1))}>
          +
        </button>
      </div>
    </div>
  );
}

// ---- Sheet / keypad ------------------------------------------------------------------
export function Sheet({ visible, onClose, children, tall }: { visible: boolean; onClose: () => void; children: React.ReactNode; tall?: boolean }) {
  useEffect(() => {
    if (!visible) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [visible, onClose]);
  if (!visible) return null;
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button aria-label="Close" className="bare absolute inset-0 bg-ink/40" onClick={onClose} tabIndex={-1} />
      <div
        className={cx('anim-slide-up relative flex flex-col rounded-t-lg border-t border-ink bg-bg pt-2', tall ? 'max-h-[90%]' : 'max-h-[82%]')}
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}
      >
        <div className="mx-auto mb-3.5 h-[3px] w-9 rounded-full bg-line" />
        {children}
      </div>
    </div>
  );
}

export function Keypad({
  visible,
  label,
  initial,
  unit,
  allowDecimal = true,
  onDone,
  onClose,
}: {
  visible: boolean;
  label: string;
  initial: number;
  unit: string;
  allowDecimal?: boolean;
  onDone: (v: number) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const fresh = useRef(true);
  useEffect(() => {
    if (visible) {
      setText(initial ? String(Math.round(initial * 100) / 100) : '');
      fresh.current = true;
    }
  }, [visible, initial]);

  const press = (k: string) => {
    tap();
    // First digit replaces the existing value, like a calculator.
    const base = fresh.current ? '' : text;
    fresh.current = false;
    let next: string;
    if (k === '⌫') next = text.slice(0, -1);
    else if (k === '.') next = !allowDecimal || base.includes('.') ? base : (base || '0') + '.';
    else if (base.replace('.', '').length >= 6) next = base;
    else if (base.includes('.') && base.split('.')[1].length >= 2) next = base;
    else next = base === '0' ? k : base + k;
    setText(next);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
  return (
    <Sheet visible={visible} onClose={onClose} tall>
      <div className={GUTTER}>
        <Eyebrow>{label}</Eyebrow>
        <div className="my-3.5">
          <Hero value={text || '0'} unit={unit} />
        </div>
        <div className="grid grid-cols-3 border-l border-t border-line">
          {keys.map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              disabled={k === '.' && !allowDecimal}
              aria-label={k === '⌫' ? 'Delete' : k}
              className="bare h-[58px] border-b border-r border-line font-serif text-[30px] text-ink active:bg-soft disabled:opacity-20"
            >
              {k}
            </button>
          ))}
        </div>
        <Btn
          label="Done"
          className="mt-2.5"
          onPress={() => {
            const v = parseFloat(text);
            onDone(isNaN(v) ? 0 : v);
          }}
        />
      </div>
    </Sheet>
  );
}

// ---- Toast ------------------------------------------------------------------------
export function Toast() {
  const { title, body, hide } = useToast();
  if (!title) return null;
  return (
    <button
      onClick={hide}
      role="status"
      aria-live="polite"
      className="anim-drop-in bare absolute inset-x-0 top-0 z-50 block w-full bg-ink px-[22px] pb-3.5 text-left"
      style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}
    >
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white">{title}</div>
      {body ? <div className="mt-1 font-serif text-[24px] leading-tight text-white">{body}</div> : null}
    </button>
  );
}

// ---- Tab bar ----------------------------------------------------------------------
function Icon({ tab }: { tab: Tab }) {
  const p = { stroke: 'currentColor', strokeWidth: 1.4, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      {tab === 'log' && <path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" {...p} />}
      {tab === 'insights' && (
        <>
          <path d="M4 20V4M4 20h16" {...p} />
          <path d="M8 15l4-4 3 3 5-6" {...p} />
        </>
      )}
      {tab === 'history' && (
        <>
          <rect x="4" y="5" width="16" height="15" rx="1" {...p} />
          <path d="M4 10h16M9 3v4M15 3v4" {...p} />
        </>
      )}
      {tab === 'profile' && (
        <>
          <circle cx="12" cy="8.5" r="3.5" {...p} />
          <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" {...p} />
        </>
      )}
    </svg>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'log', label: 'LOG' },
  { id: 'insights', label: 'INSIGHTS' },
  { id: 'history', label: 'HISTORY' },
  { id: 'profile', label: 'PROFILE' },
];

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      className="flex border-t border-line bg-white/[0.94] pt-2 backdrop-blur-[16px]"
      style={{ paddingBottom: 'max(var(--safe-bottom), 8px)' }}
      aria-label="Primary"
    >
      {TABS.map((t) => {
        const on = t.id === tab;
        return (
          <button
            key={t.id}
            aria-current={on ? 'page' : undefined}
            onClick={() => {
              tap();
              onChange(t.id);
            }}
            className={cx('bare flex flex-1 flex-col items-center gap-[3px]', on ? 'text-ink' : 'text-mute')}
          >
            <Icon tab={t.id} />
            <span className="text-[9px] font-semibold tracking-[0.1em]">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="py-7 text-[13.5px] leading-5 text-mute">{text}</p>;
}
