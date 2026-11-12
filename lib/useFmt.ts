import { fmtWeight, fmtVolume, toDisplay, fromDisplay, type Unit } from '@/lib/units';

/** Unit-aware formatters bound to the user's KG/LB setting. */
export function makeFmt(unit: Unit) {
  return {
    unit,
    w: (kg: number, d?: number) => fmtWeight(kg, unit, d),
    wu: (kg: number, d?: number) => `${fmtWeight(kg, unit, d)} ${unit}`,
    vol: (kg: number) => fmtVolume(kg, unit),
    disp: (kg: number) => toDisplay(kg, unit),
    parse: (v: number) => fromDisplay(v, unit),
    /** Smallest sensible plate jump, in kg. */
    step: unit === 'kg' ? 2.5 : 5 / 2.2046226218,
  };
}
export type Fmt = ReturnType<typeof makeFmt>;
