import type { Exercise } from '@/lib/types';

/* De krachtsessies staan als één regel in plan_day.strength_detail:
 *   "Back squat 3-4x8-12 @65-75% | Roemeense deadlift 3x8 | ..."
 * We knippen die regel op en koppelen elk onderdeel aan een oefening uit de
 * referentie. Lukt dat niet, dan tonen we de tekst zoals hij is — liever een
 * regel zonder invoervelden dan een verzonnen oefening. */

export type PlannedExercise = {
  /** Slug uit `exercise`, of null als we de oefening niet herkennen. */
  slug: string | null;
  name: string;
  /** De voorgeschreven serie zoals hij in het plan staat. */
  prescription: string;
  sets: number;
  unit: string;
};

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Aantal series uit een voorschrift als "3-4x8-12" of "5x4 x 3s": het eerste
 *  getal vóór de x. Bij een reeks nemen we de bovengrens. */
export function setCount(prescription: string, fallback: number): number {
  const m = /(\d+)(?:\s*-\s*(\d+))?\s*[x×]/i.exec(prescription);
  if (!m) return fallback;
  const n = Number(m[2] ?? m[1]);
  return Number.isFinite(n) && n > 0 && n <= 10 ? n : fallback;
}

/** Het plan schrijft soms een variant op waar de referentie één naam voor heeft.
 *  Hier staat de vertaling, zodat de invoervelden toch verschijnen. */
const ALIASES: Record<string, string> = {
  'trap bar of conventionele deadlift': 'trapbar-deadlift',
};

export function parseBlock(detail: string | null, exercises: Exercise[]): PlannedExercise[] {
  if (!detail) return [];
  // Langste naam eerst, anders wint "Roeien" van "Roemeense deadlift".
  const known = [...exercises].sort((a, b) => b.name.length - a.name.length);

  return detail
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const flat = strip(part);
      const aliasKey = Object.keys(ALIASES).find((a) => flat.startsWith(a));
      const alias = aliasKey ? known.find((e) => e.slug === ALIASES[aliasKey]) : undefined;
      const match =
        alias ??
        known.find((e) => flat.startsWith(strip(e.name))) ??
        known.find((e) => flat.includes(strip(e.name)));
      const nameLength = aliasKey ? aliasKey.length : (match?.name.length ?? 0);
      const prescription = match ? part.slice(nameLength).trim() : part;
      return {
        slug: match?.slug ?? null,
        name: match?.name ?? part,
        prescription: prescription || '—',
        sets: setCount(prescription, match?.default_sets ?? 3),
        unit: match?.unit ?? 'kg',
      };
    });
}
