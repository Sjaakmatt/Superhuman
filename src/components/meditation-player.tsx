"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { completeSession } from "@/app/(app)/actions";
import type { MeditationRow } from "@/lib/types";
import type { XpAward } from "@/lib/xp";
import { useToast } from "./toast";

const R = 88;
const CIRC = 2 * Math.PI * R;

function formatSecs(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.max(total % 60, 0);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MeditationPlayer({ meditation }: { meditation: MeditationRow }) {
  const duration = meditation.duration_secs ?? 300;
  const [remaining, setRemaining] = useState(duration);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [award, setAward] = useState<XpAward | null>(null);
  const submittedRef = useRef(false);
  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  const [pending, startTransition] = useTransition();
  const { showAward, showMessage } = useToast();

  // Ring-timer: elke seconde aftellen zolang er gespeeld wordt
  useEffect(() => {
    if (!playing || finished) return;
    const timer = setInterval(() => {
      setRemaining((r) => {
        if (r - 1 > 0) return r - 1;
        setPlaying(false);
        setFinished(true);
        return 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [playing, finished]);

  // Media meespelen/pauzeren met de timer
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    if (playing) void media.play().catch(() => undefined);
    else media.pause();
  }, [playing]);

  // Afronden: sessie + XP loggen
  useEffect(() => {
    if (!finished || submittedRef.current) return;
    submittedRef.current = true;
    startTransition(async () => {
      const result = await completeSession({
        kind: "meditation",
        refId: meditation.id,
        durationSecs: duration,
      });
      if (result.error) {
        showMessage(result.error);
        return;
      }
      setAward(result.award);
      showAward(result.award);
    });
  }, [finished, meditation.id, duration, showAward, showMessage]);

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-card p-8 text-center">
        <span
          aria-hidden
          className="size-3 rounded-full"
          style={{
            background: "var(--attr-geest)",
            boxShadow: "0 0 16px var(--attr-geest)",
          }}
        />
        <div>
          <h2 className="text-lg font-semibold">Sessie afgerond</h2>
          <p className="mt-1 font-mono text-sm text-muted">
            {meditation.title}
            {award
              ? ` · +${award.amount} XP · Geest`
              : pending
                ? ""
                : " · XP van vandaag al binnen"}
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

  const frac = remaining / duration;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Ring-timer */}
      <div className="relative">
        <svg width="208" height="208" viewBox="0 0 208 208" aria-hidden>
          <circle
            cx="104"
            cy="104"
            r={R}
            fill="none"
            stroke="var(--line)"
            strokeWidth="6"
          />
          <circle
            cx="104"
            cy="104"
            r={R}
            fill="none"
            stroke="var(--attr-geest)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${frac * CIRC} ${CIRC}`}
            transform="rotate(-90 104 104)"
            style={{
              filter: "drop-shadow(0 0 6px var(--attr-geest))",
              transition: "stroke-dasharray 1s linear",
            }}
          />
        </svg>
        <p
          className="absolute inset-0 flex items-center justify-center font-mono text-4xl font-semibold"
          aria-live="off"
        >
          {formatSecs(remaining)}
        </p>
      </div>

      {/* Media (zodra er audio/video in Storage staat) */}
      {meditation.media_url ? (
        meditation.media_type === "video" ? (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={meditation.media_url}
            playsInline
            className="w-full rounded-2xl border border-line"
          />
        ) : (
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={meditation.media_url}
          />
        )
      ) : (
        <p className="text-center text-xs text-muted">
          Stille timer — begeleidende audio volgt zodra die in Storage staat.
        </p>
      )}

      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? "Pauzeren" : "Afspelen"}
        className="size-14 rounded-full bg-text text-lg font-semibold text-ink transition-opacity hover:opacity-90"
      >
        {playing ? "❚❚" : "▶"}
      </button>
    </div>
  );
}
