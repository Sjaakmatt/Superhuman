import { clampRung, nextRungExercise, type LadderIndex } from "./ladders";
import type { LadderExercise, LadderState, LoggedSet, PatternKey } from "./types";

/**
 * Progressie & auto-promotie (T1). Regel: haal je advance_sets × advance_reps
 * schoon (tempo ok) → met_streak++. Bij twee sessies op rij (met_streak >= 2):
 * trede omhoog. Nooit automatisch degraderen.
 */

const PROMOTE_STREAK = 2;

/**
 * Haalde deze sessie het criterium voor de oefening? Een set telt als "schoon"
 * bij genoeg reps (of gehouden seconden) én tempo niet expliciet afgekeurd.
 */
export function evaluateAdvance(
  exercise: LadderExercise,
  loggedSets: LoggedSet[],
): boolean {
  const targetSets = exercise.advanceSets;
  const targetReps = exercise.advanceReps ?? exercise.holdSec ?? exercise.repLow;
  if (!targetSets || targetReps == null) return false;

  const cleanSets = loggedSets.filter(
    (s) => (s.reps ?? 0) >= targetReps && s.tempoOk !== false,
  ).length;
  return cleanSets >= targetSets;
}

export interface ProgressionResult {
  newState: LadderState;
  promoted: boolean;
  /** De nieuwe oefening bij promotie (voor de ceremonie) */
  promotedTo: LadderExercise | null;
}

/**
 * Werk de ladder-state bij na een sessie. `met` = criterium gehaald.
 * - gehaald: met_streak++; bij >= 2 → trede omhoog (reset teller + streak).
 * - niet gehaald: streak terug naar 0, sessions_at_rung++.
 */
export function applyProgression(
  index: LadderIndex,
  pattern: PatternKey,
  state: LadderState,
  met: boolean,
): ProgressionResult {
  if (!met) {
    return {
      newState: {
        ...state,
        sessionsAtRung: state.sessionsAtRung + 1,
        metStreak: 0,
      },
      promoted: false,
      promotedTo: null,
    };
  }

  const streak = state.metStreak + 1;
  const next = nextRungExercise(index, pattern, state.currentRung);

  if (streak >= PROMOTE_STREAK && next) {
    return {
      newState: {
        ...state,
        currentRung: clampRung(index, pattern, next.rung),
        sessionsAtRung: 0,
        metStreak: 0,
      },
      promoted: true,
      promotedTo: next,
    };
  }

  // Criterium gehaald maar (nog) geen promotie: streak opbouwen.
  // Aan de top van de ladder blijven we op de trede, streak mag doortellen.
  return {
    newState: {
      ...state,
      sessionsAtRung: state.sessionsAtRung + 1,
      metStreak: streak,
    },
    promoted: false,
    promotedTo: null,
  };
}

/**
 * Zachte suggestie om een trede terug te doen: twee sessies waarin je ruim
 * onder de helft van het repdoel bleef. Nooit automatisch — alleen adviseren.
 */
export function suggestsRegression(
  exercise: LadderExercise,
  recentSessions: LoggedSet[][],
): boolean {
  if (recentSessions.length < 2) return false;
  const floor = Math.ceil((exercise.advanceReps ?? exercise.repLow ?? 0) / 2);
  if (floor <= 0) return false;
  return recentSessions
    .slice(-2)
    .every((sets) => sets.every((s) => (s.reps ?? 0) < floor));
}
