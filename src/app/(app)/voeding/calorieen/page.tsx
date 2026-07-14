import { createClient } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/xp";
import type { CalorieLogRow } from "@/lib/types";
import { CalorieTracker } from "@/components/calorie-tracker";

export const metadata = { title: "Calorieën" };

export default async function CalorieenPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .single();
  const today = todayInTz(profile?.timezone ?? "Europe/Amsterdam");

  const { data: items } = await supabase
    .from("calorie_logs")
    .select("id, item, calories, protein, carbs, fat")
    .eq("date", today)
    .order("id", { ascending: false });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Calorieën</h1>
        <p className="mt-1 text-sm text-muted">
          Inzicht, geen budget — loggen mag, moeten hoeft niet.
        </p>
      </div>
      <CalorieTracker items={(items ?? []) as CalorieLogRow[]} />
    </div>
  );
}
