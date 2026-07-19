import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { evaluateUnlock } from "@/lib/breath";
import { loadBreathLevel } from "@/lib/breath-data";
import { BreathPlayer } from "@/components/breath-player";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const data = await loadBreathLevel(supabase, slug);
  return { title: data?.level.name ?? "Ademwerk" };
}

export default async function BreathLevelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const data = await loadBreathLevel(supabase, slug);
  if (!data) notFound();

  const { level, progress } = data;
  const status = evaluateUnlock(level, progress);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/geest/ademwerk"
          className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-text"
        >
          ‹ Ademwerk
        </Link>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Niveau {level.level}
        </p>
        <h1 className="text-xl font-semibold">{level.name}</h1>
      </div>

      {status.unlocked ? (
        <BreathPlayer level={level} />
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-6">
          <p className="text-sm">
            Dit niveau is nog vergrendeld — bouw eerst de basis op. Dat is niet
            alleen didactisch, maar ook voor je veiligheid.
          </p>
          <div className="flex flex-col gap-2">
            {status.parts.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span aria-hidden style={{ color: p.done ? "var(--attr-geest)" : "var(--muted)" }}>
                  {p.done ? "✓" : "○"}
                </span>
                <span className={p.done ? "text-muted line-through" : ""}>
                  {p.label}
                </span>
                <span className="ml-auto font-mono text-xs text-muted">
                  {Math.min(p.have, p.need)}/{p.need}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/geest/ademwerk"
            className="mt-1 self-start rounded-lg border border-line px-4 py-2 text-sm text-muted transition-colors hover:text-text"
          >
            Terug naar de leerlijn
          </Link>
        </div>
      )}
    </div>
  );
}
