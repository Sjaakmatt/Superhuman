import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAthlete } from '@/lib/data';

/** De browser meldt zich aan of af voor de ochtendmelding. */
export async function POST(request: Request) {
  const client = await db();
  const athlete = await getAthlete();
  if (!client || !athlete) return NextResponse.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const body = (await request.json()) as { endpoint?: string; p256dh?: string; auth?: string };
  if (!body.endpoint || !body.p256dh || !body.auth) {
    return NextResponse.json({ error: 'Onvolledig abonnement.' }, { status: 400 });
  }

  const { error } = await client.from('push_subscription').upsert(
    { endpoint: body.endpoint, athlete_id: athlete.id, p256dh: body.p256dh, auth: body.auth },
    { onConflict: 'endpoint' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const client = await db();
  if (!client) return NextResponse.json({ error: 'Niet ingelogd.' }, { status: 401 });
  const { endpoint } = (await request.json()) as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ error: 'Geen endpoint.' }, { status: 400 });
  await client.from('push_subscription').delete().eq('endpoint', endpoint);
  return NextResponse.json({ ok: true });
}
