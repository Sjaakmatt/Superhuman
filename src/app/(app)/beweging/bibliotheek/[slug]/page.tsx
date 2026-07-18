import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { explainTempo } from "@/lib/session";
import { loadLadderDetail, stripFromEntry } from "@/lib/training/data";
import { LadderStrip } from "@/components/ladder-strip";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const detail = await loadLadderDetail(supabase, slug);
  return { title: detail?.exercise.name ?? "Oefening" };
}

function statusLine(rung: number, current: number): string {
  if (rung === current) return "Dit is jouw huidige trede.";
  if (rung < current) {
    const diff = current - rung;
    return diff === 1
      ? "Eén trede onder je — hier ben je voorbij."
      : `${diff} treden onder je — hier ben je voorbij.`;
  }
  const diff = rung - current;
  return diff === 1
    ? "Eén trede boven je — je volgende doel."
    : `${diff} treden boven je huidige.`;
}

export default async function LadderDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const detail = await loadLadderDetail(supabase, slug);
  if (!detail) notFound();

  const { entry, exercise: ex, isCurrent } = detail;
  const tempo = explainTempo(ex.tempo);
  const target =
    ex.holdSec != null && ex.repLow == null
      ? `${ex.holdSec}s aanhouden`
      : ex.repLow != null && ex.repHigh != null
        ? ex.repLow === ex.repHigh
          ? `${ex.repLow} reps`
          : `${ex.repLow}-${ex.repHigh} reps`
        : null;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/beweging/bibliotheek"
        className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-text"
      >
        ‹ Bibliotheek
      </Link>

      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          {entry.pattern.label} · trede {ex.rung}
        </p>
        <h1 className="mt-1 text-xl font-semibold">{ex.name}</h1>
        {ex.oneLiner ? (
          <p className="mt-1 text-sm text-muted">{ex.oneLiner}</p>
        ) : null}
      </div>

      {/* Status op deze ladder */}
      <div
        className="rounded-2xl border bg-card p-4"
        style={
          isCurrent
            ? {
                borderColor: "var(--attr-kracht)",
                background:
                  "color-mix(in srgb, var(--attr-kracht) 7%, var(--card))",
              }
            : undefined
        }
      >
        <p className="text-sm">
          <span
            className="font-medium"
            style={isCurrent ? { color: "var(--attr-kracht)" } : undefined}
          >
            {statusLine(ex.rung, entry.currentRung)}
          </span>
        </p>
      </div>

      {/* Kerncijfers */}
      <dl className="grid grid-cols-2 gap-2">
        {target ? <Stat label="Doel" value={target} /> : null}
        {tempo ? <Stat label="Tempo" value={tempo.split(" · ")[0]} /> : null}
        {ex.restSec ? <Stat label="Rust" value={`${ex.restSec}s`} /> : null}
        {ex.equipment ? <Stat label="Nodig" value={ex.equipment} /> : null}
      </dl>

      {/* Volledige coaching */}
      {ex.setup.length > 0 ? <Coach title="Opzet" items={ex.setup} /> : null}
      {ex.execution.length > 0 ? (
        <Coach title="Uitvoering" items={ex.execution} />
      ) : null}
      {ex.breathing ? (
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Ademhaling
          </p>
          <p className="mt-1.5 text-sm">{ex.breathing}</p>
        </div>
      ) : null}
      {ex.mistakes.length > 0 ? (
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Veelgemaakte fouten
          </p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {ex.mistakes.map((m, i) => (
              <li key={i} className="text-sm text-muted">
                · {m}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ex.advanceNote ? (
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Naar de volgende trede
          </p>
          <p className="mt-1.5 text-sm">{ex.advanceNote}</p>
        </div>
      ) : null}

      {ex.muscles.length > 0 ? (
        <p className="font-mono text-xs text-muted">
          Spieren: {ex.muscles.join(" · ")}
        </p>
      ) : null}

      {/* De hele ladder, met deze trede + jouw trede gemarkeerd */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <LadderStrip strip={stripFromEntry(entry)} targetRung={ex.rung} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-card px-3.5 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-mono text-sm">{value}</p>
    </div>
  );
}

function Coach({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {title}
      </p>
      <ol className="mt-2 flex flex-col gap-2">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-sm">
            <span className="font-mono text-xs text-muted">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
