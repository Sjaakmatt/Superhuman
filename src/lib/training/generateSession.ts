import { exerciseAtRung, type LadderIndex } from "./ladders";
import type {
  LadderState,
  LastLog,
  PatternKey,
  SessionItem,
  SessionPlan,
  SessionTemplateSlot,
} from "./types";

export interface GenerateSessionInput {
  templateKey: string;
  templateLabel: string;
  slots: SessionTemplateSlot[];
  index: LadderIndex;
  /** Waar de gebruiker staat, per patroon */
  ladderState: Map<PatternKey, LadderState>;
  /** Laatste log per ladder_exercise_id (voor "vorige keer") */
  lastLogsByExercise: Map<string, LastLog>;
}

const WARMUP_LABEL = "Warming-up";
const COOLDOWN_LABEL = "Cooldown — mobiliteit";

/** Leesbaar doel: '4 × 5', '3 × 8-10' of '3 × 30s'. */
function targetText(sets: number, isHold: boolean, ex: {
  repLow: number | null;
  repHigh: number | null;
  holdSec: number | null;
}): string {
  if (isHold && ex.holdSec != null) return `${sets} × ${ex.holdSec}s`;
  if (ex.repLow != null && ex.repHigh != null) {
    return ex.repLow === ex.repHigh
      ? `${sets} × ${ex.repLow}`
      : `${sets} × ${ex.repLow}-${ex.repHigh}`;
  }
  return `${sets} sets`;
}

/**
 * Bouwt de sessie van vandaag: per slot de juiste trede op basis van waar
 * de gebruiker staat, met doel, tempo, rust en "vorige keer".
 */
export function generateSession(input: GenerateSessionInput): SessionPlan {
  const items: SessionItem[] = [];

  for (const slot of [...input.slots].sort((a, b) => a.sort - b.sort)) {
    if (slot.slotType === "warmup") {
      items.push({
        slotType: "warmup",
        fixedLabel: WARMUP_LABEL,
        note: slot.note ?? "Vijf minuten ophalen en de bewegingen van vandaag licht doorlopen.",
      });
      continue;
    }
    if (slot.slotType === "cooldown") {
      items.push({
        slotType: "cooldown",
        fixedLabel: COOLDOWN_LABEL,
        note: slot.note ?? "De korte mobiliteitsroutine om af te sluiten.",
      });
      continue;
    }

    // work / finisher: pak de trede waar de gebruiker staat
    if (!slot.patternKey) continue;
    const state = input.ladderState.get(slot.patternKey);
    const rung = state?.currentRung ?? 1;
    const ex = exerciseAtRung(input.index, slot.patternKey, rung);
    if (!ex) continue;

    const isHold = ex.holdSec != null && ex.repLow == null;
    const sets = slot.sets ?? ex.advanceSets ?? 3;
    const last = input.lastLogsByExercise.get(ex.id);

    items.push({
      slotType: slot.slotType,
      exercise: ex,
      patternKey: slot.patternKey,
      sets,
      target: targetText(sets, isHold, ex),
      tempo: ex.tempo,
      restSec: ex.restSec,
      lastTime: last?.sets ?? null,
      isHold,
      note: slot.note,
    });
  }

  return {
    templateKey: input.templateKey,
    label: input.templateLabel,
    items,
  };
}

/** Alternerende sessiekeuze op basis van de weekteller (A/B/A → B/A/B). */
export function sessionKeyForWeek(weekIndex: number): "kracht_a" | "kracht_b" {
  return weekIndex % 2 === 0 ? "kracht_a" : "kracht_b";
}
