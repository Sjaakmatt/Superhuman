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
