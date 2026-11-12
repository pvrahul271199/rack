import { AppShell } from '@/components/AppShell';

export default function Home() {
  return (
    <>
      <AppShell />
      {/* The app draws itself on the client; this gives crawlers and screen readers the same words. Never shown. */}
      <section className="sr-only">
        <h1>Rep: a minimalist strength and running ledger</h1>
        <p>Log lifts and runs, track personal records and progressive overload, and see your training in plain monochrome. Works offline.</p>
      </section>
    </>
  );
}
