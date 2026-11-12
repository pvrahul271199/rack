'use client';
import { Eyebrow, MetaRow, Screen, Section, Sheet, TextLink, Title } from '@/components/ui';
import { ExerciseList } from './ExerciseList';
import { useApp } from '@/components/DataContext';
import { addToWorkout } from '@/db/queries';
import { useNav } from '@/store/nav';
import type { Muscle } from '@/db/schema';

export function Catalogue() {
  const { back, push } = useNav();
  const { active } = useApp();
  return (
    <Screen>
      <MetaRow left="Exercise Catalogue" right="§ 02" onBack={back} />
      <Title>{'The *Catalogue.*'}</Title>
      <Section n="01" title="Exercises" action="+ Custom" onAction={() => push({ name: 'newExercise' })} />
      <ExerciseList
        actionLabel={active ? '+ Add' : ''}
        onAction={(e) => active && void addToWorkout(e.id)}
        onRowPress={(e) => push({ name: 'exercise', id: e.id })}
      />
    </Screen>
  );
}

/** Bottom-sheet picker used from the active workout. */
export function ExercisePicker({
  visible,
  muscle,
  onClose,
  onPick,
  onCustom,
  exclude,
}: {
  visible: boolean;
  muscle: Muscle | null;
  onClose: () => void;
  onPick: (id: string) => void;
  onCustom: () => void;
  exclude: string[];
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <div className="flex justify-between px-[22px] pb-1.5">
        <Eyebrow>Add exercise</Eyebrow>
        <TextLink label="+ Custom" onPress={onCustom} />
      </div>
      <div className="scroll-hide overflow-y-auto px-[22px] pb-5">
        <ExerciseList key={muscle ?? 'all'} initialMuscle={muscle} actionLabel="+ Add" exclude={exclude} onAction={(e) => onPick(e.id)} />
      </div>
    </Sheet>
  );
}
