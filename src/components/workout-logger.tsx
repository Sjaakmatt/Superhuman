"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { completeWorkout } from "@/app/(app)/actions";
import type { RoutineExerciseRow, RoutineRow } from "@/lib/types";
import type { XpAward } from "@/lib/xp";
import { useToast } from "./toast";

interface WorkoutLoggerProps {
  routine: RoutineRow;
  exercises: RoutineExerciseRow[];
}

function formatSecs(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function WorkoutLogger({ routine, exercises }: WorkoutLoggerProps) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [award, setAward] = useState<XpAward | null>(null);
  const submittedRef = useRef(false);
  const [pending, startTransition] = useTransition();
  const { showAward, showMessage } = useToast();

  useEffect(() => {
    if (!started || finished) return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [started, finished]);

  function toggle(position: number) {
    if (!started) setStarted(true);
    setDone((d) => {
      const next = new Set(d);
      if (next.has(position)) next.delete(position);
      else next.add(position);
      return next;
    });
  }

  function finish() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setFinished(true);
    startTransition(async () => {
      const result = await completeWorkout({
        routineId: routine.id,
        durationSecs: elapsed || undefined,
      });
      if (result.error) {
        showMessage(result.error);
        return;
      }
      setAward(result.award);
      showAward(result.award);
    });
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-card p-8 text-center">
        <span
          aria-hidden
          className="size-3 rounded-full"
          style={{
            background: "var(--attr-kracht)",
            boxShadow: "0 0 16px var(--attr-kracht)",
          }}
        />
        <div>
          <h2 className="text-lg font-semibold">Workout gelogd</h2>
          <p className="mt-1 font-mono text-sm text-muted">
            {routine.name}
            {elapsed > 0 ? ` · ${formatSecs(elapsed)}` : ""}
            {award
              ? ` · +${award.amount} XP · Kracht`
              : pending
                ? ""
                : " · XP van vandaag al binnen"}
          </p>
        </div>
        <Link
          href="/vandaag"
          className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
        >
          Terug naar Vandaag
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
        <p className="text-sm text-muted">
          {done.size}/{exercises.length} oefeningen
        </p>
        <p className="font-mono text-sm" aria-label="Verstreken tijd">
          {formatSecs(elapsed)}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {exercises.map((row) => {
          const checked = done.has(row.position);
          const meta = [
            row.sets && row.reps ? `${row.sets} × ${row.reps}` : null,
            row.secs ? `${row.secs}s` : null,
            row.exercises?.muscle_group ?? null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={row.position}>
              <button
                type="button"
                onClick={() => toggle(row.position)}
                aria-pressed={checked}
                className={`flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-3 text-left transition-opacity ${
                  checked ? "opacity-50" : ""
                }`}
              >
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line"
                >
                  {checked ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="var(--attr-kracht)"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 8.5 6.5 12 13 4.5" />
                    </svg>
                  ) : (
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: "var(--attr-kracht)" }}
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm ${checked ? "line-through" : ""}`}
                  >
                    {row.exercises?.name ?? "Onbekende oefening"}
                  </span>
                  <span className="block text-xs text-muted">{meta}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={finish}
        disabled={pending || done.size === 0}
        className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Workout afronden
      </button>
    </div>
  );
}
