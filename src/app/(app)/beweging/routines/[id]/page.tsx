import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RoutineExerciseRow, RoutineRow } from "@/lib/types";
import { WorkoutLogger } from "@/components/workout-logger";

export const metadata = { title: "Workout" };

export default async function RoutinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const routineId = Number(id);
  if (!Number.isInteger(routineId)) notFound();

  const supabase = await createClient();
  const [{ data: routine }, { data: exercises }] = await Promise.all([
    supabase
      .from("routines")
      .select("id, name, kind")
      .eq("id", routineId)
      .maybeSingle(),
    supabase
      .from("routine_exercises")
      .select("position, secs, reps, sets, exercises (id, name, kind, default_secs, reps, cue, muscle_group, video_url)")
      .eq("routine_id", routineId)
      .order("position"),
  ]);
  if (!routine) notFound();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">{routine.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Vink af wat je doet en rond af voor XP.
        </p>
      </div>
      <WorkoutLogger
        routine={routine as RoutineRow}
        exercises={(exercises ?? []) as unknown as RoutineExerciseRow[]}
      />
    </div>
  );
}
