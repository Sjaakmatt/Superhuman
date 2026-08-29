import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { admin, db } from '@/lib/db';
import { getZones } from '@/lib/data';
import { cronAuthorized } from '@/lib/cron';
import {
  BACKFILL_FROM,
  STREAM_BUDGET,
  derive,
  getStreams,
  isRun,
  listActivities,
  pause,
  refresh,
  toRow,
  withBackoff,
} from '@/lib/strava';

/** Twee ingangen, hetzelfde werk.
 *
 *  De cron (03:10 UTC+1, in de zomer een uur later) haalt iedereen op met een
 *  gekoppeld Strava-account. Ben je ingelogd, dan haal je alleen jezelf op —
 *  de knop "Nu ophalen", voor als je net gelopen hebt en niet tot morgen wilt
 *  wachten.
 *
 *  Twee keer achter elkaar draaien mag: alles gaat via upsert op de Strava-id,
 *  dus er ontstaan geen duplicaten. */
export async function GET(request: Request) {
  const sb = admin();

  if (cronAuthorized(request)) {
    const { data: tokens } = await sb.from('strava_token').select('*').order('athlete_id');
    const rijen = (tokens as StravaToken[] | null) ?? [];
    if (!rijen.length) return NextResponse.json({ error: 'Strava is nog niet verbonden.' }, { status: 409 });

    // Achter elkaar, niet parallel: de rate limit van Strava geldt per app, niet
    // per atleet. Een mislukte sync mag de anderen niet tegenhouden.
    const uitkomsten = [];
    for (const token of rijen) {
      try {
        uitkomsten.push(await syncAtleet(sb, token));
      } catch (fout) {
        uitkomsten.push({ athlete_id: token.athlete_id, error: (fout as Error).message });
      }
    }

    const mislukt = uitkomsten.filter((u) => 'error' in u).length;
    return NextResponse.json(
      { atleten: rijen.length, gelukt: rijen.length - mislukt, uitkomsten },
      { status: mislukt === rijen.length ? 502 : 200 },
    );
  }

  // Geen cron-geheim: dan moet je ingelogd zijn, en haal je alleen jezelf op.
  const client = await db();
  if (!client) return NextResponse.json({ error: 'Geen database verbonden.' }, { status: 503 });
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Niet toegestaan.' }, { status: 401 });

  const { data: athlete } = await client.from('athlete').select('id').eq('user_id', auth.user.id).maybeSingle();
  if (!athlete) return NextResponse.json({ error: 'Nog geen atleet in de database.' }, { status: 409 });

  const { data: token } = await sb
    .from('strava_token')
    .select('*')
    .eq('athlete_id', (athlete as { id: string }).id)
    .maybeSingle();
  if (!token) return NextResponse.json({ error: 'Strava is nog niet verbonden.' }, { status: 409 });

  // Niet vaker dan één keer per minuut: de knop mag niet uitnodigen tot rammen
  // op de rate limit van Strava.
  const rij = token as StravaToken;
  if (rij.synced_at && Date.now() - Date.parse(rij.synced_at) < 60_000) {
    return NextResponse.json({ error: 'Net opgehaald. Probeer het over een minuut nog eens.' }, { status: 429 });
  }

  try {
    return NextResponse.json(await syncAtleet(sb, rij));
  } catch (fout) {
    return NextResponse.json({ error: (fout as Error).message }, { status: 502 });
  }
}

type StravaToken = {
  athlete_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  synced_at: string | null;
  backfilled_from: string | null;
};

