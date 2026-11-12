'use client';
import { useMemo, useState } from 'react';
import { MUSCLES, type Exercise, type Muscle } from '@/db/schema';
import { Chips, Row, TextLink } from '@/components/ui';
import { useApp } from '@/components/DataContext';

type Filter = 'All' | Muscle;

/** Muscle-filtered exercise list shared by the catalogue, the picker sheet and the template builder. */
export function ExerciseList({
  actionLabel,
  onAction,
  initialMuscle,
  exclude,
  onRowPress,
}: {
  actionLabel: string;
  onAction: (e: Exercise) => void;
  initialMuscle?: Muscle | null;
  exclude?: string[];
  onRowPress?: (e: Exercise) => void;
}) {
  const { exercises } = useApp();
  const [f, setF] = useState<Filter>(initialMuscle ?? 'All');
  const list = useMemo(
    () => exercises.filter((e) => (f === 'All' || e.muscle === f) && !exclude?.includes(e.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [exercises, f, exclude],
  );
  return (
    <div>
      <Chips options={['All', ...MUSCLES] as Filter[]} value={f} onChange={setF} />
      <div className="mt-1.5">
        {list.map((e) => (
          <Row
            key={e.id}
            title={e.name}
            sub={`${e.equipment} · ${e.muscle}${e.metric !== 'weightReps' ? ` · ${e.metric === 'time' ? 'Time' : 'Distance'}` : ''}`}
            onPress={() => (onRowPress ?? onAction)(e)}
            right={actionLabel ? <TextLink label={actionLabel} onPress={() => onAction(e)} /> : undefined}
          />
        ))}
        {list.length === 0 && <p className="py-6 text-[13.5px] text-mute">Nothing here yet.</p>}
      </div>
    </div>
  );
}
