"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { completeSession } from "@/app/(app)/actions";
import type { BreathworkPatternRow } from "@/lib/types";
import type { XpAward } from "@/lib/xp";
import { useToast } from "./toast";

const ROUND_OPTIONS = [3, 5, 8] as const;
const TICK_MS = 100;
const SETTLE_SECS = 10;
const CLOSE_SECS = 8;
const GEEST = "var(--attr-geest)";

/** Doel per patroon (op naam; niet in de DB). */
function patternGoal(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("4-7-8")) return "kalmte & slaap";
  if (n.includes("box")) return "focus & controle";
  if (n.includes("coherent")) return "balans & rust";
  return "rust";
}

type Stage = "setup" | "settle" | "breathing" | "closing" | "finished";

export function BreathworkPlayer({
  patterns,
}: {
  patterns: BreathworkPatternRow[];
}) {
  const [pattern, setPattern] = useState(patterns[0] ?? null);
  const [targetRounds, setTargetRounds] = useState<number>(5);
  const [stage, setStage] = useState<Stage>("setup");
  const [round, setRound] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseRemaining, setPhaseRemaining] = useState(0);
  const [stageRemaining, setStageRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [award, setAward] = useState<XpAward | null>(null);
  const elapsedRef = useRef(0);
  const submittedRef = useRef(false);
  const [pending, startTransition] = useTransition();
  const { showAward, showMessage } = useToast();

  const phases = pattern?.phases ?? [];
  const phase = phases[phaseIndex] ?? null;

  function startSession() {
    if (!pattern) return;
    elapsedRef.current = 0;
    setRound(0);
    setPhaseIndex(0);
    setStageRemaining(SETTLE_SECS);
    setStage("settle");
    setRunning(true);
  }

  function selectPattern(p: BreathworkPatternRow) {
    setPattern(p);
    setStage("setup");
    setRunning(false);
  }

  // Settle-in en closing: simpele afteller
  useEffect(() => {
    if (!running || (stage !== "settle" && stage !== "closing")) return;
    const timer = setInterval(() => {
      setStageRemaining((r) => {
        if (r - TICK_MS / 1000 > 0) return r - TICK_MS / 1000;
        if (stage === "settle") {
          setPhaseIndex(0);
          setPhaseRemaining(pattern?.phases[0].secs ?? 0);
          setStage("breathing");
        } else {
          setStage("finished");
          setRunning(false);
        }
        return 0;
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [running, stage, pattern]);

  // Ademfasen: fase → fase → ronde; na de laatste ronde → closing
  useEffect(() => {
    if (!running || stage !== "breathing" || !pattern) return;
    const timer = setInterval(() => {
      elapsedRef.current += TICK_MS / 1000;
      setPhaseRemaining((r) => {
        if (r - TICK_MS / 1000 > 0) return r - TICK_MS / 1000;
        const nextPhase = (phaseIndex + 1) % pattern.phases.length;
        if (nextPhase === 0) {
          const nextRound = round + 1;
          setRound(nextRound);
          if (nextRound >= targetRounds) {
            setStageRemaining(CLOSE_SECS);
            setStage("closing");
            return 0;
          }
        }
        setPhaseIndex(nextPhase);
        return pattern.phases[nextPhase].secs;
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [running, stage, pattern, phaseIndex, round, targetRounds]);

  // Afronden: session_log + 25 XP Geest
  useEffect(() => {
    if (stage !== "finished" || submittedRef.current || !pattern) return;
    submittedRef.current = true;
    startTransition(async () => {
      const result = await completeSession({
        kind: "breathwork",
        refId: pattern.id,
        durationSecs: Math.round(elapsedRef.current),
      });
      if (result.error) {
        showMessage(result.error);
        return;
      }
      setAward(result.award);
      showAward(result.award);
    });
  }, [stage, pattern, showAward, showMessage]);

  if (patterns.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-card p-6 text-sm text-muted">
        Geen breathwork-patronen gevonden. Is de seed-data toegepast?
      </p>
    );
  }

  if (stage === "finished") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-card p-8 text-center">
        <span
          aria-hidden
          className="size-3 rounded-full"
          style={{ background: GEEST, boxShadow: `0 0 16px ${GEEST}` }}
        />
        <div>
          <h2 className="text-lg font-semibold">Sessie afgerond</h2>
          <p className="mt-1 font-mono text-sm text-muted">
            {pattern?.name} · {targetRounds} rondes
            {award
              ? ` · +${award.amount} XP · Geest`
              : pending
                ? ""
                : " · XP van vandaag al binnen"}
          </p>
        </div>
        <p className="max-w-[280px] text-sm text-muted">
          Neem dit rustige gevoel mee de dag in.
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

  // Setup-scherm
  if (stage === "setup") {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          {patterns.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPattern(p)}
              aria-pressed={pattern?.id === p.id}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                pattern?.id === p.id
                  ? "border-geest bg-geest/10"
                  : "border-line hover:border-muted"
              }`}
            >
              <span className="text-sm font-medium">{p.name}</span>
              <span className="font-mono text-xs text-muted">
                {patternGoal(p.name)}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">Rondes:</span>
          {ROUND_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setTargetRounds(n)}
              aria-pressed={targetRounds === n}
              className={`rounded-full border px-3 py-1 font-mono text-sm transition-colors ${
                targetRounds === n
                  ? "border-geest bg-geest/10 text-text"
                  : "border-line text-muted hover:text-text"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={startSession}
          className="rounded-lg bg-text px-6 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
        >
          Start · +25 XP
        </button>
      </div>
    );
  }

  // Live-scherm (settle / breathing / closing)
  let scale = 0.6;
  let bigText = "";
  let subText = "";
  if (stage === "settle") {
    bigText = "Kom tot rust";
    subText = `Laat je schouders zakken · ${Math.ceil(stageRemaining)}`;
    scale = 0.7;
  } else if (stage === "closing") {
    bigText = "Blijf nog even zitten";
    subText = "Laat de ademhaling terugkeren naar normaal";
    scale = 0.7;
  } else if (phase) {
    const count = Math.floor(phase.secs - phaseRemaining) + 1;
    scale = phase.scale;
    bigText = phase.label;
    subText = `${Math.min(count, phase.secs)} · ronde ${Math.min(round + 1, targetRounds)}/${targetRounds}`;
  }

  const transitionSecs =
    stage === "breathing" && phase ? phase.secs : 0.6;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-5 py-4">
        <div className="flex size-56 items-center justify-center">
          <div
            aria-hidden
            className="size-44 rounded-full"
            style={{
              background: `radial-gradient(circle at 40% 35%, color-mix(in srgb, ${GEEST} 55%, transparent), color-mix(in srgb, ${GEEST} 18%, transparent) 70%)`,
              boxShadow: `0 0 48px -12px ${GEEST}`,
              transform: `scale(${scale})`,
              transition: `transform ${transitionSecs}s ease-in-out`,
            }}
          />
        </div>
        <div className="text-center" aria-live="polite">
          <p className="text-lg font-medium">{bigText}</p>
          <p className="mt-1 font-mono text-sm text-muted">{subText}</p>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          aria-label={running ? "Pauzeren" : "Hervatten"}
          className="size-14 rounded-full bg-text text-lg font-semibold text-ink transition-opacity hover:opacity-90"
        >
          {running ? "❚❚" : "▶"}
        </button>
      </div>
    </div>
  );
}
