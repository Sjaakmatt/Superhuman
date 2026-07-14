import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { RoutineRow } from "@/lib/types";

export const metadata = { title: "Beweging" };

export default async function BewegingPage() {
  const supabase = await createClient();
  const [{ data: stretches }, { data: routines }, { count: exerciseCount }] =
    await Promise.all([
      supabase.from("exercises").select("id, default_secs").eq("kind", "stretch"),
      supabase.from("routines").select("id, name, kind").order("id"),
      supabase.from("exercises").select("id", { count: "exact", head: true }),
    ]);

  const stretchCount = stretches?.length ?? 0;
  const stretchSecs = (stretches ?? []).reduce(
    (sum, e: { default_secs: number | null }) => sum + (e.default_secs ?? 30),
    0,
  );
  const workoutRoutines = ((routines ?? []) as RoutineRow[]).filter(
    (r) => r.kind === "workout",
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Beweging</h1>
        <p className="mt-1 text-sm text-muted">
          Stretchen, kracht en de oefeningen-bibliotheek.
        </p>
      </div>

      <Link
        href="/beweging/stretch"
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
          <span className="block text-sm font-medium">Stretch-sessie</span>
          <span className="block text-xs text-muted">
            {stretchCount} oefeningen · ±{Math.round(stretchSecs / 60)} min
          </span>
        </span>
        <span className="font-mono text-xs text-muted">+40 XP</span>
      </Link>

      <section aria-label="Krachttraining" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-muted">Krachttraining</h2>
          <Link
            href="/beweging/routines/nieuw"
            className="text-xs text-muted underline underline-offset-4 transition-colors hover:text-text"
          >
            + nieuwe routine
          </Link>
        </div>
        {workoutRoutines.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {workoutRoutines.map((routine) => (
              <li key={routine.id}>
                <Link
                  href={`/beweging/routines/${routine.id}`}
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
                  <span className="min-w-0 flex-1 text-sm font-medium">
                    {routine.name}
                  </span>
                  <span className="font-mono text-xs text-muted">+45 XP</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Link
            href="/beweging/routines/nieuw"
            className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted transition-colors hover:text-text"
          >
            Nog geen routines — stel je eerste workout samen.
          </Link>
        )}
      </section>

      <Link
        href="/beweging/bibliotheek"
        className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Bibliotheek</span>
          <span className="block text-xs text-muted">
            {exerciseCount ?? 0} oefeningen · zoeken en filteren
          </span>
        </span>
        <span aria-hidden className="text-muted">
          ›
        </span>
      </Link>
    </div>
  );
}
