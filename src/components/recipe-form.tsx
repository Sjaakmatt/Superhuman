"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createRecipe } from "@/app/(app)/actions";
import { useToast } from "./toast";

interface IngredientDraft {
  name: string;
  qty: string;
  unit: string;
}

export function RecipeForm() {
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([
    { name: "", qty: "", unit: "" },
  ]);
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [instructions, setInstructions] = useState("");
  const [pending, startTransition] = useTransition();
  const { showMessage } = useToast();
  const router = useRouter();

  function updateIngredient(index: number, patch: Partial<IngredientDraft>) {
    setIngredients((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function save() {
    startTransition(async () => {
      const result = await createRecipe({
        name,
        ingredients: ingredients
          .filter((i) => i.name.trim())
          .map((i) => ({
            name: i.name.trim(),
            qty: i.qty ? Number(i.qty) : null,
            unit: i.unit.trim() || null,
          })),
        calories: Number(calories) || undefined,
        protein: Number(protein) || undefined,
        instructions,
      });
      if (result.error) {
        showMessage(result.error);
        return;
      }
      showMessage("Recept opgeslagen.");
      router.push("/voeding/recepten");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">Naam</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bijv. Kip-teriyaki bowl"
          className="rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-text placeholder:text-muted/60"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm text-muted">Ingrediënten</legend>
        {ingredients.map((row, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={row.name}
              onChange={(e) => updateIngredient(i, { name: e.target.value })}
              placeholder="Ingrediënt"
              aria-label="Ingrediënt"
              className="min-w-0 flex-1 rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-text placeholder:text-muted/60"
            />
            <input
              type="number"
              min={0}
              value={row.qty}
              onChange={(e) => updateIngredient(i, { qty: e.target.value })}
              placeholder="hoev."
              aria-label="Hoeveelheid"
              className="w-20 rounded-lg border border-line bg-ink-2 px-2 py-2 text-center font-mono text-sm text-text placeholder:text-muted/60"
            />
            <input
              value={row.unit}
              onChange={(e) => updateIngredient(i, { unit: e.target.value })}
              placeholder="eenheid"
              aria-label="Eenheid"
              className="w-20 rounded-lg border border-line bg-ink-2 px-2 py-2 text-sm text-text placeholder:text-muted/60"
            />
            <button
              type="button"
              onClick={() =>
                setIngredients((rows) => rows.filter((_, idx) => idx !== i))
              }
              disabled={ingredients.length === 1}
              aria-label="Ingrediënt verwijderen"
              className="size-9 shrink-0 rounded-full border border-line text-muted transition-colors hover:text-text disabled:opacity-40"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setIngredients((rows) => [...rows, { name: "", qty: "", unit: "" }])
          }
          className="rounded-2xl border border-dashed border-line p-2.5 text-sm text-muted transition-colors hover:text-text"
        >
          + Ingrediënt
        </button>
      </fieldset>

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1.5 text-sm">
          <span className="text-muted">kcal (optioneel)</span>
          <input
            type="number"
            min={0}
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            className="rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-center font-mono text-text"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5 text-sm">
          <span className="text-muted">eiwit g (optioneel)</span>
          <input
            type="number"
            min={0}
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            className="rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-center font-mono text-text"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">Bereiding (optioneel)</span>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          className="resize-none rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-sm text-text"
        />
      </label>

      <button
        type="button"
        onClick={save}
        disabled={pending || !name.trim()}
        className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Recept opslaan
      </button>
    </div>
  );
}
