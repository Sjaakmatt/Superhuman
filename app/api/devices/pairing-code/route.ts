import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAthlete } from '@/lib/data';
import { koppelcode } from '@/lib/apparaat';

export const dynamic = 'force-dynamic';

/** Maakt een koppelcode voor de ingelogde atleet. Draait met de gewone sessie,
 *  niet met de service-role: RLS doet hier het werk. Vijftien minuten geldig. */
export async function POST() {
  const client = await db();
  if (!client) return NextResponse.json({ error: 'Geen database verbonden.' }, { status: 503 });

  const athlete = await getAthlete();
  if (!athlete) return NextResponse.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const code = koppelcode();
  const expires = new Date(Date.now() + 15 * 60_000).toISOString();

  const { error } = await client
    .from('pairing_code')
    .insert({ code, athlete_id: athlete.id, expires_at: expires });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ code, expiresAt: expires });
}
