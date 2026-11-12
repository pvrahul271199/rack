import { uid, type Exercise, type Muscle, type Run, type Session, type WeightLog } from '@/db/schema';
import { toISO } from '@/lib/dates';

export interface ImportResult {
  sessions: Session[];
  runs: Run[];
  weights: WeightLog[];
  exercises: Exercise[];
  note: string;
}
const empty = (note: string): ImportResult => ({ sessions: [], runs: [], weights: [], exercises: [], note });

// ---- CSV ----------------------------------------------------------------------
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',' || ch === ';') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
function indexer(header: string[]) {
  const map = new Map(header.map((h, i) => [norm(h), i]));
  return (...names: string[]) => {
    for (const n of names) if (map.has(norm(n))) return map.get(norm(n))!;
    return -1;
  };
}

const MUSCLE_GUESS: [RegExp, Muscle][] = [
  [/bench|chest|fly|push.?up|pec/i, 'Chest'],
  [/row|pull|lat |deadlift|back|shrug/i, 'Back'],
  [/squat|leg|lunge|calf|glute|hip|rdl|romanian/i, 'Legs'],
  [/press|shoulder|raise|delt|face pull/i, 'Shoulders'],
  [/curl|tricep|bicep|dip|pushdown|extension/i, 'Arms'],
  [/crunch|plank|ab |core|sit.?up/i, 'Core'],
  [/run|bike|cycle|row.*erg|ski/i, 'Cardio'],
];
const guessMuscle = (n: string): Muscle => MUSCLE_GUESS.find(([re]) => re.test(n))?.[1] ?? 'Arms';
const guessEquipment = (n: string): Exercise['equipment'] =>
  /\((barbell)\)|barbell/i.test(n) ? 'Barbell' : /dumbbell/i.test(n) ? 'Dumbbell' : /cable|pulldown/i.test(n) ? 'Cable'
    : /machine|press$/i.test(n) ? 'Machine' : /bodyweight|pull.?up|push.?up|dip/i.test(n) ? 'Bodyweight' : 'Barbell';

