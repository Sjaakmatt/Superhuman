import { Card, Pill } from '@/components/ui';
import { loadColor, loadLevel } from '@/lib/load';
import type { PlanDay, PlanWeek } from '@/lib/types';

export default function SessionCard({ day, week }: { day: PlanDay; week: PlanWeek | null }) {
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
      </div>
    </Card>
  );
}
