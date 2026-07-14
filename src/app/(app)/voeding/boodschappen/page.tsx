import { createClient } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/xp";
import { isoWeekday, shiftDate } from "@/lib/streaks";
import type { ShoppingItemRow } from "@/lib/types";
import { ShoppingList } from "@/components/shopping-list";

export const metadata = { title: "Boodschappen" };

export default async function BoodschappenPage() {
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
  const weekStart = shiftDate(today, -(isoWeekday(today) - 1));

  const { data: items } = await supabase
    .from("shopping_items")
    .select("id, name, qty, unit, checked")
    .eq("week_start", weekStart)
    .order("name");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Boodschappen</h1>
        <p className="mt-1 text-sm text-muted">
          Automatisch opgeteld uit je voedingsplan van deze week.
        </p>
      </div>
      <ShoppingList
        weekStart={weekStart}
        items={(items ?? []) as ShoppingItemRow[]}
      />
    </div>
  );
}
