'use client';
import { useEffect, useState } from 'react';
import { DataProvider } from '@/components/DataContext';
import { PWAManager } from '@/components/pwa/PWAManager';
import { TabBar, Toast } from '@/components/ui';
import { Today } from '@/components/screens/Today';
import { Workout } from '@/components/screens/Workout';
import { Catalogue } from '@/components/screens/Catalogue';
import { NewExercise } from '@/components/screens/NewExercise';
import { Builder } from '@/components/screens/Builder';
import { Insights } from '@/components/screens/Insights';
import { ExerciseDive, MuscleDive } from '@/components/screens/Dives';
import { LogRun, Running } from '@/components/screens/Running';
import { History, SessionDetail } from '@/components/screens/History';
import { Profile, WeighIn } from '@/components/screens/Profile';
import { ImportScreen } from '@/components/screens/Import';
import { ensureSeed, useData } from '@/db/queries';
import { useNav, type Route } from '@/store/nav';

function renderRoute(r: Route): React.ReactNode {
  switch (r.name) {
    case 'today': return <Today />;
    case 'workout': return <Workout />;
    case 'catalogue': return <Catalogue />;
    case 'newExercise': return <NewExercise addToActive={r.addToActive} muscle={r.muscle} />;
    case 'builder': return <Builder templateId={r.templateId} />;
    case 'insights': return <Insights />;
    case 'exercise': return <ExerciseDive id={r.id} />;
    case 'muscle': return <MuscleDive muscle={r.muscle} />;
    case 'running': return <Running />;
    case 'logRun': return <LogRun />;
    case 'history': return <History />;
    case 'session': return <SessionDetail id={r.id} />;
    case 'profile': return <Profile />;
    case 'weighIn': return <WeighIn />;
    case 'import': return <ImportScreen />;
  }
}

// Full-screen flows hide the tab bar so the keypad, rest timer and builders get the room.
const IMMERSIVE = new Set<Route['name']>(['workout', 'builder', 'newExercise', 'weighIn', 'logRun']);

/** Top-level state machine: seed the on-device DB, then route between screens. */
export function AppShell() {
  const [seeded, setSeeded] = useState(false);
  const data = useData();
  const { tab, stack, goTab } = useNav();
  const route = stack[stack.length - 1];

  useEffect(() => {
    ensureSeed().then(() => setSeeded(true));
  }, []);

  return (
    <>
      <PWAManager />
      {seeded && data ? (
        <DataProvider data={data}>
          <div className="flex h-full flex-col bg-bg">
            <main className="min-h-0 flex-1">{renderRoute(route)}</main>
            {!IMMERSIVE.has(route.name) && <TabBar tab={tab} onChange={goTab} />}
          </div>
          <Toast />
        </DataProvider>
      ) : null}
    </>
  );
}
