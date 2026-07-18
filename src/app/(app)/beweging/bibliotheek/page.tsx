import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadLadderMap, type LadderMapEntry } from "@/lib/training/data";

export const metadata = { title: "Bibliotheek" };

const CATEGORIES: { key: string; label: string; color: string }[] = [
  { key: "kracht", label: "Kracht", color: "var(--attr-kracht)" },
  { key: "elasticiteit", label: "Elasticiteit", color: "var(--attr-vitaliteit)" },
  { key: "mobiliteit", label: "Mobiliteit", color: "var(--attr-soepel)" },
];

export default async function BibliotheekPage() {
  const supabase = await createClient();
  const ladderMap = await loadLadderMap(supabase);

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-xl font-semibold">Bibliotheek</h1>
        <p className="mt-1 text-sm text-muted">
          Elke beweging is een ladder van makkelijk naar moeilijk. Tik een trede
          voor de volledige coaching — en zie waar jij staat.
        </p>
      </div>

      {CATEGORIES.map((cat) => {
        const entries = ladderMap.filter((e) => e.pattern.category === cat.key);
        if (entries.length === 0) return null;
        return (
          <section
            key={cat.key}
            aria-label={cat.label}
            className="flex flex-col gap-3"
          >
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: cat.color }}
              />
              {cat.label}
            </h2>
            {entries.map((entry) => (
              <LadderCard key={entry.pattern.key} entry={entry} color={cat.color} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function LadderCard({
  entry,
  color,
}: {
  entry: LadderMapEntry;
  color: string;
}) {
  // Van makkelijk (onder) naar moeilijk (boven): moeilijkste eerst tonen
  const rungs = [...entry.rungs].sort((a, b) => b.rung - a.rung);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
        <span className="text-sm font-medium">{entry.pattern.label}</span>
        <span className="shrink-0 font-mono text-[11px] text-muted">
          jij: trede {entry.currentRung}/{entry.rungs.length}
        </span>
      </div>
      <ul>
        {rungs.map((r) => {
          const current = r.rung === entry.currentRung;
          const reached = r.rung <= entry.currentRung;
          return (
            <li key={r.slug}>
              <Link
                href={`/beweging/bibliotheek/${r.slug}`}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-ink-2"
                style={
                  current
                    ? { background: `color-mix(in srgb, ${color} 8%, transparent)` }
                    : undefined
                }
              >
                <span
                  aria-hidden
                  className="grid size-6 shrink-0 place-items-center rounded-full font-mono text-[11px]"
                  style={
                    current
                      ? { background: color, color: "var(--ink)" }
                      : {
                          background: reached
                            ? `color-mix(in srgb, ${color} 22%, transparent)`
                            : "var(--ink-2)",
                          color: "var(--muted)",
                        }
                  }
                >
                  {r.rung}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm ${current ? "font-medium" : ""}`}
                  >
                    {r.name}
                  </span>
                  {r.oneLiner ? (
                    <span className="block truncate text-xs text-muted">
                      {r.oneLiner}
                    </span>
                  ) : null}
                </span>
                {current ? (
                  <span
                    className="shrink-0 font-mono text-[10px] uppercase tracking-widest"
                    style={{ color }}
                  >
                    nu
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
