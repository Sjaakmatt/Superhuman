import Link from 'next/link';
import { Card, CardTitle } from '@/components/ui';
import { loadColor, loadInk, loadLevel } from '@/lib/load';
import { formatShort } from '@/lib/date';
import type { PlanDay } from '@/lib/types';

/** De week in één oogopslag. De kleur is de belastingschaal, niet een oordeel. */
export default function WeekStrip({ days, today }: { days: PlanDay[]; today: string }) {
  const total = days.reduce((t, d) => t + Number(d.planned_km), 0);
  return (
    <Card>
      <CardTitle aside={<span className="num">{Math.round(total * 10) / 10} km gepland</span>}>Deze week</CardTitle>
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
                <span className="block text-[9px]" style={{ opacity: 0.75 }}>{formatShort(day.date, today)}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
