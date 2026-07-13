import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata = { title: "Beweging" };

export default async function BewegingPage() {
  const supabase = await createClient();
  const { data: stretches } = await supabase
    .from("exercises")
    .select("id, default_secs")
    .eq("kind", "stretch");

  const count = stretches?.length ?? 0;
  const totalSecs = (stretches ?? []).reduce(
    (sum, e: { default_secs: number | null }) => sum + (e.default_secs ?? 30),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Beweging</h1>
        <p className="mt-1 text-sm text-muted">
          Stretchen, kracht en de oefeningen-bibliotheek.
        </p>
      </div>

      <Link
        href="/beweging/stretch"
        className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted"
      >
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{
            background: "var(--attr-soepel)",
            boxShadow: "0 0 10px var(--attr-soepel)",
          }}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Stretch-sessie</span>
          <span className="block text-xs text-muted">
            {count} oefeningen · ±{Math.round(totalSecs / 60)} min
          </span>
        </span>
        <span className="font-mono text-xs text-muted">+40 XP</span>
      </Link>

      <PagePlaceholder
        title="Kracht & bibliotheek"
        description="Routines met sets/reps en de doorzoekbare oefeningen-bibliotheek met video."
        phase="Komt in Fase 3"
        accent="var(--attr-kracht)"
        as="h2"
      />
    </div>
  );
}
