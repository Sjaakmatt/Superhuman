import { describe, expect, it } from "vitest";
import {
  evaluateUnlock,
  topReached,
  type MeditationLevel,
  type MeditationProgress,
} from "./meditation";

function lvl(level: number, count?: number): MeditationLevel {
  return {
    id: `m${level}`,
    level,
    slug: `m${level}`,
    name: `Niveau ${level}`,
    oneLiner: null,
    instruction: [],
    guidance: null,
    targetMin: 5,
    unlock: {
      requires: count ? [{ type: "sessions", level: level - 1, count }] : [],
    },
    media: null,
    xp: 30,
    sort: level,
  };
}

const progress = (over: Partial<MeditationProgress> = {}): MeditationProgress => ({
  sessionsByLevel: {},
  totalSessions: 0,
  totalMinutes: 0,
  longestSitMin: 0,
  ...over,
});

describe("meditation unlock", () => {
  it("ontgrendelt niveau 1 altijd", () => {
    expect(evaluateUnlock(lvl(1), progress()).unlocked).toBe(true);
  });
  it("vergrendelt tot de sessies gehaald zijn", () => {
    const l = lvl(2, 7);
    expect(evaluateUnlock(l, progress({ sessionsByLevel: { 1: 6 } })).unlocked).toBe(false);
    expect(evaluateUnlock(l, progress({ sessionsByLevel: { 1: 7 } })).unlocked).toBe(true);
  });
  it("topReached pas na ontgrendelen én doen van het hoogste niveau", () => {
    const levels = [lvl(1), lvl(2, 1)];
    expect(topReached(levels, progress({ sessionsByLevel: { 1: 1 } }))).toBe(false);
    expect(topReached(levels, progress({ sessionsByLevel: { 1: 1, 2: 1 } }))).toBe(true);
  });
});
