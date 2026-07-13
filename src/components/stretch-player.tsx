"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { completeSession } from "@/app/(app)/actions";
import type { ExerciseRow } from "@/lib/types";
import { useToast } from "./toast";

const FALLBACK_SECS = 30;

function formatSecs(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function StretchPlayer({ exercises }: { exercises: ExerciseRow[] }) {
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(
    exercises[0]?.default_secs ?? FALLBACK_SECS,
  );
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const elapsedRef = useRef(0);
  const submittedRef = useRef(false);
  const [, startTransition] = useTransition();
  const { showAward, showMessage } = useToast();

  const current = exercises[index];

  const finish = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setPlaying(false);
    setFinished(true);
    startTransition(async () => {
      const result = await completeSession({
        kind: "stretch",
        durationSecs: elapsedRef.current,
      });
      if (result.error) showMessage(result.error);
      else showAward(result.award);
    });
  }, [showAward, showMessage]);

  const goTo = useCallback(
    (nextIndex: number) => {
      if (nextIndex >= exercises.length) {
        finish();
        return;
      }
      setIndex(nextIndex);
      setRemaining(exercises[nextIndex].default_secs ?? FALLBACK_SECS);
    },
    [exercises, finish],
  );

  // Tik elke seconde zolang er gespeeld wordt
  useEffect(() => {
    if (!playing || finished) return;
    const timer = setInterval(() => {
      elapsedRef.current += 1;
      setRemaining((r) => r - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [playing, finished]);

  // Auto-advance als de tijd om is
  useEffect(() => {
    if (remaining <= 0 && !finished) {
      goTo(index + 1);
    }
  }, [remaining, finished, index, goTo]);

  if (exercises.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-card p-6 text-sm text-muted">
        Geen stretch-oefeningen gevonden. Is de seed-data toegepast?
      </p>
    );
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-card p-8 text-center">
        <span
          aria-hidden
          className="size-3 rounded-full"
          style={{
            background: "var(--attr-soepel)",
            boxShadow: "0 0 16px var(--attr-soepel)",
          }}
        />
        <div>
          <h2 className="text-lg font-semibold">Sessie afgerond</h2>
          <p className="mt-1 font-mono text-sm text-muted">
            {formatSecs(elapsedRef.current)} · +40 XP · Soepelheid
          </p>
        </div>
        <Link
          href="/vandaag"
          className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
        >
          Terug naar Vandaag
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Video of cue-kaart */}
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        {current.video_url ? (
          <video
            key={current.id}
            src={current.video_url}
            autoPlay
            muted
            loop
            playsInline
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-ink-2 px-8 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
              {current.muscle_group}
            </p>
            <p className="text-sm text-muted">{current.cue}</p>
          </div>
        )}
      </div>

      {/* Oefening + timer */}
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="text-lg font-semibold">{current.name}</h2>
        <p
          className="font-mono text-5xl font-semibold"
          style={{ color: "var(--attr-soepel)" }}
          aria-live="polite"
        >
          {formatSecs(Math.max(remaining, 0))}
        </p>
      </div>

      {/* Voortgangsdots */}
      <div
        className="flex justify-center gap-1.5"
        aria-label={`Oefening ${index + 1} van ${exercises.length}`}
      >
        {exercises.map((ex, i) => (
          <span
            key={ex.id}
            aria-hidden
            className="size-1.5 rounded-full transition-colors"
            style={{
              background:
                i < index
                  ? "var(--attr-soepel)"
                  : i === index
                    ? "var(--text)"
                    : "var(--line)",
            }}
          />
        ))}
      </div>

      {/* Besturing */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => goTo(Math.max(index - 1, 0))}
          disabled={index === 0}
          aria-label="Vorige oefening"
          className="size-11 rounded-full border border-line text-muted transition-colors hover:text-text disabled:opacity-40"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pauzeren" : "Afspelen"}
          className="size-14 rounded-full bg-text text-lg font-semibold text-ink transition-opacity hover:opacity-90"
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          aria-label="Volgende oefening"
          className="size-11 rounded-full border border-line text-muted transition-colors hover:text-text"
        >
          ›
        </button>
      </div>
    </div>
  );
}
