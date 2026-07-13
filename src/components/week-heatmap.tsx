import { isoWeekday, shiftDate } from "@/lib/streaks";

const WEEKDAY_LABELS = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const WEEKS = 4;

interface WeekHeatmapProps {
  /** Per datum (YYYY-MM-DD): aantal attributen met ≥ 1 xp_event */
  activity: Map<string, number>;
  today: string;
}

/** Ritme van de laatste vier weken: intensiteit = hoeveel attributen actief waren. */
export function WeekHeatmap({ activity, today }: WeekHeatmapProps) {
  // Grid start op de maandag van (WEEKS - 1) weken geleden
  const monday = shiftDate(today, -(isoWeekday(today) - 1) - (WEEKS - 1) * 7);
  const rows = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => shiftDate(monday, w * 7 + d)),
  );

  return (
    <section
      aria-label="Ritme van de laatste vier weken"
      className="rounded-2xl border border-line bg-card p-4"
    >
      <h2 className="text-sm font-medium text-muted">Ritme</h2>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <span
            key={label}
            className="text-center font-mono text-[10px] text-muted"
            aria-hidden
          >
            {label}
          </span>
        ))}
        {rows.flat().map((date) => {
          const future = date > today;
          const count = activity.get(date) ?? 0;
          const pct = Math.round((count / 6) * 85);
          return (
            <span
              key={date}
              title={future ? undefined : `${date}: ${count}/6 attributen`}
              className="aspect-square rounded-md"
              style={{
                background: future
                  ? "transparent"
                  : count === 0
                    ? "var(--ink-2)"
                    : `color-mix(in srgb, var(--attr-soepel) ${pct}%, var(--ink-2))`,
                outline: date === today ? "1px solid var(--muted)" : undefined,
                outlineOffset: 1,
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
