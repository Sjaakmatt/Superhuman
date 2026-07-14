import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ExerciseRow } from "@/lib/types";

export const metadata = { title: "Oefening" };

export default async function OefeningPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exerciseId = Number(id);
  if (!Number.isInteger(exerciseId)) notFound();

  const supabase = await createClient();
  const { data: exercise } = await supabase
    .from("exercises")
    .select("id, name, kind, default_secs, reps, cue, muscle_group, video_url")
    .eq("id", exerciseId)
    .maybeSingle();
  if (!exercise) notFound();
  const ex = exercise as ExerciseRow;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">{ex.name}</h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted">
          {ex.kind} · {ex.muscle_group}
          {ex.reps ? ` · ${ex.reps} reps` : ""}
          {ex.default_secs ? ` · ${ex.default_secs}s` : ""}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        {ex.video_url ? (
          <video
            src={ex.video_url}
            controls
            playsInline
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-ink-2 px-8 text-center">
            <p className="text-sm text-muted">
              Video volgt zodra die in Storage staat.
            </p>
          </div>
        )}
      </div>

      {ex.cue ? (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm">
          {ex.cue}
        </p>
      ) : null}

      <Link
        href="/beweging/bibliotheek"
        className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-text"
      >
        ← Terug naar de bibliotheek
      </Link>
    </div>
  );
}
