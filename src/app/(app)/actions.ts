"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AttributeKey } from "@/lib/attributes";
import { mealWindow } from "@/lib/nutrition";
import type { LoggedExerciseSets } from "@/lib/types";
import { parseAward, type XpAward } from "@/lib/xp";
import {
  loadLadderIndex,
  loadLadderState,
  loadPatterns,
} from "@/lib/training/data";
import { applyProgression, evaluateAdvance } from "@/lib/training/progression";
import type { LoggedSet, PatternKey } from "@/lib/training/types";

export interface ActionResult {
  award: XpAward | null;
  error?: string;
}

function fail(error: unknown): ActionResult {
  const message =
    error instanceof Error ? error.message : "Er ging iets mis bij het loggen.";
  return { award: null, error: message };
}

/**
 * Centrale XP-toekenning (build brief §6). De meeste flows gebruiken de
 * domein-acties hieronder, die log + XP in één DB-transactie afhandelen.
 */
export async function awardXp(
  attributeKey: AttributeKey,
  amount: number,
  source: string,
  sourceId?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("award_xp", {
    p_attribute_key: attributeKey,
    p_amount: amount,
    p_source: source,
    p_source_id: sourceId ?? null,
  });
  if (error) return fail(error);
  revalidatePath("/vandaag");
  return { award: parseAward(data) };
}

/** Ademwerk-sessie afronden: log + geest-XP (eerste ademwerk/dag). */
export async function completeBreathSession(
  level: number,
  durationSec?: number,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_breath_session", {
    p_level: level,
    p_duration_sec: durationSec ?? null,
  });
  if (error) return fail(error);
  revalidatePath("/geest/ademwerk");
  revalidatePath("/vandaag");
  return { award: parseAward((data as { award: unknown }).award) };
}

/** Een BOLT / Control Pause-meting loggen (opent de zware niveaus). */
export async function logBolt(seconds: number): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_bolt", { p_seconds: seconds });
  if (error) return { error: error.message };
  revalidatePath("/geest/ademwerk");
  return {};
}

/** Een dagritme-blok afvinken (of ontvinken) voor vandaag. */
export async function setBlockDone(
  blockId: number,
  done: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_block_done", {
    p_block_id: blockId,
    p_done: done,
  });
  if (error) return { error: error.message };
  revalidatePath("/vandaag");
  return {};
}

/** Evolutie-ceremonie bevestigen: stage onthouden zodat hij één keer toont. */
export async function ackStage(ordinal: number): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ack_stage", { p_ordinal: ordinal });
  if (error) return { error: error.message };
  revalidatePath("/vandaag");
  return {};
}

/** Water: +1 of -1 glas. XP zit in de DB-functie (5 XP per glas t/m goal). */
export async function addWater(delta: 1 | -1): Promise<
  ActionResult & { glasses?: number; goal?: number }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("log_water", { p_delta: delta });
  if (error) return fail(error);
  revalidatePath("/vandaag");
  const result = data as { glasses: number; goal: number; award: unknown };
  return {
    glasses: result.glasses,
    goal: result.goal,
    award: parseAward(result.award),
  };
}

/** Dagelijkse voeding-check-in; XP alleen bij de eerste van de dag. */
export async function checkinFood(input: {
  satisfied: boolean;
  feeling: string;
  note?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("checkin_food", {
    p_satisfied: input.satisfied,
    p_feeling: input.feeling,
    p_note: input.note?.trim() || null,
  });
  if (error) return fail(error);
  revalidatePath("/vandaag");
  revalidatePath("/voeding");
  return { award: parseAward((data as { award: unknown }).award) };
}

/** Afgeronde sessie: stretch → workout_log, breathwork/meditation → session_log. */
export async function completeSession(input: {
  kind: "stretch" | "breathwork" | "meditation";
  refId?: number;
  durationSecs?: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_session", {
    p_kind: input.kind,
    p_ref_id: input.refId ?? null,
    p_duration_secs: input.durationSecs ?? null,
  });
  if (error) return fail(error);
  revalidatePath("/vandaag");
  revalidatePath("/beweging");
  revalidatePath("/geest");
  return { award: parseAward((data as { award: unknown }).award) };
}

/** Journal-entry met optionele mood; XP alleen bij de eerste van de dag. */
export async function addJournalEntry(input: {
  type: "ochtend" | "avond" | "dankbaarheid" | "vrij";
  content: string;
  mood?: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_journal_entry", {
    p_type: input.type,
    p_content: input.content.trim(),
    p_mood: input.mood ?? null,
  });
  if (error) return fail(error);
  revalidatePath("/vandaag");
  revalidatePath("/geest/journal");
  return { award: parseAward((data as { award: unknown }).award) };
}

