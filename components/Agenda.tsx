import Link from 'next/link';
import { Card, CardTitle } from '@/components/ui';
import { addMonths, formatMonth, monthDays, weekdayIndex, type IsoDate } from '@/lib/date';
import type { Milestone, PlanDay } from '@/lib/types';

const KOPPEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'] as const;

/** Overzicht van een hele maand in plaats van dag voor dag bladeren. Je ziet in
 *  één blik waar de lange dagen staan, waar de rustdagen vallen en welke
 *  mijlpaal eraan komt. De maand staat los van de gekozen dag (`?m=`), zodat je
 *  vooruit kunt kijken zonder je dag kwijt te raken. */
export default function Agenda({
  month,
  days,
  milestones,
  selected,
  today,
  first,
  last,
  href,
}: {
  month: string;
  days: PlanDay[];
  milestones: Milestone[];
  selected: IsoDate;
  today: IsoDate;
  first: IsoDate;
  last: IsoDate;
  /** `/` of `/loggen` — de agenda stuurt je binnen hetzelfde scherm. */
  href: '/' | '/loggen';
}) {
  const perDag = new Map(days.map((d) => [d.date, d]));
  const perMijlpaal = new Map(milestones.map((m) => [m.date, m]));
  const dagen = monthDays(month);
  const leeg = weekdayIndex(dagen[0]!);

  const vorige = addMonths(month, -1);
  const volgende = addMonths(month, 1);
  const kanTerug = `${vorige}-31` >= first.slice(0, 7) + '-01';
  const kanVerder = `${volgende}-01` <= last;

  return (
    <Card>
      <CardTitle
        aside={
          <span className="flex items-center gap-1">
            <MaandKnop href={`${href}?d=${selected}&m=${vorige}`} disabled={!kanTerug} label="Maand terug" d="M15 5l-7 7 7 7" />
            <MaandKnop href={`${href}?d=${selected}&m=${volgende}`} disabled={!kanVerder} label="Maand verder" d="M9 5l7 7-7 7" />
          </span>
        }
      >
        {formatMonth(month)}
      </CardTitle>

      <div className="grid grid-cols-7 gap-1">
        {KOPPEN.map((k) => (
          <div key={k} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-[.06em]"
            style={{ color: 'var(--ink3)' }}>
            {k}
          </div>
        ))}

        {Array.from({ length: leeg }, (_, i) => <div key={`leeg-${i}`} />)}

        {dagen.map((datum) => (
          <Dag
            key={datum}
            datum={datum}
            dag={perDag.get(datum) ?? null}
            mijlpaal={perMijlpaal.get(datum) ?? null}
            isVandaag={datum === today}
            isGekozen={datum === selected}
            href={href}
            maand={month}
          />
        ))}
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--ink3)' }}>
        <Legenda kleur="var(--acc)">lange dag</Legenda>
        <Legenda kleur="var(--warn)">intensief</Legenda>
        <Legenda kleur="var(--ink3)">rustig</Legenda>
        <span>· een streepje is een rustdag · een lijn onder de dag is een mijlpaal</span>
      </p>
    </Card>
  );
}

/** De kleur van het bolletje volgt de geplande sessie, niet een oordeel: lang,
 *  intensief of rustig. Rustdagen krijgen niets. */
function tint(dag: PlanDay | null): string | null {
  if (!dag) return null;
  const km = Number(dag.planned_km);
  const soort = `${dag.session_type} ${dag.session_text}`.toLowerCase();
  if (/rust|vrij/.test(soort) && km === 0) return null;
  if (km >= 20 || /lang|back-to-back/.test(soort)) return 'var(--acc)';
  if (/tempo|interval|heuvel|drempel|snelheid|test/.test(soort)) return 'var(--warn)';
  if (km === 0 && dag.strength_block) return 'var(--ink3)';
  if (km === 0) return null;
  return 'var(--ink3)';
}

function Dag({
  datum,
  dag,
  mijlpaal,
  isVandaag,
  isGekozen,
  href,
  maand,
}: {
  datum: IsoDate;
  dag: PlanDay | null;
  mijlpaal: Milestone | null;
  isVandaag: boolean;
  isGekozen: boolean;
  href: '/' | '/loggen';
  maand: string;
}) {
  const nummer = Number(datum.slice(8));
  const kleur = tint(dag);
  const km = dag ? Number(dag.planned_km) : 0;

  const inhoud = (
    <>
      <span className="num text-[13px] font-semibold">{nummer}</span>
      <span className="num text-[10px] leading-none" style={{ color: 'var(--ink3)' }}>
        {km > 0 ? Math.round(km) : '–'}
      </span>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full"
        style={{ background: kleur ?? 'transparent' }} />
    </>
  );

  const basis = 'flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-[var(--r-btn)] side:h-[58px]';

  if (!dag) {
    return (
      <span className={basis} style={{ color: 'var(--ink3)', opacity: 0.35 }} aria-hidden>
        <span className="num text-[13px]">{nummer}</span>
      </span>
    );
  }

  const label = [
    `${nummer}`,
    dag.session_type,
    km > 0 ? `${km} kilometer` : null,
    mijlpaal ? mijlpaal.title : null,
    isVandaag ? 'vandaag' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Link
      href={`${href}?d=${datum}&m=${maand}`}
      aria-label={label}
      aria-current={isGekozen ? 'date' : undefined}
      className={`interactive ${basis}`}
      style={{
        background: isGekozen ? 'var(--acc-soft)' : 'var(--card2)',
        color: isGekozen ? 'var(--acc)' : 'var(--ink)',
        // De ring markeert vandaag; een mijlpaal krijgt een streepje eronder.
        outline: isVandaag ? '2px solid var(--acc)' : 'none',
        outlineOffset: '-2px',
        borderBottom: mijlpaal ? '3px solid var(--warn)' : '3px solid transparent',
      }}
    >
      {inhoud}
    </Link>
  );
}

function Legenda({ kleur, children }: { kleur: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: kleur }} />
      {children}
    </span>
  );
}

function MaandKnop({ href, disabled, label, d }: { href: string; disabled: boolean; label: string; d: string }) {
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
