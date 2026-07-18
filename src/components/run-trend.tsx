"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPace, type WeekVolume } from "@/lib/running";

const VITAL = "var(--attr-vitaliteit)";

const AXIS_TICK = {
  fill: "var(--muted)",
  fontSize: 10,
  fontFamily: "var(--font-mono)",
} as const;

export interface PacePoint {
  date: string;
  pace: number;
}

function dayMonth(date: string): string {
  return `${date.slice(8, 10)}-${date.slice(5, 7)}`;
}

function VolumeTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number | null }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-card-2 px-2.5 py-1.5 font-mono text-xs shadow-lg">
      <span className="text-muted">week {label ? dayMonth(label) : ""} · </span>
      {payload[0].value} km
    </div>
  );
}

function PaceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number | null }[];
  label?: string;
}) {
  if (!active || !payload?.length || payload[0].value == null) return null;
  return (
    <div className="rounded-lg border border-line bg-card-2 px-2.5 py-1.5 font-mono text-xs shadow-lg">
      <span className="text-muted">{label ? dayMonth(label) : ""} · </span>
      {formatPace(payload[0].value)} /km
    </div>
  );
}

export function RunTrend({
  weekly,
  paceSeries,
}: {
  weekly: WeekVolume[];
  paceSeries: PacePoint[];
}) {
  const hasVolume = weekly.some((w) => w.km > 0);
  const hasPace = paceSeries.length > 0;

  return (
    <section aria-label="Trend" className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted">Trend</h2>

      <figure className="rounded-2xl border border-line bg-card p-4">
        <figcaption className="text-xs text-muted">
          Weekvolume · km per week
        </figcaption>
        {hasVolume ? (
          <div className="mt-2 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
                <CartesianGrid stroke="var(--line)" strokeOpacity={0.5} vertical={false} />
                <XAxis
                  dataKey="weekStart"
                  tick={AXIS_TICK}
                  tickFormatter={dayMonth}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={20}
                  height={20}
                />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={34}
                  allowDecimals={false}
                />
                <Tooltip content={<VolumeTooltip />} cursor={{ fill: "var(--line)", fillOpacity: 0.3 }} />
                <Bar dataKey="km" fill={VITAL} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-2 flex h-32 items-center justify-center text-xs text-muted">
            Nog geen runs — dit vult zich vanzelf.
          </p>
        )}
      </figure>

      <figure className="rounded-2xl border border-line bg-card p-4">
        <figcaption className="text-xs text-muted">
          Tempo · min/km per run (lager is sneller)
        </figcaption>
        {hasPace ? (
          <div className="mt-2 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={paceSeries} margin={{ top: 4, right: 4, bottom: 0, left: -2 }}>
                <CartesianGrid stroke="var(--line)" strokeOpacity={0.5} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={AXIS_TICK}
                  tickFormatter={dayMonth}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={30}
                  height={20}
                />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={46}
                  tickFormatter={(v: number) => `${formatPace(v)}`}
                  reversed
                  domain={["auto", "auto"]}
                />
                <Tooltip content={<PaceTooltip />} cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }} />
                <Line
                  type="monotone"
                  dataKey="pace"
                  stroke={VITAL}
                  strokeWidth={2}
                  dot={{ r: 2, strokeWidth: 0, fill: VITAL }}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-2 flex h-32 items-center justify-center text-xs text-muted">
            Log een run met afstand én duur om je tempo te volgen.
          </p>
        )}
      </figure>
    </section>
  );
}
