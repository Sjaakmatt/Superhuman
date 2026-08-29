import { admin, db, reader, type Reader } from '@/lib/db';
import { getReference, getWeeks } from '@/lib/plan';
import { addDays, type IsoDate } from '@/lib/date';
import type { RuleInput } from '@/lib/rules';
import type { Activity, BloodPanel, HrTest, Insight, MilestoneResult, Shoe, StrengthSet, Wellness, Zones } from '@/lib/types';

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
  /** Leeg zolang hr_max nog uit de leeftijdsformule komt. */
  hr_max_measured_on: IsoDate | null;
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

export async function getWeekActuals(r?: Reader): Promise<WeekActual[]> {
  const l = await reader(r);
  if (!l) return [];
  let q = l.client
    .from('v_week_actual')
    .select('week, actual_km, actual_min, actual_hm, actual_descent_min, strength_done')
    .order('week');
  if (l.athleteId) q = q.eq('athlete_id', l.athleteId);
  const { data } = await q;
  return (data as WeekActual[] | null) ?? [];
}

export async function getWellness(from: IsoDate, to: IsoDate, r?: Reader): Promise<Wellness[]> {
  const l = await reader(r);
  if (!l) return [];
  let q = l.client.from('wellness').select('*').gte('date', from).lte('date', to).order('date');
  if (l.athleteId) q = q.eq('athlete_id', l.athleteId);
  const { data } = await q;
  return (data as Wellness[] | null) ?? [];
}

export async function getLogs(from: IsoDate, to: IsoDate, r?: Reader) {
  const l = await reader(r);
  if (!l) return [];
  let q = l.client
    .from('session_log')
    .select('id, date, activity_id, rpe, pain_score, pain_note, pain_next_morning, shoe_id, carbs_g_per_h, gi_score, taped, note')
    .gte('date', from)
    .lte('date', to)
    .order('date');
  if (l.athleteId) q = q.eq('athlete_id', l.athleteId);
  const { data } = await q;
  return data ?? [];
}

export async function getActivities(from: IsoDate, to: IsoDate, r?: Reader): Promise<Activity[]> {
  const l = await reader(r);
  if (!l) return [];
  let q = l.client
    .from('activity')
    .select('id, date, start_local, sport_type, name, distance_m, moving_s, elapsed_s, elev_gain_m, avg_hr, max_hr, avg_cadence, calories, suffer_score, streams_synced_at')
    .gte('date', from)
    .lte('date', to)
    .order('start_local');
  if (l.athleteId) q = q.eq('athlete_id', l.athleteId);
  const { data } = await q;
  return (data as Activity[] | null) ?? [];
}

