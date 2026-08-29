'use client';

import { useState, useTransition } from 'react';
import { saveHrMax } from '@/lib/actions';
import { formatShort } from '@/lib/date';

/** De uitkomst van de HRmax-test. Zolang hier niets staat, rekent de app met de
 *  leeftijdsformule uit de naslag — en dat is een schatting, geen meting. */
export default function HartslagMax({
  hrMax,
  measuredOn,
  today,
}: {
  hrMax: number;
  measuredOn: string | null;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [waarde, setWaarde] = useState(String(hrMax));
  const [datum, setDatum] = useState(today);
  const [state, setState] = useState<'leeg' | 'bezig' | 'fout'>('leeg');
  const [fout, setFout] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function bewaar() {
    setState('bezig');
    setFout(null);
    startTransition(async () => {
      const res = await saveHrMax(Number(waarde.replace(',', '.')), datum);
      if (res.ok) {
        setState('leeg');
        setOpen(false);
      } else {
        setState('fout');
        setFout(res.error);
      }
    });
  }

  if (!open) {
    return (
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-[13px]" style={{ color: 'var(--ink3)' }}>
          {measuredOn
            ? `Gemeten op ${formatShort(measuredOn, today)}.`
            : 'Nog niet gemeten: dit is de leeftijdsformule.'}
        </p>
        <button type="button" onClick={() => setOpen(true)} className="text-[13px] font-semibold"
          style={{ color: 'var(--acc)' }}>
          {measuredOn ? 'Nieuwe meting invoeren' : 'Testuitslag invoeren'}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        bewaar();
      }}
      className="mt-3 flex flex-col gap-3 rounded-[var(--r-tile)] p-4"
      style={{ background: 'var(--card2)' }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="hr-max" className="text-[13px] font-medium">Hoogste hartslag</label>
          <div className="mt-1.5 flex items-center gap-2">
            <input id="hr-max" inputMode="numeric" value={waarde} onChange={(e) => setWaarde(e.target.value)}
              className="num w-24 rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
              style={{ background: 'var(--card)', color: 'var(--ink)' }} />
            <span className="text-[12px]" style={{ color: 'var(--ink3)' }}>bpm</span>
          </div>
        </div>
        <div>
          <label htmlFor="hr-datum" className="text-[13px] font-medium">Testdatum</label>
          <input id="hr-datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)}
            className="num mt-1.5 block rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
            style={{ background: 'var(--card)', color: 'var(--ink)' }} />
        </div>
        <button type="submit" disabled={state === 'bezig'}
          className="interactive rounded-[var(--r-btn)] px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50"
          style={{ background: 'var(--acc)', color: 'var(--acc-ink)' }}>
          {state === 'bezig' ? 'Opslaan…' : 'Bewaren'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] underline"
          style={{ color: 'var(--ink3)' }}>Annuleren</button>
      </div>
      <p className="text-[12px]" style={{ color: 'var(--ink3)' }}>
        Je zonegrenzen schalen mee met dezelfde percentages als in het plan. De tempo&apos;s blijven staan: die volgen
        niet uit je hartslag.
      </p>
      {fout ? <p className="text-[12px]" style={{ color: 'var(--crit)' }}>{fout}</p> : null}
    </form>
  );
}
