import { DEFAULT_TEMPLATES, type Run, type Session, type WeightLog } from '@/db/schema';
import { addDays, fromISO, todayISO } from '@/lib/dates';
import { e1rm } from '@/lib/strength';

// Deterministic pseudo-random so the demo is stable between loads.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const BASE: Record<string, number> = {
  bench: 70, ohp: 42.5, 'incline-db': 26, 'lat-raise': 10, pushdown: 30,
  deadlift: 110, row: 65, pullup: 0, 'face-pull': 25, curl: 30,
  squat: 90, rdl: 80, 'leg-press': 160, lunge: 20, 'leg-raise': 0,
};

/** ~16 weeks: Push / Pull / Legs rotation, runs on off days, weekly weigh-ins. */
export interface Sample {
  sessions: Session[];
  runs: Run[];
  weights: WeightLog[];
}
export function buildSample(today = todayISO()): Sample {
  const r = rng(7);
  const sessions: Session[] = [];
  const runs: Run[] = [];
  const weights: WeightLog[] = [];
  const weeks = 16;
  const start = addDays(today, -weeks * 7 + 1);
  // lifts: Mon/Wed/Fri rotation continues, runs Tue/Sat (+ Sun now and then)
  let rot = 0;
  let id = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(start, i);
    if (date > today) break;
    const dow = (fromISO(date).getDay() + 6) % 7; // Mon=0
    const week = Math.floor(i / 7);
    if ([0, 2, 4].includes(dow) && r() > 0.12) {
      const tpl = DEFAULT_TEMPLATES[rot++ % 3];
      const startedAt = fromISO(date).getTime() + (18 * 60 + Math.floor(r() * 90)) * 60000;
      const exercises = tpl.items.map((it) => {
        const base = (BASE[it.exerciseId] ?? 20) * (1 + week * 0.012);
        const w = Math.round((base / 2.5) * 1) * 2.5;
        return {
          exerciseId: it.exerciseId,
          sets: Array.from({ length: it.sets }, () => ({
            id: `s${id++}`,
            weight: w,
            reps: it.reps + (r() > 0.7 ? 1 : r() < 0.2 ? -1 : 0),
            done: true,
          })),
        };
      });
      const volume = exercises.reduce((a, e) => a + e.sets.reduce((b, x) => b + x.weight * x.reps, 0), 0);
      sessions.push({
        id: `sample-${i}`, title: tpl.title, date, startedAt,
        durationSec: 2700 + Math.floor(r() * 1800), exercises, volume, prCount: 0, prSetIds: [],
      });
    } else if ([1, 5].includes(dow) || (dow === 6 && r() > 0.6)) {
      const km = Math.round((4 + r() * (dow === 5 ? 9 : 4)) * 10) / 10;
      const pace = 320 + r() * 50 - week * 0.8;
      runs.push({ id: `run-${i}`, date, km, durationSec: Math.round(km * pace), source: 'sample' });
    }
    if (dow === 0) weights.push({ date, kg: Math.round((81.5 - week * 0.12 + (r() - 0.5) * 0.6) * 10) / 10 });
  }
  // Flag genuine PRs against the history before each session.
  const best: Record<string, number> = {};
  for (const s of sessions) {
    for (const we of s.exercises) {
      const prior = best[we.exerciseId] ?? 0;
      let cur = prior;
      for (const st of we.sets) {
        const v = e1rm(st.weight, st.reps);
        if (prior > 0 && v > cur + 1e-6) {
          s.prCount++;
          s.prSetIds.push(st.id);
        }
        cur = Math.max(cur, v);
      }
      best[we.exerciseId] = cur;
    }
  }
  return { sessions, runs, weights };
}