function parseDateTime(s: string): number | null {
  const t = s.trim().replace(' ', 'T');
  const iso = /^\d{4}-\d{2}-\d{2}/.test(t) ? Date.parse(t.length === 10 ? `${t}T12:00:00` : t) : Date.parse(s);
  return isNaN(iso) ? null : iso;
}
function parseDurationSec(s: string): number {
  if (!s) return 0;
  const h = /(\d+)\s*h/.exec(s)?.[1];
  const m = /(\d+)\s*m/.exec(s)?.[1];
  const sec = /(\d+)\s*s/.exec(s)?.[1];
  if (h || m || sec) return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(sec ?? 0);
  if (/^\d+:\d{2}(:\d{2})?$/.test(s)) {
    const p = s.split(':').map(Number);
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  }
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

/** Strong (Date, Workout Name, Exercise Name, Weight, Reps…) and Hevy (title, start_time, exercise_title, weight_kg, reps…). */
export function parseWorkoutCSV(text: string, existing: Exercise[], unitHint: 'kg' | 'lb' = 'kg'): ImportResult {
  const rows = parseCSV(text);
  if (rows.length < 2) return empty('The file has no rows.');
  const col = indexer(rows[0]);
  const iDate = col('start_time', 'Date');
  const iTitle = col('title', 'Workout Name');
  const iEx = col('exercise_title', 'Exercise Name');
  const iKg = col('weight_kg');
  const iW = iKg >= 0 ? iKg : col('Weight', 'weight_lbs');
  const iLbs = col('weight_lbs');
  const iReps = col('reps', 'Reps');
  const iEnd = col('end_time');
  const iDur = col('Duration');
  if (iDate < 0 || iEx < 0 || iReps < 0 || iW < 0) return empty('This does not look like a Strong or Hevy export (missing date, exercise, weight or reps columns).');
  const lbs = iKg < 0 && (iLbs >= 0 || unitHint === 'lb');
  const byName = new Map(existing.map((e) => [e.name.toLowerCase(), e]));
  const created: Exercise[] = [];
  const groups = new Map<string, Session>();
  let n = 0;
  for (const r of rows.slice(1)) {
    const when = parseDateTime(r[iDate] ?? '');
    const exName = (r[iEx] ?? '').trim();
    const reps = Number(r[iReps]);
    let w = Number(r[iW] || 0);
    if (when == null || !exName || !(reps > 0) || isNaN(w)) continue;
    if (lbs) w = w / 2.2046226218;
    let ex = byName.get(exName.toLowerCase());
    if (!ex) {
      ex = { id: uid(), name: exName, muscle: guessMuscle(exName), equipment: guessEquipment(exName), metric: 'weightReps', custom: true };
      byName.set(exName.toLowerCase(), ex);
      created.push(ex);
    }
    const title = (r[iTitle] ?? '').trim() || 'Workout';
    const key = `${r[iDate]}|${title}`;
    let s = groups.get(key);
    if (!s) {
      let dur = iDur >= 0 ? parseDurationSec(r[iDur] ?? '') : 0;
      if (!dur && iEnd >= 0) {
        const end = parseDateTime(r[iEnd] ?? '');
        if (end) dur = Math.max(0, Math.round((end - when) / 1000));
      }
      s = { id: uid(), title, date: toISO(new Date(when)), startedAt: when, durationSec: dur, exercises: [], volume: 0, prCount: 0, prSetIds: [] };
      groups.set(key, s);
    }
    let we = s.exercises.find((e) => e.exerciseId === ex!.id);
    if (!we) s.exercises.push((we = { exerciseId: ex.id, sets: [] }));
    we.sets.push({ id: uid(), weight: Math.round(w * 100) / 100, reps, done: true });
    s.volume += w * reps;
    n++;
  }
  const sessions = [...groups.values()];
  return { sessions, runs: [], weights: [], exercises: created, note: `${sessions.length} workouts, ${n} sets${created.length ? `, ${created.length} new exercises` : ''}.` };
}

// ---- Strava bulk export (activities.csv) ----------------------------------------
export function parseStravaCSV(text: string): ImportResult {
  const rows = parseCSV(text);
  if (rows.length < 2) return empty('The file has no rows.');
  const col = indexer(rows[0]);
  const iDate = col('Activity Date');
  const iType = col('Activity Type');
  const iTime = col('Elapsed Time', 'Moving Time');
  const iDist = col('Distance');
  if (iDate < 0 || iType < 0 || iDist < 0) return empty('This does not look like Strava’s activities.csv.');
  const runs: Run[] = [];
  for (const r of rows.slice(1)) {
    if (!/run/i.test(r[iType] ?? '')) continue;
    const when = parseDateTime(r[iDate] ?? '');
    let km = Number(r[iDist]);
    const sec = Number(r[iTime]);
    if (when == null || !(km > 0) || !(sec > 0)) continue;
    if (km > 500) km /= 1000; // some exports are metres
    runs.push({ id: uid(), date: toISO(new Date(when)), km: Math.round(km * 100) / 100, durationSec: Math.round(sec), source: 'strava' });
  }
  return { ...empty(`${runs.length} runs.`), runs };
}

// ---- GPX / TCX --------------------------------------------------------------------
const hav = (a: [number, number], b: [number, number]) => {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export function parseGPX(text: string): ImportResult {
  const pts: { lat: number; lon: number; t: number }[] = [];
  const re = /<trkpt\b[^>]*?lat="([-\d.]+)"[^>]*?lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const t = /<time>([^<]+)<\/time>/.exec(m[3])?.[1];
    if (t) pts.push({ lat: Number(m[1]), lon: Number(m[2]), t: Date.parse(t) });
  }
  if (pts.length < 2) return empty('No timed track points found in the GPX file.');
  let km = 0;
  for (let i = 1; i < pts.length; i++) km += hav([pts[i - 1].lat, pts[i - 1].lon], [pts[i].lat, pts[i].lon]);
  const sec = Math.round((pts[pts.length - 1].t - pts[0].t) / 1000);
  if (!(km > 0.1) || !(sec > 0)) return empty('The track is too short to import.');
  const run: Run = { id: uid(), date: toISO(new Date(pts[0].t)), km: Math.round(km * 100) / 100, durationSec: sec, source: 'gpx' };
  return { ...empty(`1 run, ${run.km} km.`), runs: [run] };
}

export function parseTCX(text: string): ImportResult {
  const runs: Run[] = [];
  const act = /<Activity\b[^>]*Sport="([^"]*)"[^>]*>([\s\S]*?)<\/Activity>/g;
  let a: RegExpExecArray | null;
  while ((a = act.exec(text))) {
    if (!/running/i.test(a[1])) continue;
    const lap = /<Lap\b[^>]*StartTime="([^"]+)"/.exec(a[2])?.[1];
    let m = 0;
    let sec = 0;
    for (const l of a[2].matchAll(/<Lap\b[\s\S]*?<\/Lap>/g)) {
      sec += Number(/<TotalTimeSeconds>([\d.]+)</.exec(l[0])?.[1] ?? 0);
      m += Number(/<DistanceMeters>([\d.]+)</.exec(l[0])?.[1] ?? 0);
    }
    const when = lap ? Date.parse(lap) : NaN;
    if (!isNaN(when) && m > 100 && sec > 0) runs.push({ id: uid(), date: toISO(new Date(when)), km: Math.round(m / 10) / 100, durationSec: Math.round(sec), source: 'tcx' });
  }
  return { ...empty(runs.length ? `${runs.length} run${runs.length === 1 ? '' : 's'}.` : 'No running activities found in the TCX file.'), runs };
}

// ---- Apple Health export.xml (runs + body mass) ----------------------------------
export function parseAppleHealth(text: string): ImportResult {
  const runs: Run[] = [];
  const weights: WeightLog[] = [];
  for (const m of text.matchAll(/<Workout\b[^>]*workoutActivityType="HKWorkoutActivityTypeRunning"[^>]*>/g)) {
    const tag = m[0];
    const attr = (k: string) => new RegExp(`${k}="([^"]*)"`).exec(tag)?.[1];
    const dur = Number(attr('duration'));
    const unit = attr('durationUnit');
    const dist = Number(attr('totalDistance'));
    const dUnit = attr('totalDistanceUnit');
    const start = attr('startDate');
    if (!start || !(dur > 0) || !(dist > 0)) continue;
    const sec = unit === 'min' ? dur * 60 : unit === 'hr' ? dur * 3600 : dur;
    const km = dUnit === 'mi' ? dist * 1.609344 : dUnit === 'm' ? dist / 1000 : dist;
    runs.push({ id: uid(), date: start.slice(0, 10), km: Math.round(km * 100) / 100, durationSec: Math.round(sec), source: 'apple' });
  }
  for (const m of text.matchAll(/<Record\b[^>]*type="HKQuantityTypeIdentifierBodyMass"[^>]*>/g)) {
    const tag = m[0];
    const v = Number(/value="([^"]*)"/.exec(tag)?.[1]);
    const u = /unit="([^"]*)"/.exec(tag)?.[1];
    const d = /startDate="(\d{4}-\d{2}-\d{2})/.exec(tag)?.[1];
    if (d && v > 0) weights.push({ date: d, kg: Math.round((u === 'lb' ? v / 2.2046226218 : v) * 10) / 10 });
  }
  return { ...empty(`${runs.length} runs, ${weights.length} weigh-ins.`), runs, weights };
}
