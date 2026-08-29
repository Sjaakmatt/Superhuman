import Link from 'next/link';
import Ring from '@/components/charts/Ring';
import SeasonGrid from '@/components/charts/SeasonGrid';
import VolumeProfile from '@/components/charts/VolumeProfile';
import { Card, CardTitle, Grid, Note, Pill, Stat } from '@/components/ui';
import { getDays, getReference, getWeeks, planBounds } from '@/lib/plan';
import Metingen from '@/components/Metingen';
import { getBloodPanels, getHrTests, getIjkPunten, getMilestoneResults, getWeekActuals } from '@/lib/data';
import { addDays, daysBetween, formatShort, today as todayIn } from '@/lib/date';

const KIND: Record<string, 'acc' | 'warn' | 'neutral'> = {
  wedstrijd: 'warn',
  test: 'acc',
  simulatie: 'acc',
  meting: 'neutral',
  fase: 'neutral',
  beslissing: 'neutral',
  grens: 'warn',
};

/* Dit scherm gaat over vandaag, dus nooit vooraf renderen: anders bevriest
 * "vandaag" op de bouwdatum. */
export const dynamic = 'force-dynamic';

export default async function Seizoen() {
  const now = todayIn();
  const bounds = planBounds();
  const [weeks, days, milestones, actuals, uitslagen] = await Promise.all([
    getWeeks(),
    getDays(bounds.first, bounds.last),
    getReference('milestones'),
    getWeekActuals(),
    getMilestoneResults(),
  ]);

  // De ijkpunten komen uit Strava; alleen de dagen die al geweest zijn.
  const loopdagen = milestones.filter((m) => m.logs === 'loop' && m.date <= now).map((m) => m.date);
  const [ijkpunten, hrTests, panels] = await Promise.all([
    getIjkPunten(loopdagen),
    getHrTests(),
    getBloodPanels(),
  ]);

  const current = weeks.find((w) => w.start_date <= now && addDays(w.start_date, 6) >= now);
  const done = Math.max(0, daysBetween(bounds.first, now));
  const totalDays = daysBetween(bounds.first, bounds.last) + 1;

  const totalKm = weeks.reduce((t, w) => t + Number(w.target_km), 0);
  const ranKm = actuals.reduce((t, a) => t + Number(a.actual_km), 0);

  // Alleen weken die al geweest zijn krijgen een gelopen waarde. Voor de rest
  // null: nul zou "niets gelopen" betekenen in plaats van "moet nog komen".
  const actualByWeek = new Map(actuals.map((a) => [a.week, Number(a.actual_km)]));
  const volume = weeks.map((w) => ({
    week: w.week,
    phase: w.phase,
    status: w.status,
    target_km: Number(w.target_km),
    actual_km: current && w.week > current.week ? null : actualByWeek.get(w.week) ?? 0,
  }));

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-4 pt-2">
      <Card>
        <CardTitle aside={current ? <Pill tone="acc">week {current.week} van 57</Pill> : null}>Het seizoen</CardTitle>
        <div className="flex flex-wrap items-center justify-between gap-6">
          <Ring value={totalDays ? done / totalDays : 0} label="Van het plan afgelegd"
            sub={`${done} van ${totalDays} dagen · nog ${Math.max(0, daysBetween(now, bounds.race))} tot de wedstrijd`} />
          <Grid min={120}>
            <Stat value={Math.round(totalKm)} unit="km" label="gepland in totaal" />
            <Stat value={Math.round(ranKm)} unit="km" label="tot nu toe gelopen" />
            <Stat value={weeks.filter((w) => w.status === 'DELOAD').length} label="deloadweken" />
            <Stat value={(current ?? weeks[0]!).phase.replace(/^\d+\.\s*/, '')}
              label={current ? 'fase' : 'eerste fase'} />
          </Grid>
        </div>
      </Card>

      <Card>
        <CardTitle aside="kilometers per week">Volumeprofiel</CardTitle>
        <VolumeProfile weeks={volume} currentWeek={current?.week ?? null} />
        <div className="mt-2 flex justify-between text-[11px]" style={{ color: 'var(--ink3)' }}>
          <span>week 1 · {formatShort(bounds.first)} 2026</span>
          <span>week 57 · {formatShort(bounds.race)} 2027</span>
        </div>
        <Note>De dip elke vierde week is de deloadweek. Zonder die dip stijgt de chronische belasting door en werkt de weeksprong niet meer als maat.</Note>
      </Card>

      <Card>
        <CardTitle aside="57 weken × 7 dagen">Elke dag</CardTitle>
        <SeasonGrid days={days} today={now} />
      </Card>

      <Metingen milestones={milestones} ijkpunten={ijkpunten} hrTests={hrTests} panels={panels} today={now} />

      <Card>
        <CardTitle aside={`${milestones.length} mijlpalen`}>Wat er aankomt</CardTitle>
        <ol className="flex flex-col">
          {milestones.map((m) => {
            const uitslag = uitslagen.get(m.date) ?? null;
            const past = m.date < now;
            return (
              <li key={`${m.week}-${m.title}`} className="flex items-center gap-3 border-b py-3 last:border-0"
                style={{ borderColor: 'var(--hair)', opacity: past && !uitslag ? 0.5 : 1 }}>
                <span className="num w-12 shrink-0 text-[12px]" style={{ color: 'var(--ink3)' }}>wk {m.week}</span>
                <Link href={`/?d=${m.date}`} className="num w-20 shrink-0 text-[12px]" style={{ color: 'var(--ink2)' }}>
                  {formatShort(m.date, now)}
                </Link>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{m.title}</span>
                  {uitslag?.outcome ? (
                    <span className="block truncate text-[12px]" style={{ color: 'var(--ink3)' }}>{uitslag.outcome}</span>
                  ) : null}
                </span>
                {uitslag?.done ? (
                  <span aria-label="gedaan" title="gedaan" style={{ color: 'var(--acc)' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
                      strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 12l5 5L20 6" />
                    </svg>
                  </span>
                ) : null}
                <Pill tone={KIND[m.kind] ?? 'neutral'}>{m.kind}</Pill>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
