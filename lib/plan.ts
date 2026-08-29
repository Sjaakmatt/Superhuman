import { dbConfigured, reader, type Reader } from '@/lib/db';
import { planSeed, referenceSeed } from '@/lib/seed-files';
import { addDays, weekStart, type IsoDate } from '@/lib/date';
import type { Exercise, Fueling, Milestone, PlanDay, PlanWeek, StrengthPhase, Zones } from '@/lib/types';

/** Het plan is read-only na de seed. Staat er geen database klaar, dan lezen we
 *  dezelfde bestanden die de seed inleest — nooit een tweede, verzonnen bron.
 *  `source` maakt in de interface zichtbaar waar de getallen vandaan komen. */
export type PlanSource = 'database' | 'seed';

export function planSource(): PlanSource {
  return dbConfigured() ? 'database' : 'seed';
}

export async function getDay(date: IsoDate, r?: Reader): Promise<PlanDay | null> {
  const client = (await reader(r))?.client;
  if (client) {
    const { data } = await client.from('plan_day').select('*').eq('date', date).maybeSingle();
    if (data) return data as PlanDay;
  }
  return planSeed().days.find((d) => d.date === date) ?? null;
}

export async function getDays(from: IsoDate, to: IsoDate, r?: Reader): Promise<PlanDay[]> {
  const client = (await reader(r))?.client;
  if (client) {
    const { data } = await client.from('plan_day').select('*').gte('date', from).lte('date', to).order('date');
    if (data && data.length) return data as PlanDay[];
  }
  return planSeed().days.filter((d) => d.date >= from && d.date <= to);
}

export async function getWeek(week: number, r?: Reader): Promise<PlanWeek | null> {
  const client = (await reader(r))?.client;
  if (client) {
    const { data } = await client.from('plan_week').select('*').eq('week', week).maybeSingle();
    if (data) return data as PlanWeek;
  }
  return planSeed().weeks.find((w) => w.week === week) ?? null;
}

export async function getWeeks(r?: Reader): Promise<PlanWeek[]> {
  const client = (await reader(r))?.client;
  if (client) {
    const { data } = await client.from('plan_week').select('*').order('week');
    if (data && data.length) return data as PlanWeek[];
  }
  return planSeed().weeks;
}

/** De dagen van de week waarin `date` valt, maandag tot en met zondag. */
export async function getWeekDays(date: IsoDate, r?: Reader): Promise<PlanDay[]> {
  const start = weekStart(date);
  return getDays(start, addDays(start, 6), r);
}

export async function getReference<K extends keyof Reference>(key: K, r?: Reader): Promise<Reference[K]> {
  const client = (await reader(r))?.client;
  if (client) {
    const { data } = await client.from('reference').select('value').eq('key', key).maybeSingle();
    if (data?.value) return data.value as Reference[K];
  }
  return referenceSeed()[key] as Reference[K];
}

export type Reference = {
  zones: Zones;
  strength_phases: StrengthPhase[];
  fueling_by_week: Fueling[];
  milestones: Milestone[];
};

export async function getExercises(r?: Reader): Promise<Exercise[]> {
  const client = (await reader(r))?.client;
  if (client) {
    const { data } = await client.from('exercise').select('*').order('slug');
    if (data && data.length) return data as Exercise[];
  }
  return referenceSeed().exercises;
}

/** De krachtfase die bij een planweek hoort. */
export function phaseForWeek<T extends { weeks: [number, number] }>(list: T[], week: number): T | null {
  return list.find((p) => week >= p.weeks[0] && week <= p.weeks[1]) ?? null;
}

/** De eerste en laatste dag van het plan. */
export function planBounds(): { first: IsoDate; last: IsoDate; race: IsoDate } {
  const { days, meta } = planSeed();
  return {
    first: days[0]?.date ?? meta.start,
    last: days[days.length - 1]?.date ?? meta.race,
    race: meta.race,
  };
}

export type SearchHit = { date: IsoDate; week: number; weekday: string; session_type: string; session_text: string };

/** Zoeken in het plan: op datum, op weeknummer, of op tekst uit de sessie.
 *  Levert hoogstens `limit` treffers, oplopend op datum. */
export async function searchDays(query: string, limit = 8): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const cols = 'date, week, weekday, session_type, session_text';
  const weekNo = /^(week\s*)?(\d{1,2})$/i.exec(q);
  const client = (await reader())?.client;

  if (client) {
    let rows: SearchHit[] | null = null;
    if (weekNo) {
      const { data } = await client.from('plan_day').select(cols).eq('week', Number(weekNo[2])).order('date').limit(limit);
      rows = data as SearchHit[] | null;
    } else if (/^\d{4}-\d{2}/.test(q)) {
      const { data } = await client.from('plan_day').select(cols).like('date', `${q}%`).order('date').limit(limit);
      rows = data as SearchHit[] | null;
    } else {
      const like = `%${q}%`;
      const { data } = await client
        .from('plan_day')
        .select(cols)
        .or(`session_text.ilike.${like},session_type.ilike.${like},phase.ilike.${like}`)
        .order('date')
        .limit(limit);
      rows = data as SearchHit[] | null;
    }
    if (rows?.length) return rows;
  }

  const needle = q.toLowerCase();
  return planSeed()
    .days.filter((d) => {
      if (weekNo) return d.week === Number(weekNo[2]);
      if (/^\d{4}-\d{2}/.test(q)) return d.date.startsWith(q);
      return (
        d.session_text.toLowerCase().includes(needle) ||
        d.session_type.toLowerCase().includes(needle) ||
        d.phase.toLowerCase().includes(needle)
      );
    })
    .slice(0, limit)
    .map(({ date, week, weekday, session_type, session_text }) => ({ date, week, weekday, session_type, session_text }));
}
