'use server';

import { revalidatePath } from 'next/cache';
import { admin, db } from '@/lib/db';
import { getAthlete, type Athlete } from '@/lib/data';
import type { IsoDate } from '@/lib/date';
import type { Proposal } from '@/lib/types';
import { getReference } from '@/lib/plan';
import { schaalZones } from '@/lib/metrics';

/* Server actions voor de handinvoer. Elke actie geeft een resultaat terug in
 * plaats van te gooien: de invoerschermen moeten een storing kunnen tonen
 * zonder de ingetypte waarden kwijt te raken. */

export type Result = { ok: true } | { ok: false; error: string };

const GEEN_DATABASE: Result = {
  ok: false,
  error: 'Geen database verbonden. Zet NEXT_PUBLIC_SUPABASE_URL en de sleutels in .env.local.',
};

const NIET_INGELOGD: Result = {
  ok: false,
  error: 'Je bent niet ingelogd, dus er is niets om aan te hangen. Log opnieuw in.',
};

type Context = { client: NonNullable<Awaited<ReturnType<typeof db>>>; athlete: Athlete };

/** Levert de client plus de atleet, of het probleem dat je moet weten. De twee
 *  gevallen scheiden we bewust: "geen database" en "niet ingelogd" vragen om
 *  heel verschillende dingen van je. */
async function context(): Promise<{ ok: true; ctx: Context } | { ok: false; fout: Result }> {
  const client = await db();
  if (!client) return { ok: false, fout: GEEN_DATABASE };
  const athlete = await getAthlete();
  if (!athlete) return { ok: false, fout: NIET_INGELOGD };
  return { ok: true, ctx: { client, athlete } };
}

export type WellnessInput = {
  date: IsoDate;
  slept: number;
  fresh: number;
  legs: number;
  mind: number;
  motivation: number;
  sleep_hours?: number | null;
  resting_hr?: number | null;
  weight_kg?: number | null;
};

