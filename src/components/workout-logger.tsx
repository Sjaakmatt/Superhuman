"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { completeWorkout } from "@/app/(app)/actions";
import type { LoggedExerciseSets } from "@/lib/types";
import type { XpAward } from "@/lib/xp";
import { useToast } from "./toast";

/** Serialiseerbare oefening voor de logger (server stelt dit samen). */
export interface PlanExercise {
  position: number;
  exerciseId: number;
  name: string;
  muscleGroup: string | null;
  targetSets: number;
  targetReps: number | null;
  holdSecs: number | null;
  tempoText: string | null;
  cue: string | null;
  commonMistake: string | null;
  restSecs: number;
  /** Reps van de vorige keer (progressive overload) */
  lastReps: number[] | null;
}

interface WorkoutLoggerProps {
  routineId: number;
  routineName: string;
  plan: PlanExercise[];
}

interface SetState {
  reps: number;
  done: boolean;
}

const KRACHT = "var(--attr-kracht)";

function formatSecs(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function WorkoutLogger({
  routineId,
  routineName,
  plan,
}: WorkoutLoggerProps) {
  // Sets per oefening; reps voorgevuld met vorige-keer +1 of het doel
  const [sets, setSets] = useState<Record<number, SetState[]>>(() =>
    Object.fromEntries(
      plan.map((ex) => {
        const suggested =
          ex.lastReps && ex.lastReps.length > 0
            ? Math.max(...ex.lastReps) + 1
            : (ex.targetReps ?? 10);
        return [
          ex.exerciseId,
          Array.from({ length: ex.targetSets }, () => ({
            reps: suggested,
            done: false,
          })),
        ];
      }),
    ),
  );
  const [activeIdx, setActiveIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [award, setAward] = useState<XpAward | null>(null);
  const [rest, setRest] = useState<{ secs: number; label: string } | null>(
    null,
  );
  const submittedRef = useRef(false);
  const [pending, startTransition] = useTransition();
  const { showAward, showMessage } = useToast();

  // Sessieklok
  useEffect(() => {
    if (!started || finished) return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [started, finished]);

  // Rust-afteller tussen sets
  useEffect(() => {
    if (!rest) return;
    const timer = setInterval(() => {
      setRest((r) => (r && r.secs > 1 ? { ...r, secs: r.secs - 1 } : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [rest]);

  function markSet(ex: PlanExercise, setIdx: number) {
    if (!started) setStarted(true);
    setSets((prev) => {
      const rows = prev[ex.exerciseId].map((s, i) =>
        i === setIdx ? { ...s, done: !s.done } : s,
      );
      return { ...prev, [ex.exerciseId]: rows };
    });

    const wasDone = sets[ex.exerciseId][setIdx].done;
    if (!wasDone) {
      const setsLeft = ex.targetSets - (setIdx + 1);
      if (setsLeft > 0 && ex.restSecs > 0) {
        setRest({
          secs: ex.restSecs,
          label: `Rust ${ex.restSecs}s · volgende: set ${setIdx + 2} van ${ex.targetSets}`,
        });
      } else if (setsLeft === 0) {
        setRest(null);
        // Volgende oefening openklappen
        const nextIdx = plan.findIndex(
          (p, i) => i > activeIdx && !allDone(sets, p, ex.exerciseId, setIdx),
        );
        if (nextIdx !== -1) setActiveIdx(nextIdx);
      }
    }
  }

  function updateReps(exerciseId: number, setIdx: number, reps: number) {
    setSets((prev) => ({
      ...prev,
      [exerciseId]: prev[exerciseId].map((s, i) =>
        i === setIdx ? { ...s, reps } : s,
      ),
    }));
  }

  const doneCount = plan.filter((ex) =>
    sets[ex.exerciseId].every((s) => s.done),
  ).length;

  function finish() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setFinished(true);
    const payload: LoggedExerciseSets[] = plan
      .map((ex) => ({
        exercise_id: ex.exerciseId,
        name: ex.name,
        sets: sets[ex.exerciseId]
          .filter((s) => s.done)
          .map((s) => ({ reps: s.reps })),
      }))
      .filter((e) => e.sets.length > 0);
    startTransition(async () => {
      const result = await completeWorkout({
        routineId,
        durationSecs: elapsed || undefined,
        sets: payload,
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
    const totalSets = plan.reduce(
      (sum, ex) => sum + sets[ex.exerciseId].filter((s) => s.done).length,
      0,
    );
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-card p-8 text-center">
        <span
          aria-hidden
          className="size-3 rounded-full"
          style={{ background: KRACHT, boxShadow: `0 0 16px ${KRACHT}` }}
        />
        <div>
          <h2 className="text-lg font-semibold">Workout gelogd</h2>
          <p className="mt-1 font-mono text-sm text-muted">
            {routineName} · {totalSets} sets
            {elapsed > 0 ? ` · ${formatSecs(elapsed)}` : ""}
            {award
              ? ` · +${award.amount} XP · Kracht`
              : pending
                ? ""
                : " · XP van vandaag al binnen"}
          </p>
        </div>
        <p className="max-w-[280px] text-sm text-muted">
          Sterk gewerkt. Volgende keer bouw je hierop verder.
        </p>
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
          {doneCount}/{plan.length} oefeningen
        </p>
        <p className="font-mono text-sm" aria-label="Verstreken tijd">
          {formatSecs(elapsed)}
        </p>
      </div>

      {/* Rust-afteller — koel accent */}
      {rest ? (
        <div
          className="rounded-2xl border px-4 py-3 text-center"
          style={{
            borderColor: "var(--calm)",
            background: "color-mix(in srgb, var(--calm) 8%, transparent)",
          }}
          aria-live="polite"
        >
          <p
            className="font-mono text-2xl font-semibold"
            style={{ color: "var(--calm)" }}
          >
            {rest.secs}s
          </p>
          <p className="mt-0.5 text-xs text-muted">{rest.label}</p>
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {plan.map((ex, idx) => {
          const rows = sets[ex.exerciseId];
          const exDone = rows.every((s) => s.done);
          const active = idx === activeIdx;
          return (
            <li
              key={ex.exerciseId}
              className={`rounded-2xl border bg-card transition-opacity ${
                exDone ? "opacity-60" : ""
              }`}
              style={{ borderColor: active ? KRACHT : "var(--line)" }}
            >
              <button
                type="button"
                onClick={() => setActiveIdx(idx)}
                className="flex w-full items-center gap-3 p-3.5 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-medium ${exDone ? "line-through" : ""}`}
                  >
                    {ex.name}
                  </span>
                  <span className="block font-mono text-xs text-muted">
                    {ex.targetSets} × {ex.targetReps ?? `${ex.holdSecs}s`}
                    {ex.tempoText ? ` · tempo ${ex.tempoText.split(" · ")[0]}` : ""}
                  </span>
                </span>
                {ex.lastReps && ex.lastReps.length > 0 ? (
                  <span className="shrink-0 text-right font-mono text-[10px] text-muted">
                    vorige keer
                    <br />
                    {ex.lastReps.join("·")}
                  </span>
                ) : null}
              </button>

              {active ? (
                <div className="flex flex-col gap-3 border-t border-line px-3.5 pb-3.5 pt-3">
                  {ex.tempoText ? (
                    <p className="text-xs text-muted">{ex.tempoText}</p>
                  ) : null}
                  {ex.cue ? <p className="text-xs">{ex.cue}</p> : null}
                  {ex.commonMistake ? (
                    <p className="text-xs text-muted">
                      <span className="text-text">Let op:</span>{" "}
                      {ex.commonMistake}
                    </p>
                  ) : null}

                  <div className="flex flex-col gap-1.5">
                    {rows.map((set, setIdx) => (
                      <div key={setIdx} className="flex items-center gap-2">
                        <span className="w-12 font-mono text-xs text-muted">
                          set {setIdx + 1}
                        </span>
                        {ex.targetReps != null ? (
                          <input
                            type="number"
                            min={0}
                            value={set.reps}
                            onChange={(e) =>
                              updateReps(
                                ex.exerciseId,
                                setIdx,
                                Number(e.target.value),
                              )
                            }
                            aria-label={`Reps set ${setIdx + 1}`}
                            className="w-16 rounded-lg border border-line bg-ink-2 px-2 py-1.5 text-center font-mono text-sm text-text"
                          />
                        ) : (
                          <span className="w-16 text-center font-mono text-sm text-muted">
                            {ex.holdSecs}s
                          </span>
                        )}
                        <span className="text-xs text-muted">reps</span>
                        <button
                          type="button"
                          onClick={() => markSet(ex, setIdx)}
                          aria-pressed={set.done}
                          className="ml-auto rounded-lg border px-3 py-1.5 text-xs transition-colors"
                          style={
                            set.done
                              ? {
                                  borderColor: KRACHT,
                                  background: `color-mix(in srgb, ${KRACHT} 12%, transparent)`,
                                  color: "var(--text)",
                                }
                              : { borderColor: "var(--line)", color: "var(--muted)" }
                          }
                        >
                          {set.done ? "✓ klaar" : "klaar"}
                        </button>
                      </div>
                    ))}
                  </div>

                  {ex.lastReps && ex.lastReps.length > 0 ? (
                    <p className="text-[11px] text-muted">
                      Vorige keer {ex.lastReps.join(", ")} reps — mik op +1 rep of
                      zwaarder.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={finish}
        disabled={pending || doneCount === 0}
        className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Workout afronden
      </button>
    </div>
  );
}

function allDone(
  sets: Record<number, SetState[]>,
  ex: PlanExercise,
  justMarkedId: number,
  justMarkedIdx: number,
): boolean {
  return sets[ex.exerciseId].every((s, i) =>
    ex.exerciseId === justMarkedId && i === justMarkedIdx ? true : s.done,
  );
}
