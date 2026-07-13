import { createClient } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/xp";
import { FoodCheckinForm } from "@/components/food-checkin-form";
import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata = { title: "Voeding" };

export default async function VoedingPage() {
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

  const { data: checkin } = await supabase
    .from("food_checkins")
    .select("satisfied, feeling, note")
    .eq("date", today)
    .maybeSingle();

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

      <PagePlaceholder
        title="Voedingsplan & boodschappen"
        description="Recepten per maaltijd en de auto-gegenereerde boodschappenlijst."
        phase="Komt in Fase 3"
        accent="var(--attr-voeding)"
        as="h2"
      />
    </div>
  );
}
