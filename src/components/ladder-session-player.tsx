"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  completeLadderSession,
  type LadderPromotion,
  type LadderSessionEntry,
} from "@/app/(app)/actions";
import type { LadderStrip as Strip } from "@/lib/training/data";
import { buildStrengthSteps, workOrdinal } from "@/lib/training/sessionMachine";
import type { SessionItem, SessionPlan } from "@/lib/training/types";
import { explainTempo } from "@/lib/session";
import { haptic } from "@/lib/haptics";
import type { XpAward } from "@/lib/xp";
import { LadderStrip } from "./ladder-strip";
import { useToast } from "./toast";

interface LadderSessionPlayerProps {
  templateKey: string;
  plan: SessionPlan;
  ladders: Strip[];
}

interface SetState {
  reps: number;
  clean: boolean;
  done: boolean;
}

const KRACHT = "var(--attr-kracht)";

function formatSecs(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Voorstel-reps: één meer dan het beste van vorige keer, anders het doel. */
function suggestReps(item: SessionItem): number {
  const last = item.lastTime ?? [];
  const best = last
    .map((s) => s.reps ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);
  if (best > 0) return best + 1;
  if (item.isHold && item.exercise?.holdSec) return item.exercise.holdSec;
  return item.exercise?.repLow ?? 8;
}

export function LadderSessionPlayer({
  templateKey,
  plan,
  ladders,
}: LadderSessionPlayerProps) {
  const steps = useMemo(() => buildStrengthSteps(plan), [plan]);
  const stripByPattern = useMemo(() => {
    const m = new Map<string, Strip>();
    for (const s of ladders) m.set(s.patternKey, s);
    return m;
  }, [ladders]);

  const [stepIndex, setStepIndex] = useState(0);
  // Sets per werk-item (itemIndex → rijen)
  const [sets, setSets] = useState<Record<number, SetState[]>>(() => {
    const init: Record<number, SetState[]> = {};
    plan.items.forEach((item, i) => {
      if (item.slotType === "work" || item.slotType === "finisher") {
        const n = item.sets ?? 3;
        const reps = suggestReps(item);
        init[i] = Array.from({ length: n }, () => ({
          reps,
          clean: true,
          done: false,
        }));
      }
    });
    return init;
  });

  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState(0);
  const [finished, setFinished] = useState(false);
  const [award, setAward] = useState<XpAward | null>(null);
  const [promotions, setPromotions] = useState<LadderPromotion[]>([]);
  const submittedRef = useRef(false);
  const [pending, startTransition] = useTransition();
  const { showAward, showMessage } = useToast();

  const step = steps[stepIndex];

  // Sessieklok
  useEffect(() => {
    if (!started || finished) return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [started, finished]);

  // Rust-afteller: de tijd wordt gezet bij het afronden van een set
  // (in completeSet); hier tikken we naar 0 en schuiven op 0 automatisch door.
  useEffect(() => {
    if (step?.kind !== "rest" || rest <= 0) return;
    const timer = setInterval(() => {
      setRest((r) => {
        if (r <= 1) {
          setStepIndex((i) => Math.min(i + 1, steps.length - 1));
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, rest, steps.length]);

  function begin() {
    if (!started) setStarted(true);
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function advance() {
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function updateSet(itemIndex: number, setIdx: number, patch: Partial<SetState>) {
    setSets((prev) => ({
      ...prev,
      [itemIndex]: prev[itemIndex].map((s, i) =>
        i === setIdx ? { ...s, ...patch } : s,
      ),
    }));
  }

  function completeSet(itemIndex: number, setIdx: number) {
    if (!started) setStarted(true);
    updateSet(itemIndex, setIdx, { done: true });
    haptic("tick");
    // Zet de rust vooruit als de volgende stap een rust is (geen effect nodig).
    const nextStep = steps[stepIndex + 1];
    if (nextStep?.kind === "rest") setRest(nextStep.restSec);
    advance();
  }

  function finish() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setFinished(true);

    const entries: LadderSessionEntry[] = plan.items
      .map((item, i): LadderSessionEntry | null => {
        if (!item.exercise) return null;
        const done = (sets[i] ?? []).filter((s) => s.done);
        if (done.length === 0) return null;
        return {
          ladderExerciseId: item.exercise.id,
          rung: item.exercise.rung,
          sets: done.map((s) => ({ reps: s.reps, tempoOk: s.clean })),
        };
      })
      .filter((e): e is LadderSessionEntry => e !== null);

    startTransition(async () => {
      const result = await completeLadderSession({
        templateKey,
        durationSecs: elapsed || undefined,
        entries,
      });
      if (result.error) {
        showMessage(result.error);
        return;
      }
      setAward(result.award);
      setPromotions(result.promotions);
      showAward(result.award);
      if (result.promotions.length > 0) haptic("celebrate");
    });
  }

  // ── Afgerond: samenvatting + eventuele trede-ceremonie ──────────────────
  if (finished) {
    return (
      <SessionSummary
        award={award}
        promotions={promotions}
        pending={pending}
        elapsed={elapsed}
        ladders={ladders}
      />
    );
  }

  const workTotal = plan.items.filter(
    (i) => i.slotType === "work" || i.slotType === "finisher",
  ).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Sessiebalk */}
      <div className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
        <p className="text-sm text-muted">{plan.label}</p>
        <p className="font-mono text-sm" aria-label="Verstreken tijd">
          {formatSecs(elapsed)}
        </p>
      </div>

      {step?.kind === "panel" ? (
        <PanelStep
          item={step.item}
          ordinal={
            step.item.slotType === "work" || step.item.slotType === "finisher"
              ? workOrdinal(plan, step.itemIndex)
              : null
          }
          workTotal={workTotal}
          strip={
            step.item.patternKey
              ? stripByPattern.get(step.item.patternKey)
              : undefined
          }
          onNext={begin}
        />
      ) : null}

      {step?.kind === "set" ? (
        <SetStep
          item={step.item}
          setNumber={step.setNumber}
          totalSets={step.totalSets}
          row={sets[step.itemIndex]?.[step.setNumber - 1]}
          onReps={(reps) => updateSet(step.itemIndex, step.setNumber - 1, { reps })}
          onClean={(clean) =>
            updateSet(step.itemIndex, step.setNumber - 1, { clean })
          }
          onDone={() => completeSet(step.itemIndex, step.setNumber - 1)}
        />
      ) : null}

      {step?.kind === "rest" ? (
        <RestStep
          secs={rest}
          nextSetNumber={step.nextSetNumber}
          totalSets={step.item.sets ?? 3}
          onSkip={advance}
        />
      ) : null}

      {step?.kind === "summary" ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-card p-6 text-center">
          <p className="text-sm text-muted">
            Alles gedaan. Je logt wat je haalde — dat bepaalt je volgende trede.
          </p>
          <button
            type="button"
            onClick={finish}
            className="rounded-lg bg-text px-5 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
          >
            Sessie afronden
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ── Paneel: warmup/cooldown of intro van een werk-oefening ────────────────
function PanelStep({
  item,
  ordinal,
  workTotal,
  strip,
  onNext,
}: {
  item: SessionItem;
  ordinal: number | null;
  workTotal: number;
  strip?: Strip;
  onNext: () => void;
}) {
  const ex = item.exercise;
  const isFixed = item.slotType === "warmup" || item.slotType === "cooldown";
  const tempo = ex ? explainTempo(ex.tempo) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-card p-5">
        {ordinal ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Oefening {ordinal}/{workTotal}
          </p>
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            {item.slotType === "warmup" ? "Warming-up" : "Afsluiten"}
          </p>
        )}
        <h2 className="mt-1 text-lg font-semibold">
          {isFixed ? item.fixedLabel : ex?.name}
        </h2>
        {item.target ? (
          <p className="mt-0.5 font-mono text-sm" style={{ color: KRACHT }}>
            {item.target}
            {tempo ? ` · tempo ${tempo.split(" · ")[0]}` : ""}
          </p>
        ) : null}
        {ex?.oneLiner ? (
          <p className="mt-2 text-sm text-muted">{ex.oneLiner}</p>
        ) : null}
        {isFixed && item.note ? (
          <p className="mt-2 text-sm text-muted">{item.note}</p>
        ) : null}

        {ex ? (
          <div className="mt-4 flex flex-col gap-3">
            {ex.setup.length > 0 ? (
              <CoachBlock title="Opzet" items={ex.setup} />
            ) : null}
            {ex.execution.length > 0 ? (
              <CoachBlock title="Uitvoering" items={ex.execution} />
            ) : null}
            {ex.breathing ? (
              <p className="text-sm">
                <span className="text-muted">Adem: </span>
                {ex.breathing}
              </p>
            ) : null}
            {ex.mistakes.length > 0 ? (
              <div className="rounded-xl border border-line bg-ink-2 px-3.5 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  Let op
                </p>
                <ul className="mt-1 flex flex-col gap-1">
                  {ex.mistakes.map((m, i) => (
                    <li key={i} className="text-xs text-muted">
                      · {m}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {item.lastTime && item.lastTime.length > 0 ? (
              <p className="font-mono text-xs text-muted">
                Vorige keer: {item.lastTime.map((s) => s.reps ?? "–").join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {strip ? (
        <div className="rounded-2xl border border-line bg-card p-4">
          <LadderStrip strip={strip} />
          {ex?.advanceNote ? (
            <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
              <span className="text-text">Naar de volgende trede: </span>
              {ex.advanceNote}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onNext}
        className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
      >
        {isFixed ? "Gedaan — verder" : "Begin oefening"}
      </button>
    </div>
  );
}

function CoachBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {title}
      </p>
      <ol className="mt-1 flex flex-col gap-1">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className="font-mono text-xs text-muted">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Set: reps loggen + schoon-toggle ──────────────────────────────────────
function SetStep({
  item,
  setNumber,
  totalSets,
  row,
  onReps,
  onClean,
  onDone,
}: {
  item: SessionItem;
  setNumber: number;
  totalSets: number;
  row?: SetState;
  onReps: (reps: number) => void;
  onClean: (clean: boolean) => void;
  onDone: () => void;
}) {
  const reps = row?.reps ?? 0;
  const clean = row?.clean ?? true;
  const unit = item.isHold ? "sec" : "reps";
  const lastBest =
    (item.lastTime ?? [])
      .map((s) => s.reps ?? 0)
      .reduce((a, b) => Math.max(a, b), 0) || null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5" style={{ borderColor: KRACHT }}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">{item.exercise?.name}</h2>
        <span className="font-mono text-sm text-muted">
          set {setNumber}/{totalSets}
        </span>
      </div>
      {item.target ? (
        <p className="font-mono text-xs text-muted">Doel: {item.target}</p>
      ) : null}

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => onReps(Math.max(0, reps - 1))}
          aria-label="Minder"
          className="size-11 rounded-full border border-line text-lg text-muted transition-colors hover:text-text"
        >
          −
        </button>
        <div className="flex flex-col items-center">
          <input
            type="number"
            min={0}
            value={reps}
            onChange={(e) => onReps(Number(e.target.value))}
            aria-label={`${unit} set ${setNumber}`}
            className="w-24 bg-transparent text-center font-mono text-4xl font-semibold text-text outline-none"
          />
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
            {unit}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onReps(reps + 1)}
          aria-label="Meer"
          className="size-11 rounded-full border border-line text-lg text-muted transition-colors hover:text-text"
        >
          +
        </button>
      </div>

      {lastBest ? (
        <p className="text-center text-xs text-muted">
          Vorige keer beste set: {lastBest} — mik op {lastBest + 1}.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => onClean(!clean)}
        aria-pressed={clean}
        className="mx-auto flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs transition-colors"
        style={
          clean
            ? { borderColor: KRACHT, color: "var(--text)" }
            : { borderColor: "var(--line)", color: "var(--muted)" }
        }
      >
        <span aria-hidden>{clean ? "✓" : "○"}</span>
        Schoon & op tempo
      </button>

      <button
        type="button"
        onClick={onDone}
        className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
      >
        Set klaar
      </button>
    </div>
  );
}

// ── Rust ──────────────────────────────────────────────────────────────────
function RestStep({
  secs,
  nextSetNumber,
  totalSets,
  onSkip,
}: {
  secs: number;
  nextSetNumber: number;
  totalSets: number;
  onSkip: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-2xl border px-4 py-8 text-center"
      style={{
        borderColor: KRACHT,
        background: `color-mix(in srgb, ${KRACHT} 7%, transparent)`,
      }}
      aria-live="polite"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        Rust
      </p>
      <p className="font-mono text-5xl font-semibold" style={{ color: KRACHT }}>
        {secs}s
      </p>
      <p className="text-xs text-muted">
        Volgende: set {nextSetNumber} van {totalSets}
      </p>
      <button
        type="button"
        onClick={onSkip}
        className="mt-2 rounded-full border border-line px-4 py-1.5 text-xs text-muted transition-colors hover:text-text"
      >
        Rust overslaan
      </button>
    </div>
  );
}

// ── Samenvatting + trede-ceremonie ────────────────────────────────────────
function SessionSummary({
  award,
  promotions,
  pending,
  elapsed,
  ladders,
}: {
  award: XpAward | null;
  promotions: LadderPromotion[];
  pending: boolean;
  elapsed: number;
  ladders: Strip[];
}) {
  const stripByPattern = new Map(ladders.map((s) => [s.patternKey, s]));

  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-line bg-card p-7 text-center">
      <span
        aria-hidden
        className="size-3 rounded-full"
        style={{ background: KRACHT, boxShadow: `0 0 16px ${KRACHT}` }}
      />
      <div>
        <h2 className="text-lg font-semibold">Sessie gelogd</h2>
        <p className="mt-1 font-mono text-sm text-muted">
          {formatSecs(elapsed)}
          {award
            ? ` · +${award.amount} XP · Kracht`
            : pending
              ? ""
              : " · XP van vandaag al binnen"}
        </p>
      </div>

      {promotions.length > 0 ? (
        <div
          className="flex w-full flex-col gap-4 rounded-2xl border p-4"
          style={{
            borderColor: KRACHT,
            background: `color-mix(in srgb, ${KRACHT} 8%, transparent)`,
            animation: "rise-in .5s ease",
          }}
        >
          <p
            className="font-mono text-xs font-bold uppercase tracking-[0.3em]"
            style={{ color: KRACHT }}
          >
            Trede omhoog
          </p>
          {promotions.map((p) => {
            const strip = stripByPattern.get(p.patternKey);
            return (
              <div key={p.patternKey} className="flex flex-col gap-2 text-left">
                <p className="text-sm">
                  <span className="text-muted">{p.patternLabel}: </span>
                  <span className="font-medium">{p.toName}</span>
                </p>
                {strip ? (
                  <LadderStrip strip={strip} targetRung={p.toRung} compact />
                ) : null}
              </div>
            );
          })}
          <p className="text-xs text-muted">
            Je hebt het verdiend — volgende sessie sta je hier.
          </p>
        </div>
      ) : (
        <p className="max-w-[280px] text-sm text-muted">
          Sterk gewerkt. Blijf schoon en op tempo — dan komt de volgende trede
          vanzelf.
        </p>
      )}

      <Link
        href="/vandaag"
        className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
      >
        Terug naar Vandaag
      </Link>
    </div>
  );
}
