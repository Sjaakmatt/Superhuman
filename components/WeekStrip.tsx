import Link from 'next/link';
import { Card, CardTitle, Note } from '@/components/ui';
import { loadColor, loadInk, loadLevel } from '@/lib/load';
import { formatShort } from '@/lib/date';
import type { PlanDay } from '@/lib/types';

/** De week in één oogopslag. De kleur is de belastingschaal, niet een oordeel.
 *  Onder het geplande getal staat wat je werkelijk liep, zodra dat er is. */
export default function WeekStrip({
  days,
  today,
  gelopen,
}: {
  days: PlanDay[];
  today: string;
  /** Gelopen kilometers per dag, alleen hardlopen. */
  gelopen: Map<string, number>;
}) {
  const total = days.reduce((t, d) => t + Number(d.planned_km), 0);
  const totaalGelopen = days.reduce((t, d) => t + (gelopen.get(d.date) ?? 0), 0);
  return (
    <Card>
      <CardTitle
        aside={
          <span className="num">
            {Math.round(totaalGelopen * 10) / 10} van {Math.round(total * 10) / 10} km
          </span>
        }
      >
        Deze week
      </CardTitle>
      <ol className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const level = loadLevel(day);
          const isToday = day.date === today;
          const past = day.date < today;
          return (
            <li key={day.date}>
              <Link href={`/?d=${day.date}`} aria-current={isToday ? 'date' : undefined}
                className="interactive block rounded-[var(--r-tile)] px-1 py-2.5 text-center"
                style={{
                  background: loadColor(level),
                  color: loadInk(level),
                  opacity: past && !isToday ? 0.55 : 1,
                  outline: isToday ? '2px solid var(--acc)' : 'none',
                  outlineOffset: '2px',
                }}>
                <span className="block text-[10px] font-semibold uppercase tracking-wide">{day.weekday.slice(0, 2)}</span>
                <span className="num mt-1 block text-[14px] font-semibold">
                  {Number(day.planned_km) > 0 ? Number(day.planned_km) : '—'}
                </span>
                <span className="num block text-[11px] font-semibold" style={{ opacity: 0.8 }}>
                  {gelopen.get(day.date) ? gelopen.get(day.date) : '\u00A0'}
                </span>
                <span className="block text-[9px]" style={{ opacity: 0.75 }}>{formatShort(day.date, today)}</span>
              </Link>
            </li>
          );
        })}
      </ol>
      <Note>Het bovenste getal is gepland, het getal eronder is wat je liep.</Note>
    </Card>
  );
}
