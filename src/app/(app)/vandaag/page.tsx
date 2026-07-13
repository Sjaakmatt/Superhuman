import { createClient } from "@/lib/supabase/server";
import { superhumanLevel, todayInTz } from "@/lib/xp";
import type { DayTask, MetricRow, UserAttributeRow } from "@/lib/types";
import { LivingCore } from "@/components/living-core";
import { AttributeRings } from "@/components/attribute-rings";
import { WaterTracker } from "@/components/water-tracker";
import { TaskStack } from "@/components/task-stack";

export const metadata = { title: "Vandaag" };

export default async function VandaagPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // layout redirect vangt dit al af

  // Eerste bezoek: zorg dat er een basistakenstack is
  await supabase.rpc("ensure_default_metrics");

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const today = todayInTz(profile?.timezone ?? "Europe/Amsterdam");

  const [
    { data: attributes },
    { data: water },
    { data: foodCheckin },
    { data: metrics },
    { data: metricLogs },
    { data: stretchLogs },
    { data: breathworkLogs },
  ] = await Promise.all([
    supabase.from("user_attributes").select("key, level, xp, xp_max"),
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
    supabase
      .from("metrics")
      .select("id, key, label, attribute_key, type, xp_reward, direction, active")
      .eq("active", true)
      .eq("direction", "input")
      .eq("cadence", "daily")
      .order("id"),
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
    ...((metrics ?? []) as MetricRow[]).map(
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
