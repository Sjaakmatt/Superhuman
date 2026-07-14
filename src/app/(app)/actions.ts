"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AttributeKey } from "@/lib/attributes";
import { parseAward, type XpAward } from "@/lib/xp";

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
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_workout", {
    p_routine_id: input.routineId,
    p_duration_secs: input.durationSecs ?? null,
    p_note: input.note?.trim() || null,
  });
  if (error) return fail(error);
  revalidatePath("/vandaag");
  revalidatePath("/beweging");
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
      },
      { onConflict: "user_id,date,meal_type" },
    );
    if (error) return { error: error.message };
  }
  revalidatePath("/voeding/plan");
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
