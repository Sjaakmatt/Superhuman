'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { saveHrMax, saveMilestoneResult } from '@/lib/actions';
import { km, minutes } from '@/lib/metrics';
import type { Activity, MilestoneResult } from '@/lib/types';

/** Wat de app van deze dag weet zonder dat jij iets doet: de activiteit uit
 *  Strava en de sessielog van die dag. */
export type Gemeten = {
  activity:
    | (Pick<Activity, 'name' | 'sport_type' | 'distance_m' | 'moving_s' | 'elapsed_s' | 'elev_gain_m' | 'avg_hr' | 'max_hr'> & {
        descent_min: number | null;
      })
    | null;
  log: { rpe: number | null; pain_score: number | null; gi_score: number | null; carbs_g_per_h: number | null } | null;
};

/* De uitslag hoort op de dag zelf, niet drie schermen verderop. Wat je invult
 * hangt af van wat de mijlpaal oplevert — dat staat in de seed, niet in een
 * gok op de titel. */
export default function MijlpaalUitslag({
  date,
  logs,
  saved,
  verleden,
  gemeten,
  hrMax,
  bloedIngevuld,
}: {
  date: string;
  logs: 'hrmax' | 'bloed' | 'loop' | null;
  saved: MilestoneResult | null;
  /** Vóór de dag zelf heeft afvinken geen zin. */
  verleden: boolean;
  gemeten: Gemeten;
  /** De HRmax waar de app nu mee rekent. */
  hrMax: number;
  /** Of er al een bloedpanel binnen twee weken van deze dag staat. */
  bloedIngevuld: boolean;
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

  // Vóór de dag zelf valt er niets in te vullen; dan telt alleen de voorbereiding.
  if (!verleden && !saved) return null;

  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--hair)' }}>
      <p className="text-[12px] font-semibold uppercase tracking-[.08em]" style={{ color: 'var(--ink3)' }}>
        Wat er uitkwam
      </p>

      {logs === 'loop' ? <UitStrava gemeten={gemeten} date={date} /> : null}
      {logs === 'hrmax' ? <HrMeting date={date} hrMax={hrMax} onKlaar={() => { setDone(true); push({ done: true, outcome }); }} /> : null}
      {logs === 'bloed' ? <NaarBloedwaarden ingevuld={bloedIngevuld} /> : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
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
          {state === 'bezig' ? 'opslaan…' : state === 'bewaard' ? 'bewaard' : 'Schrijf op wat de cijfers niet zeggen'}
        </span>
      </div>

      <textarea
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        onBlur={() => (done || outcome.trim() ? push({ done, outcome }) : null)}
        rows={3}
        placeholder="Wat werkte, wat niet, wat je de volgende keer anders doet."
        className="mt-3 w-full resize-y rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] leading-relaxed outline-none"
        style={{ background: 'var(--card2)', color: 'var(--ink)' }}
      />

      {fout ? <p className="mt-2 text-[12px]" style={{ color: 'var(--crit)' }}>{fout}</p> : null}
    </div>
  );
}

/** Een wedstrijd of test is gewoon een activiteit: die komt uit de nachtelijke
 *  sync. Hier hoef je niets te typen, alleen te kijken. */
