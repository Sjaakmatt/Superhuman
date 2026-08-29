import Link from 'next/link';
import Alerts from '@/components/Alerts';
import DayNav from '@/components/DayNav';
import MorningCheck from '@/components/MorningCheck';
import SessionCard from '@/components/SessionCard';
import WeekStrip from '@/components/WeekStrip';
import { Card, CardTitle, Empty, Note, Pill } from '@/components/ui';
import { getDay, getWeek, getWeekDays, planBounds, planSource } from '@/lib/plan';
import { getWellness, loadRuleInput } from '@/lib/data';
import { evaluate } from '@/lib/rules';
import { meanOver } from '@/lib/metrics';
import { addDays, formatLong, today as todayIn } from '@/lib/date';

export default async function Vandaag({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const params = await searchParams;
  const bounds = planBounds();
  const now = todayIn();
  const date = params.d && /^\d{4}-\d{2}-\d{2}$/.test(params.d) ? params.d : now;

  const [day, weekDays] = await Promise.all([getDay(date), getWeekDays(date)]);
  const week = day ? await getWeek(day.week) : null;

  const ruleInput = day && week ? await loadRuleInput(now, week.week, week.status) : null;
  const hits = ruleInput ? evaluate(ruleInput) : [];

  const wellness = await getWellness(addDays(date, -13), date);
  const stored = wellness.find((w) => w.date === date) ?? null;
  // De kolommen mogen null zijn; de schuifjes willen een getal of niets.
  const savedToday = stored
    ? Object.fromEntries(
        (['slept', 'fresh', 'legs', 'mind', 'motivation'] as const)
          .map((k) => [k, stored[k]])
          .filter(([, v]) => typeof v === 'number'),
      )
    : null;
  const average = meanOver(wellness, date, 14, (w) => w.total);

  if (!day) {
    const untilStart = Math.round((Date.parse(bounds.first) - Date.parse(date)) / 86_400_000);
    return (
      <div className="mx-auto flex max-w-[860px] flex-col gap-4 pt-2">
        <DayNav date={date} first={bounds.first} last={bounds.last} />
        {untilStart > 0 ? (
          <Empty title={untilStart === 1 ? 'Het plan begint morgen' : `Het plan begint over ${untilStart} dagen`}>
            De eerste week start op {formatLong(bounds.first)}.{' '}
            <Link href={`/?d=${bounds.first}`} style={{ color: 'var(--acc)' }}>Bekijk die dag</Link>.
          </Empty>
        ) : (
          <Empty title="Buiten het plan">
            Het plan loopt van {bounds.first} tot en met {bounds.last}. Deze dag valt daarbuiten.
          </Empty>
        )}
      </div>
    );
  }

  const daysToRace = Math.max(0, Math.round((Date.parse(bounds.race) - Date.parse(now)) / 86_400_000));

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-4 pt-2">
      <DayNav date={date} first={bounds.first} last={bounds.last} />

      {hits.length > 0 ? <Alerts hits={hits} /> : null}

      <SessionCard day={day} week={week} />

      {day.strength_block ? (
        <Card>
          <CardTitle aside={<Link href="/kracht" className="font-semibold" style={{ color: 'var(--acc)' }}>Loggen →</Link>}>
            Kracht vandaag
          </CardTitle>
          <p className="text-[15px] font-semibold">{day.strength_block}</p>
          {day.strength_detail ? (
            <ul className="mt-3 flex flex-col gap-1.5">
              {day.strength_detail.split('|').map((line) => (
                <li key={line} className="text-[13px]" style={{ color: 'var(--ink2)' }}>{line.trim()}</li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {date === now ? <MorningCheck date={date} saved={savedToday} average={average} /> : null}

      <WeekStrip days={weekDays} today={now} />

      {week ? (
        <Card sunk>
          <CardTitle aside={<Pill tone={week.status === 'DELOAD' ? 'acc' : 'neutral'}>{week.status}</Pill>}>
            Week {week.week} · {week.phase}
          </CardTitle>
          <p className="max-w-[62ch] text-[14px] leading-relaxed">{week.focus}</p>
          <dl className="mt-4 grid grid-cols-2 gap-4 side:grid-cols-4">
            <Figure label="doel" value={`${week.target_km} km`} />
            <Figure label="bij tijdgebrek" value={`${week.compact_km} km`} />
            <Figure label="hoogtemeters" value={week.hm_target ? `${week.hm_target} hm` : '—'} />
            <Figure label="afdaalminuten" value={week.descent_min_target ? `${week.descent_min_target} min` : '—'} />
          </dl>
          <Note>
            Nog {daysToRace} dagen tot 2 oktober 2027.
            {planSource() === 'seed' ? ' Het plan komt nu uit supabase/seed, want er is geen database verbonden.' : ''}
          </Note>
        </Card>
      ) : null}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="num text-[18px] font-semibold">{value}</dd>
      <dt className="text-[12px]" style={{ color: 'var(--ink3)' }}>{label}</dt>
    </div>
  );
}
