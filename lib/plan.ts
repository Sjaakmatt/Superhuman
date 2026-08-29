import { cache } from 'react';
import { dbConfigured, reader, type Reader } from '@/lib/db';
import { planSeed, referenceSeed } from '@/lib/seed-files';
import { addDays, weekStart, type IsoDate } from '@/lib/date';
import type { BloodMarker, Exercise, Fueling, Milestone, PlanDay, PlanWeek, StrengthPhase, Zones } from '@/lib/types';

/** Het plan is read-only na de seed.
 *
 *  Staat er geen database klaar, dan lezen we dezelfde bestanden die de seed
 *  inleest — nooit een tweede, verzonnen bron. Is er wél een database maar heb
 *  jij geen planrijen, dan krijg je niets. Dat is het verschil tussen "de app
 *  draait zonder database" en "jij hebt nog geen plan", en dat verschil is hier
 *  het belangrijkst: terugvallen op de seed zou iemand anders zijn plan tonen. */
export type PlanSource = 'database' | 'seed';

export function planSource(): PlanSource {
  return dbConfigured() ? 'database' : 'seed';
}

async function leesDay(date: IsoDate, r?: Reader): Promise<PlanDay | null> {
  const client = (await reader(r))?.client;
  if (!client) return planSeed().days.find((d) => d.date === date) ?? null;
  const { data } = await client.from('plan_day').select('*').eq('date', date).maybeSingle();
  return (data as PlanDay | null) ?? null;
}

async function leesDays(from: IsoDate, to: IsoDate, r?: Reader): Promise<PlanDay[]> {
  const client = (await reader(r))?.client;
  if (!client) return planSeed().days.filter((d) => d.date >= from && d.date <= to);
  const { data } = await client.from('plan_day').select('*').gte('date', from).lte('date', to).order('date');
  return (data as PlanDay[] | null) ?? [];
}

async function leesWeek(week: number, r?: Reader): Promise<PlanWeek | null> {
  const client = (await reader(r))?.client;
  if (!client) return planSeed().weeks.find((w) => w.week === week) ?? null;
  const { data } = await client.from('plan_week').select('*').eq('week', week).maybeSingle();
  return (data as PlanWeek | null) ?? null;
}

async function leesWeeks(r?: Reader): Promise<PlanWeek[]> {
  const client = (await reader(r))?.client;
  if (!client) return planSeed().weeks;
  const { data } = await client.from('plan_week').select('*').order('week');
  return (data as PlanWeek[] | null) ?? [];
}


/* Het plan verandert na de seed bijna nooit en wordt op elk scherm gelezen —
 * loadRuleInput vraagt de weken op, de pagina zelf ook. React-cache maakt daar
 * binnen één verzoek één query van. */
export const getDay = cache(leesDay);
export const getDays = cache(leesDays);
export const getWeek = cache(leesWeek);
export const getWeeks = cache(leesWeeks);
export const getReference = cache(leesReference);
export const getExercises = cache(leesExercises);

/** De dagen van de week waarin `date` valt, maandag tot en met zondag. */
export async function getWeekDays(date: IsoDate, r?: Reader): Promise<PlanDay[]> {
  const start = weekStart(date);
  return getDays(start, addDays(start, 6), r);
}

async function leesReference<K extends keyof Reference>(key: K, r?: Reader): Promise<Reference[K]> {
  const client = (await reader(r))?.client;
  if (!client) return referenceSeed()[key] as Reference[K];

  const { data } = await client.from('reference').select('value').eq('key', key).maybeSingle();
  if (data?.value) return data.value as Reference[K];

  // Wel een database, geen rij: dan heb jij die naslag niet. Leeg teruggeven,
  // niet die van een ander. Zones zijn de uitzondering — dat zijn percentages
  // van een maximumhartslag en zonder banden kan geen enkel scherm rekenen.
  if (key === 'zones') return referenceSeed().zones as Reference[K];
  return [] as unknown as Reference[K];
}

export type Reference = {
  zones: Zones;
  strength_phases: StrengthPhase[];
  fueling_by_week: Fueling[];
  milestones: Milestone[];
  blood_markers: BloodMarker[];
};

async function leesExercises(r?: Reader): Promise<Exercise[]> {
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

export type PlanBounds = { first: IsoDate; last: IsoDate; race: IsoDate };

/** De eerste en laatste dag van jóuw plan, of null als je er geen hebt.
 *
 *  Stond eerst in de seed, en dat werkte zolang er één plan was. Met meer dan
 *  één atleet moet dit uit de database komen: anders krijgt iemand zonder plan
 *  de datums van een ander te zien. */
export const getPlanBounds = cache(async (r?: Reader): Promise<PlanBounds | null> => {
  const client = (await reader(r))?.client;
  if (!client) {
    const { days, meta } = planSeed();
    const eerste = days[0]?.date ?? meta.start;
    return { first: eerste, last: days[days.length - 1]?.date ?? meta.race, race: meta.race };
  }

  const [{ data: eerste }, { data: laatste }] = await Promise.all([
    client.from('plan_day').select('date').order('date').limit(1).maybeSingle(),
    client.from('plan_day').select('date').order('date', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const van = (eerste as { date: IsoDate } | null)?.date;
  const tot = (laatste as { date: IsoDate } | null)?.date;
  if (!van || !tot) return null;

  // De wedstrijd is de laatste dag van het plan; die staat niet apart opgeslagen.
  return { first: van, last: tot, race: tot };
});

export type SearchHit = { date: IsoDate; week: number; weekday: string; session_type: string; session_text: string };

/** Zoeken in het plan: op datum, op weeknummer, of op tekst uit de sessie.
 *  Levert hoogstens `limit` treffers, oplopend op datum. */
export async function searchDays(query: string, limit = 8): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const cols = 'date, week, weekday, session_type, session_text';
  const weekNo = /^(week\s*)?(\d{1,2})$/i.exec(q);
  const client = (await reader())?.client;

  // Zonder database zoeken we in de seed; mét database zoek je alleen in je
  // eigen plan. Terugvallen op de seed zou hier het plan van een ander
  // doorzoekbaar maken vanuit de zoekbalk die op elk scherm staat.
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
    return rows ?? [];
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