export async function getShoes(r?: Reader): Promise<Shoe[]> {
  const l = await reader(r);
  if (!l) return [];
  let q = l.client.from('shoe').select('*').order('retired').order('name');
  if (l.athleteId) q = q.eq('athlete_id', l.athleteId);
  const { data } = await q;
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
export async function getZoneSeconds(from: IsoDate, to: IsoDate, r?: Reader): Promise<Record<string, number>> {
  const l = await reader(r);
  if (!l) return {};
  let q = l.client
    .from('activity_zone')
    .select('zone, seconds, activity!inner(date, athlete_id)')
    .gte('activity.date', from)
    .lte('activity.date', to);
  if (l.athleteId) q = q.eq('activity.athlete_id', l.athleteId);
  const { data } = await q;
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
export async function loadRuleInput(
  today: IsoDate,
  currentWeek: number,
  weekStatus: string,
  r?: Reader,
): Promise<RuleInput | null> {
  const l = await reader(r);
  if (!l) return null;

  const from = addDays(today, -120);
  const [wellness, logs, weeks, actuals, shoes, zones, milestones] = await Promise.all([
    getWellness(from, today, l),
    getLogs(from, today, l),
    getWeeks(l),
    getWeekActuals(l),
    getShoes(l),
    getZones(l),
    getReference('milestones', l),
  ]);

  let panelQuery = l.client.from('blood_panel').select('date').order('date');
  if (l.athleteId) panelQuery = panelQuery.eq('athlete_id', l.athleteId);
  const { data: panels } = await panelQuery;
  const actualByWeek = new Map(actuals.map((a) => [a.week, a]));

  // Geplande Z2-sessies van minstens twintig minuten met een gemeten hartslag.
  let z2query = l.client
    .from('activity')
    .select('date, avg_hr, moving_s, plan_day!inner(zone)')
    .eq('plan_day.zone', 'Z2')
    .gte('date', addDays(today, -42))
    .lte('date', today)
    .not('avg_hr', 'is', null)
    .gte('moving_s', 1200)
    .order('date');
  if (l.athleteId) z2query = z2query.eq('athlete_id', l.athleteId);
  const { data: z2rows } = await z2query;

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

/** De zones waar deze atleet mee rekent.
 *
 *  Staat er een gemeten HRmax op `athlete`, dan winnen zijn eigen banden van de
 *  naslag: die is voor iedereen gelijk en kan dus niet jouw hertest bevatten.
 *  Zonder gemeten waarde valt hij terug op reference.zones. */
export async function getZones(r?: Reader): Promise<Zones> {
  const l = await reader(r);
  const naslag = await getReference('zones', l ?? undefined);
  if (!l) return naslag;

  let q = l.client.from('athlete').select('hr_max, hr_zones, hr_max_measured_on');
  if (l.athleteId) q = q.eq('id', l.athleteId);
  const { data } = await q.limit(1).maybeSingle();
  const eigen = data as { hr_max: number; hr_zones: Zones['bands']; hr_max_measured_on: string | null } | null;
  if (!eigen?.hr_max_measured_on || !eigen.hr_zones?.length) return naslag;

  return {
    ...naslag,
    hr_max: eigen.hr_max,
    bands: eigen.hr_zones,
    source: `HRmax ${eigen.hr_max}, gemeten op ${eigen.hr_max_measured_on}`,
  };
}

/** Je bloedpanels, oudste eerst. De eerste is je nulmeting; daar vergelijk je
 *  de rest mee, niet met de referentiewaarden van een lab.
 *
 *  De waarden staan als rijen in blood_value, want welke bepalingen een lab
 *  teruggeeft verschilt per keer. Hier vouwen we ze per prikdag samen. */
export async function getBloodPanels(r?: Reader): Promise<BloodPanel[]> {
  const l = await reader(r);
  if (!l) return [];

  let kop = l.client.from('blood_panel').select('date, note').order('date');
  let waarden = l.client.from('blood_value').select('date, code, value').order('date');
  if (l.athleteId) {
    kop = kop.eq('athlete_id', l.athleteId);
    waarden = waarden.eq('athlete_id', l.athleteId);
  }
  const [{ data: koppen }, { data: rijen }] = await Promise.all([kop, waarden]);

  const perDag = new Map<IsoDate, Record<string, number>>();
  for (const rij of ((rijen as { date: IsoDate; code: string; value: number }[] | null) ?? [])) {
    const bestaand = perDag.get(rij.date) ?? {};
    bestaand[rij.code] = Number(rij.value);
    perDag.set(rij.date, bestaand);
  }

  return ((koppen as { date: IsoDate; note: string | null }[] | null) ?? []).map((k) => ({
    date: k.date,
    note: k.note,
    values: perDag.get(k.date) ?? {},
  }));
}

/** Wat je van je mijlpalen hebt genoteerd, op datum. */
export async function getMilestoneResults(r?: Reader): Promise<Map<IsoDate, MilestoneResult>> {
  const l = await reader(r);
  if (!l) return new Map();
  let q = l.client.from('milestone_result').select('date, done, outcome').order('date');
  if (l.athleteId) q = q.eq('athlete_id', l.athleteId);
  const { data } = await q;
  return new Map(((data as MilestoneResult[] | null) ?? []).map((m) => [m.date, m]));
}

/** Je HRmax-metingen, oudste eerst. */
export async function getHrTests(r?: Reader): Promise<HrTest[]> {
  const l = await reader(r);
  if (!l) return [];
  let q = l.client.from('hr_test').select('date, hr_max, note').order('date');
  if (l.athleteId) q = q.eq('athlete_id', l.athleteId);
  const { data } = await q;
  return (data as HrTest[] | null) ?? [];
}

/** Wat er van één dag gemeten is: de langste activiteit met haar afdaalminuten,
 *  en de sessielog. Voor een wedstrijd of test hoef je zo niets over te typen —
 *  het staat er al, via de nachtelijke sync. */
export async function getDayMeasurements(date: IsoDate, r?: Reader) {
  const l = await reader(r);
  if (!l) return { activity: null, log: null };

  let q = l.client
    .from('activity')
    .select('id, name, sport_type, distance_m, moving_s, elapsed_s, elev_gain_m, avg_hr, max_hr')
    .eq('date', date)
    .order('moving_s', { ascending: false })
    .limit(1);
  if (l.athleteId) q = q.eq('athlete_id', l.athleteId);
  const { data: act } = await q.maybeSingle();
  const activity = act as (Activity & { id: number }) | null;

  let descent: number | null = null;
  if (activity) {
    const { data } = await l.client
      .from('activity_descent')
      .select('descent_seconds')
      .eq('activity_id', activity.id)
      .maybeSingle();
    const sec = (data as { descent_seconds: number } | null)?.descent_seconds;
    descent = sec === undefined || sec === null ? null : Math.round(Number(sec) / 60);
  }

  let lq = l.client
    .from('session_log')
    .select('rpe, pain_score, gi_score, carbs_g_per_h')
    .eq('date', date)
    .limit(1);
  if (l.athleteId) lq = lq.eq('athlete_id', l.athleteId);
  const { data: log } = await lq.maybeSingle();

  return {
    activity: activity ? { ...activity, descent_min: descent } : null,
    log: (log as { rpe: number | null; pain_score: number | null; gi_score: number | null; carbs_g_per_h: number | null } | null) ?? null,
  };
}

export type IjkPunt = {
  date: IsoDate;
  name: string | null;
  km: number;
  minutes: number;
  hm: number;
  avg_hr: number | null;
  descent_min: number | null;
};

/** De activiteiten op een handvol mijlpaaldagen, in één keer. Voor de
 *  vergelijking tussen je ijkpunten: dezelfde soort dag, twaalf weken later. */
export async function getIjkPunten(dates: IsoDate[], r?: Reader): Promise<Map<IsoDate, IjkPunt>> {
  const l = await reader(r);
  if (!l || !dates.length) return new Map();

  let q = l.client
    .from('activity')
    .select('id, date, name, distance_m, moving_s, elev_gain_m, avg_hr')
    .in('date', dates)
    .order('moving_s', { ascending: false });
  if (l.athleteId) q = q.eq('athlete_id', l.athleteId);
  const { data } = await q;
  const rijen = (data as { id: number; date: IsoDate; name: string | null; distance_m: number | null; moving_s: number | null; elev_gain_m: number | null; avg_hr: number | null }[] | null) ?? [];
  if (!rijen.length) return new Map();

  // Per dag de langste activiteit; de rij-volgorde is al aflopend op tijd.
  const perDag = new Map<IsoDate, (typeof rijen)[number]>();
  for (const rij of rijen) if (!perDag.has(rij.date)) perDag.set(rij.date, rij);

  const { data: dalingen } = await l.client
    .from('activity_descent')
    .select('activity_id, descent_seconds')
    .in('activity_id', [...perDag.values()].map((a) => a.id));
  const perActiviteit = new Map(
    ((dalingen as { activity_id: number; descent_seconds: number }[] | null) ?? []).map((d) => [
      d.activity_id,
      Math.round(Number(d.descent_seconds) / 60),
    ]),
  );

  return new Map(
    [...perDag.entries()].map(([datum, a]) => [
      datum,
      {
        date: datum,
        name: a.name,
        km: Math.round((Number(a.distance_m ?? 0) / 1000) * 10) / 10,
        minutes: Math.round(Number(a.moving_s ?? 0) / 60),
        hm: Math.round(Number(a.elev_gain_m ?? 0)),
        avg_hr: a.avg_hr === null ? null : Math.round(Number(a.avg_hr)),
        descent_min: perActiviteit.get(a.id) ?? null,
      },
    ]),
  );
}
