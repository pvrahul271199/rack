import type { Exercise, Muscle, Run, Session, WorkoutExercise } from '@/db/schema';
import { MUSCLES } from '@/db/schema';
import { addDays, diffDays, fromISO, monthStart, todayISO, weekStart } from '@/lib/dates';
import { e1rm } from '@/lib/strength';

export function sessionVolume(exs: WorkoutExercise[], lib: Exercise[]): number {
  let v = 0;
  for (const we of exs) {
    const ex = lib.find((e) => e.id === we.exerciseId);
    if (ex && ex.metric !== 'weightReps') continue;
    for (const s of we.sets) if (s.done) v += s.weight * s.reps;
  }
  return v;
}
/** Volume of a stored session (all its sets are done). */
export const volumeOf = (s: Session, lib: Exercise[]) => sessionVolume(s.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, done: true })) })), lib);

export function bestE1rmBefore(sessions: Session[], exerciseId: string, beforeMs = Infinity): number {
  let best = 0;
  for (const s of sessions) {
    if (s.startedAt >= beforeMs) continue;
    for (const we of s.exercises) {
      if (we.exerciseId !== exerciseId) continue;
      for (const st of we.sets) best = Math.max(best, e1rm(st.weight, st.reps));
    }
  }
  return best;
}

export type Range = '4W' | '3M' | '6M' | '1Y';
export const RANGES: Range[] = ['4W', '3M', '6M', '1Y'];
export const RANGE_DAYS: Record<Range, number> = { '4W': 28, '3M': 91, '6M': 182, '1Y': 365 };

export function inRange<T extends { date: string }>(items: T[], range: Range, today = todayISO()): T[] {
  const from = addDays(today, -RANGE_DAYS[range] + 1);
  return items.filter((i) => i.date >= from && i.date <= today);
}
export function priorRange<T extends { date: string }>(items: T[], range: Range, today = todayISO()): T[] {
  const n = RANGE_DAYS[range];
  const from = addDays(today, -2 * n + 1);
  const to = addDays(today, -n);
  return items.filter((i) => i.date >= from && i.date <= to);
}

export interface Bucket {
  label: string;
  value: number;
}
/** Weekly buckets for 4W/3M, monthly for 6M/1Y; oldest first, current last. */
export function volumeBuckets(sessions: Session[], lib: Exercise[], range: Range, today = todayISO()): Bucket[] {
  const monthly = range === '6M' || range === '1Y';
  const buckets: Bucket[] = [];
  const keyOf = (iso: string) => (monthly ? monthStart(iso) : weekStart(iso));
  const count = monthly ? (range === '6M' ? 6 : 12) : range === '4W' ? 4 : 13;
  let cur = keyOf(today);
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    keys.unshift(cur);
    if (monthly) {
      const d = fromISO(cur);
      d.setMonth(d.getMonth() - 1);
      cur = keyOf(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    } else cur = addDays(cur, -7);
  }
  const sums = new Map(keys.map((k) => [k, 0]));
  for (const s of sessions) {
    const k = keyOf(s.date);
    if (sums.has(k)) sums.set(k, (sums.get(k) ?? 0) + (s.volume || volumeOf(s, lib)));
  }
  for (const k of keys) {
    const d = fromISO(k);
    buckets.push({ label: monthly ? 'JFMAMJJASOND'[d.getMonth()] : String(d.getDate()), value: sums.get(k) ?? 0 });
  }
  return buckets;
}

