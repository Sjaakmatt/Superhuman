import { descentMeters, descentSeconds, zoneSeconds } from '@/lib/metrics';
import { localDayOf, type IsoDate } from '@/lib/date';
import type { Zone } from '@/lib/types';

/* Strava-koppeling. Alles hier draait server-side: tokens komen nooit in de
 * browser. Wat er misgaat als je niet oplet staat in BOUWPLAN.md; de
 * belangrijkste vallen zijn hieronder in code gevangen. */

const API = 'https://www.strava.com/api/v3';
const OAUTH = 'https://www.strava.com/oauth';

export const SCOPE = 'activity:read_all,profile:read_all';

/** De eerste keer halen we alles op vanaf deze datum, daarna incrementeel. */
export const BACKFILL_FROM = '2026-06-01';

/** Streams zijn één verzoek per activiteit. Strava staat 200 verzoeken per
 *  kwartier en 2.000 per dag toe; veertig per sync laat ruimte over voor de
 *  activiteitenlijst en voor een handmatige tweede run. */
export const STREAM_BUDGET = 40;

export type StravaTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // seconden sinds epoch
};

export function authorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPE,
    state,
  });
  return `${OAUTH}/authorize?${params}`;
}

export function stravaConfigured(): boolean {
  return Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);
}

async function tokenRequest(body: Record<string, string>): Promise<StravaTokens & { athlete?: { id: number } }> {
  const res = await fetch(`${OAUTH}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Strava gaf ${res.status}: ${await res.text()}`);
  return res.json();
}

export function exchangeCode(code: string) {
  return tokenRequest({ code, grant_type: 'authorization_code' });
}

/** Access tokens verlopen na zes uur. Strava geeft soms een nieuw refresh token
 *  terug — sla dat op, anders ben je er na verloop van tijd uit. */
export function refresh(refreshToken: string) {
  return tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
}

export type StravaActivity = {
  id: number;
  name: string;
  sport_type: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  calories?: number;
  suffer_score?: number;
  manual?: boolean;
};

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 429) throw new RateLimited();
  if (res.status === 404) throw new NotFound();
  if (!res.ok) throw new Error(`Strava ${path} gaf ${res.status}`);
  return res.json() as Promise<T>;
}

export class RateLimited extends Error {
  constructor() {
    super('Strava-limiet bereikt.');
  }
}

export class NotFound extends Error {
  constructor() {
    super('Niet gevonden bij Strava.');
  }
}

/** Activiteiten sinds een tijdstip, gepagineerd, met pauze tussen de pagina's. */
export async function listActivities(token: string, after: Date, maxPages = 10): Promise<StravaActivity[]> {
  const out: StravaActivity[] = [];
  const epoch = Math.floor(after.getTime() / 1000);
  for (let page = 1; page <= maxPages; page++) {
    const batch = await get<StravaActivity[]>(`/athlete/activities?after=${epoch}&per_page=100&page=${page}`, token);
    out.push(...batch);
    if (batch.length < 100) break;
    await pause(400);
  }
  return out;
}

export type Streams = {
  time?: { data: number[] };
  heartrate?: { data: number[] };
  altitude?: { data: number[] };
  grade_smooth?: { data: number[] };
  velocity_smooth?: { data: number[] };
  distance?: { data: number[] };
};

const STREAM_KEYS = 'time,heartrate,altitude,grade_smooth,velocity_smooth,distance';

/** Handmatige activiteiten hebben geen streams; die geven een 404. */
export async function getStreams(token: string, activityId: number): Promise<Streams | null> {
  try {
    return await get<Streams>(`/activities/${activityId}/streams?keys=${STREAM_KEYS}&key_by_type=true`, token);
  } catch (error) {
    if (error instanceof NotFound) return null;
    throw error;
  }
}

export type DerivedStreams = {
  zones: Record<string, number>;
  descent_seconds: number;
  descent_m: number;
};

/** De afgeleide getallen uit een stream. Definities staan in lib/metrics.ts. */
export function derive(streams: Streams, bands: Zone[]): DerivedStreams | null {
  const time = streams.time?.data;
  if (!time?.length) return null;
  const grade = streams.grade_smooth?.data ?? [];
  const altitude = streams.altitude?.data ?? [];
  const heartrate = streams.heartrate?.data ?? [];

  return {
    zones: heartrate.length ? zoneSeconds(time, heartrate, bands) : {},
    descent_seconds: grade.length ? descentSeconds(time, grade) : 0,
    descent_m: grade.length && altitude.length ? descentMeters(altitude, grade) : 0,
  };
}

export function toRow(activity: StravaActivity, athleteId: string) {
  return {
    id: activity.id,
    athlete_id: athleteId,
    // start_date_local is al lokaal; we knippen de kalenderdag eruit zodat een
    // loop van 23:40 bij die dag blijft horen.
    date: localDayOf(activity.start_date_local) as IsoDate,
    start_local: activity.start_date_local.replace('Z', ''),
    sport_type: activity.sport_type,
    name: activity.name,
    distance_m: activity.distance,
    moving_s: activity.moving_time,
    elapsed_s: activity.elapsed_time,
    elev_gain_m: activity.total_elevation_gain,
    avg_hr: activity.average_heartrate ?? null,
    max_hr: activity.max_heartrate ?? null,
    avg_cadence: activity.average_cadence ?? null,
    calories: activity.calories ?? null,
    suffer_score: activity.suffer_score ?? null,
    raw: activity,
    synced_at: new Date().toISOString(),
  };
}

export const isRun = (sportType: string) => sportType === 'Run' || sportType === 'TrailRun';

export function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponentieel wachten bij een limiet: 2, 4, 8 seconden. */
export async function withBackoff<T>(work: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await work();
    } catch (error) {
      last = error;
      if (!(error instanceof RateLimited)) throw error;
      await pause(2000 * 2 ** i);
    }
  }
  throw last;
}
