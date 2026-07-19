import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  evaluateUnlock,
  topReached,
  type BreathLevel,
  type BreathProgress,
} from "@/lib/breath";
import { loadBreathCurriculum } from "@/lib/breath-data";

export const metadata = { title: "Ademwerk" };

const TRACKS: { key: string; label: string }[] = [
  { key: "kalmerend", label: "Kalmerend — het fundament" },
  { key: "brug", label: "De brug" },
  { key: "zwaar", label: "Zwaar — verbonden ademhaling" },
];

const GEEST = "var(--attr-geest)";

export default async function AdemwerkPage() {
  const supabase = await createClient();
  const { levels, progress } = await loadBreathCurriculum(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Ademwerk</h1>
        <p className="mt-1 text-sm text-muted">
          Een leerlijn langs de video&apos;s van Breathe With Sandy: van korte
          kalmerende technieken tot haar diepe verbonden-ademhaling-journeys. Je
          volgt telkens de video; elk niveau opent zich zodra je klaar bent voor
          het volgende.
        </p>
      </div>

      {TRACKS.map((track) => {
        const items = levels.filter((l) => l.track === track.key);
        if (items.length === 0) return null;
        return (
          <section key={track.key} className="flex flex-col gap-2">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
              {track.label}
            </h2>
            <ul className="flex flex-col gap-2">
              {items.map((level) => (
                <LevelRow key={level.id} level={level} progress={progress} />
              ))}
            </ul>
          </section>
        );
      })}

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
            Je hebt de hele leerlijn doorlopen. Van hier af zijn er geen nieuwe
            sloten — het gaat om <span className="font-medium">consistentie en
            diepte</span>. Kies vrij een sessie hierboven en bouw je praktijk uit.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Sessies" value={`${progress.totalSessions}`} />
            <Stat label="Minuten" value={`${progress.totalMinutes}`} />
            <Stat
              label="Niveaus"
              value={`${Object.keys(progress.sessionsByLevel).length}`}
            />
          </div>
        </section>
      ) : null}

      <p className="rounded-2xl border border-line bg-card p-4 text-xs text-muted">
        Ademwerk is krachtig. De sloten in deze leerlijn bouwen je basis op en zijn
        er voor je veiligheid. Doe krachtige ademhaling nooit in of bij water of
        tijdens autorijden, en lees de contra-indicaties vóór de zware niveaus.
      </p>
    </div>
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

function LevelRow({
  level,
  progress,
}: {
  level: BreathLevel;
  progress: BreathProgress;
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
              ? {
                  background: `color-mix(in srgb, ${GEEST} 18%, transparent)`,
                  color: GEEST,
                }
              : { background: "var(--surface-2)", color: "var(--text-mute)" }
        }
      >
        {status.unlocked ? level.level : "🔒"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{level.name}</span>
        <span className="block truncate text-xs text-muted">
          {status.unlocked
            ? (level.oneLiner ?? level.prescription ?? "")
            : `Nog: ${status.remaining}`}
        </span>
      </span>
      {level.needsSafetyAck ? (
        <span
          className="shrink-0 font-mono text-[9px] uppercase tracking-wider"
          style={{ color: "var(--attr-kracht)" }}
        >
          zwaar
        </span>
      ) : status.unlocked ? (
        <span aria-hidden className="shrink-0 text-muted">
          ›
        </span>
      ) : null}
    </div>
  );

  if (!status.unlocked) return <li>{inner}</li>;
  return (
    <li>
      <Link
        href={`/geest/ademwerk/${level.slug}`}
        className="block transition-colors hover:opacity-90"
      >
        {inner}
      </Link>
    </li>
  );
}