async function syncAtleet(sb: SupabaseClient, token: StravaToken) {
  const athleteId = token.athlete_id;
  // Zones per atleet: wie zijn HRmax heeft gemeten rekent met eigen banden.
  const { bands } = await getZones({ client: sb, athleteId });

  // Access tokens verlopen na zes uur; we verversen als er minder dan tien
  // minuten over is. Een nieuw refresh token slaan we meteen op.
  let accessToken = token.access_token;
  const expiresAt = Date.parse(token.expires_at);
  if (Number.isNaN(expiresAt) || expiresAt - Date.now() < 600_000) {
    const fresh = await refresh(token.refresh_token);
    accessToken = fresh.access_token;
    await sb.from('strava_token').update({
      access_token: fresh.access_token,
      refresh_token: fresh.refresh_token,
      expires_at: new Date(fresh.expires_at * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('athlete_id', athleteId);
  }

  // Normaal vanaf de laatste opgeslagen activiteit min één dag, zodat een late
  // upload niet gemist wordt. Maar zolang we nog nooit tot BACKFILL_FROM terug
  // zijn geweest doen we eerst één volle haal — anders komt een periode die je
  // achteraf wilt meenemen er nooit meer bij.
  const moetTerug = !token.backfilled_from || token.backfilled_from > BACKFILL_FROM;

  const { data: last } = await sb
    .from('activity')
    .select('start_local')
    .eq('athlete_id', athleteId)
    .order('start_local', { ascending: false })
    .limit(1)
    .maybeSingle();

  const after =
    moetTerug || !last
      ? new Date(`${BACKFILL_FROM}T00:00:00Z`)
      : new Date(Date.parse(last.start_local as string) - 86_400_000);

  const activities = await withBackoff(() => listActivities(accessToken, after));
  if (activities.length) {
    const { error } = await sb
      .from('activity')
      .upsert(activities.map((a) => toRow(a, athleteId)), { onConflict: 'athlete_id,source,external_id' });
    if (error) throw new Error(error.message);
  }

  // Streams alleen voor hardloopactiviteiten die we nog niet hebben, en
  // hoogstens veertig per keer — dat past ruim binnen de limiet.
  const { data: pending } = await sb
    .from('activity')
    .select('id, sport_type')
    .eq('athlete_id', athleteId)
    .is('streams_synced_at', null)
    .order('start_local', { ascending: false })
    .limit(STREAM_BUDGET * 2);

  const queue = ((pending as { id: number; sport_type: string }[] | null) ?? [])
    .filter((a) => isRun(a.sport_type))
    .slice(0, STREAM_BUDGET);

  let withStreams = 0;

  for (const activity of queue) {
    const streams = await withBackoff(() => getStreams(accessToken, activity.id));
    const now = new Date().toISOString();

    if (!streams) {
      // Handmatige activiteit: geen streams, maar wel afgehandeld.
      await sb.from('activity').update({ streams_synced_at: now }).eq('id', activity.id);
      continue;
    }

    const derived = derive(streams, bands);
    if (derived) {
      const zoneRows = Object.entries(derived.zones).map(([zone, seconds]) => ({
        activity_id: activity.id,
        zone,
        seconds,
      }));
      if (zoneRows.length) await sb.from('activity_zone').upsert(zoneRows, { onConflict: 'activity_id,zone' });
      await sb.from('activity_descent').upsert(
        {
          activity_id: activity.id,
          descent_seconds: derived.descent_seconds,
          descent_m: derived.descent_m,
        },
        { onConflict: 'activity_id' },
      );
      withStreams++;
    }

    await sb.from('activity').update({ streams_synced_at: now }).eq('id', activity.id);
    await pause(250);
  }

  // Koppel elke activiteit aan de sessielog van dezelfde dag.
  const { data: orphans } = await sb
    .from('session_log')
    .select('id, date')
    .eq('athlete_id', athleteId)
    .is('activity_id', null);

  for (const log of ((orphans as { id: string; date: string }[] | null) ?? [])) {
    const { data: match } = await sb
      .from('activity')
      .select('id')
      .eq('athlete_id', athleteId)
      .eq('date', log.date)
      .order('moving_s', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (match) await sb.from('session_log').update({ activity_id: match.id }).eq('id', log.id);
  }

  await sb
    .from('strava_token')
    .update({ synced_at: new Date().toISOString(), backfilled_from: BACKFILL_FROM })
    .eq('athlete_id', athleteId);

  return {
    athlete_id: athleteId,
    opgehaald: activities.length,
    streams: withStreams,
    wachtrij_over: Math.max(0, queue.length - withStreams),
    vanaf: after.toISOString(),
    volledige_haal: moetTerug,
  };
}

export async function POST(request: Request) {
  return GET(request);
}
