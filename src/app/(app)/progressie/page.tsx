import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ATTRIBUTE_KEYS, ATTRIBUTES, type AttributeKey } from "@/lib/attributes";
import { superhumanLevel, todayInTz } from "@/lib/xp";
import {
  consistency,
  currentStreak,
  dateStrInTz,
  shiftDate,
} from "@/lib/streaks";
import { rollingAvg, type TrendPoint } from "@/lib/trends";
import type { UserAttributeRow } from "@/lib/types";
import { WeekHeatmap } from "@/components/week-heatmap";
import { TrendsChart } from "@/components/trends-chart";

export const metadata = { title: "Progressie" };

const LOOKBACK_DAYS = 35;

export default async function ProgressiePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const timezone = profile?.timezone ?? "Europe/Amsterdam";
  const today = todayInTz(timezone);

  const cutoff = `${shiftDate(today, -LOOKBACK_DAYS)}T00:00:00Z`;

  const [{ data: attributes }, { data: events }, { data: journals }] =
    await Promise.all([
      supabase.from("user_attributes").select("key, level, xp, xp_max"),
      supabase
        .from("xp_events")
        .select("attribute_key, amount, created_at")
        .gte("created_at", cutoff),
      supabase
        .from("journal_entries")
        .select("date, mood")
        .gte("date", shiftDate(today, -LOOKBACK_DAYS))
        .not("mood", "is", null),
    ]);

  // Per attribuut: set van actieve dagen (in de tijdzone van de gebruiker)
  const activeDates = new Map<AttributeKey, Set<string>>(
    ATTRIBUTE_KEYS.map((k) => [k, new Set<string>()]),
  );
  for (const event of events ?? []) {
    const key = event.attribute_key as AttributeKey;
    activeDates
      .get(key)
      ?.add(dateStrInTz(new Date(event.created_at), timezone));
  }

  // Heatmap: per dag hoeveel attributen actief waren
  const dayActivity = new Map<string, number>();
  for (const dates of activeDates.values()) {
    for (const date of dates) {
      dayActivity.set(date, (dayActivity.get(date) ?? 0) + 1);
    }
  }

  const attrRows = (attributes ?? []) as UserAttributeRow[];
  const byKey = new Map(attrRows.map((a) => [a.key, a]));
  const level = superhumanLevel(attrRows.map((a) => a.level));

  // Trends: XP per dag (input) tegen stemming (output), 7d rolling
  const xpPerDay = new Map<string, number>();
  for (const event of events ?? []) {
    const day = dateStrInTz(new Date(event.created_at), timezone);
    xpPerDay.set(day, (xpPerDay.get(day) ?? 0) + (event.amount ?? 0));
  }
  const moodPerDay = new Map<string, number[]>();
  for (const j of (journals ?? []) as { date: string; mood: number }[]) {
    if (!moodPerDay.has(j.date)) moodPerDay.set(j.date, []);
    moodPerDay.get(j.date)!.push(j.mood);
  }
  const trendDates = Array.from({ length: 30 }, (_, i) =>
    shiftDate(today, -(29 - i)),
  );
  const inputSeries = rollingAvg(
    trendDates.map((d) => xpPerDay.get(d) ?? 0),
  );
  const outputSeries = rollingAvg(
    trendDates.map((d) => {
      const moods = moodPerDay.get(d);
      return moods ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
    }),
  );
  const trendData: TrendPoint[] = trendDates.map((date, i) => ({
    date,
    input: inputSeries[i],
    output: outputSeries[i],
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Character sheet header */}
      <section className="flex flex-col items-center gap-1 py-4 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted">
          Superhuman-level
        </p>
        <p className="font-mono text-7xl font-semibold">
          <span className="text-muted">L</span>
          {level}
        </p>
        <p className="text-xs text-muted">
          gemiddelde van je zes attributen
        </p>
      </section>

      <WeekHeatmap activity={dayActivity} today={today} />

      {/* Per attribuut: level, XP-bar, streak en consistentie */}
      <section aria-label="Attributen" className="flex flex-col gap-2">
        {ATTRIBUTE_KEYS.map((key) => {
          const def = ATTRIBUTES[key];
          const row = byKey.get(key) ?? { key, level: 1, xp: 0, xp_max: 100 };
          const dates = activeDates.get(key) ?? new Set<string>();
          const streak = currentStreak(dates, today);
          const rhythm = Math.round(consistency(dates, today) * 100);

          return (
            <article
              key={key}
              className="rounded-2xl border border-line bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    background: def.colorVar,
                    boxShadow: `0 0 8px ${def.colorVar}`,
                  }}
                />
                <h2 className="min-w-0 flex-1 text-sm font-medium">
                  {def.label}
                </h2>
                <p className="font-mono text-sm">
                  <span className="text-muted">L</span>
                  {row.level}
                </p>
              </div>
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-2"
                role="progressbar"
                aria-valuenow={row.xp}
                aria-valuemax={row.xp_max}
                aria-label={`${def.label}: ${row.xp} van ${row.xp_max} XP`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min((row.xp / row.xp_max) * 100, 100)}%`,
                    background: def.colorVar,
                  }}
                />
              </div>
              <div className="mt-2 flex justify-between font-mono text-xs text-muted">
                <span>
                  {row.xp}/{row.xp_max} XP
                </span>
                <span>
                  {streak > 0 ? `streak ${streak}d · ` : ""}
                  ritme {rhythm}%
                </span>
              </div>
            </article>
          );
        })}
      </section>

      <TrendsChart data={trendData} />

      {/* Discipline-laag */}
      <ul className="grid grid-cols-2 gap-2">
        <li>
          <Link
            href="/doelen"
            className="flex h-full flex-col gap-1 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted"
          >
            <span className="text-sm font-medium">Doelen</span>
            <span className="text-xs text-muted">leven → week</span>
          </Link>
        </li>
        <li>
          <Link
            href="/review"
            className="flex h-full flex-col gap-1 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted"
          >
            <span className="text-sm font-medium">Review</span>
            <span className="text-xs text-muted">wekelijks, voorgevuld</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
