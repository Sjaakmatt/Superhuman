/**
 * Hardloop-berekeningen (T4), puur en testbaar. Tempo (min/km) is de kern:
 * lager is sneller. Weekvolume laat opbouw over tijd zien.
 */

export type RunKind = "rustig" | "tempo" | "duurloop" | "interval";

export interface RunLog {
  id: string;
  kind: string;
  distanceKm: number | null;
  durationMin: number | null;
  rpe: number | null;
  note: string | null;
  ranOn: string; // YYYY-MM-DD
}

export const RUN_KINDS: { value: RunKind; label: string }[] = [
  { value: "rustig", label: "Rustig" },
  { value: "tempo", label: "Tempo" },
  { value: "duurloop", label: "Duurloop" },
  { value: "interval", label: "Interval" },
];

/** Tempo in minuten per kilometer, of null als het niet te bepalen is. */
export function paceMinPerKm(
  distanceKm: number | null,
  durationMin: number | null,
): number | null {
  if (!distanceKm || !durationMin || distanceKm <= 0) return null;
  return durationMin / distanceKm;
}

/** Tempo als 'm:ss /km' (bv. 5:30). */
export function formatPace(pace: number | null): string {
  if (pace == null || !isFinite(pace)) return "—";
  const total = Math.round(pace * 60);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** ISO-maandag (YYYY-MM-DD) van een datum-string. */
export function weekStartOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=zo..6=za
  const shift = dow === 0 ? 6 : dow - 1; // terug naar maandag
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

export interface WeekVolume {
  weekStart: string;
  km: number;
  runs: number;
}

/**
 * Kilometers en aantal runs per ISO-week, oplopend in tijd. `weeks` bepaalt
 * hoeveel recente weken teruggegeven worden (opgevuld met nullen).
 */
export function weeklyVolume(runs: RunLog[], weeks: number, today: string): WeekVolume[] {
  const byWeek = new Map<string, { km: number; runs: number }>();
  for (const r of runs) {
    const w = weekStartOf(r.ranOn);
    const cur = byWeek.get(w) ?? { km: 0, runs: 0 };
    cur.km += r.distanceKm ?? 0;
    cur.runs += 1;
    byWeek.set(w, cur);
  }

  const out: WeekVolume[] = [];
  const start = new Date(`${weekStartOf(today)}T00:00:00Z`);
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const key = d.toISOString().slice(0, 10);
    const v = byWeek.get(key);
    out.push({
      weekStart: key,
      km: v ? Math.round(v.km * 10) / 10 : 0,
      runs: v?.runs ?? 0,
    });
  }
  return out;
}

export interface RunSummary {
  thisWeekKm: number;
  thisWeekRuns: number;
  avgPace: number | null; // over de laatste `n` runs met tempo
}

/** Samenvatting: deze week + gemiddeld tempo over de laatste runs. */
export function runSummary(
  runs: RunLog[],
  today: string,
  paceSample = 5,
): RunSummary {
  const thisWeek = weekStartOf(today);
  let km = 0;
  let count = 0;
  for (const r of runs) {
    if (weekStartOf(r.ranOn) === thisWeek) {
      km += r.distanceKm ?? 0;
      count += 1;
    }
  }

  // Laatste runs met een bepaalbaar tempo (runs komen aflopend binnen)
  const paces: number[] = [];
  for (const r of runs) {
    const p = paceMinPerKm(r.distanceKm, r.durationMin);
    if (p != null) paces.push(p);
    if (paces.length >= paceSample) break;
  }
  const avgPace =
    paces.length > 0 ? paces.reduce((a, b) => a + b, 0) / paces.length : null;

  return {
    thisWeekKm: Math.round(km * 10) / 10,
    thisWeekRuns: count,
    avgPace,
  };
}
