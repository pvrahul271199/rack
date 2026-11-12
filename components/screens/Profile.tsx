'use client';
import { useState } from 'react';
import { LineChart } from '@/components/charts';
import { Btn, Empty, Hero, MetaRow, Row, Screen, Section, Segmented, Stats, Title } from '@/components/ui';
import { useApp, useFmt } from '@/components/DataContext';
import { logWeight, setUnit } from '@/db/queries';
import { useNav } from '@/store/nav';
import { fromISO, monthShort, todayISO } from '@/lib/dates';
import { streakDays } from '@/lib/stats';
import { fmtKm, type Unit } from '@/lib/units';

const dShort = (iso: string) => `${fromISO(iso).getDate()} ${monthShort(iso)}`;
const Arrow = () => <span className="text-[18px] text-mute">→</span>;

export function Profile() {
  const { name, sessions, runs, weights, goalKg } = useApp();
  const { push } = useNav();
  const f = useFmt();
  const [scrub, setScrub] = useState<number | null>(null);
  const km = runs.reduce((a, r) => a + r.km, 0);
  const recent = weights.slice(-30);
  const shown = recent[Math.min(scrub ?? recent.length - 1, recent.length - 1)];
  const latest = weights[weights.length - 1];
  const toGoal = latest && goalKg != null ? latest.kg - goalKg : null;

  return (
    <Screen>
      <MetaRow left="Member Dossier" right="§ 11" />
      <Title>{`${name}’s *Dossier.*`}</Title>
      <div className="mt-2.5">
        <Stats
          items={[
            { label: 'Sessions', value: String(sessions.length) },
            { label: 'Run', value: String(Math.round(km)), unit: 'km' },
            { label: 'Streak', value: String(streakDays(sessions, runs)), unit: 'd' },
          ]}
        />
      </div>

      <Section n="01" title="Body Mass" action="+ Weigh in" onAction={() => push({ name: 'weighIn' })} />
      {recent.length === 0 ? (
        <Empty text="No weigh-ins yet. Add one to start the trend line." />
      ) : (
        <>
          <Hero value={f.w(shown.kg)} unit={f.unit} />
          <p className="mt-2 text-[12.5px] font-medium text-mute">
            {scrub != null
              ? dShort(shown.date)
              : toGoal != null
                ? Math.abs(toGoal) < 0.05
                  ? 'At goal'
                  : `${f.w(Math.abs(toGoal))} ${f.unit} ${toGoal > 0 ? 'above' : 'below'} goal of ${f.wu(goalKg!)}`
                : `Latest · ${dShort(latest.date)}`}
          </p>
          {recent.length > 1 && (
            <div className="mt-[18px]">
              <LineChart values={recent.map((w) => w.kg)} labels={[dShort(recent[0].date), dShort(recent[recent.length - 1].date)]} onScrub={setScrub} height={150} />
            </div>
          )}
        </>
      )}

      <Section n="02" title="Preferences" />
      <div className="py-3">
        <div className="mb-2 text-[10px] font-semibold tracking-[0.1em] text-mute">WEIGHT UNIT</div>
        <Segmented options={['KG', 'LB'] as const} value={f.unit === 'kg' ? 'KG' : 'LB'} onChange={(u) => void setUnit(u.toLowerCase() as Unit)} />
      </div>
      <Row title="Import Archives" sub="Strava, Apple Health, GPX / TCX, Strong & Hevy" onPress={() => push({ name: 'import' })} right={<Arrow />} />
      <Row title="Running Ledger" sub="Distance, pace and personal bests" onPress={() => push({ name: 'running' })} right={<Arrow />} />
    </Screen>
  );
}

export function WeighIn() {
  const { back } = useNav();
  const { weights } = useApp();
  const f = useFmt();
  const latest = weights[weights.length - 1]?.kg ?? 80;
  // Work in display units, in 0.1 steps, so lb users aren't fighting kg rounding.
  const [v, setV] = useState(Math.round(f.disp(latest) * 10) / 10);
  const bump = (d: number) => setV((x) => Math.max(20, Math.min(500, Math.round((x + d) * 10) / 10)));
  return (
    <Screen>
      <MetaRow left="Daily Weigh-In" right="§ 12" onBack={back} />
      <Title>{'Daily *Weigh-In.*'}</Title>
      <div className="my-[30px]">
        <Hero value={v.toFixed(1)} unit={f.unit} size={84} />
      </div>
      <div className="flex gap-2">
        {[-0.5, -0.1, 0.1, 0.5].map((d) => (
          <Btn key={d} small variant="out" label={`${d > 0 ? '+' : '−'}${Math.abs(d)}`} onPress={() => bump(d)} />
        ))}
      </div>
      <p className="mt-3.5 text-[12.5px] text-mute">{weights.length ? `Last logged ${f.wu(latest)} on ${dShort(weights[weights.length - 1].date)}.` : 'First entry.'}</p>
      <div className="mt-7">
        <Btn
          label="Save Weigh-In"
          onPress={async () => {
            await logWeight(Math.round(f.parse(v) * 100) / 100, todayISO());
            back();
          }}
        />
      </div>
    </Screen>
  );
}
