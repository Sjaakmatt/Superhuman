"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/lib/trends";

const AXIS_TICK = {
  fill: "var(--muted)",
  fontSize: 10,
  fontFamily: "var(--font-mono)",
} as const;

function formatDate(date: string): string {
  return `${date.slice(8, 10)}-${date.slice(5, 7)}`;
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { value: number | null }[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length || payload[0].value == null) return null;
  return (
    <div className="rounded-lg border border-line bg-card-2 px-2.5 py-1.5 font-mono text-xs shadow-lg">
      <span className="text-muted">{label ? formatDate(label) : ""} · </span>
      {payload[0].value} {unit}
    </div>
  );
}

interface PanelProps {
  data: TrendPoint[];
  dataKey: "input" | "output";
  title: string;
  unit: string;
  color: string;
  domain?: [number, number];
  showXAxis?: boolean;
}

function TrendPanel({
  data,
  dataKey,
  title,
  unit,
  color,
  domain,
  showXAxis = false,
}: PanelProps) {
  const hasData = data.some((d) => d[dataKey] != null);

  return (
    <figure className="rounded-2xl border border-line bg-card p-4">
      <figcaption className="text-xs text-muted">{title}</figcaption>
      {hasData ? (
        <div className="mt-2 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 4, right: 4, bottom: 0, left: -14 }}
            >
              <CartesianGrid
                stroke="var(--line)"
                strokeOpacity={0.5}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={showXAxis ? AXIS_TICK : false}
                tickFormatter={formatDate}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
                height={showXAxis ? 20 : 4}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                domain={domain ?? [0, "auto"]}
                width={34}
                allowDecimals={false}
              />
              <Tooltip
                content={<ChartTooltip unit={unit} />}
                cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-2 flex h-32 items-center justify-center text-xs text-muted">
          Nog geen data — dit vult zich vanzelf.
        </p>
      )}
    </figure>
  );
}

/**
 * Input tegen output, als twee gestapelde panelen met gedeelde x-as
 * (bewust geen dual-axis). Patronen lees je verticaal.
 */
export function TrendsChart({ data }: { data: TrendPoint[] }) {
  return (
    <section aria-label="Trends" className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted">
        Trends · 30 dagen (7d gemiddeld)
      </h2>
      <TrendPanel
        data={data}
        dataKey="input"
        title="Input · XP per dag"
        unit="XP"
        color="var(--chart-input)"
      />
      <TrendPanel
        data={data}
        dataKey="output"
        title="Output · stemming (1-10)"
        unit="/10"
        color="var(--chart-output)"
        domain={[1, 10]}
        showXAxis
      />
    </section>
  );
}
