'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Uitkomst = { opgehaald: number; streams: number; wachtrij_over: number };

/** De sync draait 's nachts. Deze knop is voor de rest van de dag: je hebt net
 *  gelopen en wilt je cijfers nu zien, niet morgenochtend. */
export default function StravaOphalen({
  laatst,
  compact = false,
}: {
  /** Wanneer de sync voor het laatst liep, als ISO-tijdstip. */
  laatst: string | null;
  /** Alleen de marge verschilt; de knop blijft een knop. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<'leeg' | 'bezig' | 'klaar' | 'fout'>('leeg');
  const [bericht, setBericht] = useState<string | null>(null);

  async function haal() {
    setState('bezig');
    setBericht(null);
    try {
      const res = await fetch('/api/strava/sync', { method: 'POST' });
      const body = (await res.json()) as Partial<Uitkomst> & { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Ophalen mislukt.');

      const aantal = body.opgehaald ?? 0;
      setState('klaar');
      setBericht(
        aantal === 0
          ? 'Niets nieuws gevonden.'
          : `${aantal} ${aantal === 1 ? 'activiteit' : 'activiteiten'} opgehaald.`,
      );
      // De schermen zijn server-gerenderd, dus verversen we ze.
      router.refresh();
    } catch (fout) {
      setState('fout');
      setBericht((fout as Error).message);
    }
  }

  return (
    <div className={compact ? 'flex flex-wrap items-center gap-3' : 'mt-3 flex flex-wrap items-center gap-3'}>
      <button type="button" onClick={() => void haal()} disabled={state === 'bezig'}
        className="interactive rounded-[var(--r-btn)] px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50"
        style={{ background: 'var(--acc)', color: 'var(--acc-ink)' }}>
        {state === 'bezig' ? 'Bezig…' : 'Nu ophalen'}
      </button>
      <span className="text-[12px]" style={{ color: state === 'fout' ? 'var(--crit)' : 'var(--ink3)' }}>
        {bericht ?? (laatst ? `Laatst opgehaald ${geleden(laatst)}.` : 'Nog niet eerder opgehaald.')}
      </span>
    </div>
  );
}

/** "12 minuten geleden" — preciezer heeft geen zin voor een sync. */
function geleden(iso: string): string {
  const minuten = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minuten) || minuten < 1) return 'zojuist';
  if (minuten < 60) return `${minuten} ${minuten === 1 ? 'minuut' : 'minuten'} geleden`;
  const uren = Math.round(minuten / 60);
  if (uren < 24) return `${uren} ${uren === 1 ? 'uur' : 'uur'} geleden`;
  const dagen = Math.round(uren / 24);
  return `${dagen} ${dagen === 1 ? 'dag' : 'dagen'} geleden`;
}
