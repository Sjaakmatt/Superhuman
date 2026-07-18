import { describe, expect, it } from "vitest";
import {
  formatPace,
  paceMinPerKm,
  runSummary,
  weekStartOf,
  weeklyVolume,
  type RunLog,
} from "./running";

function run(over: Partial<RunLog>): RunLog {
  return {
    id: over.id ?? "r",
    kind: "rustig",
    distanceKm: 5,
    durationMin: 25,
    rpe: 4,
    note: null,
    ranOn: "2026-07-15",
    ...over,
  };
}

describe("running", () => {
  it("berekent en formatteert tempo (min/km)", () => {
    expect(paceMinPerKm(5, 25)).toBe(5);
    expect(paceMinPerKm(0, 25)).toBeNull();
    expect(paceMinPerKm(5, null)).toBeNull();
    expect(formatPace(5.5)).toBe("5:30");
    expect(formatPace(null)).toBe("—");
  });

  it("pakt de ISO-maandag van een datum", () => {
    // 2026-07-15 is een woensdag → maandag is 2026-07-13
    expect(weekStartOf("2026-07-15")).toBe("2026-07-13");
    expect(weekStartOf("2026-07-13")).toBe("2026-07-13");
    // zondag 2026-07-19 → dezelfde week (maandag 13)
    expect(weekStartOf("2026-07-19")).toBe("2026-07-13");
  });

  it("telt weekvolume op, opgevuld tot het aantal weken", () => {
    const runs = [
      run({ id: "a", ranOn: "2026-07-15", distanceKm: 5 }),
      run({ id: "b", ranOn: "2026-07-17", distanceKm: 8 }),
      run({ id: "c", ranOn: "2026-07-08", distanceKm: 10 }),
    ];
    const vol = weeklyVolume(runs, 3, "2026-07-18");
    expect(vol).toHaveLength(3);
    expect(vol[vol.length - 1]).toEqual({
      weekStart: "2026-07-13",
      km: 13,
      runs: 2,
    });
    expect(vol[vol.length - 2].km).toBe(10);
  });

  it("vat deze week samen + gemiddeld tempo over recente runs", () => {
    const runs = [
      run({ id: "a", ranOn: "2026-07-17", distanceKm: 5, durationMin: 25 }),
      run({ id: "b", ranOn: "2026-07-15", distanceKm: 10, durationMin: 60 }),
      run({ id: "c", ranOn: "2026-07-06", distanceKm: 4, durationMin: 20 }),
    ];
    const s = runSummary(runs, "2026-07-18");
    expect(s.thisWeekKm).toBe(15);
    expect(s.thisWeekRuns).toBe(2);
    // gemiddelde van 5, 6, 5 = 5.333…
    expect(s.avgPace).toBeCloseTo((5 + 6 + 5) / 3, 5);
  });
});