export async function saveWellness(input: WellnessInput): Promise<Result> {
  const resultaat = await context();
  if (!resultaat.ok) return resultaat.fout;
  const ctx = resultaat.ctx;
  const { error } = await ctx.client.from('wellness').upsert(
    { ...input, athlete_id: ctx.athlete.id },
    { onConflict: 'date' },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  revalidatePath('/analyse');
  return { ok: true };
}

/** De pijn van de volgende ochtend hoort bij de sessie van gisteren, maar je
 *  weet hem pas vandaag. Daarom een eigen actie met een `update`: een upsert met
 *  alleen dit veld zou de rest van de log leegmaken. */
export async function savePainNextMorning(date: IsoDate, value: number | null): Promise<Result> {
  const resultaat = await context();
  if (!resultaat.ok) return resultaat.fout;
  const { client } = resultaat.ctx;

  const { error } = await client.from('session_log').update({ pain_next_morning: value }).eq('date', date);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  revalidatePath('/loggen');
  revalidatePath('/analyse');
  return { ok: true };
}

export type SessionLogInput = {
  date: IsoDate;
  rpe?: number | null;
  pain_score?: number | null;
  pain_note?: string | null;
  pain_next_morning?: number | null;
  shoe_id?: string | null;
  carbs_g_per_h?: number | null;
  gi_score?: number | null;
  taped?: boolean | null;
  note?: string | null;
};

export async function saveSessionLog(input: SessionLogInput): Promise<Result> {
  const resultaat = await context();
  if (!resultaat.ok) return resultaat.fout;
  const ctx = resultaat.ctx;
  const { client, athlete } = ctx;

  const { data: previous } = await client
    .from('session_log')
    .select('id, shoe_id')
    .eq('date', input.date)
    .maybeSingle();

  const { error } = await client
    .from('session_log')
    .upsert({ ...input, athlete_id: athlete.id }, { onConflict: 'athlete_id,date' });
  if (error) return { ok: false, error: error.message };

  // Schoenkilometers bijwerken: de kilometers van die dag verhuizen mee als je
  // achteraf een andere schoen kiest.
  const shoeChanged = (previous?.shoe_id ?? null) !== (input.shoe_id ?? null);
  if (shoeChanged) {
    const { data: acts } = await client.from('activity').select('distance_m').eq('date', input.date);
    const km = (acts ?? []).reduce((t, a) => t + Number(a.distance_m ?? 0), 0) / 1000;
    if (km > 0) {
      if (previous?.shoe_id) await addShoeKm(client, previous.shoe_id, -km);
      if (input.shoe_id) await addShoeKm(client, input.shoe_id, km);
    }
  }

  revalidatePath('/');
  revalidatePath('/loggen');
  return { ok: true };
}

async function addShoeKm(client: NonNullable<Awaited<ReturnType<typeof db>>>, shoeId: string, delta: number) {
  const { data } = await client.from('shoe').select('km').eq('id', shoeId).maybeSingle();
  if (!data) return;
  await client.from('shoe').update({ km: Math.max(0, Number(data.km) + delta) }).eq('id', shoeId);
}

export async function saveStrengthSet(input: {
  date: IsoDate;
  block: string;
  exercise: string;
  set_no: number;
  weight_kg: number | null;
  reps: number | null;
  done: boolean;
}): Promise<Result> {
  const resultaat = await context();
  if (!resultaat.ok) return resultaat.fout;
  const ctx = resultaat.ctx;
  const { client, athlete } = ctx;

  const { data: session, error: sessionError } = await client
    .from('strength_session')
    .upsert({ athlete_id: athlete.id, date: input.date, block: input.block }, { onConflict: 'athlete_id,date' })
    .select('id')
    .single();
  if (sessionError || !session) return { ok: false, error: sessionError?.message ?? 'Kon de sessie niet openen.' };

  const { error } = await client.from('strength_set').upsert(
    {
      session_id: session.id,
      exercise: input.exercise,
      set_no: input.set_no,
      weight_kg: input.weight_kg,
      reps: input.reps,
      done: input.done,
    },
    { onConflict: 'session_id,exercise,set_no' },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath('/kracht');
  return { ok: true };
}

export async function completeStrengthSession(date: IsoDate, done: boolean): Promise<Result> {
  const resultaat = await context();
  if (!resultaat.ok) return resultaat.fout;
  const ctx = resultaat.ctx;
  const { error } = await ctx.client
    .from('strength_session')
    .update({ completed_at: done ? new Date().toISOString() : null })
    .eq('date', date);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/kracht');
  revalidatePath('/');
  return { ok: true };
}

/** Een voorstel overnemen: het plan verandert, en de oude waarde blijft staan. */
export async function acceptProposal(insightId: string, proposal: Proposal): Promise<Result> {
  const resultaat = await context();
  if (!resultaat.ok) return resultaat.fout;
  const ctx = resultaat.ctx;
  const { client, athlete } = ctx;

  const { data: day } = await client.from('plan_day').select('*').eq('date', proposal.date).maybeSingle();
  if (!day) return { ok: false, error: `Geen plandag op ${proposal.date}.` };

  const old = day[proposal.field as keyof typeof day];
  const { error: logError } = await client.from('plan_adjustment').insert({
    athlete_id: athlete.id,
    date: proposal.date,
    field: proposal.field,
    old_value: old === null || old === undefined ? null : String(old),
    new_value: proposal.to,
    source: 'ai',
    insight_id: insightId,
  });
  if (logError) return { ok: false, error: logError.message };

  // plan_day is onder RLS read-only, met opzet: alleen deze weg mag het plan
  // veranderen, en die legt de oude waarde eerst vast.
  if (!EDITABLE.has(proposal.field)) {
    return { ok: false, error: `Het veld "${proposal.field}" mag een voorstel niet wijzigen.` };
  }
  const { error: applyError } = await admin()
    .from('plan_day')
    .update({ [proposal.field]: coerce(proposal.field, proposal.to) })
    .eq('date', proposal.date);
  if (applyError) return { ok: false, error: `Vastgelegd, maar niet doorgevoerd: ${applyError.message}` };

  await client.from('insight').update({ status: 'accepted' }).eq('id', insightId);
  revalidatePath('/');
  revalidatePath('/analyse');
  return { ok: true };
}

/** Alleen deze velden mag een voorstel aanraken. De datum, de week en de fase
 *  liggen vast — een voorstel past een sessie aan, niet de structuur. */
const EDITABLE = new Set(['session_text', 'session_type', 'planned_km', 'planned_min', 'zone', 'pace_range', 'strength_block', 'strength_detail']);

function coerce(field: string, value: string): string | number {
  if (field === 'planned_km') return Number(value.replace(',', '.'));
  if (field === 'planned_min') return Math.round(Number(value));
  return value;
}

export async function dismissInsight(insightId: string): Promise<Result> {
  const resultaat = await context();
  if (!resultaat.ok) return resultaat.fout;
  const ctx = resultaat.ctx;
  const { error } = await ctx.client.from('insight').update({ status: 'dismissed' }).eq('id', insightId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/analyse');
  return { ok: true };
}

export async function addShoe(input: { name: string; drop_mm: number | null }): Promise<Result> {
  const resultaat = await context();
  if (!resultaat.ok) return resultaat.fout;
  const ctx = resultaat.ctx;
  const { error } = await ctx.client.from('shoe').insert({ ...input, athlete_id: ctx.athlete.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/instellingen');
  return { ok: true };
}

export async function retireShoe(id: string, retired: boolean): Promise<Result> {
  const resultaat = await context();
  if (!resultaat.ok) return resultaat.fout;
  const ctx = resultaat.ctx;
  const { error } = await ctx.client.from('shoe').update({ retired }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/instellingen');
  return { ok: true };
}

/* ── uitnodigingen ──────────────────────────────────────────────────────────
 * Toegang gaat op uitnodiging. De rij in `invitation` gaat eerst: de trigger op
 * auth.users weigert elk account waarvoor geen uitnodiging klaarstaat, en
 * Supabase maakt dat account al aan bij het versturen. */

const ADRES = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function alsBeheerder() {
  const resultaat = await context();
  if (!resultaat.ok) return { ok: false as const, fout: resultaat.fout };
  if (!resultaat.ctx.athlete.can_invite) {
    return { ok: false as const, fout: { ok: false as const, error: 'Je mag geen mensen uitnodigen.' } };
  }
  return { ok: true as const, ctx: resultaat.ctx };
}

export async function inviteAthlete(email: string): Promise<Result> {
  const beheer = await alsBeheerder();
  if (!beheer.ok) return beheer.fout;

  const adres = email.trim().toLowerCase();
  if (!ADRES.test(adres)) return { ok: false, error: 'Dat is geen geldig e-mailadres.' };

  const { error: insertError } = await beheer.ctx.client
    .from('invitation')
    .insert({ email: adres, invited_by: beheer.ctx.athlete.id });
  if (insertError) {
    return {
      ok: false,
      error: insertError.code === '23505' ? 'Dat adres staat al op de lijst.' : insertError.message,
    };
  }

  const verstuurd = await stuurUitnodiging(adres);
  if (!verstuurd.ok) {
    // Geen halve staat achterlaten: zonder verstuurde mail hoort het adres
    // ook niet op de lijst te staan.
    await beheer.ctx.client.from('invitation').delete().eq('email', adres);
    return verstuurd;
  }

  revalidatePath('/instellingen');
  return { ok: true };
}

export async function resendInvitation(email: string): Promise<Result> {
  const beheer = await alsBeheerder();
  if (!beheer.ok) return beheer.fout;
  const verstuurd = await stuurUitnodiging(email.trim().toLowerCase());
  if (verstuurd.ok) revalidatePath('/instellingen');
  return verstuurd;
}

/** Haalt het adres van de lijst en verwijdert het bijbehorende account. Alles
 *  wat die persoon logde gaat mee — daarom vraagt de interface om een tweede
 *  bevestiging. */
export async function revokeInvitation(email: string): Promise<Result> {
  const beheer = await alsBeheerder();
  if (!beheer.ok) return beheer.fout;
  const adres = email.trim().toLowerCase();

  const { data: rij } = await beheer.ctx.client
    .from('invitation')
    .select('user_id')
    .eq('email', adres)
    .maybeSingle();

  const { error } = await beheer.ctx.client.from('invitation').delete().eq('email', adres);
  if (error) return { ok: false, error: error.message };

  const gebruiker = (rij as { user_id: string | null } | null)?.user_id;
  if (gebruiker) {
    const { error: verwijderError } = await admin().auth.admin.deleteUser(gebruiker);
    if (verwijderError) {
      return { ok: false, error: `Van de lijst gehaald, maar het account bleef staan: ${verwijderError.message}` };
    }
  }

  revalidatePath('/instellingen');
  return { ok: true };
}

/** Supabase verstuurt de mail met het sjabloon "Invite user"; dat staat in
 *  supabase/templates/uitnodiging.html en wijst naar /auth/bevestig. */
async function stuurUitnodiging(adres: string): Promise<Result> {
  try {
    const { error } = await admin().auth.admin.inviteUserByEmail(adres);
    if (!error) return { ok: true };
    if (/already been registered|already exists/i.test(error.message)) {
      return { ok: false, error: 'Er bestaat al een account met dat adres.' };
    }
    if (/error sending|smtp|mail/i.test(error.message)) {
      return {
        ok: false,
        error: 'De uitnodiging kon niet verstuurd worden. Controleer de SMTP-instellingen in Supabase.',
      };
    }
    return { ok: false, error: error.message };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type BloodPanelInput = {
  date: IsoDate;
  ferritin: number | null;
  tsat: number | null;
  hb: number | null;
  crp: number | null;
  b12: number | null;
  vit_d: number | null;
  tsh: number | null;
  note: string | null;
};

/** Een uitslag opslaan. Upsert op (atleet, datum): dezelfde dag nog eens
 *  invoeren corrigeert de vorige in plaats van er een tweede naast te zetten. */
export async function saveBloodPanel(input: BloodPanelInput): Promise<Result> {
  const resultaat = await context();
  if (!resultaat.ok) return resultaat.fout;
  const ctx = resultaat.ctx;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, error: 'Die datum begrijp ik niet.' };
  }
  const waarden = [input.ferritin, input.tsat, input.hb, input.crp, input.b12, input.vit_d, input.tsh];
  if (waarden.every((w) => w === null) && !input.note) {
    return { ok: false, error: 'Vul minstens één waarde in.' };
  }

  const { error } = await ctx.client
    .from('blood_panel')
    .upsert({ ...input, athlete_id: ctx.athlete.id }, { onConflict: 'athlete_id,date' });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/instellingen');
  revalidatePath('/analyse');
  return { ok: true };
}

export async function deleteBloodPanel(date: IsoDate): Promise<Result> {
  const resultaat = await context();
  if (!resultaat.ok) return resultaat.fout;
  const { error } = await resultaat.ctx.client.from('blood_panel').delete().eq('date', date);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/instellingen');
  revalidatePath('/analyse');
  return { ok: true };
}

/** De gemeten HRmax uit de test in week 6 of week 30.
 *
 *  De zonegrenzen schalen mee. We houden de percentages van de naslag aan —
 *  Z1 tot 64,9%, Z2 tot 80,9%, Z3 tot 88,8%, Z4 tot 96,8% van HRmax — en
 *  rekenen die om naar de nieuwe waarde. Dat is een afgeleid getal, geen
 *  nieuw trainingsvoorschrift: de verdeling van het plan blijft staan, alleen
 *  het ankerpunt klopt nu.
 *
 *  Tempo's laten we ongemoeid. Die volgen niet uit een hartslag. */
export async function saveHrMax(hrMax: number, measuredOn: IsoDate, note?: string | null): Promise<Result> {
  const resultaat = await context();
  if (!resultaat.ok) return resultaat.fout;
  const ctx = resultaat.ctx;

  const waarde = Math.round(hrMax);
  if (!Number.isFinite(hrMax) || waarde < 120 || waarde > 230) {
    return { ok: false, error: 'Een HRmax onder 120 of boven 230 is bijna zeker een meetfout. Controleer je band.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(measuredOn)) {
    return { ok: false, error: 'Die datum begrijp ik niet.' };
  }

  // De meting zelf blijft bewaard, ook als er later een hogere of lagere komt.
  const meting = await ctx.client
    .from('hr_test')
    .upsert(
      { athlete_id: ctx.athlete.id, date: measuredOn, hr_max: waarde, note: note?.trim() || null },
      { onConflict: 'athlete_id,date' },
    );
  if (meting.error) return { ok: false, error: meting.error.message };

  // Op `athlete` staat de laatste meting: daar rekenen de zones mee. Voer je
  // achteraf een oudere test in, dan blijft de nieuwste leidend.
  const { data: laatste } = await ctx.client
    .from('hr_test')
    .select('date, hr_max')
    .eq('athlete_id', ctx.athlete.id)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const leidend = (laatste as { date: IsoDate; hr_max: number } | null) ?? { date: measuredOn, hr_max: waarde };
  const naslag = await getReference('zones');
  const bands = schaalZones(naslag, leidend.hr_max);

  const { error } = await ctx.client
    .from('athlete')
    .update({ hr_max: leidend.hr_max, hr_zones: bands, hr_max_measured_on: leidend.date })
    .eq('id', ctx.athlete.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/instellingen');
  revalidatePath('/analyse');
  revalidatePath('/seizoen');
  revalidatePath('/');
  return { ok: true };
}

/** Wat er van een mijlpaal terecht kwam. Afvinken mag zonder tekst; een
 *  notitie zonder vinkje bestaat niet — je schrijft het op omdat het gebeurd is. */
export async function saveMilestoneResult(
  date: IsoDate,
  input: { done: boolean; outcome: string | null },
): Promise<Result> {
  const resultaat = await context();
  if (!resultaat.ok) return resultaat.fout;
  const ctx = resultaat.ctx;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'Die datum begrijp ik niet.' };

  if (!input.done && !input.outcome) {
    const { error } = await ctx.client.from('milestone_result').delete().eq('date', date);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await ctx.client.from('milestone_result').upsert(
      {
        athlete_id: ctx.athlete.id,
        date,
        done: input.done,
        outcome: input.outcome,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'athlete_id,date' },
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath('/');
  revalidatePath('/seizoen');
  return { ok: true };
}
