'use client';
import { createContext, useContext, useMemo } from 'react';
import type { Data } from '@/db/queries';
import { makeFmt, type Fmt } from '@/lib/useFmt';

const Ctx = createContext<Data | null>(null);

export function DataProvider({ data, children }: { data: Data; children: React.ReactNode }) {
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}
/** The live ledger. Only valid below AppShell, which renders children once data has loaded. */
export function useApp(): Data {
  const d = useContext(Ctx);
  if (!d) throw new Error('useApp outside DataProvider');
  return d;
}
export function useFmt(): Fmt {
  const { unit } = useApp();
  return useMemo(() => makeFmt(unit), [unit]);
}
