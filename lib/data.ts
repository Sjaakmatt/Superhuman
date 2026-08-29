import { admin, db } from '@/lib/db';
import { getReference, getWeeks } from '@/lib/plan';
import { addDays, type IsoDate } from '@/lib/date';
import type { RuleInput } from '@/lib/rules';
import type { Activity, Insight, Shoe, StrengthSet, Wellness, Zones } from '@/lib/types';

/* Alles wat uit de database komt loopt via dit bestand. Zonder database
 * leveren de functies null of een lege lijst — de schermen zeggen dat dan
 * eerlijk in plaats van te doen alsof er niets gebeurd is. */

export type Athlete = {
  id: string;
  /** Alleen de eerste gebruiker mag anderen uitnodigen. */
  can_invite: boolean;
  strava_athlete_id: number | null;
  hr_max: number;
  hr_zones: Zones['bands'];
  race_date: IsoDate;
  timezone: string;
};

export async function getAthlete(): Promise<Athlete | null> {
  const client = await db();
  if (!client) return null;
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  const { data } = await client.from('athlete').select('*').eq('user_id', auth.user.id).maybeSingle();
  return (data as Athlete | null) ?? null;
}

export type UitnodigingStatus = 'uitgenodigd' | 'actief' | 'niet aangemaakt';

export type Uitnodiging = {
  email: string;
  invited_at: string;
  status: UitnodigingStatus;
  laatste_login: string | null;
};

/** De uitnodigingenlijst met de werkelijke staat van elk account erbij. De
 *  tabel weet wie je hebt uitgenodigd; of iemand ook echt is binnengekomen
 *  weet alleen Supabase Auth. */
export async function getInvitations(): Promise<Uitnodiging[]> {
  const client = await db();
  if (!client) return [];
  const { data } = await client.from('invitation').select('email, invited_at, user_id').order('invited_at');
  const rijen = (data as { email: string; invited_at: string; user_id: string | null }[] | null) ?? [];
  if (!rijen.length) return [];

  const perId = new Map<string, string | null>();
  try {
    const { data: auth } = await admin().auth.admin.listUsers({ perPage: 200 });
    for (const u of auth?.users ?? []) perId.set(u.id, u.last_sign_in_at ?? null);
  } catch {
    // Zonder service-role-sleutel tonen we de lijst zonder status in plaats van niets.
  }

  return rijen.map((r) => {
    if (!r.user_id) return { email: r.email, invited_at: r.invited_at, status: 'niet aangemaakt' as const, laatste_login: null };
    const login = perId.get(r.user_id) ?? null;
    return {
      email: r.email,
      invited_at: r.invited_at,
      status: (login ? 'actief' : 'uitgenodigd') as UitnodigingStatus,
      laatste_login: login,
    };
  });
}

export type WeekActual = {
  week: number;
  actual_km: number;
  actual_min: number;
  actual_hm: number;
  actual_descent_min: number;
  strength_done: number;
};

export async function getWeekActuals(): Promise<WeekActual[]> {
  const client = await db();
  if (!client) return [];
  const { data } = await client
    .from('v_week_actual')
    .select('week, actual_km, actual_min, actual_hm, actual_descent_min, strength_done')
    .order('week');
  return (data as WeekActual[] | null) ?? [];
}

export async function getWellness(from: IsoDate, to: IsoDate): Promise<Wellness[]> {
  const client = await db();
  if (!client) return [];
  const { data } = await client.from('wellness').select('*').gte('date', from).lte('date', to).order('date');
  return (data as Wellness[] | null) ?? [];
}

export async function getLogs(from: IsoDate, to: IsoDate) {
  const client = await db();
  if (!client) return [];
  const { data } = await client
    .from('session_log')
    .select('id, date, activity_id, rpe, pain_score, pain_note, pain_next_morning, shoe_id, carbs_g_per_h, gi_score, taped, note')
    .gte('date', from)
    .lte('date', to)
    .order('date');
  return data ?? [];
}

export async function getActivities(from: IsoDate, to: IsoDate): Promise<Activity[]> {
  const client = await db();
  if (!client) return [];
  const { data } = await client
    .from('activity')
    .select('id, date, start_local, sport_type, name, distance_m, moving_s, elapsed_s, elev_gain_m, avg_hr, max_hr, avg_cadence, calories, suffer_score, streams_synced_at')
    .gte('date', from)
    .lte('date', to)
    .order('start_local');
  return (data as Activity[] | null) ?? [];
}

export async function getShoes(): Promise<Shoe[]> {
  const client = await db();
  if (!client) return [];
  const { data } = await client.from('shoe').select('*').order('retired').order('name');
  return (data as Shoe[] | null) ?? [];
}

export async function getStrengthSession(date: IsoDate) {
  const client = await db();
  if (!client) return null;
  const { data } = await client.from('strength_session').select('*').eq('date', date).maybeSingle();
  if (!data) return null;
  const { data: sets } = await client.from('strength_set').select('*').eq('session_id', data.id).order('set_no');
  return { session: data, sets: (sets as StrengthSet[] | null) ?? [] };
}

