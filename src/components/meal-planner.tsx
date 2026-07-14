"use client";

import { useTransition } from "react";
import { planMeal } from "@/app/(app)/actions";
import type { MealPlanRow, RecipeRow } from "@/lib/types";
import { useToast } from "./toast";

const MEAL_TYPES = ["ontbijt", "lunch", "diner", "snack"] as const;
type MealType = (typeof MEAL_TYPES)[number];

const DAY_LABELS = [
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
  "zondag",
];

interface MealPlannerProps {
  days: string[]; // 7 datums (YYYY-MM-DD), maandag eerst
  recipes: Pick<RecipeRow, "id" | "name">[];
  plan: MealPlanRow[];
  today: string;
}

export function MealPlanner({ days, recipes, plan, today }: MealPlannerProps) {
  const [pending, startTransition] = useTransition();
  const { showMessage } = useToast();

  const planned = new Map(
    plan.map((row) => [`${row.date}:${row.meal_type}`, row.recipe_id]),
  );

  function update(date: string, mealType: MealType, value: string) {
    startTransition(async () => {
      const result = await planMeal({
        date,
        mealType,
        recipeId: value ? Number(value) : null,
      });
      if (result.error) showMessage(result.error);
    });
  }

  if (recipes.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
        Maak eerst een paar recepten aan; die plan je hier per maaltijd in.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {days.map((date, i) => (
        <section
          key={date}
          className={`rounded-2xl border bg-card p-4 ${
            date === today ? "border-muted" : "border-line"
          }`}
        >
          <h2 className="flex items-baseline justify-between text-sm font-medium">
            {DAY_LABELS[i]}
            <span className="font-mono text-xs text-muted">
              {date.slice(8, 10)}-{date.slice(5, 7)}
            </span>
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {MEAL_TYPES.map((mealType) => (
              <label key={mealType} className="flex items-center gap-2 text-sm">
                <span className="w-16 shrink-0 text-xs text-muted">
                  {mealType}
                </span>
                <select
                  value={planned.get(`${date}:${mealType}`) ?? ""}
                  onChange={(e) => update(date, mealType, e.target.value)}
                  disabled={pending}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-ink-2 px-2 py-1.5 text-sm text-text disabled:opacity-60"
                >
                  <option value="">—</option>
                  {recipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
