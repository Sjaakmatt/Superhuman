import { createClient } from "@/lib/supabase/server";
import type { ExerciseRow } from "@/lib/types";
import { RoutineBuilder } from "@/components/routine-builder";

export const metadata = { title: "Nieuwe routine" };

export default async function NieuweRoutinePage() {
  const supabase = await createClient();
  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, name, kind, default_secs, reps, cue, muscle_group, video_url")
    .in("kind", ["strength", "mobility", "cardio"])
    .order("name");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Nieuwe routine</h1>
        <p className="mt-1 text-sm text-muted">
          Stel je krachttraining samen uit de bibliotheek.
        </p>
      </div>
      <RoutineBuilder exercises={(exercises ?? []) as ExerciseRow[]} />
    </div>
  );
}
