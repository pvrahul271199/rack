'use client';
import { useState } from 'react';
import { BarChart } from '@/components/charts';
import { Btn, Empty, Keypad, MetaRow, Row, Screen, Section, Stats, Title } from '@/components/ui';
import { useApp } from '@/components/DataContext';
import { addRun } from '@/db/queries';
import { useNav } from '@/store/nav';
import { useToast } from '@/store/toast';
import { fromISO, monthShort, todayISO, weekStart } from '@/lib/dates';
import { paceOf, personalBests, weeklyKm } from '@/lib/stats';
import { fmtClock, fmtKm, fmtPace } from '@/lib/units';

export function Running() {
  const { back, push } = useNav();
  const { runs } = useApp();
  const ws = weekStart(todayISO());
  const week = runs.filter((r) => r.date >= ws);
  const km = week.reduce((a, r) => a + r.km, 0);
  const sec = week.reduce((a, r) => a + r.durationSec, 0);
  const pbs = personalBests(runs);
  const dl = (iso: string) => `${fromISO(iso).getDate()} ${monthShort(iso)} ${fromISO(iso).getFullYear()}`;
  return (
    <Screen>
      <MetaRow left="Running Ledger" right="§ 08" onBack={back} />
      <Title>{'Running *Ledger.*'}</Title>
      <div className="mt-3">
        <Stats
          items={[
            { label: 'This week', value: fmtKm(km), unit: 'km' },
            { label: 'Avg pace', value: fmtPace(km > 0 ? sec / km : 0), unit: '/km' },
            { label: 'Runs', value: String(week.length) },
          ]}
        />
      </div>
      <div className="mt-3.5">
        <Btn variant="out" label="Log a Run" onPress={() => push({ name: 'logRun' })} />
      </div>

      {runs.length === 0 ? (
        <Empty text="No runs yet. Log one, or import from Strava, Apple Health or a GPX/TCX file." />
      ) : (
        <>
          <Section n="01" title="Weekly Distance" />
          <BarChart data={weeklyKm(runs, 12)} height={120} summary="Weekly distance in kilometres" />
          <Section n="02" title="Personal Bests" />
          {pbs.map((p) => (
            <Row
              key={p.label}
              title={p.label}
              sub={p.best ? dl(p.best.date) : 'No run this long yet'}
              right={<span className={`num text-[24px] ${p.best ? 'text-ink' : 'text-faint'}`}>{p.best ? fmtClock(p.best.sec) : '–'}</span>}
            />
          ))}
          <p className="mt-2.5 text-[11.5px] leading-[17px] text-mute">Estimated from the average pace of any run at least that long.</p>
          <Section n="03" title="Recent Runs" />
          {runs.slice(-6).reverse().map((r) => (
            <Row key={r.id} title={`${fmtKm(r.km)} km`} sub={`${fromISO(r.date).getDate()} ${monthShort(r.date)} · ${fmtClock(r.durationSec)} · ${fmtPace(paceOf(r))} /km`} />
          ))}
        </>
      )}
    </Screen>
  );
}

type Pad = 'km' | 'min' | 'sec' | null;

export function LogRun() {
  const { back } = useNav();
  const toast = useToast((s) => s.show);
  const [km, setKm] = useState(5);
  const [min, setMin] = useState(30);
  const [secs, setSecs] = useState(0);
  const [pad, setPad] = useState<Pad>(null);
  const total = min * 60 + secs;
  const field = (label: string, value: string, k: Exclude<Pad, null>) => (
    <button
      onClick={() => setPad(k)}
      aria-label={label}
      className={`bare flex-1 px-3 py-3.5 text-left ${k === 'km' ? '' : 'border-l border-line'}`}
    >
      <div className="text-[10px] font-semibold tracking-[0.1em] text-mute">{label}</div>
      <div className="num mt-1.5 text-[34px] leading-none">{value}</div>
    </button>
  );
  return (
    <Screen>
      <MetaRow left="Log a Run" right="§ 08" onBack={back} />
      <h1 className="mb-1.5 mt-[18px] font-serif text-[44px] font-normal leading-[0.98] tracking-[-0.02em]">
        Log a <em>Run.</em>
      </h1>
      <div className="mt-3.5 flex border-y border-line">
        {field('DISTANCE · KM', String(km), 'km')}
        {field('MIN', String(min), 'min')}
        {field('SEC', String(secs).padStart(2, '0'), 'sec')}
      </div>
      <p className="mt-4 font-serif text-[20px] italic">{km > 0 && total > 0 ? `${fmtPace(total / km)} /km` : 'Enter distance and time'}</p>
      <div className="mt-7">
        <Btn
          label="Save Run"
          disabled={!(km > 0 && total > 0)}
          onPress={async () => {
            await addRun({ date: todayISO(), km, durationSec: total, source: 'manual' });
            toast('Run saved', `${fmtKm(km)} km · ${fmtClock(total)}`);
            back();
          }}
        />
      </div>
      <Keypad
        visible={pad != null}
        label={pad === 'km' ? 'Distance · km' : pad === 'min' ? 'Minutes' : 'Seconds'}
        unit={pad === 'km' ? 'km' : pad === 'min' ? 'min' : 'sec'}
        allowDecimal={pad === 'km'}
        initial={pad === 'km' ? km : pad === 'min' ? min : secs}
        onClose={() => setPad(null)}
        onDone={(v) => {
          if (pad === 'km') setKm(Math.min(v, 500));
          else if (pad === 'min') setMin(Math.min(Math.round(v), 999));
          else setSecs(Math.min(Math.round(v), 59));
          setPad(null);
        }}
      />
    </Screen>
  );
}
