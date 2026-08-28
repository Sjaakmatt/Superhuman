import Link from 'next/link';
import { loadColor, loadLevel } from '@/lib/load';
import type { PlanDay } from '@/lib/types';

/** 57 weken naast elkaar, zeven dagen onder elkaar. Kleur is belasting.
 *  Eén blik en je ziet de blokken, de deloadweken en de taper. */
export default function SeasonGrid({ days, today }: { days: PlanDay[]; today: string }) {
  const cell = 11;
  const gap = 2;
  const weeks = [...new Set(days.map((d) => d.week))].sort((a, b) => a - b);
  const byWeek = new Map<number, PlanDay[]>();
  for (const day of days) {
    const list = byWeek.get(day.week);
    if (list) list.push(day);
    else byWeek.set(day.week, [day]);
  }

  const width = weeks.length * (cell + gap);
  const height = 7 * (cell + gap) + 16;
  const rows = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-2">
        <ol className="flex shrink-0 flex-col justify-start gap-[2px] pt-0" aria-hidden>
          {rows.map((r) => (
            <li key={r} className="text-[9px] leading-[11px]" style={{ color: 'var(--ink3)', height: cell }}>{r}</li>
          ))}
        </ol>
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img"
          aria-label="Belasting per dag over 57 weken">
          {weeks.map((week, wi) => {
            const list = (byWeek.get(week) ?? []).sort((a, b) => a.date.localeCompare(b.date));
            return (
              <g key={week}>
                {list.map((day, di) => (
                  <rect key={day.date} x={wi * (cell + gap)} y={di * (cell + gap)} width={cell} height={cell} rx="3"
                    fill={loadColor(loadLevel(day))}
                    stroke={day.date === today ? 'var(--acc)' : 'none'}
                    strokeWidth={day.date === today ? 2 : 0}>
                    <title>{`${day.date} — ${day.session_type}${Number(day.planned_km) ? `, ${day.planned_km} km` : ''}`}</title>
                  </rect>
                ))}
                {week % 4 === 1 ? (
                  <text x={wi * (cell + gap)} y={height - 3} fontSize="8" fill="var(--ink3)" className="num">{week}</text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-3 flex items-center gap-2 text-[11px]" style={{ color: 'var(--ink3)' }}>
        rustig
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} aria-hidden className="inline-block h-3 w-3 rounded-[3px]" style={{ background: loadColor(l) }} />
        ))}
        zwaar
        <Link href="/" className="ml-auto font-semibold" style={{ color: 'var(--acc)' }}>Naar vandaag</Link>
      </p>
    </div>
  );
}