/** One-tap metric-taak uit de takenstack. */
export async function logMetric(metricId: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("log_metric", {
    p_metric_id: metricId,
    p_value: 1,
  });
  if (error) return fail(error);
  revalidatePath("/vandaag");
  return { award: parseAward((data as { award: unknown }).award) };
}

/** Routine-workout afronden: log + XP (kracht of soepel, eerste per dag). */
export async function completeWorkout(input: {
  routineId: number;
  durationSecs?: number;
  note?: string;
  sets?: LoggedExerciseSets[];
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_workout", {
    p_routine_id: input.routineId,
    p_duration_secs: input.durationSecs ?? null,
    p_note: input.note?.trim() || null,
    p_sets: input.sets && input.sets.length > 0 ? input.sets : null,
  });
  if (error) return fail(error);
  revalidatePath("/vandaag");
  revalidatePath("/beweging");
  return { award: parseAward((data as { award: unknown }).award) };
}

export interface LadderSessionEntry {
  ladderExerciseId: string;
  rung: number;
  sets: LoggedSet[];
}

/** Eén trede-promotie voor de ceremonie. */
export interface LadderPromotion {
  patternKey: PatternKey;
  patternLabel: string;
  fromName: string;
  toName: string;
  toRung: number;
}

export interface LadderSessionResult extends ActionResult {
  promotions: LadderPromotion[];
}

/**
 * Ladder-sessie afronden (T2). Logs + XP via de RPC; progressie wordt in de
 * getypte engine berekend (alleen reps/tempo van de client worden vertrouwd,
 * de drempels komen uit de DB) en daarna in user_ladder_state weggeschreven.
 */
export async function completeLadderSession(input: {
  templateKey: string;
  durationSecs?: number;
  entries: LadderSessionEntry[];
}): Promise<LadderSessionResult> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { award: null, error: "Niet ingelogd", promotions: [] };

  const { keyById, idByKey, labelByKey } = await loadPatterns(supabase);
  const [index, stateByKey] = await Promise.all([
    loadLadderIndex(supabase, keyById),
    loadLadderState(supabase, keyById),
  ]);

  const promotions: LadderPromotion[] = [];
  const upserts: {
    user_id: string;
    pattern_id: string;
    current_rung: number;
    sessions_at_rung: number;
    met_streak: number;
  }[] = [];

  for (const entry of input.entries) {
    const ex = index.byId.get(entry.ladderExerciseId);
    if (!ex) continue;
    const patternKey = ex.patternKey;
    const state = stateByKey.get(patternKey) ?? {
      patternKey,
      currentRung: ex.rung,
      sessionsAtRung: 0,
      metStreak: 0,
    };
    const met = evaluateAdvance(ex, entry.sets);
    const res = applyProgression(index, patternKey, state, met);

    const patternId = idByKey.get(patternKey);
    if (patternId) {
      upserts.push({
        user_id: userId,
        pattern_id: patternId,
        current_rung: res.newState.currentRung,
        sessions_at_rung: res.newState.sessionsAtRung,
        met_streak: res.newState.metStreak,
      });
    }
    if (res.promoted && res.promotedTo) {
      promotions.push({
        patternKey,
        patternLabel: labelByKey.get(patternKey) ?? patternKey,
        fromName: ex.name,
        toName: res.promotedTo.name,
        toRung: res.promotedTo.rung,
      });
    }
  }

  const { data, error } = await supabase.rpc("complete_ladder_session", {
    p_template_key: input.templateKey,
    p_duration_secs: input.durationSecs ?? null,
    p_entries: input.entries.map((e) => ({
      ladder_exercise_id: e.ladderExerciseId,
      rung: e.rung,
      sets: e.sets,
    })),
  });
  if (error) return { ...fail(error), promotions: [] };

  if (upserts.length > 0) {
    const { error: upErr } = await supabase
      .from("user_ladder_state")
      .upsert(upserts, { onConflict: "user_id,pattern_id" });
    if (upErr) return { ...fail(upErr), promotions: [] };
  }

  revalidatePath("/vandaag");
  revalidatePath("/beweging");
  return {
    award: parseAward((data as { award: unknown }).award),
    promotions,
  };
}

