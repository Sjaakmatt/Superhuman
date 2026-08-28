import { NextResponse } from 'next/server';
import { admin } from '@/lib/db';
import { getReference } from '@/lib/plan';
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

export const maxDuration = 120;

/** Dagelijkse sync, om 03:10 aangeroepen door Vercel Cron.
 *  Twee keer achter elkaar draaien mag: alles gaat via upsert op de Strava-id,
 *  dus er ontstaan geen duplicaten. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: 'Niet toegestaan.' }, { status: 401 });

  const sb = admin();
  const { data: athlete } = await sb.from('athlete').select('id').limit(1).maybeSingle();
  if (!athlete) return NextResponse.json({ error: 'Nog geen atleet in de database.' }, { status: 409 });

  const { data: token } = await sb.from('strava_token').select('*').eq('athlete_id', athlete.id).maybeSingle();
  if (!token) return NextResponse.json({ error: 'Strava is nog niet verbonden.' }, { status: 409 });

  // Access tokens verlopen na zes uur; we verversen als er minder dan tien
  // minuten over is. Een nieuw refresh token slaan we meteen op.
  let accessToken = token.access_token as string;
  const expiresAt = Date.parse(token.expires_at as string);
  if (Number.isNaN(expiresAt) || expiresAt - Date.now() < 600_000) {
    const fresh = await refresh(token.refresh_token as string);
    accessToken = fresh.access_token;
    await sb.from('strava_token').update({
      access_token: fresh.access_token,
      refresh_token: fresh.refresh_token,
      expires_at: new Date(fresh.expires_at * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('athlete_id', athlete.id);
  }

  // Eerste keer: alles vanaf 1 augustus 2026. Daarna vanaf de laatste activiteit
  // min één dag, zodat een late upload niet gemist wordt.
  const { data: last } = await sb
    .from('activity')
    .select('start_local')
    .eq('athlete_id', athlete.id)
    .order('start_local', { ascending: false })
    .limit(1)
    .maybeSingle();

  const after = last
    ? new Date(Date.parse(last.start_local as string) - 86_400_000)
    : new Date(`${BACKFILL_FROM}T00:00:00Z`);

  const activities = await withBackoff(() => listActivities(accessToken, after));
  if (activities.length) {
    const { error } = await sb.from('activity').upsert(activities.map((a) => toRow(a, athlete.id)), { onConflict: 'id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Streams alleen voor hardloopactiviteiten die we nog niet hebben, en
  // hoogstens veertig per keer — dat past ruim binnen de limiet.
  const { data: pending } = await sb
    .from('activity')
    .select('id, sport_type')
    .eq('athlete_id', athlete.id)
    .is('streams_synced_at', null)
    .order('start_local', { ascending: false })
    .limit(STREAM_BUDGET * 2);

  const queue = ((pending as { id: number; sport_type: string }[] | null) ?? [])
    .filter((a) => isRun(a.sport_type))
    .slice(0, STREAM_BUDGET);

  const bands = (await getReference('zones')).bands;
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
    .eq('athlete_id', athlete.id)
    .is('activity_id', null);

  for (const log of ((orphans as { id: string; date: string }[] | null) ?? [])) {
    const { data: match } = await sb
      .from('activity')
      .select('id')
      .eq('athlete_id', athlete.id)
      .eq('date', log.date)
      .order('moving_s', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (match) await sb.from('session_log').update({ activity_id: match.id }).eq('id', log.id);
  }

  return NextResponse.json({
    opgehaald: activities.length,
    streams: withStreams,
    wachtrij_over: Math.max(0, queue.length - withStreams),
    vanaf: after.toISOString(),
  });
}

export async function POST(request: Request) {
  return GET(request);
}
