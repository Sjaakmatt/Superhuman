import { createClient } from "@/lib/supabase/server";
import type { ExerciseRow } from "@/lib/types";
import { StretchPlayer } from "@/components/stretch-player";

export const metadata = { title: "Stretchen" };

export default async function StretchPage() {
  const supabase = await createClient();
  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, name, kind, default_secs, reps, cue, muscle_group, video_url")
    .eq("kind", "stretch")
    .order("id");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Stretch-sessie</h1>
        <p className="mt-1 text-sm text-muted">
          Volg de timer per oefening; hij loopt vanzelf door.
        </p>
      </div>
      <StretchPlayer exercises={(exercises ?? []) as ExerciseRow[]} />
    </div>
  );
}
