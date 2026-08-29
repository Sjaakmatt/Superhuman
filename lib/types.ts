import type { IsoDate } from '@/lib/date';

export type PlanWeek = {
  week: number;
  start_date: IsoDate;
  phase: string;
  status: string;
  target_km: number;
  compact_km: number;
  longrun_km: number;
  sunday_km: number;
  midweek_km: number;
  hm_target: number;
  descent_min_target: number;
  strength_sessions: number;
  focus: string;
};

export type PlanDay = {
  date: IsoDate;
  week: number;
  weekday: string;
  phase: string;
  week_status: string;
  session_type: string;
  session_text: string;
  planned_km: number;
  planned_min: number;
  zone: string | null;
  pace_range: string | null;
  strength_block: string | null;
  strength_detail: string | null;
};

export type Zone = { key: string; name: string; hr_min: number; hr_max: number; pace: string };

export type Zones = {
  source: string;
  hr_max: number;
  bands: Zone[];
  distribution_target: { z1_z2: number; z3: number; z4_z5: number };
};

export type Exercise = {
  slug: string;
  name: string;
  block: string;
  unit: string;
  default_sets: number;
  note?: string | null;
};

export type StrengthPhase = {
  weeks: [number, number];
  name: string;
  scheme: string;
  freq: number;
  plyo_contacts: number;
};

export type Fueling = {
  weeks: [number, number];
  carbs_g_per_h: [number, number];
  sodium_mg_per_h: [number, number];
};

export type Milestone = {
  week: number;
  date: IsoDate;
  kind: string;
  title: string;
  /** Eigen voorbereidingsnotities. Staan in reference-seed.json, niet in code:
   *  trainingsinhoud komt uit de seed. Leeg is prima — de kaart toont dan wat
   *  het plan en de naslag al weten. */
  prep?: string[];
  /** Wat deze dag aan gegevens oplevert, en dus welk invoerveld erbij hoort:
   *  "hrmax" een gemeten maximumhartslag, "bloed" een bloedpanel, "loop" een
   *  activiteit die uit Strava komt. Leeg = alleen een notitie. */
  logs?: 'hrmax' | 'bloed' | 'loop';
};

export type Wellness = {
  date: IsoDate;
  slept: number | null;
  fresh: number | null;
  legs: number | null;
  mind: number | null;
  motivation: number | null;
  total: number | null;
  sleep_hours: number | null;
  resting_hr: number | null;
  weight_kg: number | null;
};

export type SessionLog = {
  id: string;
  date: IsoDate;
  activity_id: number | null;
  rpe: number | null;
  pain_score: number | null;
  pain_note: string | null;
  pain_next_morning: number | null;
  shoe_id: string | null;
  carbs_g_per_h: number | null;
  gi_score: number | null;
  taped: boolean | null;
  note: string | null;
};

export type Shoe = { id: string; name: string; drop_mm: number | null; km: number; retired: boolean };

export type Activity = {
  id: number;
  date: IsoDate;
  start_local: string;
  sport_type: string;
  name: string | null;
  distance_m: number | null;
  moving_s: number | null;
  elapsed_s: number | null;
  elev_gain_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_cadence: number | null;
  calories: number | null;
  suffer_score: number | null;
  streams_synced_at: string | null;
};

export type ActivityZone = { activity_id: number; zone: string; seconds: number };

export type ActivityDescent = {
  activity_id: number;
  descent_seconds: number;
  descent_m: number;
  method: string;
};

export type StrengthSession = {
  id: string;
  date: IsoDate;
  block: string;
  completed_at: string | null;
};

export type StrengthSet = {
  id: string;
  session_id: string;
  exercise: string;
  set_no: number;
  weight_kg: number | null;
  reps: number | null;
  done: boolean;
};

export type Finding = { title: string; detail: string; severity: 'info' | 'warn' };
export type Proposal = { date: IsoDate; field: string; from: string; to: string; reason: string };

export type Insight = {
  id: string;
  kind: 'daily' | 'weekly' | 'longrun' | 'debrief' | 'alert';
  period_start: IsoDate;
  period_end: IsoDate;
  body_md: string;
  findings: Finding[];
  proposals: Proposal[];
  rule_hits: string[];
  status: 'new' | 'accepted' | 'dismissed';
  created_at: string;
};

/** Welke bepalingen deze app bewaart. De lijst staat in reference-seed.json,
 *  niet in code: een lab geeft er twintig terug en welke daarvan iets aan je
 *  training veranderen is een keuze, geen technisch gegeven. */
export type BloodMarker = {
  code: string;
  label: string;
  unit: string;
  group: string;
  /** Waarom deze bepaling er staat, in één zin. */
  why: string;
};

/** Een prikdag. Wat je niet liet bepalen ontbreekt gewoon — dat is iets anders
 *  dan een nul. */
export type BloodPanel = {
  date: IsoDate;
  note: string | null;
  values: Record<string, number>;
};

/** Wat er van een mijlpaal terecht is gekomen. De mijlpaal zelf staat vast in
 *  de naslag; dit is wat jij erover noteert. */
export type MilestoneResult = {
  date: IsoDate;
  done: boolean;
  outcome: string | null;
};

/** Een gemeten maximumhartslag. De laatste staat ook op `athlete`, want daar
 *  rekenen de zones mee; hier staat de reeks, zodat je ziet welke kant hij op
 *  gaat. */
export type HrTest = {
  date: IsoDate;
  hr_max: number;
  note: string | null;
};
