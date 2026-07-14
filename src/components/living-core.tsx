import type { EvolutionStage } from "@/lib/evolution";
import { withAlpha } from "@/lib/evolution";

interface LivingCoreProps {
  totalXp: number;
  /** 0..1 — gemiddeld momentum; stuurt ademsnelheid en helderheid */
  vitality: number;
  stage: EvolutionStage;
  size?: number;
}

/**
 * De levende core (LivingOS): vorm, deeltjes en gloed komen uit de
 * evolutie-stage; ademsnelheid en helderheid schalen met vitaliteit.
 * Levendig = sneller en feller; laag = trager en ontzadigd.
 */
export function LivingCore({
  totalXp,
  vitality,
  stage,
  size = 190,
}: LivingCoreProps) {
  const breath = 5.2 - vitality * 2.6; // seconden per ademhaling
  const spin = 18 - vitality * 8;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Aura */}
      <div
        aria-hidden
        className="absolute -inset-2.5 rounded-full"
        style={{
          background: `radial-gradient(circle, ${withAlpha(stage.hue, (0.4 + vitality) * 0.157)}, transparent 68%)`,
          animation: `core-breath ${breath}s ease-in-out infinite`,
          opacity: 0.5 + vitality * 0.5,
        }}
      />
      {/* Draaiende deeltjes = evolutie */}
      {stage.particles > 0 ? (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ animation: `core-spin ${spin}s linear infinite` }}
        >
          {Array.from({ length: stage.particles }).map((_, i) => {
            const angle = (i / stage.particles) * Math.PI * 2;
            const radius = size / 2 - 6 - (i % stage.rings) * 16;
            return (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 size-1.5 rounded-full"
                style={{
                  background: stage.hue,
                  boxShadow: `0 0 8px ${stage.hue}`,
                  transform: `translate(-50%,-50%) rotate(${angle}rad) translateX(${radius}px)`,
                  opacity: 0.4 + vitality * 0.6,
                }}
              />
            );
          })}
        </div>
      ) : null}
      {/* Kern */}
      <div
        className="flex flex-col items-center justify-center rounded-full"
        style={{
          width: size * 0.61,
          height: size * 0.61,
          background: `radial-gradient(circle at 38% 32%, #EFE7FF, ${stage.hue} 46%, #241B3E 100%)`,
          boxShadow: `0 0 ${26 + vitality * 60}px ${withAlpha(stage.hue, stage.glow * 0.47)}, inset 0 0 26px rgba(255,255,255,.16)`,
          animation: `core-breath ${breath}s ease-in-out infinite`,
          filter: vitality < 0.25 ? "saturate(.6) brightness(.85)" : "none",
          transition: "filter 1s ease",
        }}
      >
        <p className="font-mono text-xs tracking-[0.2em] text-[#EEE6FF]/85">
          {totalXp}
        </p>
        <p className="text-[10px] tracking-widest text-[#EEE6FF]/70">XP</p>
      </div>
    </div>
  );
}