/** Consecutive days with a session or run, ending today (or yesterday if today is still empty). */
export function streakDays(sessions: Session[], runs: Run[], today = todayISO()): number {
  const days = new Set([...sessions.map((s) => s.date), ...runs.map((r) => r.date)]);
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function setsPerMuscle(sessions: Session[], lib: Exercise[]): Record<Muscle, number> {
  const out = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
  for (const s of sessions)
    for (const we of s.exercises) {
      const ex = lib.find((e) => e.id === we.exerciseId);
      if (ex) out[ex.muscle] += we.sets.length;
    }
  return out;
}

export interface ExPoint {
  date: string;
  e1rm: number;
  topWeight: number;
  topReps: number;
}
/** One point per session: best e1RM set of that exercise. */
export function exerciseSeries(sessions: Session[], exerciseId: string): ExPoint[] {
  const pts: ExPoint[] = [];
  for (const s of sessions) {
    const we = s.exercises.find((e) => e.exerciseId === exerciseId);
    if (!we) continue;
    let best: ExPoint | null = null;
    for (const st of we.sets) {
      const v = e1rm(st.weight, st.reps);
      if (!best || v > best.e1rm) best = { date: s.date, e1rm: v, topWeight: st.weight, topReps: st.reps };
    }
    if (best && best.e1rm > 0) pts.push(best);
  }
  return pts;
}

/** Heaviest weight lifted for at least n reps. */
export function repMax(sessions: Session[], exerciseId: string, n: number): number | null {
  let best = 0;
  for (const s of sessions)
    for (const we of s.exercises)
      if (we.exerciseId === exerciseId)
        for (const st of we.sets) if (st.reps >= n && st.weight > best) best = st.weight;
  return best > 0 ? best : null;
}

export interface Overload {
  weight: number; // kg, suggested next working weight
  reached: boolean;
  text: string;
}
/** Double progression: when every set of the last session hit the top rep count, add a step. */
export function overloadTip(sessions: Session[], exerciseId: string, step: number): Overload | null {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const we = sessions[i].exercises.find((e) => e.exerciseId === exerciseId);
    if (!we || !we.sets.length) continue;
    const top = Math.max(...we.sets.map((x) => x.weight));
    const working = we.sets.filter((x) => x.weight === top);
    const target = Math.max(...working.map((x) => x.reps), 8);
    const goal = target >= 8 ? target : 8;
    const reached = working.length >= 2 && working.every((x) => x.reps >= goal);
    return reached
      ? { weight: top + step, reached, text: `Every working set reached ${goal}+ reps at the last session.` }
      : { weight: top, reached, text: `Repeat the top weight until every working set reaches ${goal} reps.` };
  }
  return null;
}

export function muscleBreakdown(sessions: Session[], lib: Exercise[], muscle: Muscle) {
  const byEx = new Map<string, number>();
  let total = 0;
  for (const s of sessions)
    for (const we of s.exercises) {
      const ex = lib.find((e) => e.id === we.exerciseId);
      if (!ex || ex.muscle !== muscle) continue;
      const v = we.sets.reduce((a, x) => a + (ex.metric === 'weightReps' ? x.weight * x.reps : 0), 0);
      byEx.set(ex.name, (byEx.get(ex.name) ?? 0) + v);
      total += v;
    }
  return [...byEx.entries()]
    .map(([name, v]) => ({ name, pct: total ? (v / total) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct);
}

export function muscleWeekly(sessions: Session[], lib: Exercise[], muscle: Muscle, weeks: number, today = todayISO()): Bucket[] {
  const ws = weekStart(today);
  const out: Bucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(ws, -7 * i);
    const end = addDays(start, 6);
    let v = 0;
    for (const s of sessions) {
      if (s.date < start || s.date > end) continue;
      for (const we of s.exercises) {
        const ex = lib.find((e) => e.id === we.exerciseId);
        if (ex?.muscle === muscle && ex.metric === 'weightReps') v += we.sets.reduce((a, x) => a + x.weight * x.reps, 0);
      }
    }
    out.push({ label: String(fromISO(start).getDate()), value: v });
  }
  return out;
}

export function sessionMuscles(s: Session, lib: Exercise[]): Muscle[] {
  const seen: Muscle[] = [];
  for (const we of s.exercises) {
    const ex = lib.find((e) => e.id === we.exerciseId);
    if (ex && !seen.includes(ex.muscle)) seen.push(ex.muscle);
  }
  return seen;
}

// ---- Running --------------------------------------------------------------
export const paceOf = (r: Run) => (r.km > 0 ? r.durationSec / r.km : 0);

export function weeklyKm(runs: Run[], weeks: number, today = todayISO()): Bucket[] {
  const ws = weekStart(today);
  const out: Bucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(ws, -7 * i);
    const end = addDays(start, 6);
    out.push({
      label: String(fromISO(start).getDate()),
      value: runs.filter((r) => r.date >= start && r.date <= end).reduce((a, r) => a + r.km, 0),
    });
  }
  return out;
}

