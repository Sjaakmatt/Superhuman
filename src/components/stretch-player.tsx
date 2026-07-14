"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { completeWorkout } from "@/app/(app)/actions";
import {
  activeCue,
  breathLabel,
  breathScale,
  buildTimeline,
  type Phase,
  type Step,
} from "@/lib/session";
import type { XpAward } from "@/lib/xp";
import { useToast } from "./toast";

interface StretchPlayerProps {
  routineId: number;
  routineName: string;
  steps: Step[];
}

function formatSecs(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const SOEPEL = "var(--attr-soepel)";

export function StretchPlayer({
  routineId,
  routineName,
  steps,
}: StretchPlayerProps) {
  const [phases] = useState<Phase[]>(() => buildTimeline(steps));

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [remaining, setRemaining] = useState(phases[0]?.secs ?? 0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [award, setAward] = useState<XpAward | null>(null);
  const [sessionSecs, setSessionSecs] = useState(0);
  const elapsedRef = useRef(0);
  const submittedRef = useRef(false);
  const [pending, startTransition] = useTransition();
  const { showAward, showMessage } = useToast();

  const phase = phases[phaseIndex];

  // Eén tik per seconde; advance door de tijdlijn
  useEffect(() => {
    if (!playing || finished) return;
    const timer = setInterval(() => {
      if (phases[phaseIndex]?.kind === "hold") elapsedRef.current += 1;
      setRemaining((r) => {
        if (r - 1 > 0) return r - 1;
        const next = phaseIndex + 1;
        if (next >= phases.length) {
          setPlaying(false);
          setFinished(true);
          return 0;
        }
        setPhaseIndex(next);
        return phases[next].secs;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [playing, finished, phaseIndex, phases]);

  // Afronden: workout_log (kind stretch) + 40 XP Soepelheid
  useEffect(() => {
    if (!finished || submittedRef.current) return;
    submittedRef.current = true;
    setSessionSecs(elapsedRef.current);
    startTransition(async () => {
      const result = await completeWorkout({
        routineId,
        durationSecs: elapsedRef.current,
      });
      if (result.error) {
        showMessage(result.error);
        return;
      }
      setAward(result.award);
      showAward(result.award);
    });
  }, [finished, routineId, showAward, showMessage]);

  function skipPhase() {
    const next = phaseIndex + 1;
    if (next >= phases.length) {
      setPlaying(false);
      setFinished(true);
      return;
    }
    setPhaseIndex(next);
    setRemaining(phases[next].secs);
  }

  if (steps.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-card p-6 text-sm text-muted">
        Dit programma heeft geen oefeningen. Is het content-pack toegepast?
      </p>
    );
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-card p-8 text-center">
        <span
          aria-hidden
          className="size-3 rounded-full"
          style={{ background: SOEPEL, boxShadow: `0 0 16px ${SOEPEL}` }}
        />
        <div>
          <h2 className="text-lg font-semibold">Sessie afgerond</h2>
          <p className="mt-1 font-mono text-sm text-muted">
            {formatSecs(sessionSecs)}
            {award
              ? ` · +${award.amount} XP · Soepelheid`
              : pending
                ? ""
                : " · XP van vandaag al binnen"}
          </p>
        </div>
        <p className="max-w-[280px] text-sm text-muted">
          Mooi bewogen. Je lichaam onthoudt dit.
        </p>
        <Link
          href="/vandaag"
          className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
        >
          Terug naar Vandaag
        </Link>
      </div>
    );
  }

  const ex = phase.exercise;
  const holdElapsed = phase.kind === "hold" ? phase.secs - remaining : 0;

  // Grote regel + subtekst per fase
  let bigText = "";
  let subText = "";
  if (phase.kind === "intro") {
    bigText = ex.name;
    subText = ex.setup ?? ex.cue ?? "";
  } else if (phase.kind === "countin") {
    bigText = "Klaar?";
    subText = `${remaining}`;
  } else if (phase.kind === "switch") {
    bigText = "Wissel van kant";
    subText = ex.name;
  } else if (phase.kind === "rest") {
    bigText = "Rust";
    subText = phase.nextExercise
      ? `Volgende: ${phase.nextExercise.name}`
      : "Adem uit";
  } else {
    bigText = "HOUD VAST";
    subText = activeCue(ex, holdElapsed, phase.secs);
  }

  const scale = phase.kind === "hold" ? breathScale(holdElapsed) : 0.7;
  const holdIndex = phases
    .slice(0, phaseIndex + 1)
    .filter((p) => p.kind === "hold").length;
  const totalHolds = phases.filter((p) => p.kind === "hold").length;

  return (
    <div className="flex flex-col gap-4">
      {/* Fase-hoofdvlak: ademindicator of cue-kaart */}
      <div className="relative flex aspect-square max-h-[46vh] w-full items-center justify-center overflow-hidden rounded-2xl border border-line bg-ink-2">
        {phase.kind === "hold" ? (
          <div
            aria-hidden
            className="absolute size-48 rounded-full"
            style={{
              background: `radial-gradient(circle at 40% 35%, color-mix(in srgb, ${SOEPEL} 55%, transparent), color-mix(in srgb, ${SOEPEL} 16%, transparent) 70%)`,
              boxShadow: `0 0 48px -12px ${SOEPEL}`,
              transform: `scale(${scale})`,
              transition: "transform 1s ease-in-out",
            }}
          />
        ) : null}
        <div className="relative z-10 flex flex-col items-center gap-2 px-8 text-center">
          {phase.side ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
              {phase.side}
            </span>
          ) : null}
          <p
            className="text-xl font-semibold"
            style={phase.kind === "hold" ? { color: SOEPEL } : undefined}
          >
            {bigText}
          </p>
          {phase.kind === "hold" ? (
            <p className="font-mono text-6xl font-semibold" aria-live="off">
              {remaining}
            </p>
          ) : null}
          <p
            className="max-w-[280px] text-sm leading-relaxed text-muted"
            aria-live="polite"
          >
            {subText}
          </p>
          {phase.kind === "hold" ? (
            <span className="mt-1 font-mono text-[11px] text-muted">
              {breathLabel(holdElapsed)}
            </span>
          ) : null}
        </div>
      </div>

      {/* Voortgang: welke hold van hoeveel */}
      <p className="text-center font-mono text-xs text-muted">
        {routineName} · {Math.min(holdIndex || 1, totalHolds)}/{totalHolds}
      </p>

      {/* Besturing */}
      <div className="flex items-center justify-center gap-3">
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
          onClick={skipPhase}
          className="rounded-full border border-line px-4 py-2 text-sm text-muted transition-colors hover:text-text"
        >
          Overslaan
        </button>
      </div>

      {/* Coaching onder de knop: veelgemaakte fout */}
      {phase.kind === "hold" && ex.common_mistake ? (
        <p className="rounded-xl border border-line bg-card px-4 py-2.5 text-xs text-muted">
          <span className="text-text">Let op:</span> {ex.common_mistake}
        </p>
      ) : null}
    </div>
  );
}
