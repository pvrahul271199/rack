'use client';
import { useRef, useState } from 'react';
import { Btn, MetaRow, Row, Screen, Section, TextLink, Title } from '@/components/ui';
import { useApp } from '@/components/DataContext';
import { clearHistory, importBatch, loadSample } from '@/db/queries';
import { useNav } from '@/store/nav';
import { useToast } from '@/store/toast';
import { buildSample } from '@/lib/sample';
import { parseAppleHealth, parseGPX, parseStravaCSV, parseTCX, parseWorkoutCSV, type ImportResult } from '@/lib/importers';

type Kind = 'strong' | 'strava' | 'apple' | 'gpx';

const SOURCES: { kind: Kind; title: string; sub: string; accept: string }[] = [
  { kind: 'strong', title: 'Strong / Hevy', sub: 'Workout history .csv · lifts, sets, reps', accept: '.csv,text/csv' },
  { kind: 'strava', title: 'Strava', sub: 'activities.csv from Strava’s bulk export · runs', accept: '.csv,text/csv' },
  { kind: 'apple', title: 'Apple Health / Health Connect', sub: 'export.xml · runs and body weight', accept: '.xml,text/xml' },
  { kind: 'gpx', title: 'GPX / TCX / FIT files', sub: 'A single run recorded by any watch or app', accept: '.gpx,.tcx,.fit' },
];

export function ImportScreen() {
  const { back } = useNav();
  const { exercises, unit } = useApp();
  const toast = useToast((s) => s.show);
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>('strong');
  const [busy, setBusy] = useState<Kind | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const choose = (k: Kind) => {
    setKind(k);
    setMsg(null);
    // Set accept before opening so the right file types show.
    if (input.current) {
      input.current.accept = SOURCES.find((s) => s.kind === k)!.accept;
      input.current.value = '';
      input.current.click();
    }
  };

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(kind);
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith('.fit')) {
        setMsg('FIT files are a binary format and are not supported yet. Export the activity as GPX or TCX instead.');
        return;
      }
      const text = await file.text();
      let out: ImportResult;
      if (kind === 'strong') out = parseWorkoutCSV(text, exercises, unit);
      else if (kind === 'strava') out = parseStravaCSV(text);
      else if (kind === 'apple') out = parseAppleHealth(text);
      else out = name.endsWith('.tcx') || /<TrainingCenterDatabase/i.test(text) ? parseTCX(text) : parseGPX(text);
      if (!out.sessions.length && !out.runs.length && !out.weights.length) {
        setMsg(out.note || 'Nothing importable found in that file.');
        return;
      }
      await importBatch(out);
      setMsg(`Imported · ${out.note}`);
      toast('Import complete', out.note);
    } catch (e) {
      setMsg(`Could not read that file. ${e instanceof Error ? e.message : ''}`.trim());
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <MetaRow left="Import Archives" right="§ 13" onBack={back} />
      <Title>{'Import *Archives.*'}</Title>
      <p className="mt-1.5 text-[13.5px] leading-5 text-mute">Rep reads export files in your browser. Nothing is uploaded, and duplicates are skipped on re-import.</p>
      <input ref={input} type="file" className="hidden" aria-label="Choose file to import" onChange={(e) => void onFile(e.target.files?.[0])} />

      <Section n="01" title="Sources" />
      {SOURCES.map((s, i) => (
        <Row
          key={s.kind}
          index={`${String(i + 1).padStart(2, '0')}.`}
          title={s.title}
          sub={s.sub}
          onPress={() => choose(s.kind)}
          right={<TextLink label={busy === s.kind ? 'Reading…' : 'Choose file'} onPress={() => choose(s.kind)} />}
        />
      ))}
      {msg && <p role="status" className="mt-4 text-[13px] font-medium leading-[19px]">{msg}</p>}

      <Section n="02" title="Demo & Reset" />
      <div className="flex flex-col gap-2.5">
        <Btn
          variant="out"
          label="Load 16 weeks of demo history"
          onPress={async () => {
            await loadSample(buildSample());
            toast('Demo history loaded', 'Replaced sessions, runs and weigh-ins.');
          }}
        />
        <Btn
          variant="out"
          label={confirmClear ? 'Tap again to erase all history' : 'Clear all history'}
          onPress={async () => {
            if (!confirmClear) return setConfirmClear(true);
            await clearHistory();
            setConfirmClear(false);
            toast('History cleared');
          }}
        />
      </div>
      <p className="py-5 text-[12.5px] leading-[18px] text-mute">Demo history replaces any logged sessions, runs and weigh-ins on this device.</p>
    </Screen>
  );
}
