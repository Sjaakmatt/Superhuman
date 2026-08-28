import Link from 'next/link';
import { addDays, formatLong, today as todayIn } from '@/lib/date';

/** Bladeren door het plan. De pijl terug naar vandaag verschijnt alleen als je
 *  ergens anders staat. */
export default function DayNav({ date, first, last }: { date: string; first: string; last: string }) {
  const now = todayIn();
  const prev = addDays(date, -1);
  const next = addDays(date, 1);

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[13px]" style={{ color: 'var(--ink3)' }}>
          {date === now ? 'Vandaag' : date === addDays(now, 1) ? 'Morgen' : date === addDays(now, -1) ? 'Gisteren' : 'Plandag'}
        </p>
        <p className="text-[17px] font-bold first-letter:uppercase">{formatLong(date)}</p>
      </div>
      <nav className="flex items-center gap-1.5" aria-label="Andere dag">
        {date !== now ? (
          <Link href="/" className="interactive rounded-[var(--r-btn)] px-3 py-2 text-[12px] font-semibold"
            style={{ background: 'var(--acc-soft)', color: 'var(--acc)' }}>
            Vandaag
          </Link>
        ) : null}
        <Arrow href={`/?d=${prev}`} disabled={prev < first} label="Dag terug" d="M15 5l-7 7 7 7" />
        <Arrow href={`/?d=${next}`} disabled={next > last} label="Dag verder" d="M9 5l7 7-7 7" />
      </nav>
    </div>
  );
}

function Arrow({ href, disabled, label, d }: { href: string; disabled: boolean; label: string; d: string }) {
  const style = { background: 'var(--card)', color: 'var(--ink2)', border: '1px solid var(--hair)' };
  if (disabled) {
    return (
      <span aria-hidden className="grid h-9 w-9 place-items-center rounded-[var(--r-btn)]" style={{ ...style, opacity: 0.4 }}>
        <Glyph d={d} />
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className="interactive grid h-9 w-9 place-items-center rounded-[var(--r-btn)]" style={style}>
      <Glyph d={d} />
    </Link>
  );
}

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
