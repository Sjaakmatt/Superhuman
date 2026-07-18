import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
  const { data: routines } = await supabase
    .from("routines")
    .select("id, name, kind, description, duration_min, level, moment")
    .eq("kind", "stretch")
    .order("duration_min");

  const progs = (routines ?? []) as RoutineRow[];

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
