import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EXERCISE_COLUMNS, type ExerciseRow } from "@/lib/types";
import { explainTempo } from "@/lib/session";

export const metadata = { title: "Oefening" };

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        {label}
      </p>
      <p className="text-sm leading-relaxed">{value}</p>
    </div>
  );
}

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
    .select(EXERCISE_COLUMNS)
    .eq("id", exerciseId)
    .maybeSingle();
  if (!exercise) notFound();
  const ex = exercise as ExerciseRow;
  const tempo = explainTempo(ex.tempo);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{ex.name}</h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted">
          {ex.kind} · {ex.muscle_group} · {ex.level}
          {ex.reps ? ` · ${ex.sets ?? 3}×${ex.reps}` : ""}
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

      {ex.benefit ? (
        <p className="text-sm text-muted">{ex.benefit}</p>
      ) : null}

      <Detail label="Klaarzetten" value={ex.setup} />
      <Detail label="Uitvoering" value={ex.cue} />
      <Detail label="Ademhaling" value={ex.breathing} />
      {tempo ? <Detail label="Tempo" value={tempo} /> : null}
      <Detail label="Veelgemaakte fout" value={ex.common_mistake} />
      <Detail label="Zwaarder maken" value={ex.progression} />
      <Detail label="Makkelijker maken" value={ex.regression} />

      <Link
        href="/beweging/bibliotheek"
        className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-text"
      >
        ← Terug naar de bibliotheek
      </Link>
    </div>
  );
}
