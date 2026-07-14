"use client";

import { useEffect, useState, useTransition } from "react";
import { addWater } from "@/app/(app)/actions";
import { hydrationTarget } from "@/lib/nutrition";
import { useToast } from "./toast";

const VITAL = "var(--attr-vitaliteit)";

function useNowMin(timezone: string): number | null {
  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    const compute = () => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(new Date());
      const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
      const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
      setNowMin((h % 24) * 60 + m);
    };
    compute();
    const timer = setInterval(compute, 60_000);
    return () => clearInterval(timer);
  }, [timezone]);
  return nowMin;
}

export function HydrationDay({
  timezone,
  glasses,
  goal,
}: {
  timezone: string;
  glasses: number;
  goal: number;
}) {
  const nowMin = useNowMin(timezone);
  const [pending, startTransition] = useTransition();
  const { showAward, showMessage } = useToast();

  const target = nowMin !== null ? hydrationTarget(nowMin, goal) : 0;
  const behind = Math.max(0, target - glasses);

  let nudge = "Mooi op schema — blijf slokken nemen.";
  if (glasses >= goal) nudge = "Dagdoel gehaald. Sterk.";
  else if (behind >= 2) nudge = `Je loopt ${behind} glazen achter. Neem er nu een.`;
  else if (nowMin !== null && target === 0) nudge = "De dag begint — start met een glas.";

  function log(delta: 1 | -1) {
    startTransition(async () => {
      const result = await addWater(delta);
      if (result.error) showMessage(result.error);
      else showAward(result.award);
    });
  }

  return (
    <section
      aria-label="Hydratatie"
      className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ background: VITAL, boxShadow: `0 0 8px ${VITAL}` }}
        />
        <p className="min-w-0 flex-1 text-sm font-medium">Hydratatie</p>
        <p className="font-mono text-sm text-muted">
          <span className="text-text">{glasses}</span>/{goal}
        </p>
      </div>

      {/* Balkjes met streep op het doel-tot-nu */}
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: goal }, (_, i) => (
          <span
            key={i}
            className="relative h-2 flex-1 rounded-full"
            style={{
              background: i < glasses ? VITAL : "var(--line)",
              outline:
                nowMin !== null && i === target - 1
                  ? `1px solid ${VITAL}`
                  : undefined,
              outlineOffset: 1,
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-xs text-muted">{nudge}</p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => log(-1)}
            disabled={pending || glasses === 0}
            aria-label="Glas verwijderen"
            className="size-9 rounded-full border border-line text-muted transition-colors hover:text-text disabled:opacity-40"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => log(1)}
            disabled={pending}
            aria-label="Glas water toevoegen"
            className="size-9 rounded-full border border-line font-semibold text-text transition-colors hover:border-muted disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
    </section>
  );
}
