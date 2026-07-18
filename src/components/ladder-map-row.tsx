import Link from "next/link";
import type { LadderMapEntry } from "@/lib/training/data";

/**
 * Compacte ladder-map-regel: in één oogopslag zie je waar je op deze ladder
 * staat (horizontale sporten) en wat de volgende trede is.
 */
export function LadderMapRow({
  entry,
  color,
}: {
  entry: LadderMapEntry;
  color: string;
}) {
  const total = entry.rungs.length;
  const href = entry.current
    ? `/beweging/bibliotheek/${entry.current.slug}`
    : "/beweging/bibliotheek";

  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{entry.pattern.label}</span>
        <span className="shrink-0 font-mono text-[11px] text-muted">
          trede {entry.currentRung}/{total}
        </span>
      </div>

      {/* Sporten van makkelijk (links) naar moeilijk (rechts) */}
      <div className="flex items-center gap-1" aria-hidden>
        {entry.rungs.map((r) => {
          const reached = r.rung <= entry.currentRung;
          const current = r.rung === entry.currentRung;
          return (
            <span
              key={r.rung}
              className="h-1.5 flex-1 rounded-full transition-colors"
              style={{
                background: reached
                  ? color
                  : "color-mix(in srgb, var(--muted) 22%, transparent)",
                boxShadow: current ? `0 0 8px ${color}` : undefined,
                opacity: reached && !current ? 0.55 : 1,
              }}
            />
          );
        })}
      </div>

      <p className="text-xs text-muted">
        <span className="text-text">{entry.current?.name ?? "—"}</span>
        {entry.next
          ? ` · volgende: ${entry.next.name}`
          : " · hoogste trede bereikt"}
      </p>
    </Link>
  );
}
