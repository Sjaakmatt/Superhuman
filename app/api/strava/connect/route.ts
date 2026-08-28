import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/db';
import { authorizeUrl, stravaConfigured } from '@/lib/strava';

export async function GET(request: Request) {
  if (!stravaConfigured()) {
    return NextResponse.json({ error: 'STRAVA_CLIENT_ID of STRAVA_CLIENT_SECRET ontbreekt.' }, { status: 503 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url));

  const redirect = new URL('/api/strava/callback', process.env.NEXT_PUBLIC_SITE_URL ?? request.url).toString();
  return NextResponse.redirect(authorizeUrl(redirect, user.id));
}
