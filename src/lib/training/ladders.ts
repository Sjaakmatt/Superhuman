import type { LadderExercise, PatternKey } from "./types";

/**
 * Ladder-index: snelle toegang tot treden per patroon. Puur en testbaar —
 * krijgt de oefeningen als input (uit de DB of een fixture).
 */
export interface LadderIndex {
  byPattern: Map<PatternKey, LadderExercise[]>; // gesorteerd op rung
  bySlug: Map<string, LadderExercise>;
}

export function buildLadderIndex(exercises: LadderExercise[]): LadderIndex {
  const byPattern = new Map<PatternKey, LadderExercise[]>();
  const bySlug = new Map<string, LadderExercise>();
  for (const ex of exercises) {
    bySlug.set(ex.slug, ex);
    const list = byPattern.get(ex.patternKey) ?? [];
    list.push(ex);
    byPattern.set(ex.patternKey, list);
  }
  for (const list of byPattern.values()) {
    list.sort((a, b) => a.rung - b.rung);
  }
  return { byPattern, bySlug };
}

/** Alle treden van een ladder, van makkelijk naar moeilijk. */
export function ladderFor(
  index: LadderIndex,
  pattern: PatternKey,
): LadderExercise[] {
  return index.byPattern.get(pattern) ?? [];
}

/** De laagste en hoogste trede-nummers van een ladder. */
export function rungBounds(
  index: LadderIndex,
  pattern: PatternKey,
): { min: number; max: number } {
  const list = ladderFor(index, pattern);
  if (list.length === 0) return { min: 1, max: 1 };
  return { min: list[0].rung, max: list[list.length - 1].rung };
}

/** Houd een trede binnen de grenzen van de ladder. */
export function clampRung(
  index: LadderIndex,
  pattern: PatternKey,
  rung: number,
): number {
  const { min, max } = rungBounds(index, pattern);
  return Math.min(Math.max(rung, min), max);
}

/** De oefening op een specifieke trede (geclampt). */
export function exerciseAtRung(
  index: LadderIndex,
  pattern: PatternKey,
  rung: number,
): LadderExercise | null {
  const list = ladderFor(index, pattern);
  if (list.length === 0) return null;
  const clamped = clampRung(index, pattern, rung);
  return list.find((ex) => ex.rung === clamped) ?? list[0];
}

/** De eerstvolgende (zwaardere) trede, of null aan de top. */
export function nextRungExercise(
  index: LadderIndex,
  pattern: PatternKey,
  rung: number,
): LadderExercise | null {
  const list = ladderFor(index, pattern);
  return list.find((ex) => ex.rung > rung) ?? null;
}

/** De vorige (lichtere) trede, of null onderaan. */
export function prevRungExercise(
  index: LadderIndex,
  pattern: PatternKey,
  rung: number,
): LadderExercise | null {
  const list = ladderFor(index, pattern);
  const lighter = list.filter((ex) => ex.rung < rung);
  return lighter.length > 0 ? lighter[lighter.length - 1] : null;
}
