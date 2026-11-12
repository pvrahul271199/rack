'use client';
import { useState } from 'react';
import { Btn, Empty, MetaRow, Screen, Section, Stepper, TextLink } from '@/components/ui';
import { ExerciseList } from './ExerciseList';
import { useApp } from '@/components/DataContext';
import { uid, type TemplateItem } from '@/db/schema';
import { deleteTemplate, saveTemplate, startFromTemplate } from '@/db/queries';
import { useNav } from '@/store/nav';
import { useToast } from '@/store/toast';

export function Builder({ templateId }: { templateId?: string }) {
  const { back, openWorkout } = useNav();
  const { templates, exercises } = useApp();
  const toast = useToast((s) => s.show);
  const existing = templates.find((t) => t.id === templateId);
  const [id] = useState(existing?.id ?? uid());
  const [title, setTitle] = useState(existing?.title ?? '');
  const [items, setItems] = useState<TemplateItem[]>(existing?.items ?? []);
  const ok = items.length > 0;
  const patch = (i: number, p: Partial<TemplateItem>) => setItems((a) => a.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const persist = () => saveTemplate({ id, title: title || 'Untitled Programme', items });

  return (
    <Screen>
      <MetaRow left="Programme Builder" right="§ 04" onBack={back} />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Programme title"
        aria-label="Programme title"
        className="mt-[18px] w-full border-0 border-b border-line bg-transparent py-1.5 font-serif text-[30px] tracking-[-0.02em] text-ink placeholder:text-faint focus:border-ink"
      />

      <Section n="01" title="Selected Exercises" />
      {items.length === 0 && <Empty text="Nothing selected. Append exercises from the catalogue below." />}
      {items.map((it, i) => {
        const ex = exercises.find((e) => e.id === it.exerciseId);
        return (
          <div key={it.exerciseId} className="border-b border-line py-3.5">
            <div className="flex items-baseline gap-3.5">
              <span className="w-[26px] font-serif text-[15px] italic text-faint">{String(i + 1).padStart(2, '0')}.</span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium">{ex?.name ?? 'Unknown exercise'}</div>
                <div className="mt-0.5 text-[12.5px] text-mute">{ex ? `${ex.equipment} · ${ex.muscle}` : ''}</div>
              </div>
              <TextLink label="Remove" className="!text-mute" onPress={() => setItems((a) => a.filter((_, j) => j !== i))} />
            </div>
            <div className="mt-2.5 flex gap-7 pl-10">
              <Stepper label="Target sets" value={it.sets} max={12} onChange={(n) => patch(i, { sets: n })} />
              <Stepper label="Target reps" value={it.reps} max={100} onChange={(n) => patch(i, { reps: n })} />
            </div>
          </div>
        );
      })}

      <Section n="02" title="Add from Catalogue" />
      <ExerciseList
        actionLabel="+ Append"
        exclude={items.map((x) => x.exerciseId)}
        onAction={(e) => setItems((a) => [...a, { exerciseId: e.id, sets: 3, reps: e.metric === 'weightReps' ? 8 : 1 }])}
      />

      <div className="mt-[30px] flex flex-col gap-2.5">
        <Btn
          label="Save Programme Template"
          disabled={!ok}
          onPress={async () => {
            const t = await persist();
            toast('Programme saved', t.title);
            back();
          }}
        />
        <Btn
          variant="out"
          label="Save & Start Immediately"
          disabled={!ok}
          onPress={async () => {
            const t = await persist();
            await startFromTemplate(t.id);
            openWorkout();
          }}
        />
        {existing && (
          <div className="mt-2 text-center">
            <TextLink
              label="Delete programme"
              className="!text-mute"
              onPress={async () => {
                await deleteTemplate(existing.id);
                back();
              }}
            />
          </div>
        )}
      </div>
    </Screen>
  );
}
