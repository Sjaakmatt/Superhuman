import type { AttributeKey } from "./attributes";

/** Resultaat van een XP-toekenning (award_xp in Postgres). */
export interface XpAward {
  attributeKey: AttributeKey;
  amount: number;
  level: number;
  xp: number;
  xpMax: number;
  levelUp: boolean;
}

/** Raw jsonb uit de award_xp-functie → XpAward. */
export function parseAward(raw: unknown): XpAward | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    attributeKey: r.attribute_key as AttributeKey,
    amount: Number(r.amount),
    level: Number(r.level),
    xp: Number(r.xp),
    xpMax: Number(r.xp_max),
    levelUp: Boolean(r.level_up),
  };
}

/** Superhuman-level = afgerond gemiddelde van de zes attribuut-levels. */
export function superhumanLevel(levels: number[]): number {
  if (levels.length === 0) return 1;
  return Math.round(levels.reduce((sum, l) => sum + l, 0) / levels.length);
}

/** Vandaag (YYYY-MM-DD) in de tijdzone van de gebruiker. */
export function todayInTz(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
