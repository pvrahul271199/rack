/** ALL reads (useData) and writes (transactions). UI components never touch Dexie directly. */
import { useLiveQuery } from 'dexie-react-hooks';
import {
  DEFAULT_EXERCISES,
  DEFAULT_TEMPLATES,
  getDB,
  uid,
  type ActiveWorkout,
  type Exercise,
  type Run,
  type Session,
  type SetEntry,
  type Template,
  type WeightLog,
  type WorkoutExercise,
} from './schema';
import type { Unit } from '@/lib/units';
import { toISO, todayISO } from '@/lib/dates';
import { e1rm } from '@/lib/strength';
import { bestE1rmBefore, sessionVolume } from '@/lib/stats';
import type { Sample } from '@/lib/sample';

export interface Settings {
  name: string;
  unit: Unit;
  goalKg: number | null;
}
export interface Data extends Settings {
  exercises: Exercise[];
  templates: Template[];
  sessions: Session[];
  runs: Run[];
  weights: WeightLog[];
  active: ActiveWorkout | null;
}
export interface PRHit {
  exerciseName: string;
  weight: number; // kg
  reps: number;
}

const DEFAULTS: Settings = { name: 'Rahul', unit: 'kg', goalKg: null };

// ---- Reads ------------------------------------------------------------------------
/** Everything, live. The whole ledger is small and on-device, so screens just derive from it. */
export function useData(): Data | undefined {
  return useLiveQuery(async () => {
    const db = getDB();
    const [exercises, templates, sessions, runs, weights, kv] = await Promise.all([
      db.exercises.toArray(),
      db.templates.toArray(),
      db.sessions.orderBy('startedAt').toArray(),
      db.runs.orderBy('date').toArray(),
      db.weights.orderBy('date').toArray(),
      db.kv.toArray(),
    ]);
    const m = new Map(kv.map((r) => [r.key, r.value]));
    return {
      name: (m.get('name') as string) ?? DEFAULTS.name,
      unit: (m.get('unit') as Unit) ?? DEFAULTS.unit,
      goalKg: (m.get('goalKg') as number | null) ?? null,
      active: (m.get('active') as ActiveWorkout | null) ?? null,
      exercises,
      templates,
      sessions,
      runs,
      weights,
    } satisfies Data;
  }, []);
}

/** First run: default exercises and programmes. Idempotent. */
export async function ensureSeed(): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.exercises, db.templates, db.kv, async () => {
    if (await db.kv.get('seeded')) return;
    await db.exercises.bulkPut(DEFAULT_EXERCISES);
    await db.templates.bulkPut(DEFAULT_TEMPLATES);
    await db.kv.put({ key: 'seeded', value: true });
  });
}

// ---- Settings ---------------------------------------------------------------------
const setKV = (key: string, value: unknown) => getDB().kv.put({ key, value });
export const setUnit = (u: Unit) => setKV('unit', u);
export const setName = (n: string) => setKV('name', n);
export const setGoal = (kg: number | null) => setKV('goalKg', kg);

// ---- Library ----------------------------------------------------------------------
export async function addExercise(e: Omit<Exercise, 'id' | 'custom'>): Promise<Exercise> {
  const ex: Exercise = { ...e, id: uid(), custom: true };
  await getDB().exercises.put(ex);
  return ex;
}

export async function saveTemplate(t: Omit<Template, 'id'> & { id?: string }): Promise<Template> {
  const tpl: Template = { id: t.id ?? uid(), title: t.title.trim() || 'Untitled', items: t.items };
  await getDB().templates.put(tpl);
  return tpl;
}
export const deleteTemplate = (id: string) => getDB().templates.delete(id);

// ---- Active workout ----------------------------------------------------------------
async function readActive(): Promise<ActiveWorkout | null> {
  return ((await getDB().kv.get('active'))?.value as ActiveWorkout | null) ?? null;
}
const writeActive = (a: ActiveWorkout | null) => setKV('active', a);

/** Read-modify-write the active workout in one transaction. */
async function mutateActive(fn: (a: ActiveWorkout) => ActiveWorkout): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.kv, async () => {
    const a = await readActive();
    if (a) await writeActive(fn(a));
  });
}

