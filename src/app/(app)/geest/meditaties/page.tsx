import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { MeditationRow } from "@/lib/types";

export const metadata = { title: "Meditaties" };

const CATEGORIES = ["focus", "slaap", "kalmte", "reset"] as const;

function formatDuration(secs: number | null): string {
  return secs ? `${Math.round(secs / 60)} min` : "";
}

export default async function MeditatiesPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat } = await searchParams;
  const activeCat = CATEGORIES.find((c) => c === cat) ?? null;

  const supabase = await createClient();
  let query = supabase
    .from("meditations")
    .select("id, title, category, media_type, media_url, duration_secs, description")
    .order("duration_secs");
  if (activeCat) query = query.eq("category", activeCat);
  const { data: meditations } = await query;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Meditaties</h1>
        <p className="mt-1 text-sm text-muted">
          Kies een sessie; afronden voedt Geest.
        </p>
      </div>

      <nav aria-label="Categorieën" className="flex flex-wrap gap-2">
        <Link
          href="/geest/meditaties"
          aria-current={activeCat === null ? "page" : undefined}
          className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
            activeCat === null
              ? "border-geest bg-geest/10 text-text"
              : "border-line text-muted hover:text-text"
          }`}
        >
          alles
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/geest/meditaties?cat=${c}`}
            aria-current={activeCat === c ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              activeCat === c
                ? "border-geest bg-geest/10 text-text"
                : "border-line text-muted hover:text-text"
            }`}
          >
            {c}
          </Link>
        ))}
      </nav>

      <ul className="flex flex-col gap-2">
        {((meditations ?? []) as MeditationRow[]).map((m) => (
          <li key={m.id}>
            <Link
              href={`/geest/meditaties/${m.id}`}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted"
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  background: "var(--attr-geest)",
                  boxShadow: "0 0 10px var(--attr-geest)",
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{m.title}</span>
                <span className="block text-xs text-muted">
                  {m.category} · {formatDuration(m.duration_secs)}
                </span>
              </span>
              <span className="font-mono text-xs text-muted">+30 XP</span>
            </Link>
          </li>
        ))}
        {(meditations ?? []).length === 0 ? (
          <li className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Geen meditaties in deze categorie.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
