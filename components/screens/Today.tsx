'use client';
import { Btn, Empty, MetaRow, Row, Screen, Section, Stats, TextLink, Title } from '@/components/ui';
import { useApp, useFmt } from '@/components/DataContext';
import { startEmpty, startFromTemplate } from '@/db/queries';
import { useNav } from '@/store/nav';
import { metaDate, relativeDay, todayISO } from '@/lib/dates';
import { weekSummary } from '@/lib/stats';
import { fmtKm } from '@/lib/units';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function Today() {
  const { name, sessions, runs, templates, exercises, active } = useApp();
  const { push, openWorkout } = useNav();
  const f = useFmt();
  const last = sessions[sessions.length - 1];
  const wk = weekSummary(sessions, runs);
  const vol = f.vol(wk.volume);

  return (
    <Screen>
      <MetaRow left={metaDate(todayISO())} right="§ 01" />
      <Title>{`${greeting()}, *${name}.*`}</Title>
      <p className="mb-[22px] text-[13.5px] text-mute">
        {last ? `Last session · ${last.title} · ${relativeDay(last.date)}` : 'No sessions logged yet. Start with a programme below.'}
      </p>

      <div className="flex flex-col gap-2.5">
        <Btn
          label={active ? `Resume ${active.title}` : 'Begin Workout'}
          onPress={async () => {
            if (!active) await startEmpty();
            openWorkout();
          }}
        />
        <div className="flex gap-2.5">
          <Btn variant="out" label="+ Build Template" onPress={() => push({ name: 'builder' })} />
          <Btn variant="out" label="Log a Run" onPress={() => push({ name: 'logRun' })} />
        </div>
      </div>

      <Section n="01" title="Saved Programmes" action="+ New Template" onAction={() => push({ name: 'builder' })} />
      {templates.length === 0 && <Empty text="No programmes yet. Build one, or save an active workout as a template." />}
      {templates.map((t, i) => {
        const names = t.items.map((it) => exercises.find((e) => e.id === it.exerciseId)?.name).filter(Boolean);
        return (
          <Row
            key={t.id}
            index={`${String(i + 1).padStart(2, '0')}.`}
            title={t.title}
            sub={`${names.slice(0, 3).join(' · ')}${names.length > 3 ? ` +${names.length - 3}` : ''}`}
            onPress={async () => {
              await startFromTemplate(t.id);
              openWorkout();
            }}
            right={
              <div className="flex flex-col items-end gap-1.5">
                <span className="num text-[22px] leading-none text-ink">{t.items.length}</span>
                <TextLink label="Edit" className="!text-[11px] !text-mute" onPress={() => push({ name: 'builder', templateId: t.id })} />
              </div>
            }
          />
        );
      })}

      <Section n="02" title="Weekly Ledger" />
      <Stats
        items={[
          { label: 'Sessions', value: `${wk.sessions}/5` },
          { label: 'Volume', value: vol.value, unit: vol.unit },
          { label: 'Run', value: fmtKm(wk.km), unit: 'km' },
        ]}
      />
      <div className="mt-[22px]">
        <TextLink label="Browse exercise catalogue →" onPress={() => push({ name: 'catalogue' })} />
      </div>
    </Screen>
  );
}
