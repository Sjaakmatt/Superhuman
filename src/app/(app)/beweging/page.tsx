import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { RoutineRow } from "@/lib/types";

export const metadata = { title: "Beweging" };

const MOMENT_LABEL: Record<string, string> = {
  ochtend: "ochtend",
  desk: "tussendoor",
  avond: "avond",
  training: "training",
  any: "altijd",
};

function metaLine(r: RoutineRow): string {
  return [
    r.duration_min ? `${r.duration_min} min` : null,
    r.moment && MOMENT_LABEL[r.moment] ? MOMENT_LABEL[r.moment] : null,
    r.level,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default async function BewegingPage() {
  const supabase = await createClient();
  const [{ data: routines }, { count: exerciseCount }] = await Promise.all([
    supabase
      .from("routines")
      .select("id, name, kind, description, duration_min, level, moment")
      .order("kind")
      .order("duration_min"),
    supabase.from("exercises").select("id", { count: "exact", head: true }),
  ]);

  const all = (routines ?? []) as RoutineRow[];
  const stretchProgs = all.filter((r) => r.kind === "stretch");
  const workoutProgs = all.filter((r) => r.kind === "workout");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Beweging</h1>
        <p className="mt-1 text-sm text-muted">
          Begeleide sessies die je sturen — hoe lang, wanneer wisselen, wanneer
          rusten.
        </p>
      </div>

      {/* Stretchen & mobiliteit */}
      <section aria-label="Stretchen" className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">Stretchen & mobiliteit</h2>
        <ul className="flex flex-col gap-2">
          {stretchProgs.map((r) => (
            <li key={r.id}>
              <Link
                href={`/beweging/stretch/${r.id}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted"
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    background: "var(--attr-soepel)",
                    boxShadow: "0 0 10px var(--attr-soepel)",
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{r.name}</span>
                  <span className="block font-mono text-xs text-muted">
                    {metaLine(r)}
                  </span>
                </span>
                <span className="font-mono text-xs text-muted">+40 XP</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Krachttraining */}
      <section aria-label="Krachttraining" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-muted">Krachttraining</h2>
          <Link
            href="/beweging/routines/nieuw"
            className="text-xs text-muted underline underline-offset-4 transition-colors hover:text-text"
          >
            + eigen routine
          </Link>
        </div>
        <ul className="flex flex-col gap-2">
          {workoutProgs.map((r) => (
            <li key={r.id}>
              <Link
                href={`/beweging/routines/${r.id}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted"
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    background: "var(--attr-kracht)",
                    boxShadow: "0 0 10px var(--attr-kracht)",
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{r.name}</span>
                  <span className="block font-mono text-xs text-muted">
                    {metaLine(r)}
                  </span>
                </span>
                <span className="font-mono text-xs text-muted">+45 XP</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Link
        href="/beweging/bibliotheek"
        className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Bibliotheek</span>
          <span className="block text-xs text-muted">
            {exerciseCount ?? 0} oefeningen met uitleg, cues en fouten
          </span>
        </span>
        <span aria-hidden className="text-muted">
          ›
        </span>
      </Link>
    </div>
  );
}
