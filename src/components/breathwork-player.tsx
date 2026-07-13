"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { completeSession } from "@/app/(app)/actions";
import type { BreathworkPatternRow } from "@/lib/types";
import { useToast } from "./toast";

const ROUND_OPTIONS = [3, 5, 8] as const;
const TICK_MS = 100;

export function BreathworkPlayer({
  patterns,
}: {
  patterns: BreathworkPatternRow[];
}) {
  const [pattern, setPattern] = useState(patterns[0] ?? null);
  const [targetRounds, setTargetRounds] = useState<number>(5);
  const [round, setRound] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseRemaining, setPhaseRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const elapsedRef = useRef(0);
  const submittedRef = useRef(false);
  const [, startTransition] = useTransition();
  const { showAward, showMessage } = useToast();

  const phases = pattern?.phases ?? [];
  const phase = phases[phaseIndex] ?? null;
  const started = running || round > 0 || phaseIndex > 0;

  function start() {
    if (!pattern) return;
    setRound(0);
    setPhaseIndex(0);
    setPhaseRemaining(pattern.phases[0].secs);
    setRunning(true);
  }

  function selectPattern(p: BreathworkPatternRow) {
    setPattern(p);
    setRunning(false);
    setRound(0);
    setPhaseIndex(0);
    setPhaseRemaining(0);
    elapsedRef.current = 0;
  }

  // Tik: fase-tijd aftellen, fase → volgende fase → volgende ronde
  useEffect(() => {
    if (!running || finished || !pattern) return;
    const timer = setInterval(() => {
      elapsedRef.current += TICK_MS / 1000;
      setPhaseRemaining((r) => {
        const next = r - TICK_MS / 1000;
        if (next > 0) return next;

        // Fase klaar → door naar de volgende
        const nextPhase = (phaseIndex + 1) % pattern.phases.length;
        if (nextPhase === 0) {
          const nextRound = round + 1;
          setRound(nextRound);
          if (nextRound >= targetRounds) {
            setRunning(false);
            setFinished(true);
            return 0;
          }
        }
        setPhaseIndex(nextPhase);
        return pattern.phases[nextPhase].secs;
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [running, finished, pattern, phaseIndex, round, targetRounds]);

  // Afronden: sessie + XP loggen zodra de laatste ronde klaar is
  useEffect(() => {
    if (!finished || submittedRef.current || !pattern) return;
    submittedRef.current = true;
    startTransition(async () => {
      const result = await completeSession({
        kind: "breathwork",
        refId: pattern.id,
        durationSecs: Math.round(elapsedRef.current),
      });
      if (result.error) showMessage(result.error);
      else showAward(result.award);
    });
  }, [finished, pattern, showAward, showMessage]);

  if (patterns.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-card p-6 text-sm text-muted">
        Geen breathwork-patronen gevonden. Is de seed-data toegepast?
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
            background: "var(--attr-geest)",
            boxShadow: "0 0 16px var(--attr-geest)",
          }}
        />
        <div>
          <h2 className="text-lg font-semibold">Sessie afgerond</h2>
          <p className="mt-1 font-mono text-sm text-muted">
            {pattern?.name} · {targetRounds} rondes · +25 XP · Geest
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

  const scale = phase && started ? phase.scale : 0.6;
  const transitionSecs = phase && running ? phase.secs : 0.4;

  return (
    <div className="flex flex-col gap-6">
      {/* Patroon- en rondekeuze (vóór de start) */}
      {!started ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {patterns.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPattern(p)}
                aria-pressed={pattern?.id === p.id}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                  pattern?.id === p.id
                    ? "border-geest bg-geest/10 text-text"
                    : "border-line text-muted hover:text-text"
                }`}
              >
                {p.name}
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
        </div>
      ) : null}

      {/* Ademende bol */}
      <div className="flex flex-col items-center gap-5 py-4">
        <div className="flex size-56 items-center justify-center">
          <div
            aria-hidden
            className="size-44 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 40% 35%, color-mix(in srgb, var(--attr-geest) 55%, transparent), color-mix(in srgb, var(--attr-geest) 18%, transparent) 70%)",
              boxShadow: "0 0 48px -12px var(--attr-geest)",
              transform: `scale(${scale})`,
              transition: `transform ${transitionSecs}s ease-in-out`,
            }}
          />
        </div>
        <div className="text-center" aria-live="polite">
          <p className="text-lg font-medium">
            {started && phase ? phase.label : pattern?.name}
          </p>
          <p className="mt-1 font-mono text-sm text-muted">
            {started
              ? `${Math.ceil(phaseRemaining)}s · ronde ${Math.min(round + 1, targetRounds)}/${targetRounds}`
              : `${targetRounds} rondes`}
          </p>
        </div>
      </div>

      {/* Besturing */}
      <div className="flex justify-center">
        {!started ? (
          <button
            type="button"
            onClick={start}
            className="rounded-lg bg-text px-6 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
          >
            Start · +25 XP
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            aria-label={running ? "Pauzeren" : "Hervatten"}
            className="size-14 rounded-full bg-text text-lg font-semibold text-ink transition-opacity hover:opacity-90"
          >
            {running ? "❚❚" : "▶"}
          </button>
        )}
      </div>
    </div>
  );
}