/** De laatste keer dat je een oefening deed, voor "vorige keer" naast de invoer. */
export async function getLastSets(before: IsoDate): Promise<Map<string, { date: IsoDate; sets: StrengthSet[] }>> {
  const client = await db();
  if (!client) return new Map();
  const { data } = await client
    .from('strength_set')
    .select('*, strength_session!inner(date)')
    .lt('strength_session.date', before)
    .order('set_no');
  const rows = (data as (StrengthSet & { strength_session: { date: IsoDate } })[] | null) ?? [];

  const latest = new Map<string, { date: IsoDate; sets: StrengthSet[] }>();
  for (const row of rows) {
    const date = row.strength_session.date;
    const entry = latest.get(row.exercise);
    if (!entry || entry.date < date) latest.set(row.exercise, { date, sets: [row] });
    else if (entry.date === date) entry.sets.push(row);
  }
  for (const entry of latest.values()) entry.sets.sort((a, b) => a.set_no - b.set_no);
  return latest;
}

/** Seconden per zone over een periode, opgeteld over alle activiteiten. */
export async function getZoneSeconds(from: IsoDate, to: IsoDate): Promise<Record<string, number>> {
  const client = await db();
  if (!client) return {};
  const { data } = await client
    .from('activity_zone')
    .select('zone, seconds, activity!inner(date)')
    .gte('activity.date', from)
    .lte('activity.date', to);
  const out: Record<string, number> = {};
  for (const row of (data as { zone: string; seconds: number }[] | null) ?? []) {
    out[row.zone] = (out[row.zone] ?? 0) + Number(row.seconds);
  }
  return out;
}

export async function getInsights(limit = 6): Promise<Insight[]> {
  const client = await db();
  if (!client) return [];
  const { data } = await client.from('insight').select('*').order('created_at', { ascending: false }).limit(limit);
  return (data as Insight[] | null) ?? [];
}

/** Alles wat lib/rules.ts nodig heeft, in één keer opgehaald. */
export async function loadRuleInput(today: IsoDate, currentWeek: number, weekStatus: string): Promise<RuleInput | null> {
  const client = await db();
  if (!client) return null;

  const from = addDays(today, -120);
  const [wellness, logs, weeks, actuals, shoes, zones, milestones] = await Promise.all([
    getWellness(from, today),
    getLogs(from, today),
    getWeeks(),
    getWeekActuals(),
    getShoes(),
    getReference('zones'),
    getReference('milestones'),
  ]);

  const { data: panels } = await client.from('blood_panel').select('date').order('date');
  const actualByWeek = new Map(actuals.map((a) => [a.week, a]));

  // Geplande Z2-sessies van minstens twintig minuten met een gemeten hartslag.
  const { data: z2rows } = await client
    .from('activity')
    .select('date, avg_hr, moving_s, plan_day!inner(zone)')
    .eq('plan_day.zone', 'Z2')
    .gte('date', addDays(today, -42))
    .lte('date', today)
    .not('avg_hr', 'is', null)
    .gte('moving_s', 1200)
    .order('date');

  const ceiling = zones.bands.find((b) => b.key === 'Z2')?.hr_max ?? 152;

  return {
    today,
    wellness: wellness.map((w) => ({ date: w.date, total: w.total, weight_kg: w.weight_kg })),
    logs: logs.map((l) => ({
      date: l.date,
      rpe: l.rpe,
      pain_score: l.pain_score,
      pain_note: l.pain_note,
      pain_next_morning: l.pain_next_morning,
    })),
    weekKm: new Map(actuals.map((a) => [a.week, Number(a.actual_km)])),
    currentWeek,
    weekStatus,
    z2: ((z2rows as { date: IsoDate; avg_hr: number; moving_s: number }[] | null) ?? []).map((r) => ({
      date: r.date,
      avg_hr: Number(r.avg_hr),
      minutes: Math.round(r.moving_s / 60),
    })),
    z2Ceiling: ceiling,
    descent: weeks
      .filter((w) => w.week <= currentWeek && w.descent_min_target > 0)
      .map((w) => ({
        week: w.week,
        actual_min: Number(actualByWeek.get(w.week)?.actual_descent_min ?? 0),
        target_min: w.descent_min_target,
      })),
    strength: weeks
      .filter((w) => w.week <= currentWeek && w.strength_sessions > 0)
      .map((w) => ({
        week: w.week,
        done: Number(actualByWeek.get(w.week)?.strength_done ?? 0),
        planned: w.strength_sessions,
      })),
    milestones,
    bloodPanelDates: ((panels as { date: IsoDate }[] | null) ?? []).map((p) => p.date),
    shoes,
  };
}

/** Het gesprek met de coach, oplopend in tijd. RLS zorgt dat je alleen je eigen
 *  berichten ziet; `limit` telt vanaf het einde. */
export async function getChat(limit = 40): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const client = await db();
  if (!client) return [];
  const { data } = await client
    .from('chat_message')
    .select('role, content')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (((data as { role: 'user' | 'assistant'; content: string }[] | null) ?? []).reverse());
}
