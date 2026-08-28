'use client';

import { useState, useTransition } from 'react';
import { saveWellness } from '@/lib/actions';
import { Card, CardTitle } from '@/components/ui';

/* Vijf vragen van 1 tot 7, in gewone taal. Geen "welzijnsscore" in de interface;
 * de som staat er wel bij, want die vergelijk je met je eigen gemiddelde. */
const ITEMS = [
  { key: 'slept', label: 'Hoe heb je geslapen?', low: 'slecht', high: 'diep' },
  { key: 'fresh', label: 'Hoe fris voel je je?', low: 'op', high: 'fris' },
  { key: 'legs', label: 'Hoe voelen je benen?', low: 'zwaar', high: 'licht' },
  { key: 'mind', label: 'Rust in je hoofd?', low: 'druk', high: 'rustig' },
  { key: 'motivation', label: 'Zin om te gaan?', low: 'geen', high: 'veel' },
] as const;

type Key = (typeof ITEMS)[number]['key'];
type Values = Record<Key, number>;

const DEFAULTS: Values = { slept: 4, fresh: 4, legs: 4, mind: 4, motivation: 4 };

export default function MorningCheck({
  date,
  saved,
  average,
}: {
  date: string;
  saved: Partial<Values> | null;
  average: number | null;
}) {
  const [values, setValues] = useState<Values>({ ...DEFAULTS, ...saved });
  const [state, setState] = useState<'leeg' | 'bezig' | 'bewaard' | 'fout'>(saved ? 'bewaard' : 'leeg');
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const total = ITEMS.reduce((t, i) => t + values[i.key], 0);

  function set(key: Key, value: number) {
    const next = { ...values, [key]: value };
    setValues(next);
    setState('bezig');
    // Optimistisch: het schuifje beweegt meteen, opslaan gebeurt erachteraan.
    startTransition(async () => {
      const res = await saveWellness({ date, ...next });
      if (res.ok) {
        setState('bewaard');
        setError(null);
      } else {
        setState('fout');
        setError(res.error);
      }
    });
  }

  const delta = average === null ? null : total - average;

  return (
    <Card>
      <CardTitle aside={
        <span>
          {state === 'bezig' ? 'opslaan…' : state === 'bewaard' ? 'bewaard' : state === 'fout' ? 'niet bewaard' : '90 seconden'}
        </span>
      }>
        Hoe voel je je?
      </CardTitle>

      <div className="flex flex-col gap-4">
        {ITEMS.map((item) => (
          <div key={item.key}>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={`w-${item.key}`} className="text-[14px] font-medium">{item.label}</label>
              <span className="num text-[14px] font-semibold" style={{ color: 'var(--acc)' }}>{values[item.key]}</span>
            </div>
            <input
              id={`w-${item.key}`}
              type="range"
              min={1}
              max={7}
              step={1}
              value={values[item.key]}
              onChange={(e) => set(item.key, Number(e.target.value))}
              className="mt-2 w-full"
              aria-describedby={`w-${item.key}-uitleg`}
            />
            <div id={`w-${item.key}-uitleg`} className="mt-1 flex justify-between text-[11px]" style={{ color: 'var(--ink3)' }}>
              <span>{item.low}</span>
              <span>{item.high}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-baseline justify-between rounded-[var(--r-tile)] px-4 py-3"
        style={{ background: 'var(--card2)' }}>
        <span className="text-[13px]" style={{ color: 'var(--ink2)' }}>Samen</span>
        <span className="num text-[20px] font-semibold">
          {total}
          <span className="ml-1 text-[12px] font-medium" style={{ color: 'var(--ink3)' }}>van 35</span>
        </span>
      </div>

      {delta !== null ? (
        <p className="mt-3 text-[12px]" style={{ color: 'var(--ink3)' }}>
          {delta >= 0 ? '+' : ''}{delta.toFixed(1).replace('.', ',')} ten opzichte van je veertiendaags gemiddelde
          ({average!.toFixed(1).replace('.', ',')}). Vergelijk alleen met jezelf.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-[12px]" style={{ color: 'var(--crit)' }}>{error}</p> : null}
    </Card>
  );
}
