// Local ISO dates (yyyy-mm-dd). Never `new Date(iso)` — it parses as UTC.
const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const todayISO = () => toISO(new Date());
export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
}
/** Monday of the week containing `iso`. */
export function weekStart(iso: string): string {
  const d = fromISO(iso);
  const dow = (d.getDay() + 6) % 7;
  return addDays(iso, -dow);
}
export function monthStart(iso: string): string {
  return iso.slice(0, 8) + '01';
}
export function daysInMonth(y: number, m0: number): number {
  return new Date(y, m0 + 1, 0).getDate();
}
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const dayName = (iso: string) => DAY_NAMES[fromISO(iso).getDay()];
export const monthShort = (iso: string) => MONTH_NAMES[fromISO(iso).getMonth()].slice(0, 3);
/** "THURSDAY · 12 NOV" */
export function metaDate(iso: string): string {
  const d = fromISO(iso);
  return `${DAY_NAMES[d.getDay()]} · ${d.getDate()} ${monthShort(iso)}`.toUpperCase();
}
export function relativeDay(iso: string, today = todayISO()): string {
  const n = diffDays(today, iso);
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  return `${n} days ago`;
}
