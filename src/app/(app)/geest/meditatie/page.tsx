import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  evaluateUnlock,
  topReached,
  type MeditationLevel,
  type MeditationProgress,
} from "@/lib/meditation";
import { loadMeditationCurriculum } from "@/lib/meditation-data";

export const metadata = { title: "Meditatie" };

const GEEST = "var(--attr-geest)";

export default async function MeditatiePage() {
  const supabase = await createClient();
  const { levels, progress } = await loadMeditationCurriculum(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Meditatie</h1>
        <p className="mt-1 text-sm text-muted">
          Eén pad van rustig landen tot diepe stilte. Elk niveau opent zich als
          je het vorige een tijd hebt beoefend — consistentie, geen prestatie.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {levels.map((level) => (
          <LevelRow key={level.id} level={level} progress={progress} />
        ))}
      </ul>

      {topReached(levels, progress) ? (
        <section
          className="flex flex-col gap-3 rounded-2xl border p-5"
          style={{
            borderColor: GEEST,
            background: `color-mix(in srgb, ${GEEST} 7%, var(--card))`,
          }}
        >
          <p
            className="font-mono text-[11px] uppercase tracking-[0.2em]"
            style={{ color: GEEST }}
          >
            Doorlopend · gevorderd
          </p>
          <p className="text-sm">
            Je hebt de hele leerlijn doorlopen. Er zijn geen nieuwe sloten meer —
            vanaf hier is het <span className="font-medium">dagelijkse beoefening
            en diepte</span>. Kies vrij een zit hierboven.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Zits" value={`${progress.totalSessions}`} />
            <Stat label="Minuten" value={`${progress.totalMinutes}`} />
            <Stat label="Langste zit" value={`${progress.longestSitMin} min`} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function LevelRow({
  level,
  progress,
}: {
  level: MeditationLevel;
  progress: MeditationProgress;
}) {
  const status = evaluateUnlock(level, progress);
  const done = (progress.sessionsByLevel[level.level] ?? 0) > 0;

  const inner = (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-4 ${
        status.unlocked ? "bg-card" : "bg-ink-2"
      }`}
      style={{
        borderColor: status.unlocked ? "var(--line)" : "transparent",
        opacity: status.unlocked ? 1 : 0.75,
      }}
    >
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-full font-mono text-xs"
        style={
          done
            ? { background: GEEST, color: "var(--bg)" }
            : status.unlocked
              ? { background: `color-mix(in srgb, ${GEEST} 18%, transparent)`, color: GEEST }
              : { background: "var(--surface-2)", color: "var(--text-mute)" }
        }
      >
        {status.unlocked ? level.level : "🔒"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{level.name}</span>
        <span className="block truncate text-xs text-muted">
          {status.unlocked
            ? `${level.targetMin} min · ${level.oneLiner ?? ""}`
            : `Nog: ${status.remaining}`}
        </span>
      </span>
      {status.unlocked ? (
        <span aria-hidden className="shrink-0 text-muted">›</span>
      ) : null}
    </div>
  );

  if (!status.unlocked) return <li>{inner}</li>;
  return (
    <li>
      <Link href={`/geest/meditatie/${level.slug}`} className="block transition-colors hover:opacity-90">
        {inner}
      </Link>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2.5 text-center">
      <p className="font-mono text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
