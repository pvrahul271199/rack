'use client';
import { useEffect, useMemo, useState } from 'react';
import { Btn, Chips, Eyebrow, Hero, Keypad, Rule, Screen, Sheet, Stats, TextLink, tap } from '@/components/ui';
import { ExercisePicker } from './Catalogue';
import { useApp, useFmt } from '@/components/DataContext';
import { MUSCLES, type Muscle, type SetEntry } from '@/db/schema';
import { addSet, addToWorkout, discardWorkout, finishWorkout, lastSets, patchSet, removeFromWorkout, toggleSet, workoutAsTemplate } from '@/db/queries';
import { useNav } from '@/store/nav';
import { useToast } from '@/store/toast';
import type { Fmt } from '@/lib/useFmt';
import { fmtClock, fmtDuration } from '@/lib/units';
import { sessionVolume } from '@/lib/stats';

const CUSTOM = '+ Custom';
const REST_DEFAULT = 90;

type KeyTarget = { exerciseId: string; setId: string; field: 'weight' | 'reps' } | null;

function previousLabel(sets: SetEntry[] | null, f: Fmt): string | null {
  if (!sets?.length) return null;
  if (sets.every((x) => x.weight === sets[0].weight)) return `${f.w(sets[0].weight)} × ${sets.map((x) => x.reps).join(', ')}`;
  return sets.map((x) => `${f.w(x.weight)}×${x.reps}`).join(', ');
}

