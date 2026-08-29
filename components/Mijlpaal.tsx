import MijlpaalUitslag, { type Gemeten } from '@/components/MijlpaalUitslag';
import VraagDeCoach from '@/components/VraagDeCoach';
import { Card, CardTitle, Pill } from '@/components/ui';
import { formatLong, daysBetween, type IsoDate } from '@/lib/date';
import type { Fueling, Milestone, MilestoneResult, PlanDay, Zones } from '@/lib/types';

const TOON: Record<string, 'acc' | 'warn' | 'neutral'> = {
  wedstrijd: 'warn',
  test: 'acc',
  simulatie: 'acc',
  meting: 'neutral',
  fase: 'neutral',
  beslissing: 'neutral',
  grens: 'warn',
};

/** Wat er van een mijlpaal te weten valt, uit het plan en de naslag. Niets
 *  hiervan is in de component verzonnen: de sessie komt uit plan_day, de
 *  voedingsgetallen en de zones uit reference, de notities uit de seed. Voor de
 *  woorden eromheen is er de coach. */
export default function Mijlpaal({
  milestone,
  day,
  fueling,
  zones,
  today,
  reference,
  result,
  gemeten,
  bloedIngevuld,
}: {
  milestone: Milestone;
  day: PlanDay | null;
  fueling: Fueling | null;
  zones: Zones;
  /** Wat je er zelf over noteerde, als je dat al deed. */
  result: MilestoneResult | null;
  /** Wat de app al van die dag weet: de activiteit en de sessielog. */
  gemeten: Gemeten;
  /** Of er al een bloedpanel rond deze datum staat. */
  bloedIngevuld: boolean;
  /** De echte dag van vandaag. */
  today: IsoDate;
  /** De dag die je op het scherm bekijkt. Bladert hij vooruit, dan telt de
   *  afstand vanaf díe dag — maar "vandaag" mag hij dan niet heten. */
  reference: IsoDate;
}) {
  const over = daysBetween(reference, milestone.date);
  const kijktNaarVandaag = reference === today;
  const wanneer = kijktNaarVandaag
    ? over === 0
      ? 'Vandaag'
      : over === 1
        ? 'Morgen'
        : `Over ${over} dagen`
    : over === 0
      ? 'Op deze dag'
      : `${over} ${over === 1 ? 'dag' : 'dagen'} later`;

  const km = day ? Number(day.planned_km) : 0;
  // Voeding is alleen een vraag bij iets van enige lengte; bij een bloedpanel
  // of een beslissing zeggen die getallen niets.
  const toontVoeding = Boolean(fueling) && (km >= 20 || /wedstrijd|simulatie/.test(milestone.kind));
  // Het plan schrijft een streepje waar geen zone of tempo van toepassing is.
  const band = day?.zone && day.zone !== '-' ? zones.bands.find((b) => b.key === day.zone) : null;
  const tempo = day?.pace_range && day.pace_range !== '-' ? day.pace_range : null;

  const vraag = `Op ${milestone.date} staat "${milestone.title}" op het programma. Hoe bereid ik me daarop voor?`;

  return (
    <Card>
      <CardTitle aside={<Pill tone={TOON[milestone.kind] ?? 'neutral'}>{milestone.kind}</Pill>}>
        {wanneer}
      </CardTitle>

      <p className="text-[17px] font-bold tracking-tight">{milestone.title}</p>
      <p className="mt-0.5 text-[13px] first-letter:uppercase" style={{ color: 'var(--ink3)' }}>
        {formatLong(milestone.date)} · week {milestone.week}
      </p>

      {day ? (
        <div className="mt-4 rounded-[var(--r-tile)] px-4 py-3" style={{ background: 'var(--card2)' }}>
          <p className="text-[12px] font-semibold uppercase tracking-[.08em]" style={{ color: 'var(--ink3)' }}>
            Wat er die dag staat
          </p>
          <p className="mt-1.5 text-[14px] font-semibold">{day.session_type}</p>
          <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed" style={{ color: 'var(--ink2)' }}>
            {day.session_text}
          </p>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {km > 0 ? <Getal label="afstand" value={`${km} km`} /> : null}
            {day.planned_min ? <Getal label="tijd" value={`${day.planned_min} min`} /> : null}
            {band ? <Getal label="hartslag" value={`${band.hr_min}–${band.hr_max} bpm`} /> : null}
            {tempo ? <Getal label="tempo" value={tempo} /> : null}
          </dl>
        </div>
      ) : null}

      {toontVoeding && fueling ? (
        <div className="mt-3 rounded-[var(--r-tile)] px-4 py-3" style={{ background: 'var(--card2)' }}>
          <p className="text-[12px] font-semibold uppercase tracking-[.08em]" style={{ color: 'var(--ink3)' }}>
            Eten en drinken per uur
          </p>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            <Getal label="koolhydraten" value={`${bereik(fueling.carbs_g_per_h)} gram`} />
            <Getal label="natrium" value={`${bereik(fueling.sodium_mg_per_h)} mg`} />
          </dl>
        </div>
      ) : null}

      {milestone.prep?.length ? (
        <ul className="mt-3 flex flex-col gap-1.5 pl-4">
          {milestone.prep.map((regel) => (
            <li key={regel} className="list-disc text-[13px] leading-relaxed" style={{ color: 'var(--ink2)' }}>
              {regel}
            </li>
          ))}
        </ul>
      ) : null}

      <VraagDeCoach vraag={vraag}>Vraag de coach om een briefing</VraagDeCoach>

      <MijlpaalUitslag
        date={milestone.date}
        logs={milestone.logs ?? null}
        saved={result}
        verleden={milestone.date <= today}
        gemeten={gemeten}
        hrMax={zones.hr_max}
        bloedIngevuld={bloedIngevuld}
      />
    </Card>
  );
}

/** "30–45" of gewoon "300" als de onder- en bovengrens gelijk zijn. */
function bereik([laag, hoog]: [number, number]): string {
  return laag === hoog ? `${laag}` : `${laag}–${hoog}`;
}

function Getal({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="num text-[15px] font-semibold">{value}</dd>
      <dt className="text-[11px]" style={{ color: 'var(--ink3)' }}>{label}</dt>
    </div>
  );
}
