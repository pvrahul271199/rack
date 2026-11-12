export const MUSCLES = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'] as const;
export type Muscle = (typeof MUSCLES)[number];
export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight'] as const;
export type Equipment = (typeof EQUIPMENT)[number];
export type Metric = 'weightReps' | 'time' | 'distance';
export const METRIC_LABEL: Record<Metric, string> = {
  weightReps: 'Weight × Reps',
  time: 'Time',
  distance: 'Distance',
};

export interface Exercise {
  id: string;
  name: string;
  muscle: Muscle;
  equipment: Equipment;
  metric: Metric;
  custom?: boolean;
}

/** Weight is stored in kg. For `time` metric `reps` holds seconds; for `distance` it holds metres. */
export interface SetEntry {
  id: string;
  weight: number;
  reps: number;
  done: boolean;
}
export interface WorkoutExercise {
  exerciseId: string;
  sets: SetEntry[];
}

export interface Session {
  id: string;
  title: string;
  date: string; // yyyy-mm-dd
  startedAt: number;
  durationSec: number;
  exercises: WorkoutExercise[]; // done sets only
  volume: number; // kg
  prCount: number;
  prSetIds: string[];
}

export interface ActiveWorkout {
  title: string;
  startedAt: number;
  templateId?: string;
  exercises: WorkoutExercise[];
}

export interface Run {
  id: string;
  date: string;
  km: number;
  durationSec: number;
  source: 'manual' | 'strava' | 'apple' | 'gpx' | 'tcx' | 'sample';
}

export interface WeightLog {
  date: string;
  kg: number;
}

export interface TemplateItem {
  exerciseId: string;
  sets: number;
  reps: number;
}
export interface Template {
  id: string;
  title: string;
  items: TemplateItem[];
  builtin?: boolean;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const DEFAULT_EXERCISES: Exercise[] = [
  ['bench', 'Bench Press', 'Chest', 'Barbell'],
  ['incline-db', 'Incline Dumbbell Press', 'Chest', 'Dumbbell'],
  ['cable-fly', 'Cable Fly', 'Chest', 'Cable'],
  ['pushup', 'Push-up', 'Chest', 'Bodyweight'],
  ['row', 'Barbell Row', 'Back', 'Barbell'],
  ['pullup', 'Pull-up', 'Back', 'Bodyweight'],
  ['lat-pd', 'Lat Pulldown', 'Back', 'Cable'],
  ['deadlift', 'Deadlift', 'Back', 'Barbell'],
  ['squat', 'Back Squat', 'Legs', 'Barbell'],
  ['rdl', 'Romanian Deadlift', 'Legs', 'Barbell'],
  ['leg-press', 'Leg Press', 'Legs', 'Machine'],
  ['lunge', 'Walking Lunge', 'Legs', 'Dumbbell'],
  ['ohp', 'Overhead Press', 'Shoulders', 'Barbell'],
  ['lat-raise', 'Lateral Raise', 'Shoulders', 'Dumbbell'],
  ['face-pull', 'Face Pull', 'Shoulders', 'Cable'],
  ['curl', 'Barbell Curl', 'Arms', 'Barbell'],
  ['hammer', 'Hammer Curl', 'Arms', 'Dumbbell'],
  ['pushdown', 'Triceps Pushdown', 'Arms', 'Cable'],
  ['dip', 'Dip', 'Arms', 'Bodyweight'],
  ['plank', 'Plank', 'Core', 'Bodyweight'],
  ['cable-crunch', 'Cable Crunch', 'Core', 'Cable'],
  ['leg-raise', 'Hanging Leg Raise', 'Core', 'Bodyweight'],
  ['row-erg', 'Rowing Erg', 'Cardio', 'Machine'],
].map(([id, name, muscle, equipment]) => ({
  id,
  name,
  muscle,
  equipment,
  metric: id === 'plank' ? 'time' : id === 'row-erg' ? 'distance' : 'weightReps',
})) as Exercise[];

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'tpl-push',
    title: 'Push Day',
    builtin: true,
    items: [
      { exerciseId: 'bench', sets: 4, reps: 8 },
      { exerciseId: 'ohp', sets: 3, reps: 8 },
      { exerciseId: 'incline-db', sets: 3, reps: 10 },
      { exerciseId: 'lat-raise', sets: 3, reps: 12 },
      { exerciseId: 'pushdown', sets: 3, reps: 12 },
    ],
  },
  {
    id: 'tpl-pull',
    title: 'Pull Day',
    builtin: true,
    items: [
      { exerciseId: 'deadlift', sets: 3, reps: 5 },
      { exerciseId: 'row', sets: 4, reps: 8 },
      { exerciseId: 'pullup', sets: 3, reps: 8 },
      { exerciseId: 'face-pull', sets: 3, reps: 15 },
      { exerciseId: 'curl', sets: 3, reps: 10 },
    ],
  },
  {
    id: 'tpl-legs',
    title: 'Leg Day',
    builtin: true,
    items: [
      { exerciseId: 'squat', sets: 4, reps: 6 },
      { exerciseId: 'rdl', sets: 3, reps: 8 },
      { exerciseId: 'leg-press', sets: 3, reps: 10 },
      { exerciseId: 'lunge', sets: 3, reps: 12 },
      { exerciseId: 'leg-raise', sets: 3, reps: 12 },
    ],
  },
];

// ---- Dexie ------------------------------------------------------------------------
import Dexie, { type Table } from 'dexie';

export interface KV {
  key: string;
  value: unknown;
}

export const SCHEMA_VERSION = 1;

export class RepDB extends Dexie {
  exercises!: Table<Exercise, string>;
  templates!: Table<Template, string>;
  sessions!: Table<Session, string>;
  runs!: Table<Run, string>;
  weights!: Table<WeightLog, string>;
  kv!: Table<KV, string>;

  constructor(name: string) {
    super(name);
    // Never edit a shipped version in place: add this.version(N+1) and bump SCHEMA_VERSION.
    this.version(1).stores({
      exercises: 'id, muscle',
      templates: 'id',
      sessions: 'id, date, startedAt',
      runs: 'id, date',
      weights: 'date',
      kv: 'key',
    });
  }
}

let db: RepDB | null = null;
export function getDB(): RepDB {
  if (!db) db = new RepDB('rep');
  return db;
}
/** Tests swap in a throwaway DB. */
export function setDB(next: RepDB | null) {
  db = next;
}
