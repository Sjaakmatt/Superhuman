import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Exercise, Fueling, Milestone, PlanDay, PlanWeek, StrengthPhase, Zones } from '@/lib/types';

export type PlanSeed = {
  meta: { start: string; race: string; weeks: number; days: number; total_km: number; total_minutes: number; timezone: string; generated: string; note: string };
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

const dir = () => path.join(process.cwd(), 'supabase', 'seed');

function read<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(dir(), file), 'utf8')) as T;
}

let planCache: PlanSeed | null = null;
let refCache: ReferenceSeed | null = null;

export function planSeed(): PlanSeed {
  planCache ??= read<PlanSeed>('plan-seed.json');
  return planCache;
}

export function referenceSeed(): ReferenceSeed {
  refCache ??= read<ReferenceSeed>('reference-seed.json');
  return refCache;
}
