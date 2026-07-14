import { createClient } from "@/lib/supabase/server";
import { superhumanLevel, todayInTz } from "@/lib/xp";
import type { DayTask, MetricRow, UserAttributeRow } from "@/lib/types";
import { LivingCore } from "@/components/living-core";
import { AttributeRings } from "@/components/attribute-rings";
import { WaterTracker } from "@/components/water-tracker";
import { TaskStack } from "@/components/task-stack";

export const metadata = { title: "Vandaag" };

const METRIC_COLUMNS =
  "id, key, label, attribute_key, type, xp_reward, direction, active";

export default async function VandaagPage() {
  const supabase = await createClient();

  // Batch 1: alles wat niet van de datum afhangt (RLS scopet op de gebruiker)
  const [{ data: profile }, { data: attributes }, metricsResult] =
    await Promise.all([
      supabase.from("profiles").select("timezone").single(),
      supabase.from("user_attributes").select("key, level, xp, xp_max"),
      supabase
        .from("metrics")
        .select(METRIC_COLUMNS)
        .eq("active", true)
        .eq("direction", "input")
        .eq("cadence", "daily")
        .order("id"),
    ]);
  const today = todayInTz(profile?.timezone ?? "Europe/Amsterdam");

  // Eerste bezoek: basistakenstack aanmaken en opnieuw ophalen
  let metrics = (metricsResult.data ?? []) as MetricRow[];
  if (metrics.length === 0) {
    await supabase.rpc("ensure_default_metrics");
    const { data: seeded } = await supabase
      .from("metrics")
      .select(METRIC_COLUMNS)
      .eq("active", true)
      .eq("direction", "input")
      .eq("cadence", "daily")
      .order("id");
    metrics = (seeded ?? []) as MetricRow[];
  }

  // Batch 2: de datumafhankelijke logs van vandaag
  const [
    { data: water },
    { data: foodCheckin },
    { data: metricLogs },
    { data: stretchLogs },
    { data: breathworkLogs },
  ] = await Promise.all([
    supabase
      .from("water_logs")
      .select("glasses, goal")
      .eq("date", today)
      .maybeSingle(),
    supabase
      .from("food_checkins")
      .select("id")
      .eq("date", today)
      .maybeSingle(),
    supabase.from("metric_logs").select("metric_id").eq("date", today),
    supabase.from("workout_logs").select("id").eq("date", today).limit(1),
    supabase
      .from("session_logs")
      .select("id")
      .eq("date", today)
      .eq("kind", "breathwork")
      .limit(1),
  ]);

  const loggedMetricIds = new Set(
    (metricLogs ?? []).map((l: { metric_id: number }) => l.metric_id),
  );

  const tasks: DayTask[] = [
    {
      id: "stretch",
      label: "Stretchen",
      meta: "Stretch-sessie met timer",
      attribute: "soepel",
      xp: 40,
      done: (stretchLogs ?? []).length > 0,
      href: "/beweging/stretch",
    },
    {
      id: "breathwork",
      label: "Breathwork",
      meta: "Geleid ademhalingspatroon",
      attribute: "geest",
      xp: 25,
      done: (breathworkLogs ?? []).length > 0,
      href: "/geest/breathwork",
    },
    {
      id: "food",
      label: "Voeding-check-in",
      meta: "Hoe voelde je eten vandaag?",
      attribute: "voeding",
      xp: 20,
      done: Boolean(foodCheckin),
      href: "/voeding",
    },
    ...metrics.map(
      (m): DayTask => ({
        id: `metric-${m.id}`,
        label: m.label,
        meta: "One-tap",
        attribute: m.attribute_key ?? "focus",
        xp: m.xp_reward,
        done: loggedMetricIds.has(m.id),
        metricId: m.id,
      }),
    ),
  ];

  const glasses = water?.glasses ?? 0;
  const goal = water?.goal ?? 8;
  const plannedUnits = tasks.length + 1; // + watergoal
  const completedUnits =
    tasks.filter((t) => t.done).length + (glasses >= goal ? 1 : 0);
  const completion = plannedUnits > 0 ? completedUnits / plannedUnits : 0;

  const attrRows = (attributes ?? []) as UserAttributeRow[];
  const level = superhumanLevel(attrRows.map((a) => a.level));

  return (
    <div className="flex flex-col gap-6">
      <LivingCore level={level} completion={completion} />
      <AttributeRings attributes={attrRows} />
      <WaterTracker glasses={glasses} goal={goal} />
      <TaskStack tasks={tasks} />
    </div>
  );
}
