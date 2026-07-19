/**
 * Ademwerk-curriculum (C0): types + ontgrendel-logica. Puur en testbaar —
 * de gating bepaalt welke niveaus open zijn op basis van gelogde sessies en
 * BOLT-metingen. Geen streak-shame: we tonen "nog X te gaan", nooit falen.
 */

export type BreathMode = "paced" | "bolt" | "rounds" | "follow";

export interface BreathPhase {
  label: string;
  secs: number;
  scale: number;
}

export interface BreathConfig {
  phases?: BreathPhase[];
  durationMin?: number;
  cycles?: number;
  activePhases?: BreathPhase[];
  activeSec?: number;
  activeBreaths?: number;
  rounds?: number;
  retention?: boolean;
  recoveryHoldSec?: number;
}

export interface BreathMedia {
  provider: "youtube" | "link" | "audio";
  url: string;
  title: string;
}

export type UnlockReq =
  | { type: "sessions"; level: number; count: number }
  | { type: "bolt_count"; count: number }
  | { type: "bolt_min"; min: number };

export interface BreathLevel {
  id: string;
  level: number;
  slug: string;
  name: string;
  oneLiner: string | null;
  track: "kalmerend" | "brug" | "zwaar";
  mode: BreathMode;
  setup: string[];
  execution: string[];
  breathing: string | null;
  mistakes: string[];
  prescription: string | null;
  config: BreathConfig;
  unlock: { requires: UnlockReq[] };
  needsSafetyAck: boolean;
  media: BreathMedia | null;
  xp: number;
  sort: number;
}

export interface BreathProgress {
  /** Aantal gelogde sessies per niveau. */
  sessionsByLevel: Record<number, number>;
  /** Aantal BOLT-metingen. */
  boltCount: number;
  /** Hoogste gemeten BOLT (seconden). */
  boltMax: number;
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
  /** Korte "nog X te gaan"-regel, of null als ontgrendeld. */
  remaining: string | null;
}

/** Beoordeel of een niveau ontgrendeld is, met de resterende drempels. */
export function evaluateUnlock(
  level: BreathLevel,
  progress: BreathProgress,
): UnlockStatus {
  const parts: UnlockPart[] = (level.unlock.requires ?? []).map((req) => {
    if (req.type === "sessions") {
      const have = progress.sessionsByLevel[req.level] ?? 0;
      return {
        label: `${req.count}× niveau ${req.level} doen`,
        have,
        need: req.count,
        done: have >= req.count,
      };
    }
    if (req.type === "bolt_count") {
      return {
        label: `${req.count} BOLT-metingen`,
        have: progress.boltCount,
        need: req.count,
        done: progress.boltCount >= req.count,
      };
    }
    // bolt_min
    return {
      label: `BOLT ≥ ${req.min}s`,
      have: progress.boltMax,
      need: req.min,
      done: progress.boltMax >= req.min,
    };
  });

  const unlocked = parts.every((p) => p.done);
  const open = parts.filter((p) => !p.done);
  const remaining = unlocked
    ? null
    : open
        .map((p) =>
          p.label.startsWith("BOLT ≥")
            ? p.label
            : `${Math.max(0, p.need - p.have)}× ${p.label.replace(/^\d+× /, "")}`,
        )
        .join(" · ");

  return { unlocked, parts, remaining };
}

/** Het hoogst-ontgrendelde niveau (voor "waar sta ik"). */
export function highestUnlocked(
  levels: BreathLevel[],
  progress: BreathProgress,
): number {
  let max = 1;
  for (const lvl of levels) {
    if (evaluateUnlock(lvl, progress).unlocked) max = Math.max(max, lvl.level);
  }
  return max;
}
