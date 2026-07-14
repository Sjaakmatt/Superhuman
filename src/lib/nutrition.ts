/**
 * Voeding tot leven (L5): maaltijd-vensters, tijd-status en hydratatie
 * over de dag. Puur en testbaar — de UI tikt op de klok.
 */

export type MealType = "ontbijt" | "lunch" | "snack" | "diner";
export type MealStatus = "gehad" | "nu" | "straks";

export interface MealWindow {
  type: MealType;
  label: string;
  /** venster-start (min na middernacht) */
  start: number;
  /** richttijd */
  target: number;
  /** venster-eind */
  end: number;
}

export const MEAL_WINDOWS: MealWindow[] = [
  { type: "ontbijt", label: "Ontbijt", start: 420, target: 480, end: 600 }, // 07:00–10:00
  { type: "lunch", label: "Lunch", start: 690, target: 750, end: 840 }, // 11:30–14:00
  { type: "snack", label: "Snack", start: 870, target: 900, end: 990 }, // 14:30–16:30
  { type: "diner", label: "Diner", start: 1080, target: 1140, end: 1260 }, // 18:00–21:00
];

export function mealWindow(type: MealType): MealWindow {
  return MEAL_WINDOWS.find((w) => w.type === type) ?? MEAL_WINDOWS[0];
}

/** min na middernacht → "08:00" */
export function minToTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Status van een maaltijd t.o.v. het huidige moment. */
export function mealStatus(nowMin: number, w: MealWindow): MealStatus {
  if (nowMin > w.end) return "gehad";
  if (nowMin >= w.start) return "nu";
  return "straks";
}

/**
 * Welke maaltijd is "nu" het meest relevant? Het open venster; anders de
 * eerstvolgende; anders (na het laatste venster) null.
 */
export function activeMeal(nowMin: number): MealWindow | null {
  const open = MEAL_WINDOWS.find((w) => nowMin >= w.start && nowMin <= w.end);
  if (open) return open;
  const upcoming = MEAL_WINDOWS.find((w) => nowMin < w.start);
  return upcoming ?? null;
}

/**
 * Hoeveel glazen water je "tot nu toe" gedronken zou moeten hebben, lineair
 * verdeeld over de wakkere dag (07:00–22:00). Stuurt de hydratatie-nudge.
 */
export function hydrationTarget(
  nowMin: number,
  goal: number,
  startMin = 420,
  endMin = 1320,
): number {
  if (nowMin <= startMin) return 0;
  if (nowMin >= endMin) return goal;
  const frac = (nowMin - startMin) / (endMin - startMin);
  return Math.round(frac * goal);
}
