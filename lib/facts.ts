import { getReference, getWeeks, phaseForWeek } from '@/lib/plan';
import { getActivities, getWeekActuals, getWellness, getZoneSeconds, getZones, getLogs } from '@/lib/data';
import { getDays } from '@/lib/plan';
import { distribution, km, minutes, weekJump, wellnessTrend, z2Drift } from '@/lib/metrics';
import { addDays, weekStart, type IsoDate } from '@/lib/date';
import type { RuleInput } from '@/lib/rules';
import type { Reader } from '@/lib/db';

/* Stuur nooit ruwe activiteiten naar het model. Hier maken we er een compacte
 * verzameling van een paar tientallen getallen van. */

export async function buildFacts(kind: string, today: IsoDate, ruleInput: RuleInput | null, r?: Reader) {
  const [weeks, zones, fueling, milestones] = await Promise.all([
    getWeeks(r),
    getZones(r),
    getReference('fueling_by_week', r),
    getReference('milestones', r),
  ]);

  const current = weeks.find((w) => w.start_date <= today && addDays(w.start_date, 6) >= today) ?? weeks[0]!;
  const [actuals, wellness, zoneSeconds, logs, planDays] = await Promise.all([
    getWeekActuals(r),
    getWellness(addDays(today, -27), today, r),
    getZoneSeconds(addDays(today, -27), today, r),
    getLogs(addDays(today, -13), today, r),
    getDays(addDays(today, -1), addDays(today, 2), r),
  ]);

  const byWeek = new Map(actuals.map((a) => [a.week, a]));
  const volumes = new Map(actuals.map((a) => [a.week, Number(a.actual_km)]));
  const trend = wellnessTrend(wellness, today);
  const dist = distribution(zoneSeconds);
  const yesterday = await getActivities(addDays(today, -1), addDays(today, -1), r);

  const week = byWeek.get(current.week);

  return {
    vandaag: today,
    dagen_tot_wedstrijd: Math.round((Date.parse('2027-10-02') - Date.parse(today)) / 86_400_000),
    week: {
      nummer: current.week,
      fase: current.phase,
      status: current.status,
      focus: current.focus,
      doel_km: Number(current.target_km),
      compact_km: Number(current.compact_km),
      gelopen_km: week ? Math.round(Number(week.actual_km) * 10) / 10 : 0,
      hm_doel: current.hm_target,
      hm_gelopen: week ? Math.round(Number(week.actual_hm)) : 0,
      afdaalminuten_doel: current.descent_min_target,
      afdaalminuten_gelopen: week ? Math.round(Number(week.actual_descent_min)) : 0,
      kracht_doel: current.strength_sessions,
      kracht_gedaan: week ? Number(week.strength_done) : 0,
    },
    weeksprong: round2(weekJump(volumes, current.week)),
    verdeling: {
      z1_z2: round2(dist.z1_z2),
      z3: round2(dist.z3),
      z4_z5: round2(dist.z4_z5),
      doel: zones.distribution_target,
      uren_met_hartslag: Math.round((dist.seconds / 3600) * 10) / 10,
    },
    z2_drift_bpm: round2(ruleInput ? z2Drift(ruleInput.z2, ruleInput.z2Ceiling) : null),
    welzijn: {
      vandaag: trend.today,
      gemiddelde_7d: round2(trend.last7),
      gemiddelde_14d: round2(trend.last14),
      basislijn: round2(trend.baseline),
      schaal: '5 tot 35',
    },
    pijn_laatste_14d: logs
      .filter((l) => l.pain_score || l.pain_next_morning)
      .map((l) => ({ datum: l.date, tijdens: l.pain_score, ochtend_erna: l.pain_next_morning, plek: l.pain_note })),
    zwaarte_laatste_14d: logs.filter((l) => l.rpe).map((l) => ({ datum: l.date, rpe: l.rpe })),
    gisteren: yesterday.map((a) => ({
      soort: a.sport_type,
      km: km(a.distance_m),
      minuten: minutes(a.moving_s),
      hm: Math.round(Number(a.elev_gain_m ?? 0)),
      gemiddelde_hartslag: a.avg_hr ? Math.round(Number(a.avg_hr)) : null,
    })),
    sessies: planDays.map((d) => ({
      datum: d.date,
      soort: d.session_type,
      tekst: d.session_text,
      km: Number(d.planned_km),
      minuten: d.planned_min,
      zone: d.zone,
      tempo: d.pace_range,
      kracht: d.strength_block,
    })),
    zones: zones.bands.map((b) => ({ zone: b.key, van: b.hr_min, tot: b.hr_max, tempo: b.pace })),
    voeding_deze_fase: phaseForWeek(fueling, current.week),
    komende_mijlpalen: milestones.filter((m) => m.date >= today).slice(0, 3),
    soort_analyse: kind,
    week_start: weekStart(today),
  };
}

const round2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);
