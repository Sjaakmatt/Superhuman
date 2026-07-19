import { describe, expect, it } from "vitest";
import { evaluateUnlock, highestUnlocked, type BreathLevel, type BreathProgress } from "./breath";

function lvl(level: number, requires: BreathLevel["unlock"]["requires"]): BreathLevel {
  return {
    id: `l${level}`,
    level,
    slug: `l${level}`,
    name: `Niveau ${level}`,
    oneLiner: null,
    track: "kalmerend",
    mode: "paced",
    setup: [],
    execution: [],
    breathing: null,
    mistakes: [],
    prescription: null,
    config: {},
    unlock: { requires },
    needsSafetyAck: false,
    media: null,
    xp: 25,
    sort: level,
  };
}

const progress = (over: Partial<BreathProgress> = {}): BreathProgress => ({
  sessionsByLevel: {},
  boltCount: 0,
  boltMax: 0,
  ...over,
});

describe("evaluateUnlock", () => {
  it("ontgrendelt een niveau zonder eisen", () => {
    expect(evaluateUnlock(lvl(1, []), progress()).unlocked).toBe(true);
  });

  it("vergrendelt tot het aantal sessies gehaald is", () => {
    const l = lvl(2, [{ type: "sessions", level: 1, count: 5 }]);
    const a = evaluateUnlock(l, progress({ sessionsByLevel: { 1: 3 } }));
    expect(a.unlocked).toBe(false);
    expect(a.remaining).toContain("2×");
    const b = evaluateUnlock(l, progress({ sessionsByLevel: { 1: 5 } }));
    expect(b.unlocked).toBe(true);
    expect(b.remaining).toBeNull();
  });

  it("respecteert de BOLT-poort (min én telling)", () => {
    const l = lvl(9, [
      { type: "bolt_min", min: 20 },
      { type: "sessions", level: 8, count: 8 },
    ]);
    const locked = evaluateUnlock(
      l,
      progress({ boltMax: 15, sessionsByLevel: { 8: 8 } }),
    );
    expect(locked.unlocked).toBe(false);
    expect(locked.remaining).toContain("BOLT ≥ 20s");
    const open = evaluateUnlock(
      l,
      progress({ boltMax: 22, sessionsByLevel: { 8: 8 } }),
    );
    expect(open.unlocked).toBe(true);
  });

  it("telt BOLT-metingen voor een aparte poort", () => {
    const l = lvl(3, [{ type: "bolt_count", count: 3 }]);
    expect(evaluateUnlock(l, progress({ boltCount: 2 })).unlocked).toBe(false);
    expect(evaluateUnlock(l, progress({ boltCount: 3 })).unlocked).toBe(true);
  });
});

describe("highestUnlocked", () => {
  it("pakt het hoogste ontgrendelde niveau", () => {
    const levels = [
      lvl(1, []),
      lvl(2, [{ type: "sessions", level: 1, count: 5 }]),
      lvl(3, [{ type: "sessions", level: 2, count: 5 }]),
    ];
    expect(highestUnlocked(levels, progress({ sessionsByLevel: { 1: 5 } }))).toBe(2);
    expect(highestUnlocked(levels, progress())).toBe(1);
  });
});
