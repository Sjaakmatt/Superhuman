import { NextResponse } from 'next/server';
import { admin } from '@/lib/db';
import { getDay } from '@/lib/plan';
import { cronAuthorized } from '@/lib/cron';
import { pushConfigured, send } from '@/lib/push';
import { today as todayIn } from '@/lib/date';

/** Zes uur 's ochtends een tik op de schouder. De melding zelf bevat niets;
 *  de service worker haalt de sessie op bij /api/push/today. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: 'Niet toegestaan.' }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: 'VAPID-sleutels ontbreken.' }, { status: 503 });

  const date = todayIn();
  if (!(await getDay(date))) {
    return NextResponse.json({ verstuurd: 0, reden: 'Vandaag valt buiten het plan.' });
  }

  const sb = admin();
  const { data: subs } = await sb.from('push_subscription').select('endpoint, p256dh, auth');

  let sent = 0;
  let removed = 0;
  for (const sub of subs ?? []) {
    const result = await send(sub);
    if (result === 'verstuurd') sent++;
    if (result === 'verlopen') {
      await sb.from('push_subscription').delete().eq('endpoint', sub.endpoint);
      removed++;
    }
  }

  return NextResponse.json({ verstuurd: sent, opgeruimd: removed, datum: date });
}
