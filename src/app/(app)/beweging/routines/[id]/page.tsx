import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EXERCISE_COLUMNS, type ExerciseRow, type RoutineRow } from "@/lib/types";
import { explainTempo } from "@/lib/session";
import { WorkoutLogger, type PlanExercise } from "@/components/workout-logger";

export const metadata = { title: "Workout" };

interface RoutineExerciseJoin {
  position: number;
  secs: number | null;
  reps: number | null;
  sets: number | null;
  rest_secs: number | null;
  exercises: ExerciseRow | ExerciseRow[] | null;
}

interface LoggedExercise {
  exercise_id: number;
  sets?: { reps?: number | null }[];
}

export default async function RoutinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const routineId = Number(id);
  if (!Number.isInteger(routineId)) notFound();

  const supabase = await createClient();
  const [{ data: routine }, { data: rows }, { data: lastLog }] =
    await Promise.all([
      supabase
        .from("routines")
        .select("id, name, kind, description, duration_min, level, moment")
        .eq("id", routineId)
        .maybeSingle(),
      supabase
        .from("routine_exercises")
        .select(
          `position, secs, reps, sets, rest_secs, exercises (${EXERCISE_COLUMNS})`,
        )
        .eq("routine_id", routineId)
        .order("position"),
      supabase
        .from("workout_logs")
        .select("sets, created_at")
        .eq("routine_id", routineId)
        .not("sets", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!routine) notFound();
  const r = routine as RoutineRow;

  // Reps van de vorige keer, per oefening (progressive overload)
  const lastRepsById = new Map<number, number[]>();
  for (const entry of (lastLog?.sets ?? []) as LoggedExercise[]) {
    const reps = (entry.sets ?? [])
      .map((s) => s.reps)
      .filter((n): n is number => typeof n === "number");
    if (reps.length > 0) lastRepsById.set(entry.exercise_id, reps);
  }

  const plan: PlanExercise[] = ((rows ?? []) as RoutineExerciseJoin[])
    .map((row) => {
      const ex = Array.isArray(row.exercises)
        ? row.exercises[0]
        : row.exercises;
      if (!ex) return null;
      return {
        position: row.position,
        exerciseId: ex.id,
        name: ex.name,
        muscleGroup: ex.muscle_group,
        targetSets: row.sets ?? ex.sets ?? 3,
        targetReps: row.reps ?? ex.reps,
        holdSecs: row.secs ?? ex.default_secs,
        tempoText: explainTempo(ex.tempo),
        cue: ex.cue,
        commonMistake: ex.common_mistake,
        restSecs: row.rest_secs ?? ex.rest_secs ?? 60,
        lastReps: lastRepsById.get(ex.id) ?? null,
      } satisfies PlanExercise;
    })
    .filter((p): p is PlanExercise => p !== null);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">{r.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {r.description ??
            "Vink elke set af; tussen de sets loopt een rust-timer."}
        </p>
      </div>
      <WorkoutLogger routineId={r.id} routineName={r.name} plan={plan} />
    </div>
  );
}
