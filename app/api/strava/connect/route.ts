import { NextResponse } from 'next/server';
import { currentUser, db } from '@/lib/db';
import { authorizeUrl, stravaAppVan } from '@/lib/strava';

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url));

  const client = await db();
  const { data: athlete } = client
    ? await client.from('athlete').select('id').eq('user_id', user.id).maybeSingle()
    : { data: null };
  if (!athlete) {
    return NextResponse.redirect(new URL('/instellingen?strava=geen-atleet', request.url));
  }

  // Je eigen Strava-app, anders die uit de omgeving. Staat er geen van beide,
  // dan valt er niets te koppelen en zeggen we dat op het scherm waar je hem
  // invult, niet in een kale foutmelding.
  const app = await stravaAppVan((athlete as { id: string }).id);
  if (!app) return NextResponse.redirect(new URL('/instellingen?strava=geen-app', request.url));

  const redirect = new URL('/api/strava/callback', process.env.NEXT_PUBLIC_SITE_URL ?? request.url).toString();
  return NextResponse.redirect(authorizeUrl(app, redirect, user.id));
}
