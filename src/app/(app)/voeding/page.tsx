import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/xp";
import { FoodCheckinForm } from "@/components/food-checkin-form";

export const metadata = { title: "Voeding" };

export default async function VoedingPage() {
  const supabase = await createClient();
  const [{ data: profile }, { count: recipeCount }] = await Promise.all([
    supabase.from("profiles").select("timezone").single(),
    supabase.from("recipes").select("id", { count: "exact", head: true }),
  ]);
  const today = todayInTz(profile?.timezone ?? "Europe/Amsterdam");

  const [{ data: checkin }, { data: calorieItems }] = await Promise.all([
    supabase
      .from("food_checkins")
      .select("satisfied, feeling, note")
      .eq("date", today)
      .maybeSingle(),
    supabase.from("calorie_logs").select("calories").eq("date", today),
  ]);

  const kcalToday = (calorieItems ?? []).reduce(
    (sum, row: { calories: number | null }) => sum + (row.calories ?? 0),
    0,
  );

  const cards = [
    {
      href: "/voeding/calorieen",
      title: "Calorieën",
      meta:
        kcalToday > 0
          ? `${kcalToday} kcal gelogd vandaag`
          : "Optioneel inzicht, geen budget",
    },
    {
      href: "/voeding/plan",
      title: "Voedingsplan",
      meta: "Recepten per dag en maaltijd",
    },
    {
      href: "/voeding/boodschappen",
      title: "Boodschappen",
      meta: "Automatisch uit je weekplan",
    },
    {
      href: "/voeding/recepten",
      title: "Recepten",
      meta: `${recipeCount ?? 0} recepten`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-semibold">Voeding</h1>
          <p className="mt-1 text-sm text-muted">
            {checkin
              ? "Je hebt vandaag al ingecheckt — aanpassen kan altijd."
              : "Een check-in, geen calorieënjacht."}
          </p>
        </div>
        <FoodCheckinForm initial={checkin} />
      </section>

      <ul className="grid grid-cols-2 gap-2">
        {cards.map((card) => (
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
