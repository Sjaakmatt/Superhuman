"use client";

import { useState, useTransition } from "react";
import { addCalorieItem, deleteCalorieItem } from "@/app/(app)/actions";
import type { CalorieLogRow } from "@/lib/types";
import { useToast } from "./toast";

export function CalorieTracker({ items }: { items: CalorieLogRow[] }) {
  const [item, setItem] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [pending, startTransition] = useTransition();
  const { showMessage } = useToast();

  const totals = items.reduce(
    (acc, row) => ({
      kcal: acc.kcal + (row.calories ?? 0),
      protein: acc.protein + (row.protein ?? 0),
    }),
    { kcal: 0, protein: 0 },
  );

  function submit() {
    if (!item.trim()) return;
    startTransition(async () => {
      const result = await addCalorieItem({
        item,
        calories: Number(calories) || 0,
        protein: Number(protein) || undefined,
      });
      if (result.error) {
        showMessage(result.error);
        return;
      }
      setItem("");
      setCalories("");
      setProtein("");
    });
  }

  function remove(id: number) {
    startTransition(async () => {
      const result = await deleteCalorieItem(id);
      if (result.error) showMessage(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between rounded-2xl border border-line bg-card px-4 py-3">
        <p className="text-sm text-muted">Vandaag</p>
        <p className="font-mono text-sm">
          {totals.kcal} kcal
          {totals.protein > 0 ? (
            <span className="text-muted"> · {totals.protein}g eiwit</span>
          ) : null}
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
        <input
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder="Wat heb je gegeten?"
          aria-label="Omschrijving"
          className="rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-sm text-text placeholder:text-muted/60"
        />
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="kcal"
            aria-label="Calorieën"
            className="w-24 rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-center font-mono text-sm text-text placeholder:text-muted/60"
          />
          <input
            type="number"
            min={0}
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            placeholder="eiwit (g)"
            aria-label="Eiwit in gram"
            className="w-28 rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-center font-mono text-sm text-text placeholder:text-muted/60"
          />
          <button
            type="button"
            onClick={submit}
            disabled={pending || !item.trim()}
            className="flex-1 rounded-lg bg-text px-3 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Log
          </button>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((row) => (
          <li
            key={row.id}
            className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3"
          >
            <span className="min-w-0 flex-1 text-sm">{row.item}</span>
            <span className="font-mono text-xs text-muted">
              {row.calories ?? 0} kcal
              {row.protein ? ` · ${row.protein}g` : ""}
            </span>
            <button
              type="button"
              onClick={() => remove(row.id)}
              disabled={pending}
              aria-label={`${row.item} verwijderen`}
              className="size-8 shrink-0 rounded-full border border-line text-muted transition-colors hover:text-text"
            >
              ×
            </button>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Nog niets gelogd vandaag.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
