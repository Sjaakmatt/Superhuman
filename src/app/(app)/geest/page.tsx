import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata = { title: "Geest" };

export default async function GeestPage() {
  const supabase = await createClient();
  const { data: patterns } = await supabase
    .from("breathwork_patterns")
    .select("id")
    .limit(10);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Geest</h1>
        <p className="mt-1 text-sm text-muted">
          Meditatie, breathwork en journaling.
        </p>
      </div>

      <Link
        href="/geest/breathwork"
        className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted"
      >
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{
            background: "var(--attr-geest)",
            boxShadow: "0 0 10px var(--attr-geest)",
          }}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Breathwork</span>
          <span className="block text-xs text-muted">
            {patterns?.length ?? 0} patronen · begeleide bol-animatie
          </span>
        </span>
        <span className="font-mono text-xs text-muted">+25 XP</span>
      </Link>

      <PagePlaceholder
        title="Meditaties & journaling"
        description="De meditatie-bibliotheek met player en journaling met stemming."
        phase="Komt in Fase 2"
        accent="var(--attr-geest)"
        as="h2"
      />
    </div>
  );
}
