import { createClient } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/xp";
import { consistency, dateStrInTz, shiftDate } from "@/lib/streaks";
import type { GoalRow, MetricRow } from "@/lib/types";
import { GoalTree } from "@/components/goal-tree";
import { GoalForm } from "@/components/goal-form";

export const metadata = { title: "Doelen" };

export default async function DoelenPage() {
  const supabase = await createClient();
  const [{ data: profile }, { data: goals }, { data: metrics }] =
    await Promise.all([
      supabase.from("profiles").select("timezone").single(),
      supabase
        .from("goals")
        .select("id, title, horizon, parent_id, status, target_date, linked_metric_id")
        .order("id"),
      supabase.from("metrics").select("id, label").eq("active", true).order("id"),
    ]);
  const timezone = profile?.timezone ?? "Europe/Amsterdam";
  const today = todayInTz(timezone);

  // Ritme-% (28d) voor metrics die aan een doel gekoppeld zijn
  const linkedIds = [
    ...new Set(
      ((goals ?? []) as GoalRow[])
        .map((g) => g.linked_metric_id)
        .filter((id): id is number => id != null),
    ),
  ];
  const metricRhythm: Record<number, number> = {};
  if (linkedIds.length > 0) {
    const cutoff = shiftDate(today, -28);
    const { data: logs } = await supabase
      .from("metric_logs")
      .select("metric_id, date, created_at")
      .in("metric_id", linkedIds)
      .gte("date", cutoff);
    for (const id of linkedIds) {
      const dates = new Set(
        (logs ?? [])
          .filter((l: { metric_id: number }) => l.metric_id === id)
          .map((l: { date: string; created_at: string }) =>
            l.date ?? dateStrInTz(new Date(l.created_at), timezone),
          ),
      );
      metricRhythm[id] = Math.round(consistency(dates, today) * 100);
    }
  }

  const metricLabels = Object.fromEntries(
    ((metrics ?? []) as Pick<MetricRow, "id" | "label">[]).map((m) => [
      m.id,
      m.label,
    ]),
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Doelen</h1>
        <p className="mt-1 text-sm text-muted">
          Van leven naar week — elk niveau voedt het niveau erboven.
        </p>
      </div>

      <GoalForm
        goals={(goals ?? []) as GoalRow[]}
        metrics={(metrics ?? []) as Pick<MetricRow, "id" | "label">[]}
      />

      <GoalTree
        goals={(goals ?? []) as GoalRow[]}
        metricRhythm={metricRhythm}
        metricLabels={metricLabels}
      />
    </div>
  );
}
