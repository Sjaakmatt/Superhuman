import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { evaluateUnlock } from "@/lib/meditation";
import { loadMeditationLevel } from "@/lib/meditation-data";
import { MeditationTimer } from "@/components/meditation-timer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const data = await loadMeditationLevel(supabase, slug);
  return { title: data?.level.name ?? "Meditatie" };
}

export default async function MeditationLevelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const data = await loadMeditationLevel(supabase, slug);
  if (!data) notFound();

  const { level, progress } = data;
  const status = evaluateUnlock(level, progress);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/geest/meditatie"
          className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-text"
        >
          ‹ Meditatie
        </Link>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Niveau {level.level}
        </p>
        <h1 className="text-xl font-semibold">{level.name}</h1>
      </div>

      {status.unlocked ? (
        <MeditationTimer level={level} />
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-6">
          <p className="text-sm">
            Dit niveau opent zich als je het vorige een tijd hebt beoefend.
          </p>
          <div className="flex flex-col gap-2">
            {status.parts.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span aria-hidden style={{ color: p.done ? "var(--attr-geest)" : "var(--muted)" }}>
                  {p.done ? "✓" : "○"}
                </span>
                <span className={p.done ? "text-muted line-through" : ""}>{p.label}</span>
                <span className="ml-auto font-mono text-xs text-muted">
                  {Math.min(p.have, p.need)}/{p.need}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/geest/meditatie"
            className="mt-1 self-start rounded-lg border border-line px-4 py-2 text-sm text-muted transition-colors hover:text-text"
          >
            Terug naar de leerlijn
          </Link>
        </div>
      )}
    </div>
  );
}
