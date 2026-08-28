import { NextResponse } from 'next/server';
import { admin } from '@/lib/db';
import { getDay } from '@/lib/plan';
import { cronAuthorized } from '@/lib/cron';
import { pushConfigured, send } from '@/lib/push';
import { today as todayIn } from '@/lib/date';

/** Zes uur 's ochtends: wat er vandaag op het programma staat. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: 'Niet toegestaan.' }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: 'VAPID-sleutels ontbreken.' }, { status: 503 });

  const date = todayIn();
  const day = await getDay(date);
  if (!day) return NextResponse.json({ verstuurd: 0, reden: 'Vandaag valt buiten het plan.' });

  const sb = admin();
  const { data: subs } = await sb.from('push_subscription').select('endpoint, p256dh, auth');

  const payload = {
    title: day.session_type,
    body:
      Number(day.planned_km) > 0
        ? `${day.planned_km} km${day.zone && day.zone !== '-' ? ` · ${day.zone}` : ''}${day.pace_range && day.pace_range !== '-' ? ` · ${day.pace_range}` : ''}`
        : day.session_text.slice(0, 120),
    url: '/',
  };

  let sent = 0;
  for (const sub of subs ?? []) {
    const alive = await send(sub, payload);
    if (alive) sent++;
    else await sb.from('push_subscription').delete().eq('endpoint', sub.endpoint);
  }

  return NextResponse.json({ verstuurd: sent, datum: date });
}