/** Run loggen: run_log + vitaliteit-XP (eerste run per dag). */
export async function logRun(input: {
  kind: string;
  distanceKm?: number | null;
  durationMin?: number | null;
  rpe?: number | null;
  note?: string | null;
  ranOn?: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("log_run", {
    p_kind: input.kind,
    p_distance_km: input.distanceKm ?? null,
    p_duration_min: input.durationMin ?? null,
    p_rpe: input.rpe ?? null,
    p_note: input.note?.trim() || null,
    p_ran_on: input.ranOn ?? null,
  });
  if (error) return fail(error);
  revalidatePath("/beweging/hardlopen");
  revalidatePath("/vandaag");
  return { award: parseAward((data as { award: unknown }).award) };
}

/** Nieuwe routine met oefeningen (sets/reps/secs). */
export async function createRoutine(input: {
  name: string;
  kind: "workout" | "stretch";
  exercises: { exerciseId: number; sets?: number; reps?: number; secs?: number }[];
}): Promise<{ error?: string; routineId?: number }> {
  if (!input.name.trim() || input.exercises.length === 0) {
    return { error: "Geef de routine een naam en minstens één oefening." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd" };

  const { data: routine, error } = await supabase
    .from("routines")
    .insert({ user_id: user.id, name: input.name.trim(), kind: input.kind })
    .select("id")
    .single();
  if (error || !routine) return { error: error?.message ?? "Opslaan mislukt" };

  const { error: exError } = await supabase.from("routine_exercises").insert(
    input.exercises.map((ex, i) => ({
      routine_id: routine.id,
      exercise_id: ex.exerciseId,
      position: i + 1,
      sets: ex.sets ?? null,
      reps: ex.reps ?? null,
      secs: ex.secs ?? null,
    })),
  );
  if (exError) {
    await supabase.from("routines").delete().eq("id", routine.id);
    return { error: exError.message };
  }

  revalidatePath("/beweging");
  return { routineId: routine.id };
}

/** Calorie-item loggen (licht hulpmiddel, geen XP en geen budget). */
export async function addCalorieItem(input: {
  item: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}): Promise<{ error?: string }> {
  if (!input.item.trim()) return { error: "Vul een omschrijving in." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd" };

  const { data: today } = await supabase.rpc("user_today");
  const { error } = await supabase.from("calorie_logs").insert({
    user_id: user.id,
    date: today,
    item: input.item.trim(),
    calories: input.calories || null,
    protein: input.protein || null,
    carbs: input.carbs || null,
    fat: input.fat || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/voeding/calorieen");
  return {};
}

export async function deleteCalorieItem(id: number): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("calorie_logs").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/voeding/calorieen");
  return {};
}

/** Nieuw recept met ingrediënten en optionele macro's. */
export async function createRecipe(input: {
  name: string;
  ingredients: { name: string; qty: number | null; unit: string | null }[];
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  instructions?: string;
}): Promise<{ error?: string }> {
  if (!input.name.trim()) return { error: "Geef het recept een naam." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd" };

  const { error } = await supabase.from("recipes").insert({
    user_id: user.id,
    name: input.name.trim(),
    ingredients: input.ingredients.filter((i) => i.name.trim()),
    calories: input.calories || null,
    protein: input.protein || null,
    carbs: input.carbs || null,
    fat: input.fat || null,
    instructions: input.instructions?.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/voeding/recepten");
  revalidatePath("/voeding/plan");
  return {};
}

/** Maaltijd in het weekplan zetten of leegmaken. */
export async function planMeal(input: {
  date: string;
  mealType: "ontbijt" | "lunch" | "diner" | "snack";
  recipeId: number | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd" };

  if (input.recipeId === null) {
    const { error } = await supabase
      .from("meal_plan")
      .delete()
      .eq("date", input.date)
      .eq("meal_type", input.mealType);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("meal_plan").upsert(
      {
        user_id: user.id,
        date: input.date,
        meal_type: input.mealType,
        recipe_id: input.recipeId,
        target_min: mealWindow(input.mealType).target,
      },
      { onConflict: "user_id,date,meal_type" },
    );
    if (error) return { error: error.message };
  }
  revalidatePath("/voeding/plan");
  revalidatePath("/voeding");
  return {};
}

/** Boodschappenlijst (opnieuw) genereren uit het weekplan. */
export async function generateShoppingList(
  weekStart: string,
): Promise<{ error?: string; items?: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_shopping_list", {
    p_week_start: weekStart,
  });
  if (error) return { error: error.message };
  revalidatePath("/voeding/boodschappen");
  return { items: (data as { items: number }).items };
}

/** Nieuw doel in de hiërarchie leven → jaar → kwartaal → week. */
export async function createGoal(input: {
  title: string;
  horizon: "leven" | "jaar" | "kwartaal" | "week";
  parentId?: number;
  targetDate?: string;
  linkedMetricId?: number;
}): Promise<{ error?: string }> {
  if (!input.title.trim()) return { error: "Geef het doel een titel." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd" };

  const { error } = await supabase.from("goals").insert({
    user_id: user.id,
    title: input.title.trim(),
    horizon: input.horizon,
    parent_id: input.parentId ?? null,
    target_date: input.targetDate || null,
    linked_metric_id: input.linkedMetricId ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/doelen");
  return {};
}

export async function setGoalStatus(
  id: number,
  status: "active" | "done",
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ status })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/doelen");
  return {};
}

export async function deleteGoal(id: number): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/doelen");
  return {};
}

/** Wekelijkse review opslaan; 25 XP Focus bij de eerste save van de week. */
export async function saveReview(input: {
  weekStart: string;
  wins: string;
  lessons: string;
  adjustments: string;
  domainScores: Record<string, number>;
  focusNext: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_review", {
    p_week_start: input.weekStart,
    p_wins: input.wins.trim() || null,
    p_lessons: input.lessons.trim() || null,
    p_adjustments: input.adjustments.trim() || null,
    p_domain_scores: input.domainScores,
    p_focus_next: input.focusNext.trim() || null,
  });
  if (error) return fail(error);
  revalidatePath("/review");
  revalidatePath("/vandaag");
  return { award: parseAward((data as { award: unknown }).award) };
}

/** Profiel bijwerken (naam + tijdzone; tijdzone stuurt alle dag-logica). */
/** Dagritme-blok aan/uit zetten. */
export async function toggleScheduleBlock(
  id: number,
  enabled: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_blocks")
    .update({ enabled })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/instellingen");
  revalidatePath("/vandaag");
  return {};
}

/** Reminders (web-push) synchroniseren uit de ingeschakelde dagritme-blokken. */
export async function syncScheduleReminders(): Promise<{
  error?: string;
  count?: number;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sync_schedule_reminders");
  if (error) return { error: error.message };
  revalidatePath("/instellingen");
  return { count: (data as { reminders: number }).reminders };
}

export async function saveProfile(input: {
  displayName: string;
  timezone: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd" };

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: input.displayName.trim() || null,
      timezone: input.timezone || "Europe/Amsterdam",
    })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/instellingen");
  revalidatePath("/vandaag");
  return {};
}

/** Reminder aanmaken of bijwerken. */
export async function upsertReminder(input: {
  id?: number;
  kind: string;
  label: string;
  times: string[];
  days: string[];
  enabled: boolean;
}): Promise<{ error?: string }> {
  if (input.times.length === 0) return { error: "Kies minstens één tijd." };
  if (input.days.length === 0) return { error: "Kies minstens één dag." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd" };

  const row = {
    user_id: user.id,
    kind: input.kind,
    label: input.label.trim() || null,
    schedule: { times: input.times, days: input.days },
    enabled: input.enabled,
  };
  const { error } = input.id
    ? await supabase.from("reminders").update(row).eq("id", input.id)
    : await supabase.from("reminders").insert(row);
  if (error) return { error: error.message };
  revalidatePath("/instellingen");
  return {};
}

export async function toggleReminder(
  id: number,
  enabled: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reminders")
    .update({ enabled })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/instellingen");
  return {};
}

export async function deleteReminder(id: number): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("reminders").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/instellingen");
  return {};
}

/** Push-subscription van deze browser opslaan (dedupe op endpoint). */
export async function savePushSubscription(
  subscription: Record<string, unknown>,
): Promise<{ error?: string }> {
  const endpoint = subscription.endpoint;
  if (typeof endpoint !== "string" || !endpoint) {
    return { error: "Ongeldige subscription." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd" };

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("subscription->>endpoint", endpoint);
  const { error } = await supabase
    .from("push_subscriptions")
    .insert({ user_id: user.id, subscription });
  if (error) return { error: error.message };
  revalidatePath("/instellingen");
  return {};
}

export async function removePushSubscription(
  endpoint: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Niet ingelogd" };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("subscription->>endpoint", endpoint);
  if (error) return { error: error.message };
  revalidatePath("/instellingen");
  return {};
}

export async function toggleShoppingItem(
  id: number,
  checked: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("shopping_items")
    .update({ checked })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/voeding/boodschappen");
  return {};
}
