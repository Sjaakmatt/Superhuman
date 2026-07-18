"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setBlockDone } from "@/app/(app)/actions";
import { blockMeta, blockTime, DAY_CODES, pickNowBlock } from "@/lib/now";
import { haptic } from "@/lib/haptics";
import type { ScheduleBlockRow } from "@/lib/types";

const CORE = "var(--effort)";

/** Nu-minuut + dagcode in een tijdzone; tikt elke minuut. */
function useNow(timezone: string): { min: number; day: string } | null {
  const [now, setNow] = useState<{ min: number; day: string } | null>(null);
  useEffect(() => {
    const compute = () => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        weekday: "short",
        hour12: false,
      }).formatToParts(new Date());
      const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
      const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
      // Dagcode via een aparte, betrouwbare berekening
      const local = new Date(
        new Date().toLocaleString("en-US", { timeZone: timezone }),
      );
      setNow({ min: (h % 24) * 60 + m, day: DAY_CODES[local.getDay()] });
    };
    compute();
    const timer = setInterval(compute, 60_000);
    return () => clearInterval(timer);
  }, [timezone]);
  return now;
}

interface NowCardProps {
  timezone: string;
  blocks: ScheduleBlockRow[];
  doneKeys: string[];
  doneBlockIds: number[];
}

export function NowCard({
  timezone,
  blocks,
  doneKeys,
  doneBlockIds,
}: NowCardProps) {
  const now = useNow(timezone);
  // Optimistisch afvinken: meteen weg van de kaart, DB volgt.
  const [localDone, setLocalDone] = useState<number[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!now || blocks.length === 0) return null;

  const doneIds = new Set<number>([...doneBlockIds, ...localDone]);
  const { active, next } = pickNowBlock(
    blocks,
    now.min,
    now.day,
    new Set(doneKeys),
    doneIds,
  );

  function markDone(id: number) {
    setLocalDone((prev) => [...prev, id]);
    haptic("tick");
    startTransition(async () => {
      await setBlockDone(id, true);
      router.refresh();
    });
  }

  // Alles voor nu gedaan: rustige "je bent bij"-staat met de straks-preview
  if (!active) {
    return (
      <section
        aria-label="Nu"
        className="rounded-2xl border border-line bg-card p-4"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Nu
        </p>
        <p className="mt-1.5 text-sm">
          Je bent bij voor dit moment. Mooi ritme.
        </p>
        {next ? (
          <p className="mt-1 text-xs text-muted">
            Straks: {next.label.toLowerCase()} om {blockTime(next)}
          </p>
        ) : null}
      </section>
    );
  }

  const meta = blockMeta(active.kind);
  return (
    <section
      aria-label="Nu"
      className="rounded-2xl border bg-card p-4"
      style={{
        borderColor: CORE,
        boxShadow: `0 8px 30px -12px ${CORE}`,
        animation: "rise-in .4s ease",
      }}
    >
      <div className="flex items-center justify-between">
        <p
          className="font-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: CORE }}
        >
          Nu · {blockTime(active)}
        </p>
        {next ? (
          <p className="font-mono text-[10px] text-muted">
            straks: {next.label.toLowerCase()} {blockTime(next)}
          </p>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed">{meta.line(active.label)}</p>
      <div className="mt-3 flex items-center gap-2">
        <Link
          href={meta.href(active.ref_id)}
          className="inline-flex rounded-lg px-4 py-2 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
          style={{ background: CORE }}
        >
          {meta.cta}
        </Link>
        <button
          type="button"
          onClick={() => markDone(active.id)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-sm text-muted transition-colors hover:text-text disabled:opacity-50"
        >
          <span aria-hidden>✓</span> Klaar
        </button>
      </div>
    </section>
  );
}
