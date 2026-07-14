import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { RoutineRow } from "@/lib/types";

export const metadata = { title: "Stretchen" };

const MOMENT_LABEL: Record<string, string> = {
  ochtend: "ochtend",
  desk: "tussendoor",
  avond: "avond",
  any: "altijd",
};

export default async function StretchPickerPage() {
  const supabase = await createClient();
  const { data: routines } = await supabase
    .from("routines")
    .select("id, name, kind, description, duration_min, level, moment")
    .eq("kind", "stretch")
    .is("user_id", null)
    .order("duration_min");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Stretchen & mobiliteit</h1>
        <p className="mt-1 text-sm text-muted">
          Kies een programma. De sessie stuurt je door elke oefening — houd
          vast, adem mee, wissel van kant.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {((routines ?? []) as RoutineRow[]).map((r) => (
          <li key={r.id}>
            <Link
              href={`/beweging/stretch/${r.id}`}
              className="flex flex-col gap-1.5 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    background: "var(--attr-soepel)",
                    boxShadow: "0 0 10px var(--attr-soepel)",
                  }}
                />
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {r.name}
                </span>
                <span className="font-mono text-xs text-muted">
                  {r.duration_min ? `${r.duration_min} min` : ""}
                  {r.moment && MOMENT_LABEL[r.moment]
                    ? ` · ${MOMENT_LABEL[r.moment]}`
                    : ""}
                </span>
              </div>
              {r.description ? (
                <p className="text-xs text-muted">{r.description}</p>
              ) : null}
            </Link>
          </li>
        ))}
        {(routines ?? []).length === 0 ? (
          <li className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Geen stretch-programma&apos;s gevonden. Is het content-pack
            toegepast?
          </li>
        ) : null}
      </ul>
    </div>
  );
}
