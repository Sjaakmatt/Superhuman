import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/xp";
import { mealWindow, type MealType } from "@/lib/nutrition";
import { FoodCheckinForm } from "@/components/food-checkin-form";
import { MealTimeline, type PlannedMeal } from "@/components/meal-timeline";
import { HydrationDay } from "@/components/hydration-day";

export const metadata = { title: "Voeding" };

interface MealPlanJoin {
  meal_type: string;
  target_min: number | null;
  recipes: { name: string } | { name: string }[] | null;
}

const MEAL_TYPES: MealType[] = ["ontbijt", "lunch", "snack", "diner"];

export default async function VoedingPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .single();
  const timezone = profile?.timezone ?? "Europe/Amsterdam";
  const today = todayInTz(timezone);

  const [{ data: checkin }, { data: water }, { data: planRows }] =
    await Promise.all([
      supabase
        .from("food_checkins")
        .select("satisfied, feeling, note")
        .eq("date", today)
        .maybeSingle(),
      supabase
        .from("water_logs")
        .select("glasses, goal")
        .eq("date", today)
        .maybeSingle(),
      supabase
        .from("meal_plan")
        .select("meal_type, target_min, recipes (name)")
        .eq("date", today),
    ]);

  // Vandaag geplande maaltijden per type
  const plannedByType = new Map<string, MealPlanJoin>();
  for (const row of (planRows ?? []) as MealPlanJoin[]) {
    plannedByType.set(row.meal_type, row);
  }
  const meals: PlannedMeal[] = MEAL_TYPES.map((type) => {
    const row = plannedByType.get(type);
    const recipe = row
      ? Array.isArray(row.recipes)
        ? row.recipes[0]
        : row.recipes
      : null;
    return {
      mealType: type,
      recipeName: recipe?.name ?? null,
      targetMin: row?.target_min ?? mealWindow(type).target,
    };
  });

  const glasses = water?.glasses ?? 0;
  const goal = water?.goal ?? 8;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Voeding</h1>
        <p className="mt-1 text-sm text-muted">
          Eiwit bij elke maaltijd, eet binnen je vensters, hydrateer. Geen
          streng budget — sturing.
        </p>
      </div>

      <MealTimeline timezone={timezone} meals={meals} />

      <HydrationDay timezone={timezone} glasses={glasses} goal={goal} />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">
          {checkin ? "Je check-in van vandaag" : "Sluit je eetdag af"}
        </h2>
        <FoodCheckinForm initial={checkin} />
      </section>

      <ul className="grid grid-cols-2 gap-2">
        {[
          { href: "/voeding/plan", title: "Voedingsplan", meta: "Week per maaltijd" },
          {
            href: "/voeding/boodschappen",
            title: "Boodschappen",
            meta: "Uit je weekplan",
          },
          { href: "/voeding/recepten", title: "Recepten", meta: "Je bouwstenen" },
          {
            href: "/voeding/calorieen",
            title: "Calorieën",
            meta: "Optioneel inzicht",
          },
        ].map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="flex h-full flex-col gap-1 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted"
            >
              <span className="text-sm font-medium">{card.title}</span>
              <span className="text-xs text-muted">{card.meta}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
