import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/xp";
import { isoWeekday, shiftDate } from "@/lib/streaks";
import type { MealPlanRow, RecipeRow } from "@/lib/types";
import { MealPlanner } from "@/components/meal-planner";

export const metadata = { title: "Voedingsplan" };

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const today = todayInTz(profile?.timezone ?? "Europe/Amsterdam");

  const currentMonday = shiftDate(today, -(isoWeekday(today) - 1));
  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(week ?? "")
    ? shiftDate(week!, -(isoWeekday(week!) - 1))
    : currentMonday;
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i));

  const [{ data: recipes }, { data: plan }] = await Promise.all([
    supabase.from("recipes").select("id, name").order("name"),
    supabase
      .from("meal_plan")
      .select("id, date, meal_type, recipe_id")
      .gte("date", weekStart)
      .lte("date", days[6]),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Voedingsplan</h1>
        <p className="mt-1 text-sm text-muted">
          Plan per maaltijd; de boodschappenlijst volgt eruit.
        </p>
      </div>

      <nav className="flex items-center justify-between font-mono text-xs">
        <Link
          href={`/voeding/plan?week=${shiftDate(weekStart, -7)}`}
          className="rounded-full border border-line px-3 py-1.5 text-muted transition-colors hover:text-text"
        >
          ‹ vorige
        </Link>
        <span className="text-muted">
          week van {weekStart.slice(8, 10)}-{weekStart.slice(5, 7)}
        </span>
        <Link
          href={`/voeding/plan?week=${shiftDate(weekStart, 7)}`}
          className="rounded-full border border-line px-3 py-1.5 text-muted transition-colors hover:text-text"
        >
          volgende ›
        </Link>
      </nav>

      <MealPlanner
        days={days}
        recipes={(recipes ?? []) as Pick<RecipeRow, "id" | "name">[]}
        plan={(plan ?? []) as MealPlanRow[]}
        today={today}
      />
    </div>
  );
}
