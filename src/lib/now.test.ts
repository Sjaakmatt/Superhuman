import { describe, expect, it } from "vitest";
import { pickNowBlock } from "./now";
import type { ScheduleBlockRow } from "./types";

function block(over: Partial<ScheduleBlockRow>): ScheduleBlockRow {
  return {
    id: over.id ?? 1,
    label: over.label ?? "Blok",
    kind: over.kind ?? "focus",
    ref_id: null,
    start_min: over.start_min ?? 0,
    window_min: over.window_min ?? 60,
    days: over.days ?? ["MO", "TU", "WE", "TH", "FR", "SA", "SU"],
    enabled: over.enabled ?? true,
  };
}

const DINER = block({
  id: 1,
  label: "Diner",
  kind: "meal",
  start_min: 1140, // 19:00
  window_min: 120, // tot 21:00
});
const UNWIND = block({
  id: 2,
  label: "Avond-unwind",
  kind: "stretch",
  start_min: 1230, // 20:30
  window_min: 90,
});
const BREATH = block({
  id: 3,
  label: "Breathwork",
  kind: "breath",
  start_min: 1290, // 21:30
  window_min: 60,
});

describe("pickNowBlock", () => {
  it("laat een afvinkbare actie voorgaan op een altijd-open maaltijdvenster", () => {
    // 20:34: diner én unwind zijn 'open'; de unwind moet winnen.
    const { active, next } = pickNowBlock(
      [DINER, UNWIND, BREATH],
      1234,
      "SA",
      new Set(),
    );
    expect(active?.id).toBe(UNWIND.id);
    expect(next?.id).toBe(BREATH.id);
  });

  it("valt terug op de maaltijd als de actie al gedaan is", () => {
    const { active } = pickNowBlock(
      [DINER, UNWIND],
      1234,
      "SA",
      new Set(["stretch"]),
    );
    expect(active?.id).toBe(DINER.id);
  });

  it("kiest binnen dezelfde soort het meest recent gestarte blok", () => {
    const ochtend = block({ id: 10, kind: "stretch", start_min: 450, window_min: 200 });
    const bureau = block({ id: 11, kind: "stretch", start_min: 560, window_min: 200 });
    // 09:40 (580): beide open → het laatst gestarte (bureau) wint
    const { active } = pickNowBlock([ochtend, bureau], 580, "MO", new Set());
    expect(active?.id).toBe(bureau.id);
  });

  it("geeft geen actief blok als niets in het venster valt", () => {
    const { active, next } = pickNowBlock([UNWIND], 600, "MO", new Set());
    expect(active).toBeNull();
    expect(next?.id).toBe(UNWIND.id);
  });
});
