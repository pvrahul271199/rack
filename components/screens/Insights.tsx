'use client';
import { useState } from 'react';
import { BarChart, Meter } from '@/components/charts';
import { Empty, MetaRow, Row, Screen, Section, Segmented, Stats, TextLink, Title } from '@/components/ui';
import { useApp, useFmt } from '@/components/DataContext';
import { MUSCLES } from '@/db/schema';
import { useNav } from '@/store/nav';
import { RANGES, RANGE_DAYS, editorialNotes, exerciseSeries, inRange, setsPerMuscle, streakDays, volumeBuckets, type Range } from '@/lib/stats';

export function Insights() {
  const { sessions, runs, exercises } = useApp();
  const { push } = useNav();
  const f = useFmt();
  const [range, setRange] = useState<Range>('3M');
  const cur = inRange(sessions, range);
  const v = f.vol(cur.reduce((a, s) => a + s.volume, 0));
  const buckets = volumeBuckets(sessions, exercises, range);
  const sets = setsPerMuscle(cur, exercises);
  const weeks = RANGE_DAYS[range] / 7;
  const notes = editorialNotes(sessions, exercises, range, f.wu);
  const trained = exercises.filter((e) => e.metric === 'weightReps' && exerciseSeries(sessions, e.id).length > 0);

  return (
    <Screen>
      <MetaRow left="Insights" right="§ 05" />
      <Title>{'Training *Insights.*'}</Title>
      <div className="mb-[18px] mt-2.5">
        <Segmented options={RANGES} value={range} onChange={setRange} />
      </div>
      <Stats
        items={[
          { label: 'Sessions', value: String(cur.length) },
          { label: 'Volume', value: v.value, unit: v.unit },
          { label: 'Streak', value: String(streakDays(sessions, runs)), unit: 'd' },
        ]}
      />

      {sessions.length === 0 ? (
        <Empty text="Insights appear once you log a workout. You can also load demo history from Profile → Import Archives." />
      ) : (
        <>
          <Section n="01" title="Volume Progression" />
          <BarChart data={buckets} height={130} summary={`${range === '4W' || range === '3M' ? 'Weekly' : 'Monthly'} volume, latest ${(() => { const l = f.vol(buckets[buckets.length - 1]?.value ?? 0); return `${l.value} ${l.unit}`; })()}`} />
          <p className="mt-2 text-[11.5px] text-mute">{range === '4W' || range === '3M' ? 'Weekly' : 'Monthly'} volume · current period in black</p>

          <Section n="02" title="Sets per Muscle" />
          <div className="flex flex-col gap-5">
            {MUSCLES.filter((m) => m !== 'Cardio').map((m) => (
              <Meter key={m} label={m} value={sets[m] / weeks} target={[10, 20]} onPress={() => push({ name: 'muscle', muscle: m })} />
            ))}
          </div>
          <p className="mt-3 text-[11.5px] text-mute">Average weekly sets against the 10–20 hypertrophy range. Tap a row for detail.</p>

          <Section n="03" title="Editorial Notes" />
          {notes.map((n, i) => (
            <div key={i} className="flex gap-3.5 border-b border-line py-3">
              <span className="w-[26px] font-serif text-[15px] italic text-faint">{String(i + 1).padStart(2, '0')}.</span>
              <p className="flex-1 text-[14px] leading-[21px] text-ink2">{n}</p>
            </div>
          ))}

          <Section n="04" title="Lifts" />
          {trained.slice(0, 8).map((e, i) => (
            <Row
              key={e.id}
              index={`${String(i + 1).padStart(2, '0')}.`}
              title={e.name}
              sub={`${exerciseSeries(sessions, e.id).length} sessions`}
              onPress={() => push({ name: 'exercise', id: e.id })}
              right={<span className="num text-[20px]">{f.w(exerciseSeries(sessions, e.id).slice(-1)[0].e1rm, 0)}</span>}
            />
          ))}
        </>
      )}

      <Section n="05" title="Running" />
      <TextLink label="Open running ledger →" onPress={() => push({ name: 'running' })} />
    </Screen>
  );
}
