import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MeditationRow } from "@/lib/types";
import { MeditationPlayer } from "@/components/meditation-player";

export const metadata = { title: "Meditatie" };

export default async function MeditatiePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meditationId = Number(id);
  if (!Number.isInteger(meditationId)) notFound();

  const supabase = await createClient();
  const { data: meditation } = await supabase
    .from("meditations")
    .select("id, title, category, media_type, media_url, duration_secs, description")
    .eq("id", meditationId)
    .maybeSingle();

  if (!meditation) notFound();
  const m = meditation as MeditationRow;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{m.title}</h1>
        <p className="mt-1 text-sm text-muted">{m.description}</p>
      </div>
      <MeditationPlayer meditation={m} />
    </div>
  );
}
