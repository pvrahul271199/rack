import { create } from 'zustand';

export type Tab = 'log' | 'insights' | 'history' | 'profile';
export type Route =
  | { name: 'today' }
  | { name: 'workout' }
  | { name: 'catalogue' }
  | { name: 'newExercise'; addToActive?: boolean; muscle?: string }
  | { name: 'builder'; templateId?: string }
  | { name: 'insights' }
  | { name: 'exercise'; id: string }
  | { name: 'muscle'; muscle: string }
  | { name: 'running' }
  | { name: 'logRun' }
  | { name: 'history' }
  | { name: 'session'; id: string }
  | { name: 'profile' }
  | { name: 'weighIn' }
  | { name: 'import' };

const ROOT: Record<Tab, Route> = {
  log: { name: 'today' },
  insights: { name: 'insights' },
  history: { name: 'history' },
  profile: { name: 'profile' },
};

interface Nav {
  tab: Tab;
  stack: Route[];
  push: (r: Route) => void;
  back: () => void;
  /** Replace the top of the stack (e.g. builder → workout). */
  replace: (r: Route) => void;
  goTab: (t: Tab) => void;
  /** Jump to the Log tab with the workout open. */
  openWorkout: () => void;
}

export const useNav = create<Nav>((set) => ({
  tab: 'log',
  stack: [ROOT.log],
  push: (r) => set((s) => ({ stack: [...s.stack, r] })),
  back: () => set((s) => (s.stack.length > 1 ? { stack: s.stack.slice(0, -1) } : s)),
  replace: (r) => set((s) => ({ stack: [...s.stack.slice(0, -1), r] })),
  goTab: (tab) => set({ tab, stack: [ROOT[tab]] }),
  openWorkout: () => set({ tab: 'log', stack: [ROOT.log, { name: 'workout' }] }),
}));
