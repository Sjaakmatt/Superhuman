import type { createClient } from "@/lib/supabase/server";
import type { MeditationLevel, MeditationProgress } from "./meditation";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const COLUMNS =
  "id, level, slug, name, one_liner, instruction, guidance, target_min, unlock, media, xp, sort";

interface Row {
  id: string;
  level: number;
  slug: string;
  name: string;
  one_liner: string | null;
  instruction: string[] | null;
  guidance: string | null;
  target_min: number;
  unlock: unknown;
  media: unknown;
  xp: number;
  sort: number;
}

function toLevel(r: Row): MeditationLevel {
  return {
    id: r.id,
    level: r.level,
    slug: r.slug,
    name: r.name,
    oneLiner: r.one_liner,
    instruction: r.instruction ?? [],
    guidance: r.guidance,
    targetMin: r.target_min,
    unlock: (r.unlock ?? { requires: [] }) as MeditationLevel["unlock"],
    media: (r.media ?? null) as MeditationLevel["media"],
    xp: r.xp,
    sort: r.sort,
  };
}

export async function loadMeditationProgress(
  supabase: Supabase,
): Promise<MeditationProgress> {
  const { data } = await supabase
    .from("meditation_sessions")
    .select("level, duration_sec");
  const rows = (data ?? []) as { level: number; duration_sec: number | null }[];
  const sessionsByLevel: Record<number, number> = {};
  let totalSec = 0;
  let longest = 0;
  for (const s of rows) {
    sessionsByLevel[s.level] = (sessionsByLevel[s.level] ?? 0) + 1;
    totalSec += s.duration_sec ?? 0;
    if ((s.duration_sec ?? 0) > longest) longest = s.duration_sec ?? 0;
  }
  return {
    sessionsByLevel,
    totalSessions: rows.length,
    totalMinutes: Math.round(totalSec / 60),
    longestSitMin: Math.round(longest / 60),
  };
}

export async function loadMeditationCurriculum(
  supabase: Supabase,
): Promise<{ levels: MeditationLevel[]; progress: MeditationProgress }> {
  const [{ data }, progress] = await Promise.all([
    supabase.from("meditation_levels").select(COLUMNS).order("level"),
    loadMeditationProgress(supabase),
  ]);
  return { levels: ((data ?? []) as Row[]).map(toLevel), progress };
}

export async function loadMeditationLevel(
  supabase: Supabase,
  slug: string,
): Promise<{ level: MeditationLevel; progress: MeditationProgress } | null> {
  const { data } = await supabase
    .from("meditation_levels")
    .select(COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const progress = await loadMeditationProgress(supabase);
  return { level: toLevel(data as Row), progress };
}
