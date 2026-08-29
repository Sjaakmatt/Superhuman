'use client';

import { useState, useTransition } from 'react';
import { saveMilestoneResult } from '@/lib/actions';
import type { MilestoneResult } from '@/lib/types';

/** Afvinken en opschrijven wat eruit kwam. Een bloedpanel vul je bij
 *  Instellingen in met echte getallen; hier komt de rest terecht: een test,
 *  een wedstrijd, een beslissing. */
export default function MijlpaalUitslag({
  date,
  saved,
  verleden,
}: {
  date: string;
  saved: MilestoneResult | null;
  /** Vóór de dag zelf heeft afvinken geen zin. */
  verleden: boolean;
}) {
  const [done, setDone] = useState(saved?.done ?? false);
  const [outcome, setOutcome] = useState(saved?.outcome ?? '');
  const [state, setState] = useState<'leeg' | 'bezig' | 'bewaard' | 'fout'>(saved ? 'bewaard' : 'leeg');
  const [fout, setFout] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function push(volgende: { done: boolean; outcome: string }) {
    setState('bezig');
    startTransition(async () => {
      const res = await saveMilestoneResult(date, {
        done: volgende.done,
        outcome: volgende.outcome.trim() || null,
      });
      if (res.ok) {
        setState('bewaard');
        setFout(null);
      } else {
        setState('fout');
        setFout(res.error);
      }
    });
  }

  if (!verleden && !saved) return null;

  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--hair)' }}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-pressed={done}
          onClick={() => {
            const volgende = !done;
            setDone(volgende);
            push({ done: volgende, outcome });
          }}
          className="interactive flex items-center gap-2 rounded-[var(--r-btn)] px-3 py-2 text-[13px] font-semibold"
          style={{
            background: done ? 'var(--acc)' : 'var(--card2)',
            color: done ? 'var(--acc-ink)' : 'var(--ink2)',
          }}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 12l5 5L20 6" />
          </svg>
          {done ? 'Gedaan' : 'Afvinken'}
        </button>
        <span className="text-[12px]" style={{ color: 'var(--ink3)' }}>
          {state === 'bezig' ? 'opslaan…' : state === 'bewaard' ? 'bewaard' : 'Noteer wat eruit kwam'}
        </span>
      </div>

      <textarea
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        onBlur={() => (done || outcome.trim() ? push({ done, outcome }) : null)}
        rows={3}
        placeholder="Wat kwam eruit? Cijfers, wat werkte, wat je de volgende keer anders doet."
        className="mt-3 w-full resize-y rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] leading-relaxed outline-none"
        style={{ background: 'var(--card2)', color: 'var(--ink)' }}
      />

      {fout ? <p className="mt-2 text-[12px]" style={{ color: 'var(--crit)' }}>{fout}</p> : null}
    </div>
  );
}
