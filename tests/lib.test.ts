import { describe, expect, it } from 'vitest';
import { e1rm } from '@/lib/strength';
import { fmtPace, fmtWeight, toDisplay, fromDisplay } from '@/lib/units';
import { addDays, weekStart, diffDays } from '@/lib/dates';
import { buildSample } from '@/lib/sample';
import { exerciseSeries, overloadTip, personalBests, repMax, streakDays } from '@/lib/stats';
import { parseGPX, parseStravaCSV, parseWorkoutCSV } from '@/lib/importers';
import { DEFAULT_EXERCISES } from '@/db/schema';

describe('strength + units', () => {
  it('Epley', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(80, 6)).toBeCloseTo(96);
    expect(e1rm(0, 5)).toBe(0);
  });
  it('lb round-trip', () => {
    expect(fromDisplay(toDisplay(100, 'lb'), 'lb')).toBeCloseTo(100);
    expect(fmtWeight(100, 'lb')).toBe('220.5');
  });
  it('pace', () => expect(fmtPace(342)).toBe('5:42'));
});

describe('dates', () => {
  it('week starts Monday, DST-safe diff', () => {
    expect(weekStart('2026-11-12')).toBe('2026-11-09');
    expect(diffDays('2026-11-02', '2026-10-25')).toBe(8);
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('sample + stats', () => {
  const s = buildSample('2026-11-12');
  it('builds history with PRs and runs', () => {
    expect(s.sessions.length).toBeGreaterThan(30);
    expect(s.runs.length).toBeGreaterThan(15);
    expect(s.sessions.some((x) => x.prCount > 0)).toBe(true);
  });
  it('series, rep max, overload, PBs', () => {
    expect(exerciseSeries(s.sessions, 'bench').length).toBeGreaterThan(5);
    expect(repMax(s.sessions, 'bench', 5)).toBeGreaterThan(0);
    expect(overloadTip(s.sessions, 'bench', 2.5)).not.toBeNull();
    expect(personalBests(s.runs).find((p) => p.label === '5 km')?.best).not.toBeNull();
  });
  it('streak counts back from today or yesterday', () => {
    const mk = (d: string) => ({ date: d }) as never;
    expect(streakDays([mk('2026-11-11'), mk('2026-11-10')], [], '2026-11-12')).toBe(2);
    expect(streakDays([], [], '2026-11-12')).toBe(0);
  });
});

describe('importers', () => {
  it('Hevy csv', () => {
    const csv = 'title,start_time,end_time,exercise_title,set_index,weight_kg,reps\nPush,2026-11-01 10:00:00,2026-11-01 11:00:00,Bench Press,0,80,8\nPush,2026-11-01 10:00:00,2026-11-01 11:00:00,Bench Press,1,80,6\n';
    const r = parseWorkoutCSV(csv, DEFAULT_EXERCISES);
    expect(r.sessions).toHaveLength(1);
    expect(r.sessions[0].exercises[0].sets).toHaveLength(2);
    expect(r.sessions[0].durationSec).toBe(3600);
    expect(r.exercises).toHaveLength(0);
  });
  it('Strava csv keeps runs only', () => {
    const csv = 'Activity Date,Activity Type,Elapsed Time,Distance\n"Nov 1, 2026, 7:00:00 AM",Run,1800,5.0\n"Nov 2, 2026, 7:00:00 AM",Ride,3600,20\n';
    expect(parseStravaCSV(csv).runs).toHaveLength(1);
  });
  it('GPX distance', () => {
    const gpx = `<gpx><trk><trkseg><trkpt lat="0" lon="0"><time>2026-11-01T07:00:00Z</time></trkpt><trkpt lat="0" lon="0.0449"><time>2026-11-01T07:25:00Z</time></trkpt></trkseg></trk></gpx>`;
    const r = parseGPX(gpx);
    expect(r.runs[0].km).toBeCloseTo(5, 0);
    expect(r.runs[0].durationSec).toBe(1500);
  });
});
