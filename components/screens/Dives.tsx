'use client';
import { useState } from 'react';
import { LineChart } from '@/components/charts';
import { Btn, Empty, Hero, MetaRow, Screen, Section, Segmented, Stats, Title } from '@/components/ui';
import { useApp, useFmt } from '@/components/DataContext';
import { MUSCLES, type Muscle } from '@/db/schema';
import { addToWorkout, startEmpty } from '@/db/queries';
import { useNav } from '@/store/nav';
import { fromISO, monthShort } from '@/lib/dates';
import { RANGES, exerciseSeries, inRange, muscleBreakdown, muscleWeekly, overloadTip, repMax, type Range } from '@/lib/stats';

const dShort = (iso: string) => `${fromISO(iso).getDate()} ${monthShort(iso)}`;

export function ExerciseDive({ id }: { id: string }) {
  const { back, openWorkout } = useNav();
  const { sessions, exercises, active } = useApp();
  const f = useFmt();
  const ex = exercises.find((e) => e.id === id);
  const [range, setRange] = useState<Range>('3M');
  const [scrub, setScrub] = useState<number | null>(null);
  const all = exerciseSeries(sessions, id);
  const pts = inRange(all, range);

  if (!ex)
    return (
      <Screen>
        <MetaRow left="Exercise" onBack={back} />
        <Empty text="Exercise not found." />
      </Screen>
    );
  if (ex.metric !== 'weightReps')
    return (
      <Screen>
        <MetaRow left="Exercise Deep Dive" right="§ 06" onBack={back} />
        <Title>{`${ex.name}.`}</Title>
        <Empty text="Strength analytics use weight × reps, so they are not available for time or distance exercises." />
      </Screen>
    );

  const shownIdx = Math.min(scrub ?? pts.length - 1, pts.length - 1);
  const shown = pts[shownIdx];
  const delta = pts.length > 1 ? pts[pts.length - 1].e1rm - pts[0].e1rm : 0;
  const tip = overloadTip(sessions, id, f.step);
  const words = ex.name.split(' ');
  const title = words.length > 1 ? `${words.slice(0, -1).join(' ')} *${words[words.length - 1]}.*` : `*${ex.name}.*`;
  const rm = (n: number) => {
    const v = repMax(sessions, id, n);
    return { label: `${n} rep${n > 1 ? 's' : ''}`, value: v != null ? f.w(v, 1) : '–', unit: v != null ? f.unit : '' };
  };

  return (
    <Screen>
      <MetaRow left={`${ex.equipment} · ${ex.muscle}`} right="§ 06" onBack={back} />
      <Title>{title}</Title>
      <div className="my-3">
        <Segmented options={RANGES} value={range} onChange={(r) => { setRange(r); setScrub(null); }} />
      </div>

      {pts.length === 0 ? (
        <Empty text={all.length ? 'No sessions in this range.' : 'No logged sets for this exercise yet.'} />
      ) : (
        <>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em]">Estimated 1RM · Epley</div>
          <div className="mt-2">
            <Hero value={f.w(shown.e1rm, 0)} unit={f.unit} size={84} />
          </div>
          <p className="mt-2 text-[12.5px] font-medium text-mute">
            {delta >= 0 ? '+' : '−'}
            {f.w(Math.abs(delta), 1)} {f.unit} in period
          </p>
          <div className="mt-5">
            <LineChart values={pts.map((p) => p.e1rm)} labels={[dShort(pts[0].date), dShort(pts[pts.length - 1].date)]} onScrub={setScrub} height={170} />
          </div>
          <p className="mt-2.5 font-serif text-[20px] italic">
            {`Session ${shownIdx + 1} — ${f.w(shown.e1rm, 0)} ${f.unit}`}
            <span className="ml-3 font-sans text-[12.5px] not-italic text-mute">{`${dShort(shown.date)} · ${f.w(shown.topWeight)} × ${shown.topReps}`}</span>
          </p>
        </>
      )}

      <Section n="01" title="Repetition Maxima" />
      <Stats items={[1, 3, 5].map(rm)} />
      <div className="h-px" />
      <Stats items={[8, 10, 12].map(rm)} />

      <Section n="02" title="Progressive Overload" />
      {tip ? (
        <p className="text-[14px] leading-[21px] text-ink2">
          {tip.text} {tip.reached ? 'Next session, try ' : 'Stay at '}
          <strong className="font-semibold text-ink">{f.wu(tip.weight)}</strong>.
        </p>
      ) : (
        <Empty text="Log this lift once to get a next-weight suggestion." />
      )}

      <div className="mt-7">
        <Btn
          variant="out"
          label={active ? 'Add to active workout' : 'Start workout with this lift'}
          onPress={async () => {
            if (!active) await startEmpty();
            await addToWorkout(id);
            openWorkout();
          }}
        />
      </div>
    </Screen>
  );
}

export function MuscleDive({ muscle }: { muscle: string }) {
  const { back, push } = useNav();
  const { sessions, exercises } = useApp();
  const f = useFmt();
  const m = (MUSCLES as readonly string[]).includes(muscle) ? (muscle as Muscle) : 'Back';
  const weekly = muscleWeekly(sessions, exercises, m, 12);
  const breakdown = muscleBreakdown(inRange(sessions, '3M'), exercises, m);
  const total = weekly.reduce((a, b) => a + b.value, 0);
  const thisWeek = f.vol(weekly[weekly.length - 1].value);
  return (
    <Screen>
      <MetaRow left="Muscle Group" right="§ 07" onBack={back} />
      <Title>{`${m} *Anatomy.*`}</Title>
      {total === 0 ? (
        <Empty text={`No ${m.toLowerCase()} work in the last 12 weeks.`} />
      ) : (
        <>
          <Section n="01" title="Weekly Tonnage" />
          <div className="num text-[32px]">
            {thisWeek.value}
            <span className="ml-1 font-sans text-[10.5px] font-semibold uppercase text-mute">{thisWeek.unit} this week</span>
          </div>
          <div className="mt-3.5">
            <LineChart values={weekly.map((w) => w.value)} labels={['12 weeks ago', 'This week']} height={150} />
          </div>
          <Section n="02" title="Contribution" />
          {breakdown.map((b, i) => (
            <button
              key={b.name}
              className="bare block w-full border-b border-line py-3 text-left"
              onClick={() => {
                const ex = exercises.find((e) => e.name === b.name);
                if (ex) push({ name: 'exercise', id: ex.id });
              }}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[14.5px] font-medium">
                  <span className="mr-2 font-serif italic text-faint">{String(i + 1).padStart(2, '0')}.</span>
                  {b.name}
                </span>
                <span className="num text-[20px]">{Math.round(b.pct)}%</span>
              </div>
              <div className="mt-2 h-[3px] bg-soft">
                <div className="h-[3px] bg-ink" style={{ width: `${b.pct}%` }} />
              </div>
            </button>
          ))}
        </>
      )}
    </Screen>
  );
}
