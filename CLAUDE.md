# CLAUDE.md — Rep

Minimalist strength & running ledger, "No. 01 — Swiss Editorial Monochrome". Built the same way as `stash` (Chelav).

> Read `AGENTS.md` first: this Next.js version has breaking changes. Check `node_modules/next/dist/docs/` before writing Next-specific code.

## Stack
- Next.js App Router, **static export** (`output: 'export'`, `trailingSlash: true`), React 19, strict TypeScript. One page (`app/page.tsx` → `components/AppShell.tsx`); no server code.
- Tailwind with tokens in `theme/tokens.ts` (strictly monochrome); Instrument Serif + Inter via `next/font/google`.
- **Dexie / IndexedDB is the source of truth** (`db/schema.ts`, one DB `rep`). Zustand holds *UI-only* state (`store/nav.ts` stack navigator, `store/toast.ts`, `store/pwa.ts`).
- PWA: `app/manifest.ts`, `public/sw.js` + `scripts/build-sw.mjs` (precache + content-hash version). No accounts, no sync, no network calls.

## Commands
```bash
npm run dev      # http://localhost:3000
npm run lint     # tsc --noEmit
npm test         # vitest (lib + queries against fake-indexeddb)
npm run build    # next build --webpack && node scripts/build-sw.mjs → out/
npm start        # serve out/ (PORT env, default 3100)
npm run icons    # regenerate PWA icons
```

## Layout
```
app/                 layout, page, manifest, globals.css
components/AppShell  seeds DB, owns routing (renderRoute) and the tab bar
components/DataContext  useApp() / useFmt(): the live ledger + unit formatters
components/screens/  Today, Workout, Catalogue(+picker), NewExercise, Builder, Insights, Dives, Running, History(+SessionDetail), Profile(+WeighIn), Import
components/ui.tsx charts.tsx  primitives (MetaRow, Section, Stats, Btn, Keypad, Sheet, TabBar…), SVG charts
db/schema.ts         types, default exercises/templates, Dexie class (v1)
db/queries.ts        ALL reads (useData) and writes (transactions)
lib/                 pure logic: stats, strength (Epley), units, dates, importers, sample
tests/               vitest
```

## Rules
- Weights are stored in **kg**; convert only at the edge (`useFmt` / `lib/units`). Never store lb.
- Keep analytics **pure** in `lib/stats.ts` and unit-test them. UI never writes to Dexie directly: call `db/queries.ts`.
- Never edit a shipped Dexie version in place: add `this.version(N+1)` and bump `SCHEMA_VERSION`.
- Dates are local ISO strings; use `lib/dates.ts`, never `new Date(iso)`.
- e1RM = Epley `w × (1 + r/30)`; a PR is a set whose e1RM beats every earlier set of that exercise (`toggleSet` live, `finishWorkout` when saving).
- The active workout lives in `kv['active']` so it survives reloads. Finishing keeps only completed sets.
- Import is file-based and client-side (Strong/Hevy CSV, Strava activities.csv, Apple Health export.xml, GPX, TCX). FIT is rejected with a message. Duplicates are skipped by key.
- Personal bests for runs are *estimated* from average pace of runs ≥ the distance; the UI says so.
