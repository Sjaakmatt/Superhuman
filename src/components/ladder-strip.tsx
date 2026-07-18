import type { LadderStrip as Strip } from "@/lib/training/data";

const EFFORT = "var(--effort)";
const ALIVE = "var(--alive)";

/**
 * Visualiseert een ladder: treden van makkelijk (onder) naar moeilijk (boven),
 * met de trede waar je nu staat opgelicht. Optioneel een doel-trede die
 * oplicht bij een promotie (de ceremonie).
 */
export function LadderStrip({
  strip,
  targetRung,
  targetLabel = "nieuw",
  compact = false,
}: {
  strip: Strip;
  targetRung?: number;
  targetLabel?: string;
  compact?: boolean;
}) {
  // Van moeilijk naar makkelijk tonen: de top is het doel
  const rungs = [...strip.rungs].sort((a, b) => b.rung - a.rung);

  return (
    <div className="flex flex-col gap-1" aria-label={`Ladder ${strip.label}`}>
      {!compact ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {strip.label}
        </p>
      ) : null}
      <ol className="flex flex-col gap-1">
        {rungs.map((r) => {
          const current = r.rung === strip.currentRung;
          const target = targetRung != null && r.rung === targetRung;
          const reached = r.rung <= strip.currentRung || target;
          return (
            <li
              key={r.rung}
              className="flex items-center gap-2.5"
              aria-current={current ? "step" : undefined}
            >
              <span
                aria-hidden
                className="grid size-5 shrink-0 place-items-center rounded-full font-mono text-[10px] transition-colors"
                style={
                  target
                    ? { background: ALIVE, color: "var(--bg)", boxShadow: `0 0 14px ${ALIVE}` }
                    : current
                      ? { background: EFFORT, color: "var(--bg)" }
                      : {
                          background: reached
                            ? "color-mix(in srgb, var(--effort) 22%, transparent)"
                            : "var(--surface-1)",
                          color: "var(--text-mute)",
                        }
                }
              >
                {r.rung}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-xs ${
                  current || target ? "font-medium text-text" : "text-muted"
                }`}
              >
                {r.name}
                {current ? " · nu" : target ? ` · ${targetLabel}` : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