export function Workout() {
  const { active, exercises, sessions } = useApp();
  const { back, replace, push } = useNav();
  const toast = useToast((s) => s.show);
  const f = useFmt();

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const [key, setKey] = useState<KeyTarget>(null);
  const [picker, setPicker] = useState<{ open: boolean; muscle: Muscle | null }>({ open: false, muscle: null });
  const [finishOpen, setFinishOpen] = useState(false);
  const [restEnd, setRestEnd] = useState<number | null>(null);

  const elapsed = active ? Math.max(0, Math.floor((now - active.startedAt) / 1000)) : 0;
  const rest = restEnd ? Math.ceil((restEnd - now) / 1000) : 0;
  useEffect(() => {
    if (restEnd && now >= restEnd) setRestEnd(null);
  }, [now, restEnd]);

  const doneSets = active ? active.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0) : 0;
  const volume = active ? sessionVolume(active.exercises, exercises) : 0;
  const vol = f.vol(volume);
  const nextSetId = useMemo(() => {
    for (const e of active?.exercises ?? []) for (const x of e.sets) if (!x.done) return x.id;
    return null;
  }, [active]);

  if (!active) {
    return (
      <Screen>
        <p className="mt-10 text-[13.5px] text-mute">No active workout.</p>
        <div className="mt-5">
          <Btn label="Back" onPress={back} />
        </div>
      </Screen>
    );
  }

  const keyEntry = key ? active.exercises.find((e) => e.exerciseId === key.exerciseId)?.sets.find((x) => x.id === key.setId) : null;
  const keyEx = key ? exercises.find((e) => e.id === key.exerciseId) : null;

  const onToggle = async (exerciseId: string, setId: string) => {
    tap();
    const wasDone = active.exercises.find((e) => e.exerciseId === exerciseId)?.sets.find((x) => x.id === setId)?.done;
    setRestEnd(wasDone ? null : Date.now() + REST_DEFAULT * 1000);
    const pr = await toggleSet(exerciseId, setId);
    if (pr) toast('New Personal Record', `${f.w(pr.weight)} ${f.unit} × ${pr.reps} — PR`);
  };

  const finish = async (asTemplate: boolean) => {
    if (asTemplate) await workoutAsTemplate(active.title);
    const session = await finishWorkout(elapsed);
    setFinishOpen(false);
    setRestEnd(null);
    if (session) replace({ name: 'session', id: session.id });
    else back();
  };

  const unitLabel = (m?: string) => (m === 'time' ? 'Seconds' : m === 'distance' ? 'Metres' : 'Reps');

  return (
    <div className="relative h-full">
      <Screen bottomPad={160}>
        <button onClick={back} className="bare -ml-1 py-2 pl-1 pr-3 text-[12.5px] font-medium text-mute">
          ← Back
        </button>
        <div className="flex items-baseline justify-between border-t border-ink pt-2.5">
          <Eyebrow>{`${active.title} · ${fmtClock(elapsed)}`}</Eyebrow>
          <span className="font-serif text-[16px] italic">§ 01</span>
        </div>
        <div className="mt-4">
          <Hero value={vol.value} unit={vol.unit} />
        </div>
        <div className="mt-4 flex gap-2.5">
          <Btn
            small
            variant="out"
            label="Save Tpl"
            onPress={async () => {
              if (await workoutAsTemplate(active.title)) toast('Saved as programme', active.title);
              else toast('Nothing to save', 'Add an exercise first.');
            }}
          />
          <Btn small label="Finish" onPress={() => setFinishOpen(true)} />
        </div>

        <div className="mt-[18px]">
          <Chips
            options={[...MUSCLES, CUSTOM] as string[]}
            value={null}
            onChange={(m) => (m === CUSTOM ? push({ name: 'newExercise', addToActive: true }) : setPicker({ open: true, muscle: m as Muscle }))}
          />
        </div>

        {active.exercises.length === 0 && <p className="mt-7 text-[13.5px] leading-5 text-mute">Pick a muscle group above to add your first exercise.</p>}

        {active.exercises.map((we) => {
          const ex = exercises.find((e) => e.id === we.exerciseId);
          if (!ex) return null;
          const done = we.sets.filter((x) => x.done).length;
          const prev = previousLabel(lastSets(sessions, ex.id), f);
          const wr = ex.metric === 'weightReps';
          return (
            <section key={ex.id} className="mt-[30px]" aria-label={ex.name}>
              <Rule ink />
              <div className="mt-3 flex items-start justify-between">
                <div className="min-w-0 pr-3">
                  <h2 className="font-serif text-[24px] font-normal tracking-[-0.01em] text-ink">{ex.name}</h2>
                  <p className="mt-[3px] text-[12.5px] text-mute">{prev ? `Previous · ${prev}` : 'No previous session'}</p>
                </div>
                <span className="num font-serif text-[18px] italic text-mute">{`${done}/${we.sets.length}`}</span>
              </div>

              <div className="flex items-center px-1.5 pb-1.5 pt-4 text-[10px] font-semibold tracking-[0.1em] text-mute">
                <span className="w-[34px]">No.</span>
                <span className="flex-1">{wr ? f.unit.toUpperCase() : ''}</span>
                <span className="flex-1">{unitLabel(ex.metric).toUpperCase()}</span>
                <span className="w-[26px]" />
              </div>
              {we.sets.map((x, i) => (
                <div key={x.id} className={`flex items-center border-t border-line px-1.5 py-1 ${x.id === nextSetId ? 'bg-soft' : ''}`}>
                  <span className="w-[34px] font-serif text-[16px] italic text-mute">{String(i + 1).padStart(2, '0')}</span>
                  <button
                    className={`bare num flex-1 py-1 text-left text-[24px] ${x.weight ? 'text-ink' : 'text-faint'}`}
                    disabled={!wr}
                    aria-label={`Set ${i + 1} weight`}
                    onClick={() => setKey({ exerciseId: ex.id, setId: x.id, field: 'weight' })}
                  >
                    {wr ? (x.weight ? f.w(x.weight) : '0') : '—'}
                  </button>
                  <button
                    className={`bare num flex-1 py-1 text-left text-[24px] ${x.reps ? 'text-ink' : 'text-faint'}`}
                    aria-label={`Set ${i + 1} ${unitLabel(ex.metric).toLowerCase()}`}
                    onClick={() => setKey({ exerciseId: ex.id, setId: x.id, field: 'reps' })}
                  >
                    {x.reps || '0'}
                  </button>
                  <button
                    role="checkbox"
                    aria-checked={x.done}
                    aria-label={`Set ${i + 1} complete`}
                    onClick={() => void onToggle(ex.id, x.id)}
                    className={`bare flex h-[26px] w-[26px] items-center justify-center border border-ink ${x.done ? 'bg-ink' : ''}`}
                  >
                    {x.done && (
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                        <path d="M2.5 7.5l3 3 6-7" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
              <div className="mt-3 flex justify-between">
                <TextLink label="+ Add set" onPress={() => void addSet(ex.id)} />
                <TextLink label="Remove" className="!text-mute" onPress={() => void removeFromWorkout(ex.id)} />
              </div>
            </section>
          );
        })}

        <div className="mt-[30px]">
          <Btn variant="out" label="+ Add exercise" onPress={() => setPicker({ open: true, muscle: null })} />
        </div>
      </Screen>

      {rest > 0 && (
        <div
          className="absolute inset-x-[22px] z-30 flex items-center justify-between rounded-btn bg-ink px-[18px] py-3"
          style={{ bottom: 'calc(max(var(--safe-bottom), 10px) + 8px)' }}
          role="timer"
          aria-label="Rest timer"
        >
          <div>
            <div className="text-[9.5px] font-semibold tracking-[0.11em] text-faint">REST</div>
            <div className="num text-[30px] leading-[34px] text-white">{fmtClock(rest)}</div>
          </div>
          <div className="flex gap-[18px]">
            <button className="bare text-[12px] font-semibold uppercase tracking-[0.05em] text-white" onClick={() => setRestEnd((e) => (e ?? Date.now()) + 30000)}>
              +30s
            </button>
            <button className="bare text-[12px] font-semibold uppercase tracking-[0.05em] text-white" onClick={() => setRestEnd(null)}>
              Skip
            </button>
          </div>
        </div>
      )}

      <Keypad
        visible={!!key}
        label={key?.field === 'weight' ? `Weight · ${f.unit}` : unitLabel(keyEx?.metric)}
        unit={key?.field === 'weight' ? f.unit : keyEx?.metric === 'time' ? 'sec' : keyEx?.metric === 'distance' ? 'm' : 'reps'}
        allowDecimal={key?.field === 'weight'}
        initial={keyEntry && key ? (key.field === 'weight' ? Math.round(f.disp(keyEntry.weight) * 100) / 100 : keyEntry.reps) : 0}
        onClose={() => setKey(null)}
        onDone={(v) => {
          if (key) void patchSet(key.exerciseId, key.setId, key.field === 'weight' ? { weight: Math.round(f.parse(v) * 1e4) / 1e4 } : { reps: Math.round(v) });
          setKey(null);
        }}
      />

      <ExercisePicker
        visible={picker.open}
        muscle={picker.muscle}
        exclude={active.exercises.map((e) => e.exerciseId)}
        onClose={() => setPicker({ open: false, muscle: null })}
        onPick={(id) => {
          void addToWorkout(id);
          setPicker({ open: false, muscle: null });
        }}
        onCustom={() => {
          setPicker({ open: false, muscle: null });
          push({ name: 'newExercise', addToActive: true, muscle: picker.muscle ?? undefined });
        }}
      />

      <Sheet visible={finishOpen} onClose={() => setFinishOpen(false)}>
        <div className="px-[22px]">
          <Eyebrow>Finish workout</Eyebrow>
          <h2 className="mb-4 mt-2 font-serif text-[34px] font-normal text-ink">{active.title}</h2>
          <Stats
            items={[
              { label: 'Duration', value: fmtDuration(elapsed).replace(' min', ''), unit: elapsed < 3600 ? 'min' : '' },
              { label: 'Volume', value: vol.value, unit: vol.unit },
              { label: 'Sets', value: String(doneSets) },
            ]}
          />
          {doneSets === 0 && <p className="mt-3 text-[12.5px] text-mute">Tick off at least one set to save this session.</p>}
          <div className="mt-[22px] flex flex-col gap-2.5">
            <Btn label="Save to History" disabled={doneSets === 0} onPress={() => void finish(false)} />
            <Btn variant="out" label="Save as Programme Template" disabled={doneSets === 0} onPress={() => void finish(true)} />
          </div>
          <div className="mt-4 text-center">
            <TextLink
              label="Discard workout"
              className="!text-mute"
              onPress={async () => {
                await discardWorkout();
                setFinishOpen(false);
                back();
              }}
            />
          </div>
        </div>
      </Sheet>
    </div>
  );
}
