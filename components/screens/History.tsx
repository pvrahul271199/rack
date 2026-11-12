'use client';
import { useMemo, useState } from 'react';
import { Btn, Empty, MetaRow, Rule, Screen, Section, Segmented, Title } from '@/components/ui';
import { useApp, useFmt } from '@/components/DataContext';
import { startFromSession } from '@/db/queries';
import { useNav } from '@/store/nav';
import { DAY_NAMES, MONTH_NAMES, addDays, daysInMonth, fromISO, toISO, todayISO } from '@/lib/dates';
import { sessionMuscles } from '@/lib/stats';
import { fmtClock, fmtDuration, fmtKm, fmtPace } from '@/lib/units';

const FILTERS = ['ALL', 'LIFTS', 'RUNS'] as const;
type Filter = (typeof FILTERS)[number];

export function History() {
  const { sessions, runs, exercises } = useApp();
  const { push } = useNav();
  const f = useFmt();
  const today = todayISO();
  const [month, setMonth] = useState(() => {
    const d = fromISO(today);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');

  const shift = (n: number) =>
    setMonth(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const maxVol = Math.max(...sessions.map((s) => s.volume), 1);
  const liftByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) map.set(s.date, (map.get(s.date) ?? 0) + s.volume);
    return map;
  }, [sessions]);
  const runDays = useMemo(() => new Set(runs.map((r) => r.date)), [runs]);

  const first = toISO(new Date(month.y, month.m, 1));
  const lead = (fromISO(first).getDay() + 6) % 7;
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth(month.y, month.m) }, (_, i) => addDays(first, i))];
  while (cells.length % 7) cells.push(null);

  const prefix = `${month.y}-${String(month.m + 1).padStart(2, '0')}`;
  type Item = { key: string; date: string; kind: 'lift' | 'run'; sortKey: number };
  const feed: Item[] = [
    ...(filter !== 'RUNS' ? sessions.map((s) => ({ key: s.id, date: s.date, kind: 'lift' as const, sortKey: s.startedAt })) : []),
    ...(filter !== 'LIFTS' ? runs.map((r) => ({ key: r.id, date: r.date, kind: 'run' as const, sortKey: fromISO(r.date).getTime() })) : []),
  ]
    .filter((i) => (selected ? i.date === selected : i.date.startsWith(prefix)))
    .sort((a, b) => b.sortKey - a.sortKey);

  return (
    <Screen>
      <MetaRow left="Archive" right="§ 09" />
      <Title>{'Training *Archive.*'}</Title>

      <div className="mb-2.5 mt-3.5 flex items-center justify-between">
        <button className="bare px-2 text-[18px] font-medium" onClick={() => shift(-1)} aria-label="Previous month">←</button>
        <span className="font-serif text-[22px] italic">{`${MONTH_NAMES[month.m]} ${month.y}`}</span>
        <button className="bare px-2 text-[18px] font-medium" onClick={() => shift(1)} aria-label="Next month">→</button>
      </div>

      <div className="grid grid-cols-7">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="pb-1.5 text-center text-[9.5px] font-semibold tracking-[0.1em] text-faint">{d}</div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} className="aspect-square" />;
          const vol = liftByDay.get(iso);
          const run = runDays.has(iso);
          const lifted = vol != null;
          const alpha = lifted ? 0.3 + 0.6 * Math.min(1, vol / maxVol) : 0;
          const sel = selected === iso;
          const dark = lifted && alpha > 0.55;
          return (
            <div key={i} className="aspect-square p-[1.5px]">
              <button
                onClick={() => setSelected(sel ? null : iso)}
                aria-pressed={sel}
                aria-label={`${iso}${lifted ? ', lifted' : ''}${run ? ', ran' : ''}`}
                className="bare relative flex h-full w-full items-center justify-center text-[12px] font-medium tabular-nums"
                style={{
                  background: lifted ? `rgba(10,10,10,${alpha.toFixed(2)})` : '#FAF9F7',
                  boxShadow: run ? 'inset 0 0 0 1.5px #0A0A0A' : sel ? 'inset 0 0 0 1px #0A0A0A' : 'none',
                  color: dark ? '#fff' : iso === today ? '#0A0A0A' : '#7A7A7A',
                }}
              >
                {fromISO(iso).getDate()}
                {sel && <span className="absolute bottom-[3px] h-0.5 w-2.5" style={{ background: dark ? '#fff' : '#0A0A0A' }} />}
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center gap-4 text-[11px] font-medium text-mute">
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3" style={{ background: 'rgba(10,10,10,0.6)' }} />Lift</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3" style={{ boxShadow: 'inset 0 0 0 1.5px #0A0A0A' }} />Run</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 border border-line bg-rest" />Rest</span>
      </div>

      <Section
        n="01"
        title={selected ? `${fromISO(selected).getDate()} ${MONTH_NAMES[fromISO(selected).getMonth()].slice(0, 3)}` : 'This Month'}
        action={selected ? 'Show month' : undefined}
        onAction={() => setSelected(null)}
      />
      <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      <div className="mt-1.5">
        {feed.length === 0 && <Empty text={selected ? 'Nothing logged on this day.' : 'Nothing logged this month.'} />}
        {feed.map((it) => {
          const d = fromISO(it.date);
          const dow = DAY_NAMES[d.getDay()].slice(0, 3);
          if (it.kind === 'lift') {
            const s = sessions.find((x) => x.id === it.key)!;
            const v = f.vol(s.volume);
            return (
              <FeedRow
                key={it.key}
                day={d.getDate()}
                dow={dow}
                title={s.title}
                sub={`${fmtDuration(s.durationSec)} · ${v.value} ${v.unit}${s.prCount ? ` · ★ ${s.prCount} PR` : ''}`}
                tags={sessionMuscles(s, exercises).join(' · ')}
                onPress={() => push({ name: 'session', id: s.id })}
              />
            );
          }
          const r = runs.find((x) => x.id === it.key)!;
          return <FeedRow key={it.key} day={d.getDate()} dow={dow} title={`Run · ${fmtKm(r.km)} km`} sub={`${fmtClock(r.durationSec)} · ${fmtPace(r.durationSec / r.km)} /km`} tags="Cardio" />;
        })}
      </div>
    </Screen>
  );
}

