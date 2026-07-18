import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/xp";
import type { RoutineRow } from "@/lib/types";

export const metadata = { title: "Mobiliteit" };

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

export default async function MobiliteitPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .single();
  const today = todayInTz(profile?.timezone ?? "Europe/Amsterdam");

  const [{ data: routines }, { data: doneToday }] = await Promise.all([
    supabase
      .from("routines")
      .select("id, name, kind, description, duration_min, level, moment")
      .eq("kind", "stretch")
      .order("duration_min"),
    supabase
      .from("workout_logs")
      .select("id, routines!inner(kind)")
      .eq("date", today)
      .eq("routines.kind", "stretch")
      .limit(1),
  ]);

  const progs = (routines ?? []) as RoutineRow[];
  const done = (doneToday ?? []).length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/beweging"
          className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-text"
        >
          ‹ Beweging
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Mobiliteit</h1>
        <p className="mt-1 text-sm text-muted">
          Begeleide stretch- en mobiliteitsflows met timer en ademindicator —
          houd los wat vastzit.
        </p>
      </div>

      {/* Dagelijkse flow: vandaag-status */}
      <div
        className="flex items-center gap-3 rounded-2xl border px-4 py-3"
        style={
          done
            ? {
                borderColor: "var(--attr-soepel)",
                background: "color-mix(in srgb, var(--attr-soepel) 8%, var(--card))",
              }
            : { borderColor: "var(--line)", background: "var(--card)" }
        }
      >
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full text-sm"
          style={{
            background: done
              ? "var(--attr-soepel)"
              : "color-mix(in srgb, var(--attr-soepel) 16%, transparent)",
            color: done ? "var(--ink)" : "var(--attr-soepel)",
          }}
        >
          {done ? "✓" : "~"}
        </span>
        <p className="text-sm">
          {done
            ? "Vandaag al bewogen — je lichaam dankt je."
            : "Nog niet los vandaag. Eén korte flow is genoeg."}
        </p>
      </div>

      {progs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
          Nog geen mobiliteitsflows. Is het content-pack toegepast?
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {progs.map((r) => (
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
      )}
    </div>
  );
}
