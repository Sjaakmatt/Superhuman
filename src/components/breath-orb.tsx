"use client";

const GEEST = "var(--attr-geest)";

/**
 * De ademhalings-orb: één rustige bol die met de ademfase mee-ademt. Volg 'm
 * gewoon — groter = adem in, kleiner = adem uit. De overgang duurt precies zo
 * lang als de fase, dus de beweging ís de timing. Reduced-motion neutraliseert
 * de schaal-transitie (globals.css); de tekst + telling blijven leiden.
 */
export function BreathOrb({
  scale,
  transitionSecs,
  label,
  count,
  sub,
  color = GEEST,
}: {
  scale: number;
  transitionSecs: number;
  label: string;
  count?: number | null;
  sub?: string | null;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-2">
      <div className="relative flex size-64 items-center justify-center">
        {/* Statische ring als houvast */}
        <div
          aria-hidden
          className="absolute size-56 rounded-full border"
          style={{ borderColor: "color-mix(in srgb, var(--muted) 25%, transparent)" }}
        />
        {/* De ademende bol */}
        <div
          aria-hidden
          className="absolute size-52 rounded-full"
          style={{
            background: `radial-gradient(circle at 42% 36%, color-mix(in srgb, ${color} 60%, transparent), color-mix(in srgb, ${color} 14%, transparent) 72%)`,
            boxShadow: `0 0 60px -12px ${color}`,
            transform: `scale(${scale})`,
            transition: `transform ${transitionSecs}s ease-in-out`,
          }}
        />
        {/* Fase-tekst in het midden */}
        <div className="relative z-10 flex flex-col items-center text-center" aria-live="polite">
          <p className="text-lg font-medium">{label}</p>
          {count != null ? (
            <p className="font-mono text-5xl font-semibold tabular-nums" style={{ color }}>
              {count}
            </p>
          ) : null}
        </div>
      </div>
      {sub ? (
        <p className="font-mono text-xs text-muted" aria-live="polite">
          {sub}
        </p>
      ) : null}
    </div>
  );
}
