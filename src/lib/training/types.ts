/**
 * Beweging-diepte (T1) — getypte spiegel van het ladder-datamodel.
 * De engine (ladders/generateSession/progression) werkt puur op deze
 * camelCase types; de DB-mapping zit in de data-laag (T2).
 */

export type PatternKey =
  | "trek_vert"
  | "trek_hor"
  | "duw_vert"
  | "duw_hor"
  | "been_knie"
  | "been_heup"
  | "core"
  | "plyo"
  | "mobiliteit";

export type SlotType = "warmup" | "work" | "finisher" | "cooldown";

export interface MovementPattern {
  id: string;
  key: PatternKey;
  label: string;
  category: "kracht" | "elasticiteit" | "mobiliteit";
  blurb: string | null;
  sort: number;
}

export interface LadderExercise {
  id: string;
  patternId: string;
  patternKey: PatternKey;
  rung: number;
  slug: string;
  name: string;
  oneLiner: string | null;
  setup: string[];
  execution: string[];
  breathing: string | null;
  mistakes: string[];
  tempo: string | null;
  repLow: number | null;
  repHigh: number | null;
  holdSec: number | null;
  restSec: number | null;
  isUnilateral: boolean;
  advanceReps: number | null;
  advanceSets: number | null;
  advanceNote: string | null;
  regressionSlug: string | null;
  progressionSlug: string | null;
  equipment: string | null;
  muscles: string[];
}

/** Waar de gebruiker staat op één ladder. */
export interface LadderState {
  patternKey: PatternKey;
  currentRung: number;
  sessionsAtRung: number;
  metStreak: number;
}

/** Eén gelogde set (uit workout_logs.sets of live). */
export interface LoggedSet {
  reps?: number | null; // bij holds: gehouden seconden
  tempoOk?: boolean;
  note?: string | null;
}

/** De laatste keer dat deze oefening gedaan is. */
export interface LastLog {
  ladderExerciseId: string;
  rung: number;
  sets: LoggedSet[];
}

export interface SessionTemplateSlot {
  sort: number;
  slotType: SlotType;
  patternKey: PatternKey | null;
  sets: number | null;
  note: string | null;
}

/** Eén onderdeel van de gegenereerde sessie. */
export interface SessionItem {
  slotType: SlotType;
  /** Vaste tekst voor warmup/cooldown; anders de oefening */
  fixedLabel?: string;
  note: string | null;
  exercise?: LadderExercise;
  patternKey?: PatternKey;
  /** Aantal werksets */
  sets?: number;
  /** Leesbaar doel: '4 × 5' of '3 × 30s' */
  target?: string;
  tempo?: string | null;
  restSec?: number | null;
  /** Vorige keer (voor progressive overload) */
  lastTime?: LoggedSet[] | null;
  /** Isometrische trede? */
  isHold?: boolean;
}

export interface SessionPlan {
  templateKey: string;
  label: string;
  items: SessionItem[];
}
