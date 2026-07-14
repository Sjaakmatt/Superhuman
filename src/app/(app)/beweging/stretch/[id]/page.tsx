import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EXERCISE_COLUMNS, type ExerciseRow, type RoutineRow } from "@/lib/types";
import type { Step } from "@/lib/session";
import { StretchPlayer } from "@/components/stretch-player";

export const metadata = { title: "Stretch-sessie" };

interface RoutineExerciseJoin {
  position: number;
  secs: number | null;
  rest_secs: number | null;
  exercises: ExerciseRow | ExerciseRow[] | null;
}

const FALLBACK_SECS = 30;

export default async function StretchSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const routineId = Number(id);
  if (!Number.isInteger(routineId)) notFound();

  const supabase = await createClient();
  const [{ data: routine }, { data: rows }] = await Promise.all([
    supabase
      .from("routines")
      .select("id, name, kind, description, duration_min, level, moment")
      .eq("id", routineId)
      .maybeSingle(),
    supabase
      .from("routine_exercises")
      .select(`position, secs, rest_secs, exercises (${EXERCISE_COLUMNS})`)
      .eq("routine_id", routineId)
      .order("position"),
  ]);

  if (!routine) notFound();
  const r = routine as RoutineRow;

  const steps: Step[] = ((rows ?? []) as RoutineExerciseJoin[])
    .map((row) => {
      const ex = Array.isArray(row.exercises)
        ? row.exercises[0]
        : row.exercises;
      if (!ex) return null;
      return {
        exercise: ex,
        secs: row.secs ?? ex.default_secs ?? FALLBACK_SECS,
        restSecs: row.rest_secs ?? 10,
      } satisfies Step;
    })
    .filter((s): s is Step => s !== null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{r.name}</h1>
        {r.description ? (
          <p className="mt-1 text-sm text-muted">{r.description}</p>
        ) : null}
      </div>
      <StretchPlayer routineId={r.id} routineName={r.name} steps={steps} />
    </div>
  );
}
