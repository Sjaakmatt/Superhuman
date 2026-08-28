'use client';

import { useState, useTransition } from 'react';
import { completeStrengthSession, saveStrengthSet } from '@/lib/actions';
import { Card, CardTitle } from '@/components/ui';
import type { PlannedExercise } from '@/lib/strength';

export type SetValue = { weight_kg: number | null; reps: number | null; done: boolean };
export type Previous = { date: string; sets: SetValue[] };

/** Per set gewicht en herhalingen, een vinkje, en de vorige keer ernaast.
 *  De invoer voelt direct; opslaan gebeurt op de achtergrond per set. */
export default function StrengthBoard({
  date,
  block,
  exercises,
  saved,
  previous,
  completed,
  writable,
}: {
  date: string;
  block: string;
  exercises: PlannedExercise[];
  saved: Record<string, SetValue[]>;
  previous: Record<string, Previous>;
  completed: boolean;
  writable: boolean;
}) {
  const [values, setValues] = useState<Record<string, SetValue[]>>(() => {
    const start: Record<string, SetValue[]> = {};
    for (const ex of exercises) {
      const key = ex.slug ?? ex.name;
      start[key] = Array.from({ length: ex.sets }, (_, i) =>
        saved[key]?.[i] ?? { weight_kg: null, reps: null, done: false },
      );
    }
    return start;
  });
  const [done, setDone] = useState(completed);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function update(ex: PlannedExercise, index: number, patch: Partial<SetValue>) {
    const key = ex.slug ?? ex.name;
    const rows = values[key] ?? [];
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    setValues({ ...values, [key]: next });
    if (!ex.slug || !writable) return;
    const row = next[index]!;
    startTransition(async () => {
      const res = await saveStrengthSet({
        date,
        block,
        exercise: ex.slug!,
        set_no: index + 1,
        weight_kg: row.weight_kg,
        reps: row.reps,
        done: row.done,
      });
      if (!res.ok) setError(res.error);
    });
  }

  function finish() {
    const next = !done;
    setDone(next);
    startTransition(async () => {
      const res = await completeStrengthSession(date, next);
      if (!res.ok) setError(res.error);
    });
  }

  const totalSets = exercises.reduce((t, e) => t + e.sets, 0);
  const doneSets = Object.values(values).flat().filter((s) => s.done).length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle aside={<span className="num">{doneSets} van {totalSets} series</span>}>{block}</CardTitle>
        <div className="h-1.5 w-full overflow-hidden rounded-[var(--r-pill)]" style={{ background: 'var(--sunk)' }}>
          <div className="h-full rounded-[var(--r-pill)] transition-[width] duration-300"
            style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%`, background: 'var(--acc)' }} />
        </div>
      </Card>

      {exercises.map((ex) => {
        const key = ex.slug ?? ex.name;
        const rows = values[key] ?? [];
        const last = previous[key];
        return (
          <Card key={key}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[15px] font-bold">{ex.name}</h3>
              <span className="num text-[12px]" style={{ color: 'var(--ink3)' }}>{ex.prescription}</span>
            </div>

            {ex.slug ? (
              <ul className="flex flex-col gap-2">
                {rows.map((row, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="num w-6 shrink-0 text-[12px]" style={{ color: 'var(--ink3)' }}>{i + 1}</span>

                    <NumberInput
                      value={row.weight_kg}
                      onChange={(v) => update(ex, i, { weight_kg: v })}
                      suffix={ex.unit === 'kg' ? 'kg' : ex.unit}
                      disabled={!writable}
                      label={`${ex.name}, serie ${i + 1}, gewicht`}
                    />
                    <NumberInput
                      value={row.reps}
                      onChange={(v) => update(ex, i, { reps: v })}
                      suffix="×"
                      disabled={!writable}
                      label={`${ex.name}, serie ${i + 1}, herhalingen`}
                    />

                    <span className="num min-w-[74px] text-[11px]" style={{ color: 'var(--ink3)' }}>
                      {last?.sets[i]
                        ? `was ${last.sets[i]!.weight_kg ?? '—'}${ex.unit === 'kg' ? ' kg' : ''} × ${last.sets[i]!.reps ?? '—'}`
                        : ''}
                    </span>

                    <button type="button" onClick={() => update(ex, i, { done: !row.done })} aria-pressed={row.done}
                      aria-label={`Serie ${i + 1} gedaan`} disabled={!writable}
                      className="interactive ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-[var(--r-btn)]"
                      style={{
                        background: row.done ? 'var(--acc)' : 'var(--card2)',
                        color: row.done ? 'var(--acc-ink)' : 'var(--ink3)',
                      }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4"
                        strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px]" style={{ color: 'var(--ink3)' }}>
                Deze regel staat niet als oefening in de referentie, dus er is niets te loggen.
              </p>
            )}

            {last ? (
              <p className="mt-3 text-[11px]" style={{ color: 'var(--ink3)' }}>Vorige keer: {last.date}</p>
            ) : null}
          </Card>
        );
      })}

      {writable ? (
        <button type="button" onClick={finish}
          className="interactive rounded-[var(--r-card)] px-5 py-4 text-[15px] font-bold"
          style={{
            background: done ? 'var(--acc-soft)' : 'var(--acc)',
            color: done ? 'var(--acc)' : 'var(--acc-ink)',
            border: '1px solid var(--hair)',
          }}>
          {done ? 'Sessie afgerond — nog eens openen' : 'Sessie afronden'}
        </button>
      ) : null}

      {error ? <p className="text-[12px]" style={{ color: 'var(--crit)' }}>{error}</p> : null}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  suffix,
  disabled,
  label,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  suffix: string;
  disabled: boolean;
  label: string;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  return (
    <span className="flex items-center gap-1 rounded-[var(--r-btn)] px-2" style={{ background: 'var(--card2)' }}>
      <input
        aria-label={label}
        inputMode="decimal"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const clean = text.replace(',', '.').trim();
          const n = clean === '' ? null : Number(clean);
          onChange(n !== null && Number.isFinite(n) ? n : null);
        }}
        className="num w-[52px] bg-transparent py-2.5 text-right text-[14px] outline-none"
        style={{ color: 'var(--ink)' }}
      />
      <span className="text-[11px]" style={{ color: 'var(--ink3)' }}>{suffix}</span>
    </span>
  );
}
