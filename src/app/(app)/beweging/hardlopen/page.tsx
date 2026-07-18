import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/xp";
import {
  formatPace,
  paceMinPerKm,
  runSummary,
  weeklyVolume,
  type RunLog,
} from "@/lib/running";
import { RunLogger } from "@/components/run-logger";
import { RunTrend, type PacePoint } from "@/components/run-trend";

export const metadata = { title: "Hardlopen" };

interface RunRow {
  id: string;
  kind: string;
  distance_km: number | null;
  duration_min: number | null;
  rpe: number | null;
  note: string | null;
  ran_on: string;
}

const KIND_LABEL: Record<string, string> = {
  rustig: "rustig",
  tempo: "tempo",
  duurloop: "duurloop",
  interval: "interval",
};

export default async function HardlopenPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .single();
  const timezone = profile?.timezone ?? "Europe/Amsterdam";
  const today = todayInTz(timezone);

  const { data: runRows } = await supabase
    .from("run_logs")
    .select("id, kind, distance_km, duration_min, rpe, note, ran_on")
    .order("ran_on", { ascending: false })
    .limit(60);

  const runs: RunLog[] = ((runRows ?? []) as RunRow[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    distanceKm: r.distance_km,
    durationMin: r.duration_min,
    rpe: r.rpe,
    note: r.note,
    ranOn: r.ran_on,
  }));

  const summary = runSummary(runs, today);
  const weekly = weeklyVolume(runs, 8, today);
  const paceSeries: PacePoint[] = [...runs]
    .reverse()
    .map((r) => ({ date: r.ranOn, pace: paceMinPerKm(r.distanceKm, r.durationMin) }))
    .filter((p): p is PacePoint => p.pace != null)
    .slice(-14);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/beweging"
          className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-text"
        >
          ‹ Beweging
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Hardlopen</h1>
        <p className="mt-1 text-sm text-muted">
          Rustig of tempo — log afstand, duur en gevoel, en zie je opbouw over
          tijd.
        </p>
      </div>

      {/* Samenvatting */}
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Deze week" value={`${summary.thisWeekKm}`} unit="km" />
        <Tile label="Runs" value={`${summary.thisWeekRuns}`} unit="deze week" />
        <Tile
          label="Gem. tempo"
          value={formatPace(summary.avgPace)}
          unit="/km"
        />
      </div>

      <RunLogger today={today} />

      <RunTrend weekly={weekly} paceSeries={paceSeries} />

      {/* Recente runs */}
      <section aria-label="Recente runs" className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">Recent</h2>
        {runs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Nog geen runs gelogd — begin je eerste boven.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {runs.slice(0, 20).map((r) => {
              const pace = paceMinPerKm(r.distanceKm, r.durationMin);
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {KIND_LABEL[r.kind] ?? r.kind}
                      {r.distanceKm ? ` · ${r.distanceKm} km` : ""}
                    </span>
                    <span className="block font-mono text-xs text-muted">
                      {[
                        r.durationMin ? `${r.durationMin} min` : null,
                        pace != null ? `${formatPace(pace)} /km` : null,
                        r.rpe ? `RPE ${r.rpe}` : null,
                        r.ranOn,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {r.note ? (
                      <span className="mt-0.5 block text-xs text-muted">
                        {r.note}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card px-3 py-3 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
      <p className="font-mono text-[10px] text-muted">{unit}</p>
    </div>
  );
}
