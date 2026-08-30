import { NextResponse } from 'next/server';
import { admin, readerFor } from '@/lib/db';
import { getDay } from '@/lib/plan';
import { cronAuthorized } from '@/lib/cron';
import { pushConfigured, send } from '@/lib/push';
import { today as todayIn } from '@/lib/date';

type Abonnement = { endpoint: string; p256dh: string; auth: string; athlete_id: string };

/** Zes uur 's ochtends een tik op de schouder. De melding zelf bevat niets;
 *  de service worker haalt de sessie op bij /api/push/today.
 *
 *  Per atleet, en met de service-role-sleutel. De vorige versie las het plan
 *  via de gewone client: die heeft in een cron geen sessie, dus RLS gaf niets
 *  terug en de melding ging nooit uit. En met twee atleten is "is er vandaag
 *  een sessie" ook geen vraag met één antwoord. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: 'Niet toegestaan.' }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: 'VAPID-sleutels ontbreken.' }, { status: 503 });

  const date = todayIn();
  const sb = admin();
  const { data } = await sb.from('push_subscription').select('endpoint, p256dh, auth, athlete_id');
  const abonnementen = (data as Abonnement[] | null) ?? [];

  const perAtleet = new Map<string, Abonnement[]>();
  for (const a of abonnementen) {
    const lijst = perAtleet.get(a.athlete_id) ?? [];
    lijst.push(a);
    perAtleet.set(a.athlete_id, lijst);
  }

  let sent = 0;
  let removed = 0;
  const overgeslagen: string[] = [];

  for (const [athleteId, lijst] of perAtleet) {
    // Geen sessie vandaag, geen melding: er valt niets te zeggen.
    if (!(await getDay(date, readerFor(athleteId)))) {
      overgeslagen.push(athleteId);
      continue;
    }
    for (const sub of lijst) {
      const result = await send(sub);
      if (result === 'verstuurd') sent++;
      if (result === 'verlopen') {
        await sb.from('push_subscription').delete().eq('endpoint', sub.endpoint);
        removed++;
      }
    }
  }

  return NextResponse.json({
    datum: date,
    atleten: perAtleet.size,
    verstuurd: sent,
    opgeruimd: removed,
    zonder_sessie: overgeslagen.length,
  });
}
