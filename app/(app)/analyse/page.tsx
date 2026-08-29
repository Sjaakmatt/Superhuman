import Link from 'next/link';
import Alerts from '@/components/Alerts';
import DistributionBar from '@/components/charts/DistributionBar';
import AerobicTrend from '@/components/charts/AerobicTrend';
import Trend from '@/components/charts/Trend';
import WeekBars from '@/components/charts/WeekBars';
import InsightPanel from '@/components/InsightPanel';
import { Card, CardTitle, Empty, Grid, Note, Stat } from '@/components/ui';
import { getWeeks } from '@/lib/plan';
import { getAerobicSessions, getInsights, getWeekActuals, getWellness, getZoneSeconds, getZones, loadRuleInput } from '@/lib/data';
import { dbConfigured } from '@/lib/db';
import { BACKFILL_FROM } from '@/lib/strava';
import { evaluate } from '@/lib/rules';
import { distribution, weekJump, wellnessTrend, z2Drift } from '@/lib/metrics';
import { addDays, today as todayIn, weekStart } from '@/lib/date';

/* Dit scherm gaat over vandaag, dus nooit vooraf renderen: anders bevriest
 * "vandaag" op de bouwdatum. */
export const dynamic = 'force-dynamic';

export default async function Analyse() {
  const now = todayIn();
  const [weeks, zones] = await Promise.all([getWeeks(), getZones()]);
  const current = weeks.find((w) => w.start_date <= now && addDays(w.start_date, 6) >= now) ?? weeks[0]!;

  const [actuals, wellness, zoneSeconds, insights] = await Promise.all([
    getWeekActuals(),
    getWellness(addDays(now, -41), now),
    getZoneSeconds(addDays(now, -27), now),
    getInsights(6),
  ]);

  // Alles wat we hebben, niet een venster: een basis bouw je over maanden, en
  // de lopen van vóór het plan horen er net zo goed bij.
  const aeroob = await getAerobicSessions(BACKFILL_FROM, now);

  const ruleInput = await loadRuleInput(now, current.week, current.status);
  const hits = ruleInput ? evaluate(ruleInput) : [];

  const actualByWeek = new Map(actuals.map((a) => [a.week, a]));
  const window = weeks.filter((w) => w.week > current.week - 12 && w.week <= current.week);
  const bars = window.map((w) => ({
    week: w.week,
    planned: Number(w.target_km),
    actual: actualByWeek.has(w.week) ? Number(actualByWeek.get(w.week)!.actual_km) : null,
  }));

  const volumes = new Map(actuals.map((a) => [a.week, Number(a.actual_km)]));
  const jump = weekJump(volumes, current.week);
  const dist = distribution(zoneSeconds);
  const trend = wellnessTrend(wellness, now);
  const drift = ruleInput ? z2Drift(ruleInput.z2, ruleInput.z2Ceiling) : null;

  const thisWeek = actualByWeek.get(current.week);
  const wellnessPoints = Array.from({ length: 28 }, (_, i) => {
    const date = addDays(now, -(27 - i));
    return { label: date, value: wellness.find((w) => w.date === date)?.total ?? null };
  });

  return (
    <div className="mx-auto flex max-w-[980px] flex-col gap-4 pt-2">
      {hits.length > 0 ? <Alerts hits={hits} /> : null}

      <Card>
        <CardTitle aside={<Link href="/seizoen" className="font-semibold" style={{ color: 'var(--acc)' }}>Seizoen →</Link>}>
          Week {current.week} · {current.status}
        </CardTitle>
        <Grid min={130}>
          <Stat value={thisWeek ? Math.round(Number(thisWeek.actual_km)) : '—'} unit="km"
            label={`gelopen van ${current.target_km}`} />
          <Stat value={thisWeek ? Math.round(Number(thisWeek.actual_hm)) : '—'} unit="hm"
            label={current.hm_target ? `doel ${current.hm_target}` : 'geen doel'} />
          <Stat value={thisWeek ? Math.round(Number(thisWeek.actual_descent_min)) : '—'} unit="min"
            label={current.descent_min_target ? `afdalen, doel ${current.descent_min_target}` : 'afdalen'} />
          <Stat value={thisWeek ? Number(thisWeek.strength_done) : '—'}
            label={`kracht van ${current.strength_sessions}`} />
        </Grid>
        <Note>
          Afdaalminuten zijn onze eigen maat: seconden waarin het verhang steiler is dan −4%, uit de grade_smooth-stream.
        </Note>
      </Card>

      <Card>
        <CardTitle aside="laatste 12 weken">Gepland tegen gelopen</CardTitle>
        {bars.some((b) => b.actual !== null) ? (
          <WeekBars rows={bars} />
        ) : (
          <Empty title="Nog niets gelopen">
            De omtrek is het plan, de vulling wat je liep. Zodra Strava synchroniseert vult dit zich vanzelf.
          </Empty>
        )}
      </Card>

      <div className="grid gap-4 side:grid-cols-2">
        <Card>
          <CardTitle aside="28 dagen">Verdeling over de zones</CardTitle>
          {dist.seconds > 0 ? (
            <DistributionBar actual={dist} target={zones.distribution_target} />
          ) : (
            <Empty title="Nog geen hartslagdata">Zonder hartslagstream is er geen verdeling te tonen.</Empty>
          )}
        </Card>

        <Card>
          <CardTitle aside={trend.baseline !== null ? `basislijn ${trend.baseline.toFixed(1).replace('.', ',')}` : ''}>
            Hoe je je voelde
          </CardTitle>
          {wellnessPoints.filter((p) => p.value !== null).length >= 2 ? (
            <>
              <Trend points={wellnessPoints} baseline={trend.baseline} markIndex={27}
                ariaLabel="Welzijnstotaal over de laatste 28 dagen" />
              <Note>De stippellijn is je eigen basislijn: de 28 dagen die een week geleden eindigden.</Note>
            </>
          ) : (
            <Empty title="Te weinig ochtendchecks">Vanaf twee ingevulde dagen verschijnt hier een lijn.</Empty>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle aside="meters per minuut per hartslag">Aerobe basis</CardTitle>
        {aeroob.length >= 3 ? (
          <>
            <AerobicTrend points={aeroob} />
            <Note>
              Hoe verder je afstand aflegt per hartslag, hoe beter je basis. Een stijgende lijn betekent dat je bij
              dezelfde hartslag sneller loopt — precies waar dit blok op stuurt. Meetellen doen hardloopsessies van
              minstens twintig minuten waarvan de gemiddelde hartslag in Z2 viel én die hoogstens een tiende van de
              tijd erboven zaten. Dat laatste houdt sessies van hard-en-uitrusten eruit: die komen gemiddeld ook in Z2
              uit en scoren kunstmatig hoog. Heuvels drukken de waarde, dus de hoogtemeters staan bij elk punt.
            </Note>
          </>
        ) : (
          <Empty title="Nog te weinig duurlopen">
            Vanaf drie hardloopsessies van twintig minuten of langer waarvan de gemiddelde hartslag in Z2 viel,
            verschijnt hier de lijn. Ook lopen van vóór het plan tellen mee.
          </Empty>
        )}
      </Card>

      <Card>
        <CardTitle>Stuurvariabelen</CardTitle>
        <Grid min={150}>
          <Stat value={jump === null ? '—' : jump.toFixed(2).replace('.', ',')} label="weeksprong (vlag boven 1,30)"
            tone={jump !== null && jump > 1.3 ? 'warn' : undefined} />
          <Stat value={drift === null ? '—' : `${drift > 0 ? '+' : ''}${Math.round(drift)}`} unit={drift === null ? undefined : 'bpm'}
            label={`Z2-drift t.o.v. ${zones.bands.find((b) => b.key === 'Z2')?.hr_max ?? 152}`}
            tone={drift !== null && drift > 0 ? 'warn' : undefined} />
          <Stat value={dist.seconds > 0 ? `${Math.round(dist.z1_z2 * 100)}%` : '—'}
            label={`rustig, doel ${Math.round(zones.distribution_target.z1_z2 * 100)}%`} />
          <Stat value={trend.last7 !== null ? trend.last7.toFixed(1).replace('.', ',') : '—'}
            label="welzijn, gemiddelde over 7 dagen" />
        </Grid>
        <Note>
          Deze vier getallen sturen het plan. Ze komen uit lib/metrics.ts, en de grenzen eromheen uit lib/rules.ts —
          niet uit het taalmodel.
        </Note>
      </Card>

      {dbConfigured() ? (
        <InsightPanel insights={insights} weekStart={weekStart(now)} />
      ) : (
        <Empty title="Analyse werkt pas met een database">
          De weekanalyse leest wat je logde en wat je liep. Verbind Supabase en draai <code>npm run db:seed</code>.
        </Empty>
      )}
    </div>
  );
}
