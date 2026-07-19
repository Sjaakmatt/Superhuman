import type { createClient } from "@/lib/supabase/server";
import type { BreathLevel, BreathProgress } from "./breath";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const COLUMNS =
  "id, level, slug, name, one_liner, track, mode, setup, execution, breathing, mistakes, prescription, config, unlock, needs_safety_ack, media, xp, sort";

interface Row {
  id: string;
  level: number;
  slug: string;
  name: string;
  one_liner: string | null;
  track: string;
  mode: string;
  setup: string[] | null;
  execution: string[] | null;
  breathing: string | null;
  mistakes: string[] | null;
  prescription: string | null;
  config: unknown;
  unlock: unknown;
  needs_safety_ack: boolean;
  media: unknown;
  xp: number;
  sort: number;
}

function toLevel(r: Row): BreathLevel {
  return {
    id: r.id,
    level: r.level,
    slug: r.slug,
    name: r.name,
    oneLiner: r.one_liner,
    track: r.track as BreathLevel["track"],
    mode: r.mode as BreathLevel["mode"],
    setup: r.setup ?? [],
    execution: r.execution ?? [],
    breathing: r.breathing,
    mistakes: r.mistakes ?? [],
    prescription: r.prescription,
    config: (r.config ?? {}) as BreathLevel["config"],
    unlock: (r.unlock ?? { requires: [] }) as BreathLevel["unlock"],
    needsSafetyAck: r.needs_safety_ack,
    media: (r.media ?? null) as BreathLevel["media"],
    xp: r.xp,
    sort: r.sort,
  };
}

/** Gelogde sessies per niveau + BOLT-stats van de gebruiker. */
export async function loadBreathProgress(
  supabase: Supabase,
): Promise<BreathProgress> {
  const [{ data: sessions }, { data: bolts }] = await Promise.all([
    supabase.from("breath_sessions").select("level"),
    supabase.from("bolt_logs").select("seconds"),
  ]);
  const sessionsByLevel: Record<number, number> = {};
  for (const s of (sessions ?? []) as { level: number }[]) {
    sessionsByLevel[s.level] = (sessionsByLevel[s.level] ?? 0) + 1;
  }
  const boltSecs = (bolts ?? []).map((b: { seconds: number }) => b.seconds);
  return {
    sessionsByLevel,
    boltCount: boltSecs.length,
    boltMax: boltSecs.length > 0 ? Math.max(...boltSecs) : 0,
  };
}

export async function loadBreathCurriculum(
  supabase: Supabase,
): Promise<{ levels: BreathLevel[]; progress: BreathProgress }> {
  const [{ data }, progress] = await Promise.all([
    supabase.from("breath_levels").select(COLUMNS).order("level"),
    loadBreathProgress(supabase),
  ]);
  return { levels: ((data ?? []) as Row[]).map(toLevel), progress };
}

export async function loadBreathLevel(
  supabase: Supabase,
  slug: string,
): Promise<{ level: BreathLevel; progress: BreathProgress } | null> {
  const { data } = await supabase
    .from("breath_levels")
    .select(COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const progress = await loadBreathProgress(supabase);
  return { level: toLevel(data as Row), progress };
}
