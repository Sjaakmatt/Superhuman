import { NextResponse } from 'next/server';
import { admin } from '@/lib/db';
import { apparaatToken, hashToken } from '@/lib/apparaat';

export const dynamic = 'force-dynamic';

/** Wisselt een koppelcode in voor een apparaattoken. De code is vijftien minuten
 *  geldig en eenmalig bruikbaar. Openbaar bereikbaar: de code is het geheim. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const ruw = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  if (ruw.length < 6 || ruw.length > 12) {
    return NextResponse.json({ error: 'Die code klopt niet.' }, { status: 400 });
  }

  const sb = admin();
  const { data } = await sb
    .from('pairing_code')
    .select('code, athlete_id, expires_at, used_at')
    .eq('code', ruw)
    .maybeSingle();

  const code = data as { code: string; athlete_id: string; expires_at: string; used_at: string | null } | null;

  // Bewust dezelfde melding voor alle drie de gevallen: bestaat niet, al
  // gebruikt, of verlopen. Anders vertel je welke codes er zijn.
  if (!code || code.used_at || Date.parse(code.expires_at) < Date.now()) {
    return NextResponse.json({ error: 'Code klopt niet of is verlopen.' }, { status: 400 });
  }

  const token = apparaatToken();
  const { error } = await sb.from('device').insert({
    athlete_id: code.athlete_id,
    naam: 'Telefoon',
    token_hash: await hashToken(token),
  });
  if (error) return NextResponse.json({ error: 'Koppelen mislukt.' }, { status: 500 });

  // Eenmalig: meteen afstempelen, ook als er verderop iets misgaat.
  await sb.from('pairing_code').update({ used_at: new Date().toISOString() }).eq('code', ruw);

  // Het token gaat hier één keer over de lijn en is daarna niet meer op te vragen.
  return NextResponse.json({ deviceToken: token });
}
