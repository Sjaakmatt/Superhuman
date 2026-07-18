"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logRun } from "@/app/(app)/actions";
import { formatPace, paceMinPerKm, RUN_KINDS, type RunKind } from "@/lib/running";
import { useToast } from "./toast";

const VITAL = "var(--attr-vitaliteit)";

export function RunLogger({ today }: { today: string }) {
  const [kind, setKind] = useState<RunKind>("rustig");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [rpe, setRpe] = useState(5);
  const [note, setNote] = useState("");
  const [ranOn, setRanOn] = useState(today);
  const [pending, startTransition] = useTransition();
  const { showAward, showMessage } = useToast();
  const router = useRouter();

  const dist = distance ? Number(distance) : null;
  const dur = duration ? Number(duration) : null;
  const pace = paceMinPerKm(dist, dur);
  const canSubmit = (dist != null && dist > 0) || (dur != null && dur > 0);

  function submit() {
    if (!canSubmit) return;
    startTransition(async () => {
      const result = await logRun({
        kind,
        distanceKm: dist,
        durationMin: dur,
        rpe,
        note,
        ranOn,
      });
      if (result.error) {
        showMessage(result.error);
        return;
      }
      setDistance("");
      setDuration("");
      setNote("");
      if (result.award) showAward(result.award);
      else showMessage("Run gelogd. Mooi dat je liep.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5">
      <div className="flex flex-wrap gap-2">
        {RUN_KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKind(k.value)}
            aria-pressed={kind === k.value}
            className="rounded-full border px-3.5 py-1.5 text-sm transition-colors"
            style={
              kind === k.value
                ? {
                    borderColor: VITAL,
                    background: `color-mix(in srgb, ${VITAL} 12%, transparent)`,
                    color: "var(--text)",
                  }
                : { borderColor: "var(--line)", color: "var(--muted)" }
            }
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Afstand (km)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder="5.0"
            className="rounded-lg border border-line bg-ink-2 px-3 py-2.5 font-mono text-sm text-text placeholder:text-muted/50"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Duur (min)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="25"
            className="rounded-lg border border-line bg-ink-2 px-3 py-2.5 font-mono text-sm text-text placeholder:text-muted/50"
          />
        </label>
      </div>

      {pace != null ? (
        <p className="font-mono text-xs text-muted">
          Tempo: <span style={{ color: VITAL }}>{formatPace(pace)} /km</span>
        </p>
      ) : null}

      <label className="flex items-center gap-3 text-sm">
        <span className="w-16 shrink-0 text-muted">Zwaarte</span>
        <input
          type="range"
          min={1}
          max={10}
          value={rpe}
          onChange={(e) => setRpe(Number(e.target.value))}
          className="flex-1"
          style={{ accentColor: VITAL }}
          aria-label="RPE (1-10)"
        />
        <span className="w-10 text-right font-mono">RPE {rpe}</span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Datum</span>
          <input
            type="date"
            value={ranOn}
            max={today}
            onChange={(e) => setRanOn(e.target.value)}
            className="rounded-lg border border-line bg-ink-2 px-3 py-2.5 font-mono text-sm text-text"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Notitie</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="hoe voelde het?"
            className="rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-sm text-text placeholder:text-muted/50"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={pending || !canSubmit}
        className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Run loggen
      </button>
    </div>
  );
}
