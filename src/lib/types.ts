import type { AttributeKey } from "./attributes";

/** Databaserijen die de app gebruikt (subset van het schema). */

export interface UserAttributeRow {
  user_id: string;
  key: AttributeKey;
  level: number;
  xp: number;
  xp_max: number;
}

export interface MetricRow {
  id: number;
  key: string;
  label: string;
  attribute_key: AttributeKey | null;
  type: string;
  xp_reward: number;
  direction: string;
  active: boolean;
}

export interface ExerciseRow {
  id: number;
  name: string;
  kind: string;
  default_secs: number | null;
  reps: number | null;
  cue: string | null;
  muscle_group: string | null;
  video_url: string | null;
}

export interface BreathworkPhase {
  label: string;
  secs: number;
  scale: number;
}

export interface BreathworkPatternRow {
  id: number;
  name: string;
  phases: BreathworkPhase[];
}

export interface MeditationRow {
  id: number;
  title: string;
  category: string | null;
  media_type: string | null;
  media_url: string | null;
  duration_secs: number | null;
  description: string | null;
}

export interface JournalEntryRow {
  id: number;
  date: string;
  type: string | null;
  content: string | null;
  mood: number | null;
}

export interface FoodCheckinRow {
  id: number;
  date: string;
  satisfied: boolean | null;
  feeling: string | null;
  note: string | null;
}

export interface WaterLogRow {
  glasses: number;
  goal: number;
}

/** Eén eenheid in de takenstack van Vandaag (server-side samengesteld). */
export interface DayTask {
  id: string;
  label: string;
  meta: string;
  attribute: AttributeKey;
  xp: number;
  done: boolean;
  /** One-tap taak: metric die gelogd wordt */
  metricId?: number;
  /** Player-taak: route die geopend wordt */
  href?: string;
}
