import type { createClient } from "@/lib/supabase/server";
import { buildLadderIndex, ladderFor, type LadderIndex } from "./ladders";
import { generateSession, sessionKeyForWeek } from "./generateSession";
import type {
  LadderExercise,
  LadderState,
  LastLog,
  MovementPattern,
  PatternKey,
  SessionPlan,
  SessionTemplateSlot,
  SlotType,
} from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const PATTERN_COLUMNS = "id, key, label, category, blurb, sort";
const EXERCISE_COLUMNS =
  "id, pattern_id, rung, slug, name, one_liner, setup, execution, breathing, mistakes, tempo, rep_low, rep_high, hold_sec, rest_sec, is_unilateral, advance_reps, advance_sets, advance_note, regression_slug, progression_slug, equipment, muscles";

// ── DB-rijen (snake_case) ────────────────────────────────────────────────
interface PatternRow {
  id: string;
  key: string;
  label: string;
  category: string;
  blurb: string | null;
  sort: number;
}
interface ExerciseRow {
  id: string;
  pattern_id: string;
  rung: number;
  slug: string;
  name: string;
  one_liner: string | null;
  setup: string[] | null;
  execution: string[] | null;
  breathing: string | null;
  mistakes: string[] | null;
  tempo: string | null;
  rep_low: number | null;
  rep_high: number | null;
  hold_sec: number | null;
  rest_sec: number | null;
  is_unilateral: boolean;
  advance_reps: number | null;
  advance_sets: number | null;
  advance_note: string | null;
  regression_slug: string | null;
  progression_slug: string | null;
  equipment: string | null;
  muscles: string[] | null;
}
interface StateRow {
  pattern_id: string;
  current_rung: number;
  sessions_at_rung: number;
  met_streak: number;
}
interface SlotRow {
  sort: number;
  slot_type: string;
  pattern_id: string | null;
  sets: number | null;
  note: string | null;
}
interface WorkoutLogRow {
  ladder_exercise_id: string;
  rung: number | null;
  sets: unknown;
  created_at: string;
}

// ── Mappers ──────────────────────────────────────────────────────────────
function toPattern(r: PatternRow): MovementPattern {
  return {
    id: r.id,
    key: r.key as PatternKey,
    label: r.label,
    category: r.category as MovementPattern["category"],
    blurb: r.blurb,
    sort: r.sort,
  };
}

function toExercise(r: ExerciseRow, keyById: Map<string, PatternKey>): LadderExercise {
  return {
    id: r.id,
    patternId: r.pattern_id,
    patternKey: keyById.get(r.pattern_id) ?? ("core" as PatternKey),
    rung: r.rung,
    slug: r.slug,
    name: r.name,
    oneLiner: r.one_liner,
    setup: r.setup ?? [],
    execution: r.execution ?? [],
    breathing: r.breathing,
    mistakes: r.mistakes ?? [],
    tempo: r.tempo,
    repLow: r.rep_low,
    repHigh: r.rep_high,
    holdSec: r.hold_sec,
    restSec: r.rest_sec,
    isUnilateral: r.is_unilateral,
    advanceReps: r.advance_reps,
    advanceSets: r.advance_sets,
    advanceNote: r.advance_note,
    regressionSlug: r.regression_slug,
    progressionSlug: r.progression_slug,
    equipment: r.equipment,
    muscles: r.muscles ?? [],
  };
}

/** jsonb sets → LoggedSet[] (tolerant voor oude/losse vormen). */
function toLoggedSets(raw: unknown): LastLog["sets"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s) => ({
      reps: typeof s.reps === "number" ? s.reps : null,
      tempoOk: typeof s.tempoOk === "boolean" ? s.tempoOk : undefined,
      note: typeof s.note === "string" ? s.note : null,
    }));
}

// ── Loaders ──────────────────────────────────────────────────────────────

/** Alle patronen (gesorteerd) + snelle key↔id-maps. */
export interface PatternBundle {
  patterns: MovementPattern[];
  keyById: Map<string, PatternKey>;
  idByKey: Map<PatternKey, string>;
  labelByKey: Map<PatternKey, string>;
}

export async function loadPatterns(supabase: Supabase): Promise<PatternBundle> {
  const { data } = await supabase
    .from("movement_patterns")
    .select(PATTERN_COLUMNS)
    .order("sort");
  const patterns = ((data ?? []) as PatternRow[]).map(toPattern);
  const keyById = new Map<string, PatternKey>();
  const idByKey = new Map<PatternKey, string>();
  const labelByKey = new Map<PatternKey, string>();
  for (const p of patterns) {
    keyById.set(p.id, p.key);
    idByKey.set(p.key, p.id);
    labelByKey.set(p.key, p.label);
  }
  return { patterns, keyById, idByKey, labelByKey };
}

/** Ladder-index over alle treden. */
export async function loadLadderIndex(
  supabase: Supabase,
  keyById: Map<string, PatternKey>,
): Promise<LadderIndex> {
  const { data } = await supabase
    .from("ladder_exercises")
    .select(EXERCISE_COLUMNS)
    .order("rung");
  const exercises = ((data ?? []) as ExerciseRow[]).map((r) =>
    toExercise(r, keyById),
  );
  return buildLadderIndex(exercises);
}

