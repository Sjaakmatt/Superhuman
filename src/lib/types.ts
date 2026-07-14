import type { AttributeKey } from "./attributes";

/** Databaserijen die de app gebruikt (subset van het schema). */

export interface UserAttributeRow {
  user_id: string;
  key: AttributeKey;
  level: number;
  xp: number;
  xp_max: number;
  /** Levenspuls 0-100 (levende laag) */
  momentum: number;
  idle_days: number;
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

export interface CoachingCue {
  at_pct: number;
  text: string;
}

export interface ExerciseRow {
  id: number;
  name: string;
  kind: string;
  default_secs: number | null;
  reps: number | null;
  sets: number | null;
  tempo: string | null;
  rest_secs: number | null;
  bilateral: boolean | null;
  level: string | null;
  cue: string | null;
  setup: string | null;
  breathing: string | null;
  common_mistake: string | null;
  progression: string | null;
  regression: string | null;
  benefit: string | null;
  muscle_group: string | null;
  video_url: string | null;
  coaching_cues: CoachingCue[] | null;
}

/** Kolommen die de begeleide sessies nodig hebben. */
export const EXERCISE_COLUMNS =
  "id, name, kind, default_secs, reps, sets, tempo, rest_secs, bilateral, level, cue, setup, breathing, common_mistake, progression, regression, benefit, muscle_group, video_url, coaching_cues";

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

export interface ReminderSchedule {
  times: string[]; // ['09:00', '13:00']
  days: string[]; // ['MO', 'TU', ...]
}

export interface ReminderRow {
  id: number;
  kind: string; // water|stretch|meditation|review|custom
  label: string | null;
  schedule: ReminderSchedule | null;
  enabled: boolean;
}

export interface GoalRow {
  id: number;
  title: string;
  horizon: string;
  parent_id: number | null;
  status: string;
  target_date: string | null;
  linked_metric_id: number | null;
}

export interface ReviewRow {
  week_start: string;
  wins: string | null;
  lessons: string | null;
  adjustments: string | null;
  domain_scores: Record<string, number> | null;
  focus_next: string | null;
}

export interface RoutineRow {
  id: number;
  name: string;
  kind: string;
  description: string | null;
  duration_min: number | null;
  level: string | null;
  moment: string | null;
}

export interface RoutineExerciseRow {
  position: number;
  secs: number | null;
  reps: number | null;
  sets: number | null;
  rest_secs: number | null;
  exercises: ExerciseRow | null;
}

/** Eén set uit een eerdere workout (progressive overload). */
export interface LoggedSet {
  reps?: number | null;
  weight?: number | null;
}

export interface LoggedExerciseSets {
  exercise_id: number;
  name: string;
  sets: LoggedSet[];
}

export interface RecipeIngredient {
  name: string;
  qty: number | null;
  unit: string | null;
}

export interface RecipeRow {
  id: number;
  name: string;
  ingredients: RecipeIngredient[] | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  instructions: string | null;
}

export interface CalorieLogRow {
  id: number;
  item: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface MealPlanRow {
  id: number;
  date: string;
  meal_type: string;
  recipe_id: number | null;
}

export interface ShoppingItemRow {
  id: number;
  name: string;
  qty: number | null;
  unit: string | null;
  checked: boolean;
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
