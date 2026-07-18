import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/xp";
import { isoWeekday } from "@/lib/streaks";
import { loadLadderMap, resolveSessionKey } from "@/lib/training/data";
import { LadderMapRow } from "@/components/ladder-map-row";

export const metadata = { title: "Beweging" };

const DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

const CATEGORIES: {
  key: string;
  label: string;
  color: string;
}[] = [
  { key: "kracht", label: "Kracht", color: "var(--attr-kracht)" },
  { key: "elasticiteit", label: "Elasticiteit", color: "var(--attr-vitaliteit)" },
  { key: "mobiliteit", label: "Mobiliteit", color: "var(--attr-soepel)" },
];

const SESSION_LABEL: Record<string, string> = {
  kracht_a: "Kracht A · trek-nadruk",
  kracht_b: "Kracht B · duw-nadruk",
};

export default async function BewegingPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .single();
  const timezone = profile?.timezone ?? "Europe/Amsterdam";
  const today = todayInTz(timezone);
  const dayCode = DAY_CODES[isoWeekday(today) - 1];

  const [{ data: workoutBlock }, ladderMap] = await Promise.all([
    supabase
      .from("schedule_blocks")
      .select("days, session_key")
      .eq("kind", "workout")
      .maybeSingle(),
    loadLadderMap(supabase),
  ]);

  const trainingDay = (workoutBlock?.days ?? []).includes(dayCode);
  const sessionKey = resolveSessionKey(workoutBlock?.session_key ?? "auto", today);
  const sessionLabel = SESSION_LABEL[sessionKey] ?? "Krachtsessie";

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-xl font-semibold">Beweging</h1>
        <p className="mt-1 text-sm text-muted">
          Calisthenics-ladders: elke sessie kent je trede en tilt je een sport
          hoger.
        </p>
      </div>

      {/* Vandaag: de gegenereerde sessie of een rustdag */}
      <section aria-label="Vandaag" className="flex flex-col gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Vandaag
        </p>
        {trainingDay ? (
          <Link
            href="/beweging/sessie/auto"
            className="flex items-center gap-4 rounded-2xl border p-5 transition-colors"
            style={{
              borderColor: "var(--attr-kracht)",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--attr-kracht) 9%, var(--card)), var(--card))",
            }}
          >
            <span
              aria-hidden
              className="grid size-11 shrink-0 place-items-center rounded-full font-mono text-lg"
              style={{
                background:
                  "color-mix(in srgb, var(--attr-kracht) 18%, transparent)",
                color: "var(--attr-kracht)",
                boxShadow: "0 0 16px -4px var(--attr-kracht)",
              }}
            >
              ↑
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{sessionLabel}</span>
              <span className="block text-xs text-muted">
                De sessie leidt je set voor set — schoon en op tempo brengt je
                hoger.
              </span>
            </span>
            <span aria-hidden className="text-muted">
              ›
            </span>
          </Link>
        ) : (
          <Link
            href="/beweging/mobiliteit"
            className="flex items-center gap-4 rounded-2xl border border-line bg-card p-5 transition-colors hover:border-muted"
          >
            <span
              aria-hidden
              className="grid size-11 shrink-0 place-items-center rounded-full text-lg"
              style={{
                background:
                  "color-mix(in srgb, var(--attr-soepel) 16%, transparent)",
                color: "var(--attr-soepel)",
              }}
            >
              ~
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">
                Rustdag — houd los
              </span>
              <span className="block text-xs text-muted">
                Geen krachtsessie vandaag. Een korte mobiliteitsflow houdt je
                soepel.
              </span>
            </span>
            <span aria-hidden className="text-muted">
              ›
            </span>
          </Link>
        )}
      </section>

      {/* Je ladders: in één blik waar je staat */}
      <section aria-label="Je ladders" className="flex flex-col gap-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Je ladders
        </p>
        {CATEGORIES.map((cat) => {
          const entries = ladderMap.filter(
            (e) => e.pattern.category === cat.key,
          );
          if (entries.length === 0) return null;
          return (
            <div key={cat.key} className="flex flex-col gap-2">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: cat.color }}
                />
                {cat.label}
              </h2>
              <ul className="flex flex-col gap-2">
                {entries.map((entry) => (
                  <li key={entry.pattern.key}>
                    <LadderMapRow entry={entry} color={cat.color} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {/* Losse ingangen */}
      <section aria-label="Meer" className="flex flex-col gap-2">
        <HubLink
          href="/beweging/mobiliteit"
          title="Mobiliteit"
          sub="Begeleide stretch- en mobiliteitsflows"
        />
        <HubLink
          href="/beweging/hardlopen"
          title="Hardlopen"
          sub="Log rustig of tempo, zie je opbouw"
        />
        <HubLink
          href="/beweging/bibliotheek"
          title="Bibliotheek"
          sub="Elke ladder, van makkelijk naar moeilijk, met jouw trede"
        />
      </section>
    </div>
  );
}

function HubLink({
  href,
  title,
  sub,
}: {
  href: string;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted">{sub}</span>
      </span>
      <span aria-hidden className="text-muted">
        ›
      </span>
    </Link>
  );
}
