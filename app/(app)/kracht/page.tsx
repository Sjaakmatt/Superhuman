import Link from 'next/link';
import DatumVeld from '@/components/DatumVeld';
import StrengthBoard, { type Previous, type SetValue } from '@/components/StrengthBoard';
import { Card, CardTitle, Empty, Note, Pill } from '@/components/ui';
import { getDay, getExercises, getReference, getWeek, phaseForWeek } from '@/lib/plan';
import { getLastSets, getStrengthSession } from '@/lib/data';
import { dbConfigured } from '@/lib/db';
import { parseBlock } from '@/lib/strength';
import { addDays, formatLong, today as todayIn } from '@/lib/date';

export default async function Kracht({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const params = await searchParams;
  const now = todayIn();
  const date = params.d && /^\d{4}-\d{2}-\d{2}$/.test(params.d) ? params.d : now;

  const [day, exercises, phases] = await Promise.all([getDay(date), getExercises(), getReference('strength_phases')]);
  const week = day ? await getWeek(day.week) : null;
  const phase = week ? phaseForWeek(phases, week.week) : null;

  const planned = parseBlock(day?.strength_detail ?? null, exercises);
  const stored = await getStrengthSession(date);
  const previousSets = await getLastSets(date);

  const saved: Record<string, SetValue[]> = {};
  for (const set of stored?.sets ?? []) {
    (saved[set.exercise] ??= [])[set.set_no - 1] = {
      weight_kg: set.weight_kg,
      reps: set.reps,
      done: set.done,
    };
  }

  const previous: Record<string, Previous> = {};
  for (const [slug, entry] of previousSets) {
    previous[slug] = {
      date: entry.date,
      sets: entry.sets.map((s) => ({ weight_kg: s.weight_kg, reps: s.reps, done: s.done })),
    };
  }

  // Zoek de eerstvolgende dag met een krachtblok, zodat een rustdag niet doodloopt.
  const upcoming = !day?.strength_block ? await nextStrengthDay(date) : null;

  // Vooruitkijken mag — je wilt weten wat er vrijdag staat. Invullen niet: een
  // sessie die nog moet komen kun je niet loggen.
  const toekomst = date > now;
  const vorige = addDays(date, -1);
  const volgende = addDays(date, 1);

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-4 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px]" style={{ color: 'var(--ink3)' }}>
            {date === now ? 'Vandaag' : date === addDays(now, -1) ? 'Gisteren' : date === addDays(now, 1) ? 'Morgen' : 'Andere dag'}
          </p>
          <p className="text-[17px] font-bold first-letter:uppercase">{formatLong(date)}</p>
        </div>
        <nav className="flex items-center gap-1.5" aria-label="Andere dag">
          {date !== now ? (
            <Link href="/kracht" className="interactive rounded-[var(--r-btn)] px-3 py-2 text-[12px] font-semibold"
              style={{ background: 'var(--acc-soft)', color: 'var(--acc)' }}>
              Vandaag
            </Link>
          ) : null}
          <DatumVeld pad="/kracht" date={date} />
          <Pijl href={`/kracht?d=${vorige}`} label="Dag terug" d="M15 5l-7 7 7 7" />
          <Pijl href={`/kracht?d=${volgende}`} label="Dag verder" d="M9 5l7 7-7 7" />
        </nav>
      </div>

      {phase ? (
        <div className="flex">
          <Pill tone="acc">{phase.name} · {phase.scheme}</Pill>
        </div>
      ) : null}

      {day?.strength_block ? (
        <StrengthBoard
          date={date}
          block={day.strength_block}
          exercises={planned}
          saved={saved}
          previous={previous}
          completed={Boolean(stored?.session.completed_at)}
          writable={dbConfigured() && !toekomst}
        />
      ) : (
        <Empty title={date === now ? 'Geen krachtblok vandaag' : `Geen krachtblok op ${formatLong(date)}`}>
          {upcoming ? (
            <>
              De eerstvolgende staat op{' '}
              <Link href={`/kracht?d=${upcoming.date}`} style={{ color: 'var(--acc)' }}>{formatLong(upcoming.date)}</Link>:{' '}
              {upcoming.block}.
            </>
          ) : (
            'In de rest van het plan staat geen krachtsessie meer.'
          )}
        </Empty>
      )}

      {phase ? (
        <Card sunk>
          <CardTitle aside={`week ${phase.weeks[0]}–${phase.weeks[1]}`}>Krachtfase</CardTitle>
          <p className="text-[15px] font-semibold first-letter:uppercase">{phase.name}</p>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--ink2)' }}>
            {phase.scheme} · {phase.freq} keer per week
            {phase.plyo_contacts > 0 ? ` · ${phase.plyo_contacts} plyo-contacten` : ''}
          </p>
          <Note>Schema en frequentie komen uit reference-seed.json, niet uit de app.</Note>
        </Card>
      ) : null}

      {toekomst && day?.strength_block ? (
        <Note>Deze sessie moet nog komen. Je kunt hem bekijken; invullen kan vanaf de dag zelf.</Note>
      ) : null}

      {!dbConfigured() ? (
        <Empty title="Je invoer wordt niet bewaard">
          Zonder database kun je het blok wel zien, maar niet loggen.
        </Empty>
      ) : null}
    </div>
  );
}

async function nextStrengthDay(from: string) {
  for (let i = 1; i <= 14; i++) {
    const day = await getDay(addDays(from, i));
    if (day?.strength_block) return { date: day.date, block: day.strength_block };
  }
  return null;
}

function Pijl({ href, label, d }: { href: string; label: string; d: string }) {
  return (
    <Link href={href} aria-label={label}
      className="interactive grid h-9 w-9 place-items-center rounded-[var(--r-btn)]"
      style={{ background: 'var(--card)', color: 'var(--ink2)', border: '1px solid var(--hair)' }}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    </Link>
  );
}