const newSet = (weight = 0, reps = 0): SetEntry => ({ id: uid(), weight, reps, done: false });

/** Sets from the most recent session containing this exercise. */
export function lastSets(sessions: Session[], exerciseId: string): SetEntry[] | null {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const we = sessions[i].exercises.find((e) => e.exerciseId === exerciseId);
    if (we?.sets.length) return we.sets;
  }
  return null;
}

export const startWorkout = (title: string, exercises: WorkoutExercise[], templateId?: string) =>
  writeActive({ title, startedAt: Date.now(), exercises, templateId });
export const startEmpty = () => startWorkout('Workout', []);
export const discardWorkout = () => writeActive(null);

export async function startFromTemplate(id: string): Promise<void> {
  const db = getDB();
  const tpl = await db.templates.get(id);
  if (!tpl) return;
  const sessions = await db.sessions.orderBy('startedAt').toArray();
  const exercises = tpl.items.map((it) => {
    const last = lastSets(sessions, it.exerciseId);
    return {
      exerciseId: it.exerciseId,
      sets: Array.from({ length: it.sets }, (_, i) => newSet(last?.[i]?.weight ?? last?.[last.length - 1]?.weight ?? 0, it.reps)),
    };
  });
  await startWorkout(tpl.title, exercises, tpl.id);
}

export async function startFromSession(id: string): Promise<void> {
  const src = await getDB().sessions.get(id);
  if (!src) return;
  await startWorkout(
    src.title,
    src.exercises.map((we) => ({ exerciseId: we.exerciseId, sets: we.sets.map((st) => newSet(st.weight, st.reps)) })),
  );
}

export async function addToWorkout(exerciseId: string): Promise<void> {
  const db = getDB();
  const sessions = await db.sessions.orderBy('startedAt').toArray();
  await mutateActive((a) => {
    if (a.exercises.some((e) => e.exerciseId === exerciseId)) return a;
    const last = lastSets(sessions, exerciseId);
    const sets = last?.length ? last.map((x) => newSet(x.weight, x.reps)) : [newSet(), newSet(), newSet()];
    return { ...a, exercises: [...a.exercises, { exerciseId, sets }] };
  });
}

export const removeFromWorkout = (exerciseId: string) =>
  mutateActive((a) => ({ ...a, exercises: a.exercises.filter((e) => e.exerciseId !== exerciseId) }));

export const addSet = (exerciseId: string) =>
  mutateActive((a) => ({
    ...a,
    exercises: a.exercises.map((e) => {
      if (e.exerciseId !== exerciseId) return e;
      const prev = e.sets[e.sets.length - 1];
      return { ...e, sets: [...e.sets, newSet(prev?.weight ?? 0, prev?.reps ?? 0)] };
    }),
  }));

export const patchSet = (exerciseId: string, setId: string, patch: Partial<SetEntry>) =>
  mutateActive((a) => ({
    ...a,
    exercises: a.exercises.map((e) =>
      e.exerciseId !== exerciseId ? e : { ...e, sets: e.sets.map((st) => (st.id === setId ? { ...st, ...patch } : st)) },
    ),
  }));

/** Toggle a set. Returns a PR if completing it beat every earlier lift of that exercise. */
export async function toggleSet(exerciseId: string, setId: string): Promise<PRHit | null> {
  const db = getDB();
  return db.transaction('rw', db.kv, db.sessions, db.exercises, async () => {
    const a = await readActive();
    const we = a?.exercises.find((e) => e.exerciseId === exerciseId);
    const st = we?.sets.find((x) => x.id === setId);
    if (!a || !we || !st) return null;
    const done = !st.done;
    await writeActive({
      ...a,
      exercises: a.exercises.map((e) =>
        e.exerciseId !== exerciseId ? e : { ...e, sets: e.sets.map((x) => (x.id === setId ? { ...x, done } : x)) },
      ),
    });
    const ex = await db.exercises.get(exerciseId);
    if (!done || !ex || ex.metric !== 'weightReps' || st.weight <= 0 || st.reps <= 0) return null;
    const history = bestE1rmBefore(await db.sessions.toArray(), exerciseId);
    // Earlier sets of this same workout count too, so the toast fires once per record.
    const inSession = we.sets.filter((x) => x.done && x.id !== setId).reduce((m, x) => Math.max(m, e1rm(x.weight, x.reps)), 0);
    const mine = e1rm(st.weight, st.reps);
    if (history > 0 && mine > history + 1e-6 && mine > inSession + 1e-6) return { exerciseName: ex.name, weight: st.weight, reps: st.reps };
    return null;
  });
}

