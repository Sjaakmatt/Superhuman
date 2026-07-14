/** Evolutie-stadia en levende-laag-berekeningen (living brief §1-4). */

export interface EvolutionStage {
  ordinal: number;
  name: string;
  min_total_xp: number;
  particles: number;
  rings: number;
  hue: string;
  glow: number;
  line: string;
}

/**
 * Opgebouwde XP van één attribuut over alle levels heen
 * (spiegel van attr_total_xp in Postgres; curve 100 + (level-1)*25).
 */
export function attrTotalXp(level: number, xp: number): number {
  return xp + 100 * (level - 1) + (25 * (level - 1) * (level - 2)) / 2;
}

/** Huidige stage bij een totaal-XP. */
export function pickStage(
  stages: EvolutionStage[],
  totalXp: number,
): EvolutionStage {
  const sorted = [...stages].sort((a, b) => a.ordinal - b.ordinal);
  let current = sorted[0];
  for (const stage of sorted) {
    if (totalXp >= stage.min_total_xp) current = stage;
  }
  return current;
}

/** Eerstvolgende stage, of null op het hoogste stadium. */
export function nextStage(
  stages: EvolutionStage[],
  current: EvolutionStage,
): EvolutionStage | null {
  return (
    stages
      .filter((s) => s.ordinal > current.ordinal)
      .sort((a, b) => a.ordinal - b.ordinal)[0] ?? null
  );
}

/** Eén observerende regel die de toestand van het systeem benoemt. */
export function stateLine(vitality: number, fedToday: boolean): string {
  if (!fedToday) return "Nog niets gevoed vandaag. Kies één ding en begin.";
  if (vitality > 0.65) return "Je systeem gloeit.";
  if (vitality > 0.35) return "Het leeft, maar er zakt her en der iets weg.";
  return "Veel sluimert. Voed jezelf terug tot leven.";
}

/** Hex-kleur + alpha (0..1) → 8-digit hex, zoals het prototype. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}