function FeedRow({ day, dow, title, sub, tags, onPress }: { day: number; dow: string; title: string; sub: string; tags: string; onPress?: () => void }) {
  return (
    <div
      role={onPress ? 'button' : undefined}
      tabIndex={onPress ? 0 : undefined}
      onClick={onPress}
      onKeyDown={onPress ? (e) => e.key === 'Enter' && onPress() : undefined}
      className={`flex gap-4 border-b border-line py-4 ${onPress ? 'cursor-pointer active:bg-soft' : ''}`}
    >
      <div className="w-14">
        <div className="num text-[34px] leading-[34px]">{day}</div>
        <div className="font-serif text-[14px] italic text-mute">{dow}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium">{title}</div>
        <div className="mt-[3px] text-[12.5px] text-mute">{sub}</div>
        <div className="mt-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-faint">{tags}</div>
      </div>
    </div>
  );
}

export function SessionDetail({ id }: { id: string }) {
  const { back, openWorkout } = useNav();
  const { sessions, exercises, active } = useApp();
  const f = useFmt();
  const s = sessions.find((x) => x.id === id);
  if (!s)
    return (
      <Screen>
        <MetaRow left="Session" onBack={back} />
        <Empty text="Session not found." />
      </Screen>
    );
  const v = f.vol(s.volume);
  const d = fromISO(s.date);
  const sets = s.exercises.reduce((a, e) => a + e.sets.length, 0);
  const words = s.title.split(' ');
  return (
    <Screen>
      <MetaRow left={`${DAY_NAMES[d.getDay()]} · ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`.toUpperCase()} right="§ 10" onBack={back} />
      <Title>{words.length > 1 ? `${words.slice(0, -1).join(' ')} *${words[words.length - 1]}.*` : `*${s.title}.*`}</Title>
      <p className="mb-4 text-[13px] text-mute">{`${fmtDuration(s.durationSec)} · ${v.value} ${v.unit} · ${sets} sets`}</p>

      {s.exercises.map((we, i) => {
        const ex = exercises.find((e) => e.id === we.exerciseId);
        const wr = ex?.metric === 'weightReps';
        return (
          <section key={we.exerciseId} className="mt-[22px]">
            <Rule ink />
            <div className="mt-2.5 flex items-baseline gap-3">
              <span className="font-serif text-[15px] italic text-faint">{String(i + 1).padStart(2, '0')}.</span>
              <h2 className="flex-1 font-serif text-[24px] font-normal">{ex?.name ?? 'Exercise'}</h2>
            </div>
            <div className="mt-2.5">
              {we.sets.map((st, j) => (
                <div key={st.id} className="flex items-center border-t border-line py-2">
                  <span className="w-[34px] font-serif text-[16px] italic text-mute">{String(j + 1).padStart(2, '0')}</span>
                  <span className="num flex-1 text-[24px]">{wr ? `${f.w(st.weight)} ${f.unit} × ${st.reps}` : `${st.reps} ${ex?.metric === 'time' ? 'sec' : 'm'}`}</span>
                  {s.prSetIds.includes(st.id) && <span className="border border-ink px-[7px] py-[3px] text-[9.5px] font-semibold tracking-[0.1em]">★ RECORD</span>}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div className="mt-[30px]">
        <Btn
          label={active ? 'Repeat (replaces active)' : 'Repeat Session'}
          onPress={async () => {
            await startFromSession(s.id);
            openWorkout();
          }}
        />
      </div>
    </Screen>
  );
}
