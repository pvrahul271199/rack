import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { RepDB, setDB, getDB } from '@/db/schema';
import { addToWorkout, ensureSeed, finishWorkout, patchSet, startEmpty, toggleSet } from '@/db/queries';

let n = 0;
beforeEach(async () => {
  setDB(new RepDB(`t${n++}`));
  await ensureSeed();
});

async function setupSet(weight: number, reps: number) {
  await startEmpty();
  await addToWorkout('bench');
  const a = (await getDB().kv.get('active'))!.value as { exercises: { sets: { id: string }[] }[] };
  const id = a.exercises[0].sets[0].id;
  await patchSet('bench', id, { weight, reps });
  return id;
}

describe('workout flow', () => {
  it('seeds once', async () => {
    await ensureSeed();
    expect(await getDB().exercises.count()).toBeGreaterThan(20);
    expect(await getDB().templates.count()).toBe(3);
  });
  it('first ever lift is not a PR; a heavier later one is', async () => {
    let id = await setupSet(60, 8);
    expect(await toggleSet('bench', id)).toBeNull();
    const s1 = await finishWorkout(600);
    expect(s1?.volume).toBe(480);
    expect(s1?.prCount).toBe(0);

    id = await setupSet(70, 8);
    const pr = await toggleSet('bench', id);
    expect(pr).toMatchObject({ exerciseName: 'Bench Press', weight: 70, reps: 8 });
    const s2 = await finishWorkout(600);
    expect(s2?.prCount).toBe(1);
    expect(s2?.prSetIds).toContain(id);
  });
  it('finishing with no completed sets saves nothing and clears active', async () => {
    await setupSet(60, 8);
    expect(await finishWorkout(10)).toBeNull();
    expect(await getDB().sessions.count()).toBe(0);
    expect((await getDB().kv.get('active'))?.value).toBeNull();
  });
});