function UitStrava({ gemeten, date }: { gemeten: Gemeten; date: string }) {
  const { activity, log } = gemeten;

  if (!activity) {
    return (
      <p className="mt-2 text-[13px]" style={{ color: 'var(--ink3)' }}>
        Nog niets uit Strava voor deze dag. De sync draait elke nacht; zodra de activiteit er staat, verschijnen
        afstand, tijd, hoogtemeters, hartslag en afdaalminuten hier vanzelf.
      </p>
    );
  }

  return (
    <div className="mt-2">
      <p className="text-[14px] font-semibold">{activity.name ?? activity.sport_type}</p>
      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
        <Cijfer label="afstand" value={`${km(activity.distance_m)} km`} />
        <Cijfer label="in beweging" value={`${minutes(activity.moving_s)} min`} />
        <Cijfer label="totale tijd" value={`${minutes(activity.elapsed_s)} min`} />
        <Cijfer label="klim" value={`${Math.round(Number(activity.elev_gain_m ?? 0))} hm`} />
        {activity.avg_hr ? <Cijfer label="gemiddelde hartslag" value={`${Math.round(Number(activity.avg_hr))} bpm`} /> : null}
        {activity.max_hr ? <Cijfer label="hoogste hartslag" value={`${Math.round(Number(activity.max_hr))} bpm`} /> : null}
        {activity.descent_min !== null ? <Cijfer label="afdaalminuten" value={`${activity.descent_min} min`} /> : null}
      </dl>
      {log ? (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--ink3)' }}>
          Uit je logboek:
          {log.rpe ? ` zwaarte ${log.rpe}` : ' geen zwaarte'}
          {log.pain_score ? ` · pijn ${log.pain_score}` : ''}
          {log.carbs_g_per_h ? ` · ${log.carbs_g_per_h} g koolhydraten per uur` : ''}
          {log.gi_score ? ` · maag ${log.gi_score}` : ''}
        </p>
      ) : (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--ink3)' }}>
          Nog niets gelogd. <Link href={`/loggen?d=${date}`} style={{ color: 'var(--acc)' }}>Hoe zwaar het voelde</Link> en je
          maag zeggen hier meer dan de kilometers.
        </p>
      )}
    </div>
  );
}

/** De uitslag van de HRmax-test, hier en niet in een instellingenscherm. */
function HrMeting({ date, hrMax, onKlaar }: { date: string; hrMax: number; onKlaar: () => void }) {
  const [waarde, setWaarde] = useState('');
  const [state, setState] = useState<'leeg' | 'bezig' | 'bewaard' | 'fout'>('leeg');
  const [fout, setFout] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function bewaar() {
    setState('bezig');
    setFout(null);
    startTransition(async () => {
      const res = await saveHrMax(Number(waarde.replace(',', '.')), date);
      if (res.ok) {
        setState('bewaard');
        onKlaar();
      } else {
        setState('fout');
        setFout(res.error);
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        bewaar();
      }}
      className="mt-2"
    >
      <label htmlFor="mp-hrmax" className="text-[13px] font-medium">Gemeten maximumhartslag</label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input id="mp-hrmax" inputMode="numeric" value={waarde} onChange={(e) => setWaarde(e.target.value)}
          placeholder={String(hrMax)}
          className="num w-24 rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
          style={{ background: 'var(--card2)', color: 'var(--ink)' }} />
        <span className="text-[12px]" style={{ color: 'var(--ink3)' }}>bpm</span>
        <button type="submit" disabled={state === 'bezig' || !waarde.trim()}
          className="interactive rounded-[var(--r-btn)] px-4 py-2.5 text-[13px] font-semibold disabled:opacity-40"
          style={{ background: 'var(--acc)', color: 'var(--acc-ink)' }}>
          {state === 'bezig' ? 'Opslaan…' : state === 'bewaard' ? 'Bewaard' : 'Bewaren'}
        </button>
      </div>
      <p className="mt-1.5 text-[12px]" style={{ color: 'var(--ink3)' }}>
        Je rekent nu met {hrMax}. Vul je hier een gemeten waarde in, dan schalen al je zones mee en blijft de meting
        bewaard, zodat je bij de volgende hertest ziet welke kant hij op gaat.
      </p>
      {fout ? <p className="mt-2 text-[12px]" style={{ color: 'var(--crit)' }}>{fout}</p> : null}
    </form>
  );
}

function NaarBloedwaarden({ ingevuld }: { ingevuld: boolean }) {
  return (
    <p className="mt-2 text-[13px]" style={{ color: 'var(--ink2)' }}>
      {ingevuld ? 'De uitslag staat erin. ' : 'De waarden vul je in bij '}
      <Link href="/instellingen" style={{ color: 'var(--acc)' }}>
        {ingevuld ? 'Bekijk of wijzig hem bij Instellingen' : 'Instellingen, onder Bloedwaarden'}
      </Link>
      . Daar staan ze naast je nulmeting.
    </p>
  );
}

function Cijfer({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="num text-[15px] font-semibold">{value}</dd>
      <dt className="text-[11px]" style={{ color: 'var(--ink3)' }}>{label}</dt>
    </div>
  );
}
