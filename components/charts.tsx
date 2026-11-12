'use client';
import React, { useEffect, useRef, useState } from 'react';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function BarChart({ data, height = 120, summary }: { data: { label: string; value: number }[]; height?: number; summary?: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const max = Math.max(...data.map((d) => d.value), 1);
  const labelH = 18;
  const plotH = height - labelH;
  const gap = data.length > 14 ? 3 : 6;
  const bw = w ? Math.max(2, (w - gap * (data.length - 1)) / data.length) : 0;
  const every = data.length > 8 ? 2 : 1;
  return (
    <div ref={ref} role="img" aria-label={summary ?? 'Bar chart'}>
      {w > 0 && (
        <svg width={w} height={height}>
          <line x1={0} x2={w} y1={plotH + 0.5} y2={plotH + 0.5} stroke="#E8E8E6" />
          {data.map((d, i) => {
            const h = d.value > 0 ? Math.max(2, (d.value / max) * (plotH - 6)) : 0;
            const last = i === data.length - 1;
            const x = i * (bw + gap);
            return (
              <g key={i}>
                <rect x={x} y={plotH - h} width={bw} height={h} fill={last ? '#0A0A0A' : '#E5E5E2'} />
                {(data.length - 1 - i) % every === 0 && (
                  <text x={x + bw / 2} y={height - 3} fontSize={9.5} fontWeight={500} fill={last ? '#0A0A0A' : '#B5B5B5'} textAnchor="middle">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/** Hairline line chart. Touch or drag to scrub: a dashed rule and a dot follow the pointer and onScrub reports the nearest index. */
export function LineChart({
  values,
  labels,
  height = 150,
  onScrub,
}: {
  values: number[];
  labels?: [string, string];
  height?: number;
  onScrub?: (i: number | null) => void;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [touch, setTouch] = useState<number | null>(null);
  const pad = { l: 4, r: 8, t: 10, b: labels ? 20 : 8 };
  const n = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const lo = min - span * 0.15;
  const hi = max + span * 0.15;
  const pw = Math.max(1, w - pad.l - pad.r);
  const ph = height - pad.t - pad.b;
  const xOf = (i: number) => pad.l + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
  const yOf = (v: number) => pad.t + ph - ((v - lo) / (hi - lo)) * ph;

  const at = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (n <= 1) return 0;
    return Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - pad.l) / pw) * (n - 1))));
  };
  const move = (e: React.PointerEvent) => {
    const i = at(e);
    setTouch(i);
    onScrub?.(i);
  };
  const end = () => {
    setTouch(null);
    onScrub?.(null);
  };
  const shown = Math.min(touch ?? n - 1, n - 1);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`).join(' ');
  return (
    <div
      ref={ref}
      style={{ height, touchAction: 'pan-y' }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={(e) => e.buttons || e.pointerType === 'touch' ? move(e) : undefined}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={(e) => !e.buttons && end()}
      role="img"
      aria-label="Line chart. Drag across it to inspect values."
    >
      {w > 0 && n > 0 && (
        <svg width={w} height={height} style={{ display: 'block' }}>
          {[0, 0.5, 1].map((f) => (
            <line key={f} x1={pad.l} x2={w - pad.r} y1={pad.t + ph * f} y2={pad.t + ph * f} stroke="#E8E8E6" />
          ))}
          <path d={d} stroke="#0A0A0A" strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {touch != null && <line x1={xOf(touch)} x2={xOf(touch)} y1={pad.t} y2={pad.t + ph} stroke="#0A0A0A" strokeDasharray="3 3" />}
          <circle cx={xOf(shown)} cy={yOf(values[shown])} r={4} fill="#0A0A0A" />
          <circle cx={xOf(shown)} cy={yOf(values[shown])} r={7} fill="none" stroke="#0A0A0A" strokeOpacity={0.18} />
          {labels && (
            <>
              <text x={pad.l} y={height - 4} fontSize={9.5} fontWeight={500} fill="#B5B5B5">{labels[0]}</text>
              <text x={w - pad.r} y={height - 4} fontSize={9.5} fontWeight={500} fill="#B5B5B5" textAnchor="end">{labels[1]}</text>
            </>
          )}
        </svg>
      )}
    </div>
  );
}

export function Meter({ label, value, target, onPress }: { label: string; value: number; target: [number, number]; onPress?: () => void }) {
  const cap = Math.max(target[1] * 1.25, value);
  return (
    <button onClick={onPress} className="bare block w-full text-left" aria-label={`${label}: ${value.toFixed(1)} sets per week, target ${target[0]} to ${target[1]}`}>
      <div className="mb-[7px] flex items-baseline justify-between">
        <span className="text-[14.5px] font-medium text-ink">{label}</span>
        <span className="num text-[18px] text-ink">
          {value.toFixed(1)}
          <span className="font-sans text-[10.5px] font-medium text-mute"> /wk</span>
        </span>
      </div>
      <div className="relative h-1.5 bg-soft">
        <div className="h-1.5" style={{ width: `${Math.min(100, (value / cap) * 100)}%`, background: value >= target[0] ? '#0A0A0A' : '#7A7A7A' }} />
        <div className="absolute -bottom-[3px] -top-[3px] border-x border-faint" style={{ left: `${(target[0] / cap) * 100}%`, width: `${((target[1] - target[0]) / cap) * 100}%` }} />
      </div>
    </button>
  );
}
