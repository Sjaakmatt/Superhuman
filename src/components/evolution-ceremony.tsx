"use client";

import { useEffect, useState, useTransition } from "react";
import { ackStage } from "@/app/(app)/actions";
import type { EvolutionStage } from "@/lib/evolution";
import { haptic } from "@/lib/haptics";
import { LivingCore } from "./living-core";

interface EvolutionCeremonyProps {
  stage: EvolutionStage;
  totalXp: number;
}

/**
 * Full-screen evolutie-moment: verschijnt zodra het totaal-XP een nieuwe
 * stage passeert, en precies één keer (bevestigd via ack_stage).
 */
export function EvolutionCeremony({ stage, totalXp }: EvolutionCeremonyProps) {
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();

  // Eén warme puls bij het verschijnen van de ceremonie
  useEffect(() => {
    haptic("celebrate");
  }, []);

  if (dismissed) return null;

  function close() {
    setDismissed(true);
    startTransition(async () => {
      await ackStage(stage.ordinal);
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Evolutie: ${stage.name}`}
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[rgba(6,5,12,.92)] px-6 backdrop-blur-md"
    >
      <div
        className="flex flex-col items-center"
        style={{ animation: "evo-in .9s cubic-bezier(.2,.8,.3,1)" }}
      >
        <p
          className="font-mono text-xs tracking-[0.4em]"
          style={{ color: stage.hue }}
        >
          EVOLUTIE
        </p>
        <div className="my-6">
          <LivingCore totalXp={totalXp} vitality={1} stage={stage} />
        </div>
        <p
          className="bg-clip-text text-3xl font-extrabold text-transparent"
          style={{
            backgroundImage: `linear-gradient(90deg, ${stage.hue}, #EFE7FF)`,
          }}
        >
          {stage.name}
        </p>
        <p className="mt-2.5 max-w-[300px] text-center text-sm leading-relaxed text-muted">
          {stage.line}
        </p>
        <button
          type="button"
          onClick={close}
          disabled={pending}
          className="mt-8 rounded-full border px-8 py-3 text-sm font-bold text-text transition-opacity hover:opacity-90"
          style={{
            borderColor: stage.hue,
            background: `color-mix(in srgb, ${stage.hue} 13%, transparent)`,
          }}
        >
          Verder
        </button>
      </div>
    </div>
  );
}
