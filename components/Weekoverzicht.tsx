import Link from 'next/link';
import { Card, CardTitle, Note } from '@/components/ui';
import { loadColor, loadLevel } from '@/lib/load';
import { addDays, formatShort, weekStart, monthOf, type IsoDate } from '@/lib/date';
import type { Milestone, PlanDay, PlanWeek } from '@/lib/types';

/** De week als lijst, naast het maandraster. Het raster laat zien waar de
 *  zware dagen liggen; deze lijst zegt wát je die dagen doet. Kort: de soort
 *  sessie, de kilometers en of er kracht bij hoort. De rest staat op de dag
 *  zelf — daar klik je heen. */
export default function Weekoverzicht({
  days,
  week,
  milestones,
  today,
  selected,
  first,
  last,
}: {
  days: PlanDay[];
  week: PlanWeek | null;
  milestones: Milestone[];
  today: IsoDate;
  selected: IsoDate;
  first: IsoDate;
  last: IsoDate;
}) {
  if (!days.length) return null;

  const begin = weekStart(selected);
  const eind = addDays(begin, 6);
  const perMijlpaal = new Map(milestones.map((m) => [m.date, m]));
  const totaal = days.reduce((t, d) => t + Number(d.planned_km), 0);

  const vorige = addDays(begin, -7);
  const volgende = addDays(begin, 7);
  const kanTerug = addDays(vorige, 6) >= first;
  const kanVerder = volgende <= last;

  return (
    <Card>
      <CardTitle
        aside={
          <span className="flex items-center gap-2">
            <span className="num">{Math.round(totaal * 10) / 10} km</span>
            <WeekKnop href={link(vorige)} disabled={!kanTerug} label="Week terug" d="M15 5l-7 7 7 7" />
            <WeekKnop href={link(volgende)} disabled={!kanVerder} label="Week verder" d="M9 5l7 7-7 7" />
          </span>
        }
      >
        {week ? `Week ${week.week} · ` : ''}
        {formatShort(begin, today)} – {formatShort(eind, today)}
      </CardTitle>

      <ol className="flex flex-col">
        {days.map((dag) => (
          <Rij key={dag.date} dag={dag} mijlpaal={perMijlpaal.get(dag.date) ?? null} today={today} />
        ))}
      </ol>

      {week ? <Note>{week.focus}</Note> : null}
    </Card>
  );
}

/** De agenda blijft de agenda: bladeren door de weken wisselt niet van tab. */
function link(datum: IsoDate): string {
  return `/?d=${datum}&m=${monthOf(datum)}&v=agenda`;
}

function Rij({ dag, mijlpaal, today }: { dag: PlanDay; mijlpaal: Milestone | null; today: IsoDate }) {
  const km = Number(dag.planned_km);
  const isVandaag = dag.date === today;
  const geweest = dag.date < today;
  // Alleen het letterdeel van "Kracht A - onderlichaam zwaar + romp": de rest
  // staat op de dag zelf en bij Kracht.
  const kracht = dag.strength_block?.split(/\s[–-]\s/)[0]?.trim() ?? null;

  return (
    <li>
      <Link
        href={`/?d=${dag.date}`}
        aria-current={isVandaag ? 'date' : undefined}
        className="interactive flex items-center gap-3 border-b py-2.5 last:border-0"
        style={{ borderColor: 'var(--hair)', opacity: geweest ? 0.6 : 1 }}
      >
        <span aria-hidden className="h-8 w-1 shrink-0 rounded-full"
          style={{ background: km > 0 || dag.strength_block ? loadColor(loadLevel(dag)) : 'transparent' }} />

        <span className="w-11 shrink-0">
          <span className="block text-[12px] font-semibold uppercase"
            style={{ color: isVandaag ? 'var(--acc)' : 'var(--ink3)' }}>
            {dag.weekday.slice(0, 2)}
          </span>
          <span className="num block text-[11px]" style={{ color: 'var(--ink3)' }}>{Number(dag.date.slice(8))}</span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium">{dag.session_type}</span>
          {mijlpaal || kracht ? (
            <span className="block truncate text-[12px]">
              {mijlpaal ? <span style={{ color: 'var(--warn)' }}>{mijlpaal.title}</span> : null}
              {mijlpaal && kracht ? <span style={{ color: 'var(--ink3)' }}> · </span> : null}
              {kracht ? <span style={{ color: 'var(--ink3)' }}>{kracht}</span> : null}
            </span>
          ) : null}
        </span>

        <span className="num shrink-0 text-[13px] font-semibold" style={{ color: km > 0 ? 'var(--ink)' : 'var(--ink3)' }}>
          {km > 0 ? `${km} km` : '–'}
        </span>
      </Link>
    </li>
  );
}

function WeekKnop({ href, disabled, label, d }: { href: string; disabled: boolean; label: string; d: string }) {
  const style = { background: 'var(--card2)', color: 'var(--ink2)' };
  const klas = 'grid h-7 w-7 place-items-center rounded-[var(--r-btn)]';
  if (disabled) {
    return (
      <span aria-hidden className={klas} style={{ ...style, opacity: 0.4 }}>
        <Glyph d={d} />
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={`interactive ${klas}`} style={style}>
      <Glyph d={d} />
    </Link>
  );
}

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
