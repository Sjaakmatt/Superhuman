import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ExerciseRow } from "@/lib/types";

export const metadata = { title: "Bibliotheek" };

const KINDS = [
  { value: "stretch", label: "stretch" },
  { value: "strength", label: "kracht" },
  { value: "mobility", label: "mobiliteit" },
  { value: "cardio", label: "cardio" },
] as const;

function metaFor(ex: ExerciseRow): string {
  const parts = [ex.muscle_group ?? ""];
  if (ex.reps) parts.push(`${ex.reps} reps`);
  else if (ex.default_secs) parts.push(`${ex.default_secs}s`);
  return parts.filter(Boolean).join(" · ");
}

export default async function BibliotheekPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  const { q, kind } = await searchParams;
  const activeKind = KINDS.find((k) => k.value === kind)?.value ?? null;

  const supabase = await createClient();
  let query = supabase
    .from("exercises")
    .select("id, name, kind, default_secs, reps, cue, muscle_group, video_url")
    .order("name");
  if (activeKind) query = query.eq("kind", activeKind);
  if (q?.trim())
    query = query.or(`name.ilike.%${q.trim()}%,muscle_group.ilike.%${q.trim()}%`);
  const { data: exercises } = await query;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Bibliotheek</h1>
        <p className="mt-1 text-sm text-muted">
          Alle oefeningen, filterbaar op type en spiergroep.
        </p>
      </div>

      <form method="GET" action="/beweging/bibliotheek" className="flex gap-2">
        {activeKind ? <input type="hidden" name="kind" value={activeKind} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Zoek op naam of spiergroep…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-sm text-text placeholder:text-muted/60"
        />
        <button
          type="submit"
          className="rounded-lg border border-line px-4 text-sm text-muted transition-colors hover:text-text"
        >
          Zoek
        </button>
      </form>

      <nav aria-label="Type" className="flex flex-wrap gap-2">
        <Link
          href={`/beweging/bibliotheek${q ? `?q=${encodeURIComponent(q)}` : ""}`}
          aria-current={activeKind === null ? "page" : undefined}
          className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
            activeKind === null
              ? "border-kracht bg-kracht/10 text-text"
              : "border-line text-muted hover:text-text"
          }`}
        >
          alles
        </Link>
        {KINDS.map((k) => (
          <Link
            key={k.value}
            href={`/beweging/bibliotheek?kind=${k.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            aria-current={activeKind === k.value ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              activeKind === k.value
                ? "border-kracht bg-kracht/10 text-text"
                : "border-line text-muted hover:text-text"
            }`}
          >
            {k.label}
          </Link>
        ))}
      </nav>

      <ul className="flex flex-col gap-2">
        {((exercises ?? []) as ExerciseRow[]).map((ex) => (
          <li key={ex.id}>
            <Link
              href={`/beweging/bibliotheek/${ex.id}`}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{ex.name}</span>
                <span className="block text-xs text-muted">{metaFor(ex)}</span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                {ex.kind}
              </span>
            </Link>
          </li>
        ))}
        {(exercises ?? []).length === 0 ? (
          <li className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Geen oefeningen gevonden.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
