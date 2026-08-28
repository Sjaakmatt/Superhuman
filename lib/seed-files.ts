import planJson from '@/supabase/seed/plan-seed.json';
import referenceJson from '@/supabase/seed/reference-seed.json';
import type { Exercise, Fueling, Milestone, PlanDay, PlanWeek, StrengthPhase, Zones } from '@/lib/types';

/* De seed wordt statisch geïmporteerd, niet van schijf gelezen: op Cloudflare
 * Workers bestaat er geen bestandssysteem. Dat kost ~40 kB in de bundel en
 * levert op dat de app het plan ook zonder database kan tonen. */

export type PlanSeed = {
  meta: {
    start: string;
    race: string;
    weeks: number;
    days: number;
    total_km: number;
    total_minutes: number;
    timezone: string;
    generated: string;
    note: string;
  };
  weeks: PlanWeek[];
  days: PlanDay[];
};

export type ReferenceSeed = {
  zones: Zones;
  exercises: Exercise[];
  strength_phases: StrengthPhase[];
  fueling_by_week: Fueling[];
  milestones: Milestone[];
};

export function planSeed(): PlanSeed {
  return planJson as unknown as PlanSeed;
}

export function referenceSeed(): ReferenceSeed {
  return referenceJson as unknown as ReferenceSeed;
}
