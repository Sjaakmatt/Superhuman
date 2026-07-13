interface LivingCoreProps {
  /** Superhuman-level (afgerond gemiddelde van de zes attributen) */
  level: number;
  /** Dag-completion, 0..1 — stuurt hoe vol de kern gloeit */
  completion: number;
}

/**
 * De living core: een pulserende kern die voller en helderder gloeit
 * naarmate de dag completer is. Het ene bold element van de app.
 */
export function LivingCore({ level, completion }: LivingCoreProps) {
  const pct = Math.round(completion * 100);
  const glow = 0.25 + completion * 0.65;

  return (
    <div className="relative mx-auto flex size-52 items-center justify-center">
      {/* Aura */}
      <div
        aria-hidden
        className="absolute inset-2 rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(circle at 40% 35%, var(--attr-vitaliteit), var(--attr-soepel) 55%, var(--attr-geest) 100%)",
          animation: "core-pulse 4.5s ease-in-out infinite",
          ["--core-glow" as string]: glow,
        }}
      />
      {/* Kern */}
      <div
        className="relative flex size-40 flex-col items-center justify-center rounded-full border border-line"
        style={{
          background:
            "radial-gradient(circle at 38% 32%, var(--card-2), var(--ink-2) 75%)",
          boxShadow: `inset 0 0 32px -8px color-mix(in srgb, var(--attr-soepel) ${Math.round(
            30 + completion * 50,
          )}%, transparent)`,
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted">
          Superhuman
        </p>
        <p className="font-mono text-5xl font-semibold leading-tight">
          <span className="text-muted">L</span>
          {level}
        </p>
        <p className="font-mono text-xs text-muted">
          dag <span className="text-text">{pct}%</span>
        </p>
      </div>
    </div>
  );
}
