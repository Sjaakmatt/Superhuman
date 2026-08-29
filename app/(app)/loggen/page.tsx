import Link from 'next/link';
import SessionLogForm from '@/components/SessionLogForm';
import { Card, CardTitle, Empty, Grid, Note, Pill, Stat } from '@/components/ui';
import { getDay } from '@/lib/plan';
import { getActivities, getLogs, getShoes } from '@/lib/data';
import { dbConfigured } from '@/lib/db';
import { addDays, formatLong, formatShort, today as todayIn } from '@/lib/date';
import { km, minutes } from '@/lib/metrics';

export default async function Loggen({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const params = await searchParams;
  const now = todayIn();
  const date = params.d && /^\d{4}-\d{2}-\d{2}$/.test(params.d) ? params.d : now;

  const [day, shoes, activities, logs] = await Promise.all([
    getDay(date),
    getShoes(),
    getActivities(date, date),
    getLogs(addDays(now, -30), now),
  ]);

  const saved = logs.find((l) => l.date === date) ?? null;
  const isLongrun = Boolean(day && (/lang|back-to-back|trail/i.test(day.session_type) || Number(day.planned_km) >= 20));

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-4 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px]" style={{ color: 'var(--ink3)' }}>{date === now ? 'Vandaag' : 'Eerdere dag'}</p>
          <p className="text-[17px] font-bold first-letter:uppercase">{formatLong(date)}</p>
        </div>
        <div className="flex gap-1.5">
          {[-2, -1].map((offset) => {
            const d = addDays(now, offset);
            return (
              <Link key={d} href={`/loggen?d=${d}`}
                className="interactive rounded-[var(--r-btn)] px-3 py-2 text-[12px] font-semibold"
                style={{
                  background: date === d ? 'var(--acc-soft)' : 'var(--card)',
                  color: date === d ? 'var(--acc)' : 'var(--ink2)',
                  border: '1px solid var(--hair)',
                }}>
                {offset === -1 ? 'Gisteren' : 'Eergisteren'}
              </Link>
            );
          })}
          <Link href="/loggen"
            className="interactive rounded-[var(--r-btn)] px-3 py-2 text-[12px] font-semibold"
            style={{
              background: date === now ? 'var(--acc-soft)' : 'var(--card)',
              color: date === now ? 'var(--acc)' : 'var(--ink2)',
              border: '1px solid var(--hair)',
            }}>
            Vandaag
          </Link>
        </div>
      </div>

      {day ? (
        <Card sunk>
          <CardTitle aside={day.zone && day.zone !== '-' ? <Pill>{day.zone}</Pill> : null}>Gepland</CardTitle>
          <p className="text-[15px] font-semibold">{day.session_type}</p>
          <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed" style={{ color: 'var(--ink2)' }}>{day.session_text}</p>
        </Card>
      ) : null}

      {activities.length > 0 ? (
        <Card>
          <CardTitle aside="uit Strava">Gelopen</CardTitle>
          {activities.map((a) => (
            <div key={a.id} className="mb-4 last:mb-0">
              <p className="mb-3 text-[14px] font-semibold">{a.name ?? a.sport_type}</p>
              <Grid min={110}>
                <Stat value={km(a.distance_m)} unit="km" label="afstand" />
                <Stat value={minutes(a.moving_s)} unit="min" label="in beweging" />
                <Stat value={Math.round(Number(a.elev_gain_m ?? 0))} unit="hm" label="klim" />
                <Stat value={a.avg_hr ? Math.round(Number(a.avg_hr)) : '—'} unit={a.avg_hr ? 'bpm' : undefined} label="gemiddelde hartslag" />
              </Grid>
            </div>
          ))}
        </Card>
      ) : null}

      {dbConfigured() ? (
        <SessionLogForm date={date} saved={saved} shoes={shoes} isLongrun={isLongrun} />
      ) : (
        <Empty title="Nog geen database verbonden">
          Zet <code>NEXT_PUBLIC_SUPABASE_URL</code> en <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code>,
          draai de migraties en <code>npm run db:seed</code>. Daarna kun je hier loggen.
        </Empty>
      )}

      {logs.length > 0 ? (
        <Card sunk>
          <CardTitle aside={`${logs.length} in 30 dagen`}>Wat je logde</CardTitle>
          <ul className="flex flex-col">
            {[...logs].reverse().map((log) => (
              <li key={log.id} className="flex items-center gap-3 border-b py-2.5 last:border-0"
                style={{ borderColor: 'var(--hair)' }}>
                <Link href={`/loggen?d=${log.date}`} className="num w-14 shrink-0 text-[12px]" style={{ color: 'var(--ink3)' }}>
                  {formatShort(log.date, now)}
                </Link>
                <span className="text-[13px]">
                  {log.rpe ? `zwaarte ${log.rpe}` : 'geen zwaarte'}
                  {log.pain_score ? ` · pijn ${log.pain_score}` : ''}
                  {log.pain_next_morning ? ` · ochtend ${log.pain_next_morning}` : ''}
                </span>
                {log.note ? (
                  <span className="ml-auto hidden max-w-[36ch] truncate text-[12px] side:block" style={{ color: 'var(--ink3)' }}>
                    {log.note}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <Note>Pijn tot en met 5 mag, moet de volgende ochtend nul zijn, en mag niet week op week stijgen. Alle drie moeten kloppen.</Note>
        </Card>
      ) : null}
    </div>
  );
}
