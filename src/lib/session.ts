import type { ExerciseRow } from "./types";

/**
 * Sessie-engine (L4): zet een programma om in een tijdlijn van fasen en
 * levert de begeleiding — getimede cues, ademindicator, tempo-uitleg.
 * De app vertelt altijd wat je nú doet, hoe lang en wat de volgende stap is.
 */

export type PhaseKind = "intro" | "countin" | "hold" | "switch" | "rest";

export interface Step {
  exercise: ExerciseRow;
  /** Vasthoud-duur in seconden (uit routine_exercises of default_secs) */
  secs: number;
  /** Rust ná deze oefening */
  restSecs: number;
}

export interface Phase {
  kind: PhaseKind;
  secs: number;
  exercise: ExerciseRow;
  stepIndex: number;
  /** Bij bilateraal: welke kant */
  side?: "eerste kant" | "andere kant";
  /** Preview van de volgende oefening (bij rest) */
  nextExercise?: ExerciseRow;
}

const INTRO_SECS = 2;
const COUNTIN_SECS = 3;
const SWITCH_SECS = 3;

/** Bouwt de volledige fase-tijdlijn van een stretch-/mobiliteitssessie. */
export function buildTimeline(steps: Step[]): Phase[] {
  const phases: Phase[] = [];

  steps.forEach((step, stepIndex) => {
    const bilateral = step.exercise.bilateral ?? false;
    const isLast = stepIndex === steps.length - 1;
    const nextExercise = steps[stepIndex + 1]?.exercise;

    phases.push({
      kind: "intro",
      secs: INTRO_SECS,
      exercise: step.exercise,
      stepIndex,
    });
    phases.push({
      kind: "countin",
      secs: COUNTIN_SECS,
      exercise: step.exercise,
      stepIndex,
    });

    if (bilateral) {
      phases.push({
        kind: "hold",
        secs: step.secs,
        exercise: step.exercise,
        stepIndex,
        side: "eerste kant",
      });
      phases.push({
        kind: "switch",
        secs: SWITCH_SECS,
        exercise: step.exercise,
        stepIndex,
      });
      phases.push({
        kind: "hold",
        secs: step.secs,
        exercise: step.exercise,
        stepIndex,
        side: "andere kant",
      });
    } else {
      phases.push({
        kind: "hold",
        secs: step.secs,
        exercise: step.exercise,
        stepIndex,
      });
    }

    if (!isLast && step.restSecs > 0) {
      phases.push({
        kind: "rest",
        secs: step.restSecs,
        exercise: step.exercise,
        stepIndex,
        nextExercise,
      });
    }
  });

  return phases;
}

/**
 * Actieve coaching-cue tijdens een HOLD. Gebruikt de getimede cues uit de
 * database; is die leeg, dan de defaults uit de briefing:
 *  - start: de uitvoerings-cue
 *  - 50%: de ademcue
 *  - laatste 10s: "Nog 10 seconden, blijf zacht"
 *  - laatste 3s: aftellen naar los
 */
export function activeCue(
  exercise: ExerciseRow,
  elapsed: number,
  total: number,
): string {
  const remaining = total - elapsed;
  if (remaining <= 3) return "3 · 2 · 1 · en los";

  const cues = exercise.coaching_cues;
  if (cues && cues.length > 0) {
    const pct = total > 0 ? elapsed / total : 0;
    const passed = [...cues]
      .filter((c) => pct >= c.at_pct)
      .sort((a, b) => a.at_pct - b.at_pct);
    if (passed.length > 0) return passed[passed.length - 1].text;
    return cues[0].text;
  }

  // Defaults
  if (remaining <= 10) return "Nog 10 seconden, blijf zacht";
  if (elapsed >= total / 2 && exercise.breathing) return exercise.breathing;
  return exercise.cue ?? "Zak in de rek en adem rustig door.";
}

/** Ademritme tijdens HOLD: 4s in, 6s uit (bol groeit en krimpt). */
export function breathScale(elapsed: number): number {
  const cycle = 10; // 4 in + 6 uit
  const t = elapsed % cycle;
  if (t < 4) return 0.6 + (t / 4) * 0.4; // inademen: 0.6 → 1.0
  return 1.0 - ((t - 4) / 6) * 0.4; // uitademen: 1.0 → 0.6
}

export function breathLabel(elapsed: number): string {
  return elapsed % 10 < 4 ? "Adem in" : "Adem uit";
}

/**
 * Legt een tempo-notatie als '3-1-1' uit in gewone taal
 * (excentrisch-pauze-concentrisch).
 */
export function explainTempo(tempo: string | null): string | null {
  if (!tempo) return null;
  const parts = tempo.split("-").map((p) => parseInt(p, 10));
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  const [down, pause, up] = parts;
  const tel = (n: number) => (n === 1 ? "1 tel" : `${n} tellen`);
  return `${tempo} · ${tel(down)} zakken, ${pause === 0 ? "geen pauze" : tel(pause) + " pauze"}, ${tel(up)} omhoog`;
}
