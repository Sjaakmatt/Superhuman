import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Hardlopen" };

interface RunRow {
  id: string;
  kind: string;
  distance_km: number | null;
  duration_min: number | null;
  rpe: number | null;
  ran_on: string;
}

const KIND_LABEL: Record<string, string> = {
  easy: "rustig",
  tempo: "tempo",
  long: "duurloop",
  interval: "interval",
};

export default async function HardlopenPage() {
  const supabase = await createClient();
  const { data: runs } = await supabase
    .from("run_logs")
    .select("id, kind, distance_km, duration_min, rpe, ran_on")
    .order("ran_on", { ascending: false })
    .limit(30);

  const rows = (runs ?? []) as RunRow[];

  return (
    <div className="flex flex-col gap-5">
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

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-6 text-center">
          <p className="text-sm text-muted">
            Nog geen runs gelogd. De run-logger en je trend komen eraan in het
            hardloop-spoor.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {KIND_LABEL[r.kind] ?? r.kind}
                  {r.distance_km ? ` · ${r.distance_km} km` : ""}
                </span>
                <span className="block font-mono text-xs text-muted">
                  {[
                    r.duration_min ? `${r.duration_min} min` : null,
                    r.rpe ? `RPE ${r.rpe}` : null,
                    r.ran_on,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
