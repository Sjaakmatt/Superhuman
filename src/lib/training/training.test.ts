import { describe, expect, it } from "vitest";
import {
  buildLadderIndex,
  clampRung,
  exerciseAtRung,
  nextRungExercise,
} from "./ladders";
import { generateSession, sessionKeyForWeek } from "./generateSession";
import {
  applyProgression,
  evaluateAdvance,
  suggestsRegression,
} from "./progression";
import { buildStrengthSteps, workOrdinal } from "./sessionMachine";
import type {
  LadderExercise,
  LadderState,
  LastLog,
  PatternKey,
  SessionTemplateSlot,
} from "./types";

/** Minimale fixture: een trek_vert-ladder van 3 treden. */
function ex(rung: number, over: Partial<LadderExercise> = {}): LadderExercise {
  return {
    id: `tv-${rung}`,
    patternId: "p-trek",
    patternKey: "trek_vert",
    rung,
    slug: `tv${rung}`,
    name: `Trek ${rung}`,
    oneLiner: null,
    setup: ["a", "b"],
    execution: ["a", "b"],
    breathing: "adem",
    mistakes: ["x", "y"],
    tempo: "2-0-1",
    repLow: 4,
    repHigh: 5,
    holdSec: null,
    restSec: 120,
    isUnilateral: false,
    advanceReps: 5,
    advanceSets: 3,
    advanceNote: "bij 3x5",
    regressionSlug: null,
    progressionSlug: null,
    equipment: "rekstok",
    muscles: ["rug"],
    ...over,
  };
}

const ladder = [ex(1), ex(2), ex(3)];
const index = buildLadderIndex(ladder);

function state(rung: number, streak = 0): Map<PatternKey, LadderState> {
  return new Map([
    ["trek_vert", { patternKey: "trek_vert", currentRung: rung, sessionsAtRung: 0, metStreak: streak }],
  ]);
}

describe("ladders", () => {
  it("pakt de juiste trede en clampt buiten de grenzen", () => {
    expect(exerciseAtRung(index, "trek_vert", 2)?.slug).toBe("tv2");
    expect(clampRung(index, "trek_vert", 9)).toBe(3);
    expect(clampRung(index, "trek_vert", 0)).toBe(1);
    expect(exerciseAtRung(index, "trek_vert", 9)?.slug).toBe("tv3");
  });

  it("kent de volgende trede en null aan de top", () => {
    expect(nextRungExercise(index, "trek_vert", 1)?.slug).toBe("tv2");
    expect(nextRungExercise(index, "trek_vert", 3)).toBeNull();
  });
});

describe("generateSession", () => {
  const slots: SessionTemplateSlot[] = [
    { sort: 1, slotType: "warmup", patternKey: null, sets: null, note: null },
    { sort: 2, slotType: "work", patternKey: "trek_vert", sets: 4, note: null },
    { sort: 3, slotType: "cooldown", patternKey: null, sets: null, note: null },
  ];

  it("plaatst de trede van de gebruiker met doel en vorige keer", () => {
    const lastLogs = new Map<string, LastLog>([
      ["tv-2", { ladderExerciseId: "tv-2", rung: 2, sets: [{ reps: 4 }, { reps: 4 }] }],
    ]);
    const plan = generateSession({
      templateKey: "kracht_a",
      templateLabel: "Kracht A",
      slots,
      index,
      ladderState: state(2),
      lastLogsByExercise: lastLogs,
    });
    expect(plan.items.map((i) => i.slotType)).toEqual([
      "warmup",
      "work",
      "cooldown",
    ]);
    const work = plan.items[1];
    expect(work.exercise?.slug).toBe("tv2");
    expect(work.target).toBe("4 × 4-5");
    expect(work.lastTime).toHaveLength(2);
  });

  it("target voor een isometrische trede is in seconden", () => {
    const holdIndex = buildLadderIndex([
      ex(1, { repLow: null, repHigh: null, holdSec: 30, advanceReps: 30 }),
    ]);
    const plan = generateSession({
      templateKey: "kracht_a",
      templateLabel: "Kracht A",
      slots: [{ sort: 1, slotType: "work", patternKey: "trek_vert", sets: 3, note: null }],
      index: holdIndex,
      ladderState: state(1),
      lastLogsByExercise: new Map(),
    });
    expect(plan.items[0].target).toBe("3 × 30s");
    expect(plan.items[0].isHold).toBe(true);
  });

  it("wisselt A/B per week", () => {
    expect(sessionKeyForWeek(0)).toBe("kracht_a");
    expect(sessionKeyForWeek(1)).toBe("kracht_b");
    expect(sessionKeyForWeek(2)).toBe("kracht_a");
  });
});

