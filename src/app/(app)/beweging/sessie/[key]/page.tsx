import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/xp";
import {
  buildSessionBundle,
  loadPatterns,
  resolveSessionKey,
} from "@/lib/training/data";
import { LadderSessionPlayer } from "@/components/ladder-session-player";

export const metadata = { title: "Krachtsessie" };

const VALID = new Set(["auto", "kracht_a", "kracht_b"]);

export default async function SessiePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  if (!VALID.has(key)) notFound();

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .single();
  const timezone = profile?.timezone ?? "Europe/Amsterdam";
  const today = todayInTz(timezone);

  const templateKey = resolveSessionKey(key, today);
  const { labelByKey } = await loadPatterns(supabase);
  const bundle = await buildSessionBundle(supabase, templateKey, labelByKey);

  if (!bundle || bundle.plan.items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Krachtsessie</h1>
        <p className="rounded-2xl border border-line bg-card p-6 text-sm text-muted">
          Deze sessie kon niet worden opgebouwd. Is het ladder-content-pack
          toegepast?
        </p>
        <Link
          href="/beweging"
          className="text-sm text-muted underline underline-offset-4"
        >
          Terug naar Beweging
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-semibold">{bundle.plan.label}</h1>
          {key === "auto" ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              vandaag
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted">
          De sessie leidt je set voor set. Log wat je haalt — schoon en op
          tempo brengt je een trede hoger.
        </p>
      </div>
      <LadderSessionPlayer
        templateKey={templateKey}
        plan={bundle.plan}
        ladders={bundle.ladders}
      />
    </div>
  );
}