/** Waar de gebruiker op elke ladder staat (na idempotente backfill). */
export async function loadLadderState(
  supabase: Supabase,
  keyById: Map<string, PatternKey>,
): Promise<Map<PatternKey, LadderState>> {
  await supabase.rpc("ensure_ladder_state");
  const { data } = await supabase
    .from("user_ladder_state")
    .select("pattern_id, current_rung, sessions_at_rung, met_streak");
  const map = new Map<PatternKey, LadderState>();
  for (const r of (data ?? []) as StateRow[]) {
    const key = keyById.get(r.pattern_id);
    if (!key) continue;
    map.set(key, {
      patternKey: key,
      currentRung: r.current_rung,
      sessionsAtRung: r.sessions_at_rung,
      metStreak: r.met_streak,
    });
  }
  return map;
}

/** Template + slots voor een sessiesleutel (kracht_a/kracht_b). */
export async function loadTemplate(
  supabase: Supabase,
  templateKey: string,
  keyById: Map<string, PatternKey>,
): Promise<{ label: string; slots: SessionTemplateSlot[] } | null> {
  const { data: tpl } = await supabase
    .from("session_templates")
    .select("id, key, label")
    .eq("key", templateKey)
    .maybeSingle();
  if (!tpl) return null;

  const { data: slotRows } = await supabase
    .from("session_template_slots")
    .select("sort, slot_type, pattern_id, sets, note")
    .eq("template_id", (tpl as { id: string }).id)
    .order("sort");

  const slots: SessionTemplateSlot[] = ((slotRows ?? []) as SlotRow[]).map(
    (r) => ({
      sort: r.sort,
      slotType: r.slot_type as SlotType,
      patternKey: r.pattern_id ? (keyById.get(r.pattern_id) ?? null) : null,
      sets: r.sets,
      note: r.note,
    }),
  );
  return { label: (tpl as { label: string }).label, slots };
}

/** Laatste log per ladder-oefening (voor "vorige keer"). */
export async function loadLastLogs(
  supabase: Supabase,
  exerciseIds: string[],
): Promise<Map<string, LastLog>> {
  const map = new Map<string, LastLog>();
  if (exerciseIds.length === 0) return map;
  const { data } = await supabase
    .from("workout_logs")
    .select("ladder_exercise_id, rung, sets, created_at")
    .in("ladder_exercise_id", exerciseIds)
    .order("created_at", { ascending: false });
  for (const r of (data ?? []) as WorkoutLogRow[]) {
    if (!r.ladder_exercise_id || map.has(r.ladder_exercise_id)) continue;
    map.set(r.ladder_exercise_id, {
      ladderExerciseId: r.ladder_exercise_id,
      rung: r.rung ?? 1,
      sets: toLoggedSets(r.sets),
    });
  }
  return map;
}

/**
 * Kies de sessiesleutel: 'auto' wisselt A/B per kalenderweek, anders de
 * expliciet gekozen sleutel.
 */
export function resolveSessionKey(key: string, today: string): string {
  if (key !== "auto") return key;
  const epochWeek = Math.floor(
    Date.parse(`${today}T00:00:00Z`) / (86_400_000 * 7),
  );
  return sessionKeyForWeek(epochWeek);
}

/** De ladder van één patroon met de trede waar de gebruiker staat. */
export interface LadderStrip {
  patternKey: PatternKey;
  label: string;
  currentRung: number;
  rungs: { rung: number; name: string; slug: string }[];
}

export interface SessionBundle {
  plan: SessionPlan;
  ladders: LadderStrip[];
}

/**
 * Bouwt het volledige sessieplan van vandaag + de ladder-strips voor de
 * werk-patronen. Retourneert null als de template onbekend is.
 */
export async function buildSessionBundle(
  supabase: Supabase,
  templateKey: string,
  labelByKey: Map<PatternKey, string>,
): Promise<SessionBundle | null> {
  const { keyById } = await loadPatterns(supabase);
  const [index, ladderState, template] = await Promise.all([
    loadLadderIndex(supabase, keyById),
    loadLadderState(supabase, keyById),
    loadTemplate(supabase, templateKey, keyById),
  ]);
  if (!template) return null;

  // Eerst zonder "vorige keer": welke oefeningen komen op de werk-slots?
  const dry = generateSession({
    templateKey,
    templateLabel: template.label,
    slots: template.slots,
    index,
    ladderState,
    lastLogsByExercise: new Map(),
  });
  const workIds = dry.items
    .filter((i) => i.exercise)
    .map((i) => i.exercise!.id);

  const lastLogs = await loadLastLogs(supabase, workIds);
  const plan = generateSession({
    templateKey,
    templateLabel: template.label,
    slots: template.slots,
    index,
    ladderState,
    lastLogsByExercise: lastLogs,
  });

  // Strip per uniek werk-patroon, in de volgorde van het plan
  const seen = new Set<PatternKey>();
  const ladders: LadderStrip[] = [];
  for (const item of plan.items) {
    if (!item.patternKey || seen.has(item.patternKey)) continue;
    seen.add(item.patternKey);
    ladders.push({
      patternKey: item.patternKey,
      label: labelByKey.get(item.patternKey) ?? item.patternKey,
      currentRung: ladderState.get(item.patternKey)?.currentRung ?? 1,
      rungs: ladderFor(index, item.patternKey).map((e) => ({
        rung: e.rung,
        name: e.name,
        slug: e.slug,
      })),
    });
  }

  return { plan, ladders };
}
