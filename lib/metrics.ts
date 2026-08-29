import { addDays, daysBetween, type IsoDate } from '@/lib/date';
import type { Zone, Zones } from '@/lib/types';

/* Alle afgeleide getallen staan hier, en nergens anders. Elke definitie die
 * niet van Strava komt is hieronder opgeschreven; wijk je ervan af, wijzig dan
 * ook CLAUDE.md. */

/** Afdaalminuten: seconden uit de grade_smooth-stream waarin het verhang
 *  steiler is dan −4%. Dit is onze maat, geen Strava-veld.
 *  `time` is seconden sinds de start, `grade` is procent verhang. */
export function descentSeconds(time: number[], grade: number[]): number {
  let s = 0;
  for (let i = 1; i < time.length; i++) {
    const g = grade[i];
    const t = time[i];
    const prev = time[i - 1];
    if (g === undefined || t === undefined || prev === undefined) continue;
    if (g < -4) s += t - prev;
  }
  return s;
}

/** Hoogtemeters die je afdaalde tijdens diezelfde seconden. */
export function descentMeters(altitude: number[], grade: number[]): number {
  let m = 0;
  for (let i = 1; i < altitude.length; i++) {
    const g = grade[i];
    const a = altitude[i];
    const prev = altitude[i - 1];
    if (g === undefined || a === undefined || prev === undefined) continue;
    if (g < -4 && a < prev) m += prev - a;
  }
  return Math.round(m);
}

/** Seconden per hartslagzone. Zones komen uit athlete.hr_zones, niet uit code.
 *  Ontbreekt de hartslagstream, dan levert dit een lege verdeling — dat mag,
 *  de weekcijfers moeten er tegen kunnen. */
export function zoneSeconds(time: number[], heartrate: number[], bands: Zone[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 1; i < time.length; i++) {
    const hr = heartrate[i];
    const t = time[i];
    const prev = time[i - 1];
    if (hr === undefined || t === undefined || prev === undefined) continue;
    const band = bands.find((b) => hr >= b.hr_min && hr <= b.hr_max);
    if (!band) continue;
    out[band.key] = (out[band.key] ?? 0) + (t - prev);
  }
  return out;
}

export type Distribution = { z1_z2: number; z3: number; z4_z5: number; seconds: number };

/** Intensiteitsverdeling als aandeel van de tijd met hartslag. */
export function distribution(seconds: Record<string, number>): Distribution {
  const g = (k: string) => seconds[k] ?? 0;
  const easy = g('Z1') + g('Z2');
  const mid = g('Z3');
  const hard = g('Z4') + g('Z5');
  const total = easy + mid + hard;
  if (total === 0) return { z1_z2: 0, z3: 0, z4_z5: 0, seconds: 0 };
  return { z1_z2: easy / total, z3: mid / total, z4_z5: hard / total, seconds: total };
}

/** Weeksprong: weekvolume gedeeld door het maximum van de twee voorgaande
 *  weken. Bewust niet ten opzichte van alleen de vorige week — na een
 *  deloadweek zegt dat niets, want de chronische belasting daalde niet mee.
 *  Zonder twee voorgaande weken is er geen sprong te berekenen: null. */
export function weekJump(volumes: Map<number, number>, week: number): number | null {
  const a = volumes.get(week - 1);
  const b = volumes.get(week - 2);
  const base = Math.max(a ?? 0, b ?? 0);
  const current = volumes.get(week);
  if (current === undefined || a === undefined || b === undefined || base === 0) return null;
  return current / base;
}

/** Z2-drift: gemiddelde hartslag op geplande Z2-sessies min het Z2-plafond.
 *  Alleen sessies met planned_zone Z2 en minstens 20 minuten. */
export type Z2Session = { date: IsoDate; avg_hr: number; minutes: number };

export function z2Drift(sessions: Z2Session[], ceiling: number): number | null {
  const usable = sessions.filter((s) => s.minutes >= 20 && s.avg_hr > 0);
  if (!usable.length) return null;
  const mean = usable.reduce((t, s) => t + s.avg_hr, 0) / usable.length;
  return mean - ceiling;
}

/** Gemiddelde over de laatste `days` kalenderdagen tot en met `end`. */
export function meanOver<T extends { date: IsoDate }>(
  rows: T[],
  end: IsoDate,
  days: number,
  value: (row: T) => number | null | undefined,
): number | null {
  const start = addDays(end, -(days - 1));
  const nums = rows
    .filter((r) => r.date >= start && r.date <= end)
    .map(value)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  if (!nums.length) return null;
  return nums.reduce((t, n) => t + n, 0) / nums.length;
}

export type WellnessPoint = { date: IsoDate; total: number | null };

export type WellnessTrend = {
  /** Gemiddelde van de laatste zeven dagen. */
  last7: number | null;
  /** Het veertiendaags gemiddelde waar de regels tegen vergelijken. */
  last14: number | null;
  /** Basislijn: de 28 dagen die eindigen een week geleden. Zo vergelijk je
   *  een slechte week met je eigen normaal, niet met zichzelf. */
  baseline: number | null;
  today: number | null;
};

export function wellnessTrend(rows: WellnessPoint[], today: IsoDate): WellnessTrend {
  const v = (r: WellnessPoint) => r.total;
  return {
    last7: meanOver(rows, today, 7, v),
    last14: meanOver(rows, today, 14, v),
    baseline: meanOver(rows, addDays(today, -7), 28, v),
    today: rows.find((r) => r.date === today)?.total ?? null,
  };
}

/** Gewichtsverandering per week, als aandeel: −0,012 is 1,2% verlies per week.
 *  Rekent over het verschil tussen het eerste en het laatste gewicht in het
 *  venster, gedeeld door het aantal weken ertussen. */
export function weightChangePerWeek(
  rows: { date: IsoDate; weight_kg: number | null }[],
  end: IsoDate,
  days = 21,
): number | null {
  const start = addDays(end, -(days - 1));
  const points = rows
    .filter((r) => r.date >= start && r.date <= end && typeof r.weight_kg === 'number')
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || first === last || !first.weight_kg || !last.weight_kg) return null;
  const weeks = daysBetween(first.date, last.date) / 7;
  if (weeks < 1) return null;
  return (last.weight_kg - first.weight_kg) / first.weight_kg / weeks;
}

/** Adherentie: gedaan gedeeld door gepland, afgekapt op 1 per week zodat een
 *  extra sessie een gemiste week niet wegpoetst. */
export function adherence(rows: { done: number; planned: number }[]): number | null {
  const usable = rows.filter((r) => r.planned > 0);
  if (!usable.length) return null;
  const sum = usable.reduce((t, r) => t + Math.min(1, r.done / r.planned), 0);
  return sum / usable.length;
}

export function km(meters: number | null | undefined): number {
  return Math.round(((meters ?? 0) / 1000) * 10) / 10;
}

export function minutes(seconds: number | null | undefined): number {
  return Math.round((seconds ?? 0) / 60);
}

/** Zet de banden van de naslag om naar een andere HRmax, met dezelfde
 *  percentages. De bovengrens van de hoogste zone blijft open. */
export function schaalZones(naslag: Zones, hrMax: number): Zones['bands'] {
  const factor = hrMax / naslag.hr_max;
  return naslag.bands.map((band, i) => {
    const laatste = i === naslag.bands.length - 1;
    const boven = laatste ? band.hr_max : Math.round(band.hr_max * factor);
    const onder = i === 0 ? band.hr_min : Math.round(naslag.bands[i - 1]!.hr_max * factor) + 1;
    return { ...band, hr_min: onder, hr_max: boven };
  });
}
