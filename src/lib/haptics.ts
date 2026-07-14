/**
 * Zachte haptiek (L7): een subtiele tik bij het voeden, een warmere puls
 * bij een level-up of afgeronde sessie. Respecteert prefers-reduced-motion
 * en doet niets als het apparaat geen trillingen ondersteunt.
 */

export type HapticKind = "tick" | "success" | "celebrate";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tick: 8,
  success: [12, 40, 12],
  celebrate: [16, 50, 16, 50, 24],
};

export function haptic(kind: HapticKind): void {
  if (typeof window === "undefined") return;
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // vibrate kan door de browser geblokkeerd zijn; stil negeren
  }
}
