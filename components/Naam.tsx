'use client';

import { useState, useTransition } from 'react';
import { saveNaam } from '@/lib/actions';
import { Card, CardTitle, Note } from '@/components/ui';

/** De aanhef bovenaan elk scherm. Stond hier niets, dan groette de app je met
 *  de naam van degene die de app bouwde — wat klopt zolang je in je eentje
 *  bent en daarna niet meer. */
export default function Naam({ naam }: { naam: string | null }) {
  const [waarde, setWaarde] = useState(naam ?? '');
  const [open, setOpen] = useState(!naam);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, startTransition] = useTransition();

  function bewaar(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    startTransition(async () => {
      const res = await saveNaam(waarde);
      if (res.ok) setOpen(false);
      else setFout(res.error);
    });
  }

  return (
    <Card>
      <CardTitle aside={naam ?? 'nog leeg'}>Je naam</CardTitle>

      {open ? (
        <form onSubmit={bewaar} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <label htmlFor="naam" className="text-[13px] font-medium">Hoe noemen we je</label>
            <input id="naam" value={waarde} onChange={(e) => setWaarde(e.target.value)}
              autoComplete="given-name" maxLength={40} placeholder="je voornaam"
              className="mt-1.5 block w-full rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
              style={{ background: 'var(--card2)', color: 'var(--ink)' }} />
          </div>
          <button type="submit" disabled={bezig}
            className="interactive rounded-[var(--r-btn)] px-4 py-2.5 text-[13px] font-semibold"
            style={{ background: 'var(--acc)', color: 'var(--acc-ink)' }}>
            {bezig ? 'bezig…' : 'Bewaren'}
          </button>
          {naam ? (
            <button type="button" onClick={() => { setWaarde(naam); setOpen(false); setFout(null); }}
              className="text-[13px] font-semibold" style={{ color: 'var(--ink3)' }}>
              Laat maar
            </button>
          ) : null}
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="text-[13px] font-semibold"
          style={{ color: 'var(--acc)' }}>
          Naam wijzigen
        </button>
      )}

      {fout ? <p className="mt-2 text-[13px]" style={{ color: 'var(--crit)' }}>{fout}</p> : null}
      <Note>Alleen voor de aanhef bovenaan het scherm en de letter in de hoek. Verder doet de app er niets mee.</Note>
    </Card>
  );
}
