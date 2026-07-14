import { createClient } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/xp";
import { dateStrInTz, isoWeekday, shiftDate } from "@/lib/streaks";
import {
  attrTotalXp,
  nextStage,
  pickStage,
  stateLine,
  type EvolutionStage,
} from "@/lib/evolution";
import { ATTRIBUTE_KEYS, type AttributeKey } from "@/lib/attributes";
import { computeReflections } from "@/lib/reflections";
import type {
  DayTask,
  MetricRow,
  ScheduleBlockRow,
  UserAttributeRow,
} from "@/lib/types";
import { NowCard } from "@/components/now-card";
import { LivingCore } from "@/components/living-core";
import { MomentumCells } from "@/components/momentum-cells";
import { EvolutionCeremony } from "@/components/evolution-ceremony";
import { Mirror } from "@/components/mirror";
import { WaterTracker } from "@/components/water-tracker";
import { TaskStack } from "@/components/task-stack";

export const metadata = { title: "Vandaag" };

const METRIC_COLUMNS =
  "id, key, label, attribute_key, type, xp_reward, direction, active";

export default async function VandaagPage() {
  const supabase = await createClient();

  // Batch 1: alles wat niet van de datum afhangt (RLS scopet op de gebruiker)
  const [
    { data: profile },
    { data: attributes },
    { data: stages },
    metricsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("timezone, last_stage").single(),
    supabase
      .from("user_attributes")
      .select("key, level, xp, xp_max, momentum, idle_days"),
    supabase
      .from("evolution_stages")
      .select("ordinal, name, min_total_xp, particles, rings, hue, glow, line")
      .order("ordinal"),
    supabase
      .from("metrics")
      .select(METRIC_COLUMNS)
      .eq("active", true)
      .eq("direction", "input")
      .eq("cadence", "daily")
      .order("id"),
  ]);
  const timezone = profile?.timezone ?? "Europe/Amsterdam";
  const today = todayInTz(timezone);

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

  // Eerste bezoek: standaard-dagritme seeden
  await supabase.rpc("ensure_default_schedule");

  // Batch 2: de datumafhankelijke logs van vandaag
  const [
    { data: water },
    { data: foodCheckin },
    { data: metricLogs },
    { data: stretchLogs },
    { data: breathworkLogs },
    { data: recentEvents },
    { data: journals },
    { data: blocks },
    { data: meditationLogs },
    { data: journalToday },
    { data: reviewRow },
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
    // 30 dagen events: voedt fedToday, streaks én de spiegel
    supabase
      .from("xp_events")
      .select("attribute_key, created_at")
      .gte("created_at", `${shiftDate(today, -30)}T00:00:00Z`),
    supabase
      .from("journal_entries")
      .select("date, mood")
      .gte("date", shiftDate(today, -14))
      .not("mood", "is", null),
    supabase
      .from("schedule_blocks")
      .select("id, label, kind, ref_id, start_min, window_min, days, enabled")
      .eq("enabled", true),
    supabase
      .from("session_logs")
      .select("id")
      .eq("date", today)
      .eq("kind", "meditation")
      .limit(1),
    supabase
      .from("journal_entries")
      .select("id")
      .eq("date", today)
      .limit(1),
    supabase
      .from("reviews")
      .select("week_start")
      .eq("week_start", shiftDate(today, -(isoWeekday(today) - 1)))
      .maybeSingle(),
  ]);

  // Voed-dagen per attribuut (lokale tz) — voor fedToday én de spiegel
  const fedDates = new Map<AttributeKey, Set<string>>(
    ATTRIBUTE_KEYS.map((k) => [k, new Set<string>()]),
  );
  for (const event of (recentEvents ?? []) as {
    attribute_key: string;
    created_at: string;
  }[]) {
    fedDates
      .get(event.attribute_key as AttributeKey)
      ?.add(dateStrInTz(new Date(event.created_at), timezone));
  }
  const fedToday = new Set<AttributeKey>(
    ATTRIBUTE_KEYS.filter((k) => fedDates.get(k)?.has(today)),
  );

  // Gemiddelde stemming per dag (voor het cross-domein-patroon)
  const moodByDay = new Map<string, number>();
  {
    const perDay = new Map<string, number[]>();
    for (const j of (journals ?? []) as { date: string; mood: number }[]) {
      if (!perDay.has(j.date)) perDay.set(j.date, []);
      perDay.get(j.date)!.push(j.mood);
    }
    for (const [day, moods] of perDay) {
      moodByDay.set(day, moods.reduce((a, b) => a + b, 0) / moods.length);
    }
  }

  // Levende laag: totaal-XP, vitaliteit, stage en eventuele ceremonie
  const attrRows = (attributes ?? []) as UserAttributeRow[];
  const totalXp = attrRows.reduce(
    (sum, a) => sum + attrTotalXp(a.level, a.xp),
    0,
  );
  const vitality =
    attrRows.length > 0
      ? attrRows.reduce((sum, a) => sum + Math.min(a.momentum ?? 50, 100), 0) /
        (attrRows.length * 100)
      : 0.5;
  const stageRows = (stages ?? []) as EvolutionStage[];
  const stage = stageRows.length > 0 ? pickStage(stageRows, totalXp) : null;
  const next = stage ? nextStage(stageRows, stage) : null;
  const pendingCeremony =
    stage && stage.ordinal > (profile?.last_stage ?? 0) ? stage : null;

  // Nu-motor: wat is vandaag al gedaan (per blok-soort)?
  const doneKeys: string[] = [];
  if (fedToday.has("soepel")) doneKeys.push("stretch");
  if (fedToday.has("kracht")) doneKeys.push("workout");
  if (fedToday.has("focus")) doneKeys.push("focus");
  if ((breathworkLogs ?? []).length > 0) doneKeys.push("breath");
  if ((meditationLogs ?? []).length > 0) doneKeys.push("meditation");
  if ((journalToday ?? []).length > 0) doneKeys.push("journal");
  if (reviewRow) doneKeys.push("review");
  const scheduleBlocks = (blocks ?? []) as ScheduleBlockRow[];

  // De spiegel: 2 gerankte regels uit echte data
  const reflections = computeReflections({
    attributes: attrRows,
    stages: stageRows,
    fedDates,
    moodByDay,
    today,
    vitality,
  });

  // Takenstack
  const loggedMetricIds = new Set(
    (metricLogs ?? []).map((l: { metric_id: number }) => l.metric_id),
  );
  const tasks: DayTask[] = [
    {
      id: "stretch",
      label: "Stretchen",
      meta: "Begeleide sessie met timer",
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
  const stagePct =
    stage && next
      ? Math.min(
          100,
          ((totalXp - stage.min_total_xp) /
            (next.min_total_xp - stage.min_total_xp)) *
            100,
        )
      : 100;

  return (
    <div className="flex flex-col gap-6">
      {pendingCeremony ? (
        <EvolutionCeremony stage={pendingCeremony} totalXp={totalXp} />
      ) : null}

      <NowCard
        timezone={timezone}
        blocks={scheduleBlocks}
        doneKeys={doneKeys}
      />

      {/* Op desktop twee kolommen: core + cellen links, spiegel/water/taken rechts */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
        <div className="flex flex-col gap-6">
      {/* Home-hero: de levende core */}
      {stage ? (
        <section
          aria-label="Je core"
          className="flex flex-col items-center gap-3.5 pt-2"
        >
          <p className="text-xl font-extrabold">{stage.name}</p>
          <LivingCore totalXp={totalXp} vitality={vitality} stage={stage} />
          {next ? (
            <div className="w-52">
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${stagePct}%`,
                    background: `linear-gradient(90deg, ${stage.hue}, ${next.hue})`,
                    transition: "width .8s",
                  }}
                />
              </div>
              <p className="mt-1.5 text-center font-mono text-[10.5px] text-muted">
                {next.min_total_xp - totalXp} XP tot {next.name}
              </p>
            </div>
          ) : (
            <p
              className="font-mono text-xs font-bold tracking-widest"
              style={{ color: stage.hue }}
            >
              MAX · SUPERHUMAN
            </p>
          )}
          <p className="max-w-[300px] text-center text-[13px] leading-relaxed text-muted">
            {stateLine(vitality, fedToday.size > 0)}
          </p>
        </section>
      ) : null}

          <MomentumCells attributes={attrRows} fedToday={fedToday} />
        </div>

        <div className="flex flex-col gap-6">
          <Mirror reflections={reflections} />
          <WaterTracker glasses={glasses} goal={goal} />
          <TaskStack tasks={tasks} />
        </div>
      </div>
    </div>
  );
}
