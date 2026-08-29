'use client';

import { useState, useTransition } from 'react';
import { saveSessionLog, type SessionLogInput } from '@/lib/actions';
import { Card, CardTitle } from '@/components/ui';
import type { Shoe } from '@/lib/types';

type Draft = {
  rpe: number | null;
  pain_score: number;
  pain_note: string;
  pain_next_morning: number | null;
  shoe_id: string;
  carbs_g_per_h: string;
  gi_score: number | null;
  taped: boolean;
  note: string;
};

export default function SessionLogForm({
  date,
  saved,
  shoes,
  isLongrun,
  isToday,
}: {
  date: string;
  saved: Partial<SessionLogInput> | null;
  shoes: Shoe[];
  isLongrun: boolean;
  /** Op de dag zelf kun je de ochtend erna nog niet beoordelen. */
  isToday: boolean;
}) {
  const [draft, setDraft] = useState<Draft>({
    rpe: saved?.rpe ?? null,
    pain_score: saved?.pain_score ?? 0,
    pain_note: saved?.pain_note ?? '',
    pain_next_morning: saved?.pain_next_morning ?? null,
    shoe_id: saved?.shoe_id ?? '',
    carbs_g_per_h: saved?.carbs_g_per_h != null ? String(saved.carbs_g_per_h) : '',
    gi_score: saved?.gi_score ?? null,
    taped: saved?.taped ?? false,
    note: saved?.note ?? '',
  });
  const [state, setState] = useState<'leeg' | 'bezig' | 'bewaard' | 'fout'>(saved ? 'bewaard' : 'leeg');
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function push(next: Draft) {
    setDraft(next);
    setState('bezig');
    startTransition(async () => {
      const res = await saveSessionLog({
        date,
        rpe: next.rpe,
        pain_score: next.pain_score,
        pain_note: next.pain_note.trim() || null,
        pain_next_morning: next.pain_next_morning,
        shoe_id: next.shoe_id || null,
        carbs_g_per_h: next.carbs_g_per_h ? Number(next.carbs_g_per_h.replace(',', '.')) : null,
        gi_score: next.gi_score,
        taped: next.taped,
        note: next.note.trim() || null,
      });
      if (res.ok) {
        setState('bewaard');
        setError(null);
      } else {
        setState('fout');
        setError(res.error);
      }
    });
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => push({ ...draft, [key]: value });

  return (
    <Card>
      <CardTitle aside={<span>{state === 'bezig' ? 'opslaan…' : state === 'bewaard' ? 'bewaard' : state === 'fout' ? 'niet bewaard' : ''}</span>}>
        Hoe ging het?
      </CardTitle>

      <Field label="Hoe zwaar voelde het?" hint="1 is wandelen, 10 is alles eruit">
        <Scale from={1} to={10} value={draft.rpe} onPick={(v) => set('rpe', v)} />
      </Field>

      <Field label="Pijn tijdens het lopen" hint="Tot en met 5 mag. Boven de 5 stop je.">
        <Scale from={0} to={10} value={draft.pain_score} onPick={(v) => set('pain_score', v ?? 0)} danger={5} />
      </Field>

      {draft.pain_score > 0 ? (
        <Field label="Waar zat het?">
          <input value={draft.pain_note} onChange={(e) => setDraft({ ...draft, pain_note: e.target.value })}
            onBlur={() => push(draft)} placeholder="achillespees rechts"
            className="w-full rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
            style={{ background: 'var(--card2)', color: 'var(--ink)' }} />
        </Field>
      ) : null}

      {/* De ochtend erna kun je vandaag niet weten. Die vraag komt morgen bij de
          ochtendcheck op Vandaag, en gaat dan naar de log van deze dag. */}
      {draft.pain_score > 0 && isToday ? (
        <Field label="Pijn de volgende ochtend">
          <p className="text-[13px]" style={{ color: 'var(--ink3)' }}>
            Die vraag krijg je morgen bij de ochtendcheck. Het pijnmodel vraagt daar nul.
          </p>
        </Field>
      ) : null}

      {!isToday ? (
        <Field label="Pijn de ochtend erna" hint="Het pijnmodel vraagt hier nul.">
          <Scale from={0} to={10} value={draft.pain_next_morning} onPick={(v) => set('pain_next_morning', v)} danger={1} />
        </Field>
      ) : null}

      {shoes.length > 0 ? (
        <Field label="Schoen">
          <select value={draft.shoe_id} onChange={(e) => set('shoe_id', e.target.value)}
            className="w-full rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
            style={{ background: 'var(--card2)', color: 'var(--ink)' }}>
            <option value="">niet genoteerd</option>
            {shoes.filter((s) => !s.retired).map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {Math.round(s.km)} km</option>
            ))}
          </select>
        </Field>
      ) : null}

      {isLongrun ? (
        <>
          <Field label="Koolhydraten per uur" hint="Alleen bij lange duurlopen: dit traint je darm mee.">
            <div className="flex items-center gap-2">
              <input inputMode="decimal" value={draft.carbs_g_per_h}
                onChange={(e) => setDraft({ ...draft, carbs_g_per_h: e.target.value })} onBlur={() => push(draft)}
                placeholder="70" className="num w-24 rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
                style={{ background: 'var(--card2)', color: 'var(--ink)' }} />
              <span className="text-[13px]" style={{ color: 'var(--ink3)' }}>gram</span>
            </div>
          </Field>
          <Field label="Maag en darm" hint="0 is niets gemerkt, 10 is niet meer kunnen eten.">
            <Scale from={0} to={10} value={draft.gi_score} onPick={(v) => set('gi_score', v)} danger={5} />
          </Field>
        </>
      ) : null}

      <Field label="Heb je getapet?" hint="Kinesiotape of sporttape, bijvoorbeeld om je achillespees of knie. Zo zie je later terug of tape verschil maakt.">
        <button type="button" onClick={() => set('taped', !draft.taped)} aria-pressed={draft.taped}
          className="interactive rounded-[var(--r-btn)] px-4 py-2 text-[13px] font-semibold"
          style={{
            background: draft.taped ? 'var(--acc)' : 'var(--card2)',
            color: draft.taped ? 'var(--acc-ink)' : 'var(--ink2)',
          }}>
          {draft.taped ? 'Ja' : 'Nee'}
        </button>
      </Field>

      <Field label="Notitie">
        <textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          onBlur={() => push(draft)} rows={3} placeholder="Weer, ondergrond, wat opviel."
          className="w-full resize-y rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] leading-relaxed outline-none"
          style={{ background: 'var(--card2)', color: 'var(--ink)' }} />
      </Field>

      {error ? <p className="text-[12px]" style={{ color: 'var(--crit)' }}>{error}</p> : null}
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <p className="text-[14px] font-medium">{label}</p>
      {hint ? <p className="mb-2 mt-0.5 text-[12px]" style={{ color: 'var(--ink3)' }}>{hint}</p> : <div className="h-2" />}
      {children}
    </div>
  );
}

/** Een rij knoppen in plaats van een schuifje: op de telefoon één tik. */
function Scale({
  from,
  to,
  value,
  onPick,
  danger,
}: {
  from: number;
  to: number;
  value: number | null;
  onPick: (value: number | null) => void;
  danger?: number;
}) {
  const steps = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return (
    <div className="flex flex-wrap gap-1.5">
      {steps.map((n) => {
        const active = value === n;
        const hot = danger !== undefined && n >= danger;
        return (
          <button key={n} type="button" onClick={() => onPick(active ? null : n)} aria-pressed={active}
            className="num h-10 w-10 rounded-[var(--r-btn)] text-[14px] font-semibold"
            style={{
              background: active ? (hot ? 'var(--crit)' : 'var(--acc)') : 'var(--card2)',
              color: active ? 'var(--acc-ink)' : hot ? 'var(--crit)' : 'var(--ink2)',
            }}>
            {n}
          </button>
        );
      })}
    </div>
  );
}
