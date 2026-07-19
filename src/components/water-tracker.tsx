"use client";

import { useOptimistic, useTransition } from "react";
import { addWater } from "@/app/(app)/actions";
import { useToast } from "./toast";

interface WaterTrackerProps {
  glasses: number;
  goal: number;
}

export function WaterTracker({ glasses, goal }: WaterTrackerProps) {
  const [, startTransition] = useTransition();
  const { showAward, showMessage } = useToast();
  // Optimistisch: het glas telt direct, de server synct op de achtergrond.
  const [optimisticGlasses, addOptimistic] = useOptimistic(
    glasses,
    (state, delta: number) => Math.max(0, state + delta),
  );

  function log(delta: 1 | -1) {
    startTransition(async () => {
      addOptimistic(delta);
      const result = await addWater(delta);
      if (result.error) showMessage(result.error);
      else showAward(result.award);
    });
  }

  return (
    <section
      aria-label="Watertracker"
      className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4"
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{
          background: "var(--attr-vitaliteit)",
          boxShadow: "0 0 8px var(--attr-vitaliteit)",
        }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm">Water</p>
        <div className="mt-1.5 flex gap-1" aria-hidden>
          {Array.from({ length: goal }, (_, i) => (
            <span
              key={i}
              className="h-1.5 flex-1 rounded-full transition-colors"
              style={{
                background:
                  i < optimisticGlasses
                    ? "var(--attr-vitaliteit)"
                    : "var(--line)",
              }}
            />
          ))}
        </div>
      </div>
      <p className="font-mono text-sm text-muted">
        <span className="text-text">{optimisticGlasses}</span>/{goal}
      </p>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => log(-1)}
          disabled={optimisticGlasses === 0}
          aria-label="Glas water verwijderen"
          className="size-9 rounded-full border border-line text-muted transition-colors hover:text-text disabled:opacity-40"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => log(1)}
          aria-label="Glas water toevoegen"
          className="size-9 rounded-full border border-line font-semibold text-text transition-colors hover:border-muted"
        >
          +
        </button>
      </div>
    </section>
  );
}