describe("progression", () => {
  it("evalueert het advance-criterium (3x5 schoon)", () => {
    const e = ex(2);
    expect(evaluateAdvance(e, [{ reps: 5 }, { reps: 5 }, { reps: 5 }])).toBe(true);
    expect(evaluateAdvance(e, [{ reps: 5 }, { reps: 4 }, { reps: 5 }])).toBe(false);
    expect(
      evaluateAdvance(e, [{ reps: 5, tempoOk: false }, { reps: 5 }, { reps: 5 }]),
    ).toBe(false);
  });

  it("promoveert pas bij twee sessies op rij", () => {
    const s0: LadderState = { patternKey: "trek_vert", currentRung: 1, sessionsAtRung: 1, metStreak: 0 };
    const r1 = applyProgression(index, "trek_vert", s0, true);
    expect(r1.promoted).toBe(false);
    expect(r1.newState.metStreak).toBe(1);

    const r2 = applyProgression(index, "trek_vert", r1.newState, true);
    expect(r2.promoted).toBe(true);
    expect(r2.promotedTo?.slug).toBe("tv2");
    expect(r2.newState.currentRung).toBe(2);
    expect(r2.newState.metStreak).toBe(0);
  });

  it("reset de streak als het criterium niet gehaald is", () => {
    const s: LadderState = { patternKey: "trek_vert", currentRung: 1, sessionsAtRung: 0, metStreak: 1 };
    const r = applyProgression(index, "trek_vert", s, false);
    expect(r.promoted).toBe(false);
    expect(r.newState.metStreak).toBe(0);
    expect(r.newState.sessionsAtRung).toBe(1);
  });

  it("promoveert niet voorbij de top van de ladder", () => {
    const top: LadderState = { patternKey: "trek_vert", currentRung: 3, sessionsAtRung: 0, metStreak: 1 };
    const r = applyProgression(index, "trek_vert", top, true);
    expect(r.promoted).toBe(false);
    expect(r.newState.currentRung).toBe(3);
  });

  it("suggereert een trede terug na twee zwakke sessies", () => {
    const e = ex(2); // advanceReps 5 → floor 3
    expect(suggestsRegression(e, [[{ reps: 2 }], [{ reps: 2 }]])).toBe(true);
    expect(suggestsRegression(e, [[{ reps: 4 }], [{ reps: 2 }]])).toBe(false);
  });
});

describe("sessionMachine", () => {
  it("bouwt de stappen: panel → set/rest per set → summary", () => {
    const plan = generateSession({
      templateKey: "kracht_a",
      templateLabel: "Kracht A",
      slots: [
        { sort: 1, slotType: "warmup", patternKey: null, sets: null, note: null },
        { sort: 2, slotType: "work", patternKey: "trek_vert", sets: 3, note: null },
      ],
      index,
      ladderState: state(1),
      lastLogsByExercise: new Map(),
    });
    const steps = buildStrengthSteps(plan);
    const kinds = steps.map((s) => s.kind);
    // warmup-paneel, dan intro-paneel + set/rest/set/rest/set, dan summary
    expect(kinds).toEqual([
      "panel", // warmup
      "panel", // intro werk-oefening
      "set",
      "rest",
      "set",
      "rest",
      "set",
      "summary",
    ]);
    expect(workOrdinal(plan, 1)).toBe(1);
  });
});
