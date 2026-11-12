'use client';
import { useState } from 'react';
import { Btn, Chips, MetaRow, Screen, Section, Title } from '@/components/ui';
import { EQUIPMENT, METRIC_LABEL, MUSCLES, type Equipment, type Metric, type Muscle } from '@/db/schema';
import { addExercise, addToWorkout } from '@/db/queries';
import { useNav } from '@/store/nav';

const METRICS = Object.values(METRIC_LABEL);
const metricOf = (l: string) => (Object.keys(METRIC_LABEL) as Metric[]).find((k) => METRIC_LABEL[k] === l)!;

export function NewExercise({ addToActive, muscle }: { addToActive?: boolean; muscle?: string }) {
  const { back } = useNav();
  const [name, setName] = useState('');
  const [m, setM] = useState<Muscle>((MUSCLES as readonly string[]).includes(muscle ?? '') ? (muscle as Muscle) : 'Chest');
  const [eq, setEq] = useState<Equipment>('Barbell');
  const [metric, setMetric] = useState<Metric>('weightReps');
  const ok = name.trim().length > 1;

  return (
    <Screen>
      <MetaRow left="New Custom Exercise" right="§ 03" onBack={back} />
      <Title>{'Custom *Exercise.*'}</Title>
      <Section n="01" title="Name" />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Cable Pull-through"
        aria-label="Exercise name"
        autoFocus
        className="w-full border-0 border-b border-ink bg-transparent py-2 font-serif text-[30px] text-ink placeholder:text-faint"
      />
      <Section n="02" title="Primary Muscle" />
      <Chips options={MUSCLES} value={m} onChange={setM} />
      <Section n="03" title="Equipment" />
      <Chips options={EQUIPMENT} value={eq} onChange={setEq} />
      <Section n="04" title="Tracking Metric" />
      <Chips options={METRICS} value={METRIC_LABEL[metric]} onChange={(l) => setMetric(metricOf(l))} />
      <div className="mt-8">
        <Btn
          label={addToActive ? 'Add to library & workout' : 'Add to library'}
          disabled={!ok}
          onPress={async () => {
            const ex = await addExercise({ name: name.trim(), muscle: m, equipment: eq, metric });
            if (addToActive) await addToWorkout(ex.id);
            back();
          }}
        />
      </div>
    </Screen>
  );
}
