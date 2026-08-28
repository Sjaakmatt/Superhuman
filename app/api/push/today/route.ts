import { NextResponse } from 'next/server';
import { getDay } from '@/lib/plan';
import { today as todayIn } from '@/lib/date';

/** Wat de melding moet zeggen. De service worker haalt dit op zodra er een push
 *  binnenkomt, zodat de tekst klopt met het plan van dat moment. */
export async function GET() {
  const date = todayIn();
  const day = await getDay(date);

  if (!day) {
    return NextResponse.json({ title: 'Vandaag', body: 'Vandaag valt buiten het plan.', url: '/' });
  }

  const parts = [
    Number(day.planned_km) > 0 ? `${Number(day.planned_km)} km` : null,
    day.zone && day.zone !== '-' ? day.zone : null,
    day.pace_range && day.pace_range !== '-' ? day.pace_range : null,
  ].filter(Boolean);

  return NextResponse.json({
    title: day.session_type,
    body: parts.length ? parts.join(' · ') : day.session_text.slice(0, 120),
    url: '/',
  });
}
