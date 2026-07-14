import { ATTRIBUTES, type AttributeKey } from "./attributes";
import { attrTotalXp, nextStage, pickStage, type EvolutionStage } from "./evolution";
import { currentStreak } from "./streaks";
import type { UserAttributeRow } from "./types";

/**
 * De spiegel (living brief §5): 2 gerankte regels, berekend uit echte
 * data — nooit verzonnen. Hoogste prioriteit wint.
 */

export interface Reflection {
  text: string;
  color: string;
  priority: number;
}

const WILT_COLOR = "#E0748C";
const PATTERN_COLOR = "#8B7CFF";

export interface ReflectionInput {
  attributes: Pick<UserAttributeRow, "key" | "level" | "xp" | "momentum">[];
  stages: EvolutionStage[];
  /** Per attribuut: dagen (YYYY-MM-DD, lokale tz) met ≥ 1 xp_event */
  fedDates: Map<AttributeKey, Set<string>>;
  /** Per dag: gemiddelde mood uit journal_entries */
  moodByDay: Map<string, number>;
  today: string;
  vitality: number;
}

export function computeReflections(input: ReflectionInput): Reflection[] {
  const { attributes, stages, fedDates, moodByDay, today, vitality } = input;
  const out: Reflection[] = [];

  const totalXp = attributes.reduce(
    (sum, a) => sum + attrTotalXp(a.level, a.xp),
    0,
  );

  for (const attr of attributes) {
    const def = ATTRIBUTES[attr.key];
    const momentum = attr.momentum ?? 50;

    // Verval-alarm (p 4): uitgedoofd én er valt iets te verliezen
    if (momentum <= 0 && attrTotalXp(attr.level, attr.xp) > 0) {
      out.push({
        text: `${def.label} is uitgedoofd — voortgang begint te vervallen.`,
        color: WILT_COLOR,
        priority: 4,
      });
    } else if (momentum > 0 && momentum < 22) {
      // Dim-waarschuwing (p 3)
      out.push({
        text: `${def.label} dimt. Nog een dag zonder aandacht en het zakt terug.`,
        color: WILT_COLOR,
        priority: 3,
      });
    }

    // Opbouw-streak (p 2): ≥ 2 dagen op rij gevoed
    const streak = currentStreak(fedDates.get(attr.key) ?? new Set(), today);
    if (streak >= 2) {
      out.push({
        text: `Je voedt ${def.label} ${streak} dagen op rij. Er wordt iets opgebouwd.`,
        color: def.colorVar,
        priority: 2,
      });
    }
  }

  // Drempel dichtbij (p 3.5)
  if (stages.length > 0) {
    const stage = pickStage(stages, totalXp);
    const next = nextStage(stages, stage);
    if (next) {
      const toGo = next.min_total_xp - totalXp;
      if (toGo > 0 && toGo < 90) {
        out.push({
          text: `Nog ${toGo} XP tot ${next.name}. Je staat op de drempel.`,
          color: stage.hue,
          priority: 3.5,
        });
      }
    }
  }

  // Vitaliteit-stemming (p 1–1.5), alleen als er al geleefd wordt
  const anyHistory = [...fedDates.values()].some((dates) => dates.size > 0);
  if (anyHistory) {
    if (vitality > 0.7) {
      out.push({
        text: "Bijna alles krijgt aandacht. Zo voelt momentum.",
        color: "#39E0C4",
        priority: 1,
      });
    } else if (vitality < 0.3) {
      out.push({
        text: "Het meeste sluimert. Kies één cel en begin klein.",
        color: "var(--muted)",
        priority: 1.5,
      });
    }
  }

  // Cross-domein patroon (p 0.8): echt verband uit de logs
  const pattern = crossDomainPattern(fedDates, moodByDay);
  if (pattern) out.push(pattern);

  return out.sort((a, b) => b.priority - a.priority).slice(0, 2);
}

/**
 * Bewegen × stemming: vergelijk de gemiddelde mood op dagen mét een
 * soepel/kracht-event tegen dagen zonder. Alleen tonen bij ≥ 5 dagen
 * mood-data, minstens 2 dagen in elke groep en een verschil dat er toe
 * doet. Valt terug op het voed-ritme zodra er ≥ 3 dagen activiteit is.
 */
function crossDomainPattern(
  fedDates: Map<AttributeKey, Set<string>>,
  moodByDay: Map<string, number>,
): Reflection | null {
  const moveDays = new Set([
    ...(fedDates.get("soepel") ?? []),
    ...(fedDates.get("kracht") ?? []),
  ]);

  const moved: number[] = [];
  const rest: number[] = [];
  for (const [day, mood] of moodByDay) {
    (moveDays.has(day) ? moved : rest).push(mood);
  }
  if (moodByDay.size >= 5 && moved.length >= 2 && rest.length >= 2) {
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const diff = avg(moved) - avg(rest);
    if (diff >= 0.5) {
      return {
        text: `Op dagen dat je beweegt scoort je stemming gemiddeld ${diff.toFixed(1)} hoger.`,
        color: PATTERN_COLOR,
        priority: 0.8,
      };
    }
  }

  // Fallback: eerlijk voed-ritme over de laatste dagen
  const allDays = new Set<string>();
  for (const dates of fedDates.values()) {
    for (const d of dates) allDays.add(d);
  }
  if (allDays.size >= 3) {
    let feeds = 0;
    for (const dates of fedDates.values()) feeds += dates.size;
    const avgCells = feeds / allDays.size;
    return {
      text: `Je voedt gemiddeld ${avgCells.toFixed(1)} cellen per dag. De volle dagen trekken je rank het snelst omhoog.`,
      color: PATTERN_COLOR,
      priority: 0.8,
    };
  }

  return null;
}
