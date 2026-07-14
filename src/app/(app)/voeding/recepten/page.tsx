import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { RecipeRow } from "@/lib/types";

export const metadata = { title: "Recepten" };

export default async function ReceptenPage() {
  const supabase = await createClient();
  const { data: recipes } = await supabase
    .from("recipes")
    .select("id, name, ingredients, calories, protein, carbs, fat, instructions")
    .order("name");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">Recepten</h1>
          <p className="mt-1 text-sm text-muted">
            De bouwstenen van je voedingsplan.
          </p>
        </div>
        <Link
          href="/voeding/recepten/nieuw"
          className="text-xs text-muted underline underline-offset-4 transition-colors hover:text-text"
        >
          + nieuw
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {((recipes ?? []) as RecipeRow[]).map((recipe) => (
          <li
            key={recipe.id}
            className="rounded-2xl border border-line bg-card p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="min-w-0 text-sm font-medium">{recipe.name}</h2>
              {recipe.calories ? (
                <span className="shrink-0 font-mono text-xs text-muted">
                  {recipe.calories} kcal
                  {recipe.protein ? ` · ${recipe.protein}g eiwit` : ""}
                </span>
              ) : null}
            </div>
            {recipe.ingredients && recipe.ingredients.length > 0 ? (
              <p className="mt-1.5 text-xs text-muted">
                {recipe.ingredients.map((i) => i.name).join(" · ")}
              </p>
            ) : null}
          </li>
        ))}
        {(recipes ?? []).length === 0 ? (
          <li className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Nog geen recepten — voeg je eerste toe.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