export const PB_DISTANCES = [
  { label: '1 km', km: 1 },
  { label: '5 km', km: 5 },
  { label: '10 km', km: 10 },
  { label: 'Half marathon', km: 21.0975 },
] as const;

/** Best time per distance, estimated from the average pace of any run at least that long. */
export function personalBests(runs: Run[]) {
  return PB_DISTANCES.map((d) => {
    let best: { sec: number; date: string } | null = null;
    for (const r of runs) {
      if (r.km < d.km * 0.995) continue;
      const sec = paceOf(r) * d.km;
      if (!best || sec < best.sec) best = { sec, date: r.date };
    }
    return { ...d, best };
  });
}

// ---- Editorial notes --------------------------------------------------------
export function editorialNotes(
  sessions: Session[],
  lib: Exercise[],
  range: Range,
  fmtW: (kg: number) => string,
  today = todayISO(),
): string[] {
  const notes: string[] = [];
  const cur = inRange(sessions, range, today);
  const prev = priorRange(sessions, range, today);
  const vCur = cur.reduce((a, s) => a + s.volume, 0);
  const vPrev = prev.reduce((a, s) => a + s.volume, 0);
  if (vPrev > 0 && vCur < vPrev * 0.85)
    notes.push(`Volume is down ${Math.round((1 - vCur / vPrev) * 100)}% on the previous ${range}. Fine for a deload, worth noting otherwise.`);
  else if (vPrev > 0 && vCur > vPrev * 1.1)
    notes.push(`Volume is up ${Math.round((vCur / vPrev - 1) * 100)}% on the previous ${range}.`);

  const prs = cur.reduce((a, s) => a + s.prCount, 0);
  if (prs > 0) notes.push(`${prs} new personal record${prs === 1 ? '' : 's'} in this period.`);

  // Plateau: the best of the last three sessions is no better than the three before.
  for (const ex of lib) {
    const pts = exerciseSeries(sessions, ex.id);
    if (pts.length < 6) continue;
    const last3 = Math.max(...pts.slice(-3).map((p) => p.e1rm));
    const prev3 = Math.max(...pts.slice(-6, -3).map((p) => p.e1rm));
    if (last3 <= prev3 + 1e-6) {
      notes.push(`${ex.name} has not improved in its last three sessions (e1RM ${fmtW(last3)}). Consider changing rep ranges or adding volume.`);
      break;
    }
  }

  const sets = setsPerMuscle(cur, lib);
  const weeks = RANGE_DAYS[range] / 7;
  const low = MUSCLES.filter((m) => m !== 'Cardio' && m !== 'Core').filter((m) => sets[m] / weeks < 10);
  if (cur.length && low.length)
    notes.push(`${low.slice(0, 3).join(', ')} ${low.length === 1 ? 'sits' : 'sit'} under 10 weekly sets on average.`);
  if (!notes.length) notes.push('Not enough history yet for observations. Log a few more sessions.');
  return notes;
}

export function weekSummary(sessions: Session[], runs: Run[], today = todayISO()) {
  const start = weekStart(today);
  const s = sessions.filter((x) => x.date >= start);
  const r = runs.filter((x) => x.date >= start);
  return { sessions: s.length, volume: s.reduce((a, x) => a + x.volume, 0), km: r.reduce((a, x) => a + x.km, 0) };
}

export { diffDays };
