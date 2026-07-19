"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { completeMeditationSession } from "@/app/(app)/actions";
import type { MeditationLevel } from "@/lib/meditation";
import { haptic } from "@/lib/haptics";
import type { XpAward } from "@/lib/xp";
import { MediaEmbed } from "./media-embed";
import { useToast } from "./toast";

const GEEST = "var(--attr-geest)";

function fmt(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

type Stage = "idle" | "running" | "paused" | "done";

function Coaching({ level }: { level: MeditationLevel }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      {level.oneLiner ? (
        <p className="text-sm text-muted">{level.oneLiner}</p>
      ) : null}
      <p className="mt-2 font-mono text-xs" style={{ color: GEEST }}>
        richtduur {level.targetMin} min · +{level.xp} XP
      </p>
      <ol className="mt-4 flex flex-col gap-1.5">
        {level.instruction.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className="font-mono text-xs text-muted">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {level.guidance ? (
        <p className="mt-3 rounded-xl border border-line bg-ink-2 px-3.5 py-2.5 text-xs text-muted">
          {level.guidance}
        </p>
      ) : null}
    </div>
  );
}

export function MeditationTimer({ level }: { level: MeditationLevel }) {
  // Begeleide audio is leidend: de sessie ís de opname. Alleen de stille zit
  // (geen media) gebruikt de ring-timer met duurkeuze.
  const guided = level.media?.provider === "audio";
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const durations = Array.from(
    new Set([level.targetMin, level.targetMin + 5, level.targetMin + 10]),
  );
  const [minutes, setMinutes] = useState(level.targetMin);
  const [stage, setStage] = useState<Stage>("idle");
  const [remaining, setRemaining] = useState(level.targetMin * 60);
  const [award, setAward] = useState<XpAward | null>(null);
  const [finalSecs, setFinalSecs] = useState(0);
  const submittedRef = useRef(false);
  const [pending, startTransition] = useTransition();
  const { showAward, showMessage } = useToast();

  const total = minutes * 60;

  // Stille-zit-timer (alleen zonder begeleiding).
  useEffect(() => {
    if (guided || stage !== "running") return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setFinalSecs(total);
          setStage("done");
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [guided, stage, total]);

  // Afronden → sessie loggen.
  useEffect(() => {
    if (stage !== "done" || submittedRef.current) return;
    submittedRef.current = true;
    haptic("success");
    const secs = Math.max(1, Math.round(finalSecs || total - remaining));
    startTransition(async () => {
      const result = await completeMeditationSession(level.level, secs);
      if (result.error) {
        showMessage(result.error);
        return;
      }
      setAward(result.award);
      showAward(result.award);
    });
  }, [stage, level.level, total, remaining, finalSecs, showAward, showMessage]);

  function finishGuided() {
    setFinalSecs(
      Math.round(audioRef.current?.currentTime ?? 0) || level.targetMin * 60,
    );
    setStage("done");
  }

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (stage === "done") {
    const sat = Math.round((finalSecs || total - remaining) / 60);
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-card p-8 text-center">
        <span
          aria-hidden
          className="size-3 rounded-full"
          style={{ background: GEEST, boxShadow: `0 0 16px ${GEEST}` }}
        />
        <div>
          <h2 className="text-lg font-semibold">Gezeten</h2>
          <p className="mt-1 font-mono text-sm text-muted">
            {level.name} · {Math.max(1, sat)} min
            {award
              ? ` · +${award.amount} XP · Geest`
              : pending
                ? ""
                : " · XP van vandaag al binnen"}
          </p>
        </div>
        <p className="max-w-[280px] text-sm text-muted">
          Neem de stilte mee de dag in.
        </p>
        <Link
          href="/geest/meditatie"
          className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
        >
          Terug naar de leerlijn
        </Link>
      </div>
    );
  }

  // ── Begeleide audio: de opname leidt ────────────────────────────────────────
  if (guided && level.media) {
    return (
      <div className="flex flex-col gap-5">
        <Coaching level={level} />
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="mb-2 text-xs text-muted">{level.media.title}</p>
          <audio
            ref={audioRef}
            controls
            src={level.media.url}
            onEnded={finishGuided}
            className="w-full"
          >
            <track kind="captions" />
          </audio>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={finishGuided}
          className="rounded-lg px-6 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: GEEST }}
        >
          Sessie afronden · +{level.xp} XP
        </button>
        <p className="text-center text-xs text-muted">
          Speel de opname af en zit mee; tik daarna om te loggen. Bij het einde
          gaat dit vanzelf.
        </p>
      </div>
    );
  }

  // ── Stille zit: ring-timer met duurkeuze ────────────────────────────────────
  const running = stage === "running" || stage === "paused";
  const pct = running ? ((total - remaining) / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-5">
      {!running ? <Coaching level={level} /> : null}

      {running ? (
        <div className="flex flex-col items-center gap-5 py-2">
          <div className="relative flex size-64 items-center justify-center">
            <svg viewBox="0 0 100 100" className="absolute size-64 -rotate-90">
              <circle cx="50" cy="50" r="46" fill="none" stroke="var(--line)" strokeWidth="2" />
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke={GEEST}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 46}
                strokeDashoffset={(2 * Math.PI * 46 * (100 - pct)) / 100}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <p className="font-mono text-5xl font-semibold tabular-nums">
              {fmt(remaining)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStage((s) => (s === "running" ? "paused" : "running"))}
              className="size-14 rounded-full bg-text text-lg font-semibold text-ink transition-opacity hover:opacity-90"
            >
              {stage === "running" ? "❚❚" : "▶"}
            </button>
            <button
              type="button"
              onClick={() => {
                setFinalSecs(total - remaining);
                setStage("done");
              }}
              className="rounded-full border border-line px-4 py-2 text-sm text-muted transition-colors hover:text-text"
            >
              Nu afronden
            </button>
          </div>
        </div>
      ) : (
        <>
          {level.media ? <MediaEmbed media={level.media} /> : null}
          <div className="flex items-center justify-center gap-2">
            {durations.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setMinutes(d);
                  setRemaining(d * 60);
                }}
                aria-pressed={minutes === d}
                className="rounded-full border px-4 py-1.5 font-mono text-sm transition-colors"
                style={
                  minutes === d
                    ? { borderColor: GEEST, color: "var(--text)" }
                    : { borderColor: "var(--line)", color: "var(--muted)" }
                }
              >
                {d} min
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setRemaining(minutes * 60);
              setStage("running");
            }}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
            style={{ background: GEEST }}
          >
            Begin de zit
          </button>
        </>
      )}
    </div>
  );
}
