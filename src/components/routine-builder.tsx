"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createRoutine } from "@/app/(app)/actions";
import type { ExerciseRow } from "@/lib/types";
import { useToast } from "./toast";

interface RoutineExerciseDraft {
  exerciseId: number;
  sets: number;
  reps: number;
}

export function RoutineBuilder({ exercises }: { exercises: ExerciseRow[] }) {
  const [name, setName] = useState("");
  const [rows, setRows] = useState<RoutineExerciseDraft[]>([]);
  const [pending, startTransition] = useTransition();
  const { showMessage } = useToast();
  const router = useRouter();

  function addRow() {
    const first = exercises[0];
    if (!first) return;
    setRows((r) => [
      ...r,
      { exerciseId: first.id, sets: 3, reps: first.reps ?? 10 },
    ]);
  }

  function updateRow(index: number, patch: Partial<RoutineExerciseDraft>) {
    setRows((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((r) => r.filter((_, i) => i !== index));
  }

  function save() {
    startTransition(async () => {
      const result = await createRoutine({
        name,
        kind: "workout",
        exercises: rows.map((r) => ({
          exerciseId: r.exerciseId,
          sets: r.sets,
          reps: r.reps,
        })),
      });
      if (result.error) {
        showMessage(result.error);
        return;
      }
      showMessage("Routine opgeslagen.");
      router.push("/beweging");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">Naam</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bijv. Full body A"
          className="rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-text placeholder:text-muted/60"
        />
      </label>

      <ul className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <li
            key={i}
            className="flex items-center gap-2 rounded-2xl border border-line bg-card p-3"
          >
            <select
              value={row.exerciseId}
              onChange={(e) => updateRow(i, { exerciseId: Number(e.target.value) })}
              aria-label="Oefening"
              className="min-w-0 flex-1 rounded-lg border border-line bg-ink-2 px-2 py-2 text-sm text-text"
            >
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={row.sets}
              onChange={(e) => updateRow(i, { sets: Number(e.target.value) })}
              aria-label="Sets"
              className="w-14 rounded-lg border border-line bg-ink-2 px-2 py-2 text-center font-mono text-sm text-text"
            />
            <span className="text-xs text-muted">×</span>
            <input
              type="number"
              min={1}
              value={row.reps}
              onChange={(e) => updateRow(i, { reps: Number(e.target.value) })}
              aria-label="Reps"
              className="w-14 rounded-lg border border-line bg-ink-2 px-2 py-2 text-center font-mono text-sm text-text"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              aria-label="Oefening verwijderen"
              className="size-8 shrink-0 rounded-full border border-line text-muted transition-colors hover:text-text"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addRow}
        className="rounded-2xl border border-dashed border-line p-3 text-sm text-muted transition-colors hover:text-text"
      >
        + Oefening toevoegen
      </button>

      <button
        type="button"
        onClick={save}
        disabled={pending || !name.trim() || rows.length === 0}
        className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Routine opslaan
      </button>
    </div>
  );
}
