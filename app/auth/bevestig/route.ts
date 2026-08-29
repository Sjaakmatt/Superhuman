import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inHetNederlands } from '@/lib/auth';

/* Elke link uit een Supabase-mail komt hier binnen. We wisselen het token in
 * voor een sessie op de server, zodat de cookie klopt vóór het eerste scherm
 * rendert — dat is betrouwbaarder dan het in de browser afhandelen.
 *
 * De sjablonen in supabase/templates verwijzen hiernaartoe met
 * ?token_hash={{ .TokenHash }}&type=recovery&volgende=/wachtwoord-herstellen */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const volgende = url.searchParams.get('volgende') ?? '/';

  const naarLogin = (fout: string) =>
    NextResponse.redirect(new URL(`/login?fout=${encodeURIComponent(fout)}`, url.origin));

  if (!tokenHash || !type) return naarLogin('Deze link is onvolledig. Vraag een nieuwe aan.');

  const client = await db();
  if (!client) return naarLogin('Geen database verbonden.');

  const { error } = await client.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return naarLogin(inHetNederlands(error.message));

  // Alleen paden binnen de app, nooit een doorverwijzing naar buiten.
  const doel = volgende.startsWith('/') && !volgende.startsWith('//') ? volgende : '/';
  return NextResponse.redirect(new URL(doel, url.origin));
}
