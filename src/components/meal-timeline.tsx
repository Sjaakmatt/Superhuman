"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  activeMeal,
  MEAL_WINDOWS,
  mealStatus,
  minToTime,
  type MealStatus,
  type MealType,
} from "@/lib/nutrition";

const VOEDING = "var(--attr-voeding)";

export interface PlannedMeal {
  mealType: MealType;
  recipeName: string | null;
  targetMin: number | null;
}

/** Huidige minuut-na-middernacht in een tijdzone; tikt elke minuut. */
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

const STATUS_LABEL: Record<MealStatus, string> = {
  gehad: "gehad",
  nu: "nu",
  straks: "straks",
};

export function MealTimeline({
  timezone,
  meals,
}: {
  timezone: string;
  meals: PlannedMeal[];
}) {
  const nowMin = useNowMin(timezone);
  const byType = new Map(meals.map((m) => [m.mealType, m]));

  // Nu-regel: het actieve venster + wat er gepland staat
  let nowLine = "Plan je maaltijden om sturing over de dag te krijgen.";
  if (nowMin !== null) {
    const active = activeMeal(nowMin);
    if (active) {
      const planned = byType.get(active.type);
      const status = mealStatus(nowMin, active);
      const timeStr = minToTime(active.target);
      if (status === "nu") {
        nowLine = planned?.recipeName
          ? `Nu — ${active.label.toLowerCase()}-venster: ${planned.recipeName}.`
          : `${active.label}-venster is open. Eet iets met eiwit.`;
      } else {
        nowLine = planned?.recipeName
          ? `Straks: ${active.label.toLowerCase()} om ${timeStr} — ${planned.recipeName}.`
          : `Straks: ${active.label.toLowerCase()}-venster om ${timeStr}.`;
      }
    } else {
      nowLine = "De dag zit erop. Rond rustig af en hydrateer nog wat.";
    }
  }

  return (
    <section aria-label="Maaltijden vandaag" className="flex flex-col gap-3">
      <div
        className="rounded-2xl border bg-card px-4 py-3"
        style={{ borderLeft: `3px solid ${VOEDING}` }}
      >
        <p className="text-sm leading-relaxed">{nowLine}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {MEAL_WINDOWS.map((w) => {
          const planned = byType.get(w.type);
          const targetMin = planned?.targetMin ?? w.target;
          const status = nowMin !== null ? mealStatus(nowMin, w) : "straks";
          const isNow = status === "nu";
          return (
            <li key={w.type}>
              <Link
                href="/voeding/plan"
                className={`flex items-center gap-3 rounded-2xl border bg-card p-3.5 transition-opacity ${
                  status === "gehad" ? "opacity-55" : ""
                }`}
                style={{ borderColor: isNow ? VOEDING : "var(--line)" }}
              >
                <span className="w-12 shrink-0 font-mono text-xs text-muted">
                  {minToTime(targetMin)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{w.label}</span>
                  <span className="block text-xs text-muted">
                    {planned?.recipeName ?? "Niets gepland"}
                  </span>
                </span>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider"
                  style={{
                    color: isNow ? VOEDING : "var(--muted)",
                    background: isNow
                      ? `color-mix(in srgb, ${VOEDING} 12%, transparent)`
                      : "transparent",
                  }}
                >
                  {STATUS_LABEL[status]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
