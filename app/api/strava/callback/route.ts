import { NextResponse } from 'next/server';
import { admin } from '@/lib/db';
import { exchangeCode, stravaAppVan } from '@/lib/strava';

/** Strava stuurt de gebruiker hier terug. We wisselen de code om voor tokens en
 *  bewaren die met de service-role-sleutel — strava_token heeft geen RLS-policy,
 *  dus de browser komt er nooit bij. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const userId = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error || !code || !userId) {
    return NextResponse.redirect(new URL(`/instellingen?strava=${error ?? 'mislukt'}`, url.origin));
  }

  const sb = admin();
  const { data: athlete } = await sb.from('athlete').select('id').eq('user_id', userId).maybeSingle();
  if (!athlete) return NextResponse.redirect(new URL('/instellingen?strava=geen-atleet', url.origin));

  const app = await stravaAppVan(athlete.id);
  if (!app) return NextResponse.redirect(new URL('/instellingen?strava=geen-app', url.origin));

  try {
    const tokens = await exchangeCode(app, code);
    await sb.from('strava_token').upsert({
      athlete_id: athlete.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(tokens.expires_at * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (tokens.athlete?.id) {
      await sb.from('athlete').update({ strava_athlete_id: tokens.athlete.id }).eq('id', athlete.id);
    }
  } catch (err) {
    return NextResponse.redirect(new URL(`/instellingen?strava=${encodeURIComponent((err as Error).message)}`, url.origin));
  }

  return NextResponse.redirect(new URL('/instellingen?strava=verbonden', url.origin));
}
