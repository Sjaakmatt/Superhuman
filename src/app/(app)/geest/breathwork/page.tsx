import { createClient } from "@/lib/supabase/server";
import type { BreathworkPatternRow } from "@/lib/types";
import { BreathworkPlayer } from "@/components/breathwork-player";

export const metadata = { title: "Breathwork" };

export default async function BreathworkPage() {
  const supabase = await createClient();
  const { data: patterns } = await supabase
    .from("breathwork_patterns")
    .select("id, name, phases")
    .order("id");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Breathwork</h1>
        <p className="mt-1 text-sm text-muted">
          Volg de bol: groter is inademen, kleiner is uitademen.
        </p>
      </div>
      <BreathworkPlayer
        patterns={(patterns ?? []) as BreathworkPatternRow[]}
      />
    </div>
  );
}
