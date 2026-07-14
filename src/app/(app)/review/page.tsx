import { createClient } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/xp";
import { dateStrInTz, isoWeekday, shiftDate } from "@/lib/streaks";
import { ATTRIBUTE_KEYS, ATTRIBUTES, type AttributeKey } from "@/lib/attributes";
import type { ReviewRow } from "@/lib/types";
import { ReviewForm } from "@/components/review-form";

export const metadata = { title: "Wekelijkse review" };

export default async function ReviewPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .single();
  const timezone = profile?.timezone ?? "Europe/Amsterdam";
  const today = todayInTz(timezone);
  const weekStart = shiftDate(today, -(isoWeekday(today) - 1));

  const [
    { data: events },
    { data: waterLogs },
    { data: checkins },
    { data: journals },
    { data: review },
  ] = await Promise.all([
    supabase
      .from("xp_events")
      .select("attribute_key, amount, created_at")
      .gte("created_at", `${weekStart}T00:00:00Z`),
    supabase
      .from("water_logs")
      .select("glasses, goal")
      .gte("date", weekStart),
    supabase
      .from("food_checkins")
      .select("satisfied")
      .gte("date", weekStart),
    supabase
      .from("journal_entries")
      .select("mood")
      .gte("date", weekStart)
      .not("mood", "is", null),
    supabase
      .from("reviews")
      .select("week_start, wins, lessons, adjustments, domain_scores, focus_next")
      .eq("week_start", weekStart)
      .maybeSingle(),
  ]);

  // Week in cijfers: XP + actieve dagen per attribuut
  const xpTotal = new Map<AttributeKey, number>();
  const activeDays = new Map<AttributeKey, Set<string>>();
  for (const event of events ?? []) {
    const key = event.attribute_key as AttributeKey;
    const day = dateStrInTz(new Date(event.created_at), timezone);
    if (day < weekStart) continue;
    xpTotal.set(key, (xpTotal.get(key) ?? 0) + event.amount);
    if (!activeDays.has(key)) activeDays.set(key, new Set());
    activeDays.get(key)!.add(day);
  }

  const stats = ATTRIBUTE_KEYS.map((key) => ({
    key,
    xp: xpTotal.get(key) ?? 0,
    days: activeDays.get(key)?.size ?? 0,
  }));
  const minDays = Math.min(...stats.map((s) => s.days));
  const laggard = stats.filter((s) => s.days === minDays && minDays < 3);

  const moods = (journals ?? [])
    .map((j: { mood: number | null }) => j.mood)
    .filter((m): m is number => m != null);
  const avgMood =
    moods.length > 0
      ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1)
      : null;
  const waterDaysAtGoal = (waterLogs ?? []).filter(
    (w: { glasses: number; goal: number }) => w.glasses >= w.goal,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Wekelijkse review</h1>
        <p className="mt-1 font-mono text-xs text-muted">
          week van {weekStart.slice(8, 10)}-{weekStart.slice(5, 7)}
        </p>
      </div>

      {/* Je week in cijfers (voorgevuld) */}
      <section
        aria-label="Je week in cijfers"
        className="rounded-2xl border border-line bg-card p-4"
      >
        <h2 className="text-sm font-medium text-muted">Je week in cijfers</h2>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
          {stats.map((s) => (
            <li
              key={s.key}
              className="flex items-center gap-2 font-mono text-xs"
            >
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: ATTRIBUTES[s.key].colorVar }}
              />
              <span className="min-w-0 flex-1 truncate text-muted">
                {ATTRIBUTES[s.key].label}
              </span>
              <span>
                {s.days}d · {s.xp} XP
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
          {checkins?.length ?? 0} check-ins · {waterDaysAtGoal}× watergoal
          {avgMood ? ` · stemming ø ${avgMood}` : ""}
          {laggard.length > 0 && laggard.length < 6
            ? ` · aandacht: ${laggard.map((s) => ATTRIBUTES[s.key].label).join(", ")}`
            : ""}
        </p>
      </section>

      <ReviewForm weekStart={weekStart} existing={review as ReviewRow | null} />
    </div>
  );
}
