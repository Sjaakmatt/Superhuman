/** Trend-reeksen voor input-vs-output in Progressie. */

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  /** input: XP per dag, 7d rolling average */
  input: number | null;
  /** output: stemming (1-10), 7d rolling average over gelogde dagen */
  output: number | null;
}

/**
 * Rolling average over de laatste `window` waarden t/m index i.
 * null-waarden tellen niet mee; is er niets in het venster → null.
 */
export function rollingAvg(
  values: (number | null)[],
  window = 7,
): (number | null)[] {
  return values.map((_, i) => {
    const slice = values
      .slice(Math.max(0, i - window + 1), i + 1)
      .filter((v): v is number => v != null);
    if (slice.length === 0) return null;
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    return Math.round(avg * 10) / 10;
  });
}