export async function workoutAsTemplate(title?: string): Promise<Template | null> {
  const a = await readActive();
  if (!a || !a.exercises.length) return null;
  return saveTemplate({
    title: title || a.title,
    items: a.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      sets: Math.max(1, e.sets.length),
      reps: Math.max(1, Math.round(e.sets.reduce((m, x) => Math.max(m, x.reps), 0)) || 8),
    })),
  });
}

/** Saves completed sets as a Session and clears the active workout. Returns null if nothing was ticked. */
export async function finishWorkout(durationSec: number): Promise<Session | null> {
  const db = getDB();
  return db.transaction('rw', db.kv, db.sessions, db.exercises, async () => {
    const a = await readActive();
    if (!a) return null;
    await writeActive(null);
    const exercises = a.exercises.map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) })).filter((e) => e.sets.length > 0);
    if (!exercises.length) return null;
    const lib = await db.exercises.toArray();
    const prior = await db.sessions.toArray();
    const prSetIds: string[] = [];
    for (const we of exercises) {
      const ex = lib.find((e) => e.id === we.exerciseId);
      if (!ex || ex.metric !== 'weightReps') continue;
      let best = bestE1rmBefore(prior, we.exerciseId);
      if (best <= 0) continue;
      for (const st of we.sets) {
        const v = e1rm(st.weight, st.reps);
        if (v > best + 1e-6) {
          best = v;
          prSetIds.push(st.id);
        }
      }
    }
    const session: Session = {
      id: uid(),
      title: a.title,
      date: toISO(new Date(a.startedAt)),
      startedAt: a.startedAt,
      durationSec,
      exercises,
      volume: sessionVolume(exercises, lib),
      prCount: prSetIds.length,
      prSetIds,
    };
    await db.sessions.put(session);
    return session;
  });
}

// ---- Runs / body / import -------------------------------------------------------------
export const addRun = (r: Omit<Run, 'id'>) => getDB().runs.put({ ...r, id: uid() });
export const logWeight = (kg: number, date = todayISO()) => getDB().weights.put({ date, kg });

export async function importBatch(b: { sessions?: Session[]; runs?: Run[]; weights?: WeightLog[]; exercises?: Exercise[] }): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.exercises, db.sessions, db.runs, db.weights, async () => {
    if (b.exercises?.length) await db.exercises.bulkPut(b.exercises);
    const sKey = new Set((await db.sessions.toArray()).map((x) => `${x.startedAt}|${x.title}`));
    const rKey = new Set((await db.runs.toArray()).map((x) => `${x.date}|${x.km}|${x.durationSec}`));
    await db.sessions.bulkPut((b.sessions ?? []).filter((x) => !sKey.has(`${x.startedAt}|${x.title}`)));
    await db.runs.bulkPut((b.runs ?? []).filter((x) => !rKey.has(`${x.date}|${x.km}|${x.durationSec}`)));
    await db.weights.bulkPut(b.weights ?? []);
  });
}

export async function loadSample(s: Sample): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.sessions, db.runs, db.weights, db.kv, async () => {
    await Promise.all([db.sessions.clear(), db.runs.clear(), db.weights.clear()]);
    await db.sessions.bulkPut(s.sessions);
    await db.runs.bulkPut(s.runs);
    await db.weights.bulkPut(s.weights);
    await setKV('goalKg', 76);
  });
}

export async function clearHistory(): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.sessions, db.runs, db.weights, db.kv, async () => {
    await Promise.all([db.sessions.clear(), db.runs.clear(), db.weights.clear()]);
    await writeActive(null);
  });
}
