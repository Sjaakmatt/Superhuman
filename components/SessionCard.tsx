import Link from 'next/link';
import { Card, Pill } from '@/components/ui';
import { loadColor, loadLevel } from '@/lib/load';
import { km as naarKm, minutes as naarMinuten } from '@/lib/metrics';
import type { Gemeten } from '@/components/MijlpaalUitslag';
import type { PlanDay, PlanWeek } from '@/lib/types';

/* Het plan en wat ervan terechtkwam, op dezelfde kaart. Los van elkaar zeggen
 * ze weinig: 12 km gepland is pas informatie als je ziet dat je er 15 liep. */
export default function SessionCard({
  day,
  week,
  gemeten,
  toonGelopen,
}: {
  day: PlanDay;
  week: PlanWeek | null;
  gemeten: Gemeten;
  /** Vóór de dag zelf valt er niets te vergelijken. */
  toonGelopen: boolean;
}) {
  const level = loadLevel(day);
  const hasZone = day.zone && day.zone !== '-';
  const hasPace = day.pace_range && day.pace_range !== '-';

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="h-2 w-full" style={{ background: loadColor(level) }} aria-hidden />
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="acc">{day.session_type}</Pill>
          {hasZone ? <Pill>{day.zone}</Pill> : null}
          {week ? <Pill>{week.phase}</Pill> : null}
        </div>

        <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed">{day.session_text}</p>

        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
          {Number(day.planned_km) > 0 ? (
            <div>
              <dd className="num text-[24px] font-semibold leading-none">
                {Number(day.planned_km)}<span className="ml-1 text-[13px] font-medium" style={{ color: 'var(--ink3)' }}>km</span>
              </dd>
              <dt className="mt-1.5 text-[12px]" style={{ color: 'var(--ink3)' }}>gepland</dt>
            </div>
          ) : null}
          {day.planned_min > 0 ? (
            <div>
              <dd className="num text-[24px] font-semibold leading-none">
                {day.planned_min}<span className="ml-1 text-[13px] font-medium" style={{ color: 'var(--ink3)' }}>min</span>
              </dd>
              <dt className="mt-1.5 text-[12px]" style={{ color: 'var(--ink3)' }}>tijd</dt>
            </div>
          ) : null}
          {hasPace ? (
            <div>
              <dd className="num text-[24px] font-semibold leading-none">{day.pace_range}</dd>
              <dt className="mt-1.5 text-[12px]" style={{ color: 'var(--ink3)' }}>tempo /km</dt>
            </div>
          ) : null}
        </dl>

        {toonGelopen ? <Gelopen day={day} gemeten={gemeten} /> : null}
      </div>
    </Card>
  );
}

function Gelopen({ day, gemeten }: { day: PlanDay; gemeten: Gemeten }) {
  const { activity } = gemeten;

  if (!activity) {
    return (
      <p className="mt-5 border-t pt-4 text-[13px]" style={{ borderColor: 'var(--hair)', color: 'var(--ink3)' }}>
        Nog niets uit Strava voor deze dag.{' '}
        <Link href={`/loggen?d=${day.date}`} style={{ color: 'var(--acc)' }}>Ophalen of zelf loggen</Link>.
      </p>
    );
  }

  const gelopenKm = naarKm(activity.distance_m);
  const gepland = Number(day.planned_km);
  const verschil = gepland > 0 ? Math.round((gelopenKm - gepland) * 10) / 10 : null;

  return (
    <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--hair)' }}>
      <p className="text-[12px] font-semibold uppercase tracking-[.08em]" style={{ color: 'var(--ink3)' }}>
        Gelopen
      </p>
      <p className="mt-1 text-[14px] font-semibold">{activity.name ?? activity.sport_type}</p>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
        <Cijfer value={`${gelopenKm} km`} label="afstand"
          delta={verschil === null || verschil === 0 ? null : `${verschil > 0 ? '+' : ''}${String(verschil).replace('.', ',')}`} />
        <Cijfer value={`${naarMinuten(activity.moving_s)} min`} label="in beweging" />
        <Cijfer value={`${Math.round(Number(activity.elev_gain_m ?? 0))} hm`} label="klim" />
        {activity.avg_hr ? <Cijfer value={`${Math.round(Number(activity.avg_hr))} bpm`} label="gemiddelde hartslag" /> : null}
        {activity.descent_min !== null ? <Cijfer value={`${activity.descent_min} min`} label="afdalen" /> : null}
      </dl>
    </div>
  );
}

function Cijfer({ value, label, delta }: { value: string; label: string; delta?: string | null }) {
  return (
    <div>
      <dd className="num text-[18px] font-semibold leading-none">
        {value}
        {delta ? <span className="ml-1.5 text-[12px] font-medium" style={{ color: 'var(--ink3)' }}>{delta}</span> : null}
      </dd>
      <dt className="mt-1.5 text-[12px]" style={{ color: 'var(--ink3)' }}>{label}</dt>
    </div>
  );
}
