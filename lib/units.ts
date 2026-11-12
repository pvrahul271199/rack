export type Unit = 'kg' | 'lb';
const LB = 2.2046226218;

/** Weights are always stored in kg. */
export const toDisplay = (kg: number, unit: Unit) => (unit === 'kg' ? kg : kg * LB);
export const fromDisplay = (v: number, unit: Unit) => (unit === 'kg' ? v : v / LB);

/** Round to a sensible increment for display: 0.5 kg / 1 lb-ish, trimmed. */
export function fmtWeight(kg: number, unit: Unit, decimals?: number): string {
  const v = toDisplay(kg, unit);
  const d = decimals ?? (unit === 'kg' ? 1 : 1);
  const r = Math.round(v * 10 ** d) / 10 ** d;
  return r.toLocaleString('en-US', { maximumFractionDigits: d });
}
export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');

/** Volume in tonnes when large, otherwise in the unit. */
export function fmtVolume(kg: number, unit: Unit): { value: string; unit: string } {
  const v = toDisplay(kg, unit);
  if (v >= 10000) return { value: (v / 1000).toFixed(1), unit: unit === 'kg' ? 't' : 'k lb' };
  return { value: fmtInt(v), unit };
}
export const fmtKm = (km: number) => (Math.round(km * 10) / 10).toFixed(1);
export function fmtPace(secPerKm: number): string {
  if (!isFinite(secPerKm) || secPerKm <= 0) return '–';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}
export function fmtClock(totalSec: number): string {
  const t = Math.max(0, Math.round(totalSec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
export function fmtDuration(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}
