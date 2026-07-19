/**
 * Meditatie-leerlijn (C2): types + ontgrendel-logica. Gated op consistentie
 * (X sessies van het vorige niveau). Puur en testbaar. Geen streak-shame.
 */

export interface MediaLink {
  provider: "audio" | "link" | "youtube";
  url: string;
  title: string;
}

export interface MeditationLevel {
  id: string;
  level: number;
  slug: string;
  name: string;
  oneLiner: string | null;
  instruction: string[];
  guidance: string | null;
  targetMin: number;
  unlock: { requires: { type: "sessions"; level: number; count: number }[] };
  media: MediaLink | null;
  xp: number;
  sort: number;
}

export interface MeditationProgress {
  sessionsByLevel: Record<number, number>;
  totalSessions: number;
  totalMinutes: number;
  longestSitMin: number;
}

export interface UnlockPart {
  label: string;
  have: number;
  need: number;
  done: boolean;
}

export interface UnlockStatus {
  unlocked: boolean;
  parts: UnlockPart[];
  remaining: string | null;
}

export function evaluateUnlock(
  level: MeditationLevel,
  progress: MeditationProgress,
): UnlockStatus {
  const parts: UnlockPart[] = (level.unlock.requires ?? []).map((req) => {
    const have = progress.sessionsByLevel[req.level] ?? 0;
    return {
      label: `${req.count}× niveau ${req.level}`,
      have,
      need: req.count,
      done: have >= req.count,
    };
  });
  const unlocked = parts.every((p) => p.done);
  const open = parts.filter((p) => !p.done);
  const remaining = unlocked
    ? null
    : open
        .map(
          (p) =>
            `${Math.max(0, p.need - p.have)}× niveau ${p.label.replace(/^\d+× niveau /, "")}`,
        )
        .join(" · ");
  return { unlocked, parts, remaining };
}

export function topReached(
  levels: MeditationLevel[],
  progress: MeditationProgress,
): boolean {
  if (levels.length === 0) return false;
  const top = levels.reduce((a, b) => (b.level > a.level ? b : a));
  const done = (progress.sessionsByLevel[top.level] ?? 0) > 0;
  return evaluateUnlock(top, progress).unlocked && done;
}
