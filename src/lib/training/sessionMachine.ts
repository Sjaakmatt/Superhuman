import type { SessionItem, SessionPlan } from "./types";

/**
 * Kracht-state machine (T1) als platte stappen-tijdlijn — hetzelfde
 * testbare patroon als buildTimeline voor de stretch-player.
 * Per werk-oefening: PANEL (intro) → SET → REST → SET … → (geen rest na
 * de laatste set). Warmup/cooldown zijn een enkel PANEL. Sluit af met SUMMARY.
 */

export type StrengthStep =
  | { kind: "panel"; itemIndex: number; item: SessionItem }
  | {
      kind: "set";
      itemIndex: number;
      item: SessionItem;
      setNumber: number;
      totalSets: number;
    }
  | {
      kind: "rest";
      itemIndex: number;
      item: SessionItem;
      restSec: number;
      nextSetNumber: number;
    }
  | { kind: "summary" };

export function buildStrengthSteps(plan: SessionPlan): StrengthStep[] {
  const steps: StrengthStep[] = [];

  plan.items.forEach((item, itemIndex) => {
    // Intro/uitleg-paneel voor elk item
    steps.push({ kind: "panel", itemIndex, item });

    if (item.slotType === "warmup" || item.slotType === "cooldown") return;

    const totalSets = item.sets ?? 3;
    const restSec = item.restSec ?? 90;
    for (let setNumber = 1; setNumber <= totalSets; setNumber += 1) {
      steps.push({ kind: "set", itemIndex, item, setNumber, totalSets });
      if (setNumber < totalSets) {
        steps.push({
          kind: "rest",
          itemIndex,
          item,
          restSec,
          nextSetNumber: setNumber + 1,
        });
      }
    }
  });

  steps.push({ kind: "summary" });
  return steps;
}

/** Aantal werk-oefeningen (work/finisher) in een plan. */
export function workItemCount(plan: SessionPlan): number {
  return plan.items.filter(
    (i) => i.slotType === "work" || i.slotType === "finisher",
  ).length;
}

/** Positie van een item onder de werk-oefeningen (voor "oefening 2/5"). */
export function workOrdinal(plan: SessionPlan, itemIndex: number): number {
  let n = 0;
  for (let i = 0; i <= itemIndex && i < plan.items.length; i += 1) {
    const t = plan.items[i].slotType;
    if (t === "work" || t === "finisher") n += 1;
  }
  return n;
}
