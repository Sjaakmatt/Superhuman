"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { completeBreathSession, logBolt } from "@/app/(app)/actions";
import type { BreathLevel, BreathMedia, BreathPhase } from "@/lib/breath";
import { haptic } from "@/lib/haptics";
import type { XpAward } from "@/lib/xp";
import { BreathOrb } from "./breath-orb";
import { useToast } from "./toast";

const GEEST = "var(--attr-geest)";
const TICK = 100;
const SETTLE = 6;

type Stage =
  | "intro"
  | "settle"
  | "breathing"
  | "active"
  | "retention"
  | "recovery"
  | "bolt"
  | "done";

function formatSecs(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function youtubeId(url: string): string | null {
  const m =
    /(?:v=|youtu\.be\/|embed\/)([\w-]{11})/.exec(url) ?? null;
  return m ? m[1] : null;
}

function MediaBlock({ media }: { media: BreathMedia }) {
  if (media.provider === "youtube") {
    const id = youtubeId(media.url);
    if (id) {
      return (
        <div className="overflow-hidden rounded-2xl border border-line bg-black">
          <div className="relative aspect-video w-full">
            <iframe
              src={`https://www.youtube.com/embed/${id}`}
              title={media.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 size-full"
            />
          </div>
        </div>
      );
    }
  }
  if (media.provider === "audio") {
    return (
      <audio controls src={media.url} className="w-full">
        <track kind="captions" />
      </audio>
    );
  }
  return (
    <a
      href={media.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted"
    >
      <span className="min-w-0 flex-1 text-sm">{media.title}</span>
      <span aria-hidden className="text-muted">
        ↗
      </span>
    </a>
  );
}

function Coach({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
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

export function BreathPlayer({ level }: { level: BreathLevel }) {
  const cfg = level.config;
  const [stage, setStage] = useState<Stage>("intro");
  const [acked, setAcked] = useState(!level.needsSafetyAck);

  // paced/active
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseRemaining, setPhaseRemaining] = useState(0);
  const [countUnits, setCountUnits] = useState(0); // cycles (paced) of breaths (active)
  const breathElapsedRef = useRef(0);
  const [breathLeft, setBreathLeft] = useState(0); // seconden resterend (paced-duur)
  // rounds
  const [round, setRound] = useState(0);
  const [retention, setRetention] = useState(0);
  const [stageRemaining, setStageRemaining] = useState(0);
  // bolt
  const [boltRunning, setBoltRunning] = useState(false);
  const [boltSecs, setBoltSecs] = useState(0);
  const [boltSaved, setBoltSaved] = useState<number | null>(null);

  const elapsedRef = useRef(0);
  const activeElapsedRef = useRef(0);
  const roundRef = useRef(0);
  const maxRetentionRef = useRef(0);
  const submittedRef = useRef(false);
  const [award, setAward] = useState<XpAward | null>(null);
  const [pending, startTransition] = useTransition();
  const { showAward, showMessage } = useToast();

  const pacedPhases: BreathPhase[] = useMemo(() => cfg.phases ?? [], [cfg]);
  const activePhases: BreathPhase[] = useMemo(
    () => cfg.activePhases ?? [],
    [cfg],
  );
  const rounds = cfg.rounds ?? 1;

  function beginRunner() {
    elapsedRef.current = 0;
    breathElapsedRef.current = 0;
    activeElapsedRef.current = 0;
    roundRef.current = 0;
    maxRetentionRef.current = 0;
    setCountUnits(0);
    setRound(0);
    setPhaseIndex(0);
    setStageRemaining(SETTLE);
    setStage("settle");
  }

  // Volgende ronde (of afronden). Declared vóór de effects die 'm gebruiken.
  const nextRound = useCallback(() => {
    const next = roundRef.current + 1;
    if (next >= rounds) {
      setStage("done");
      return;
    }
    roundRef.current = next;
    activeElapsedRef.current = 0;
    setRound(next);
    setCountUnits(0);
    setPhaseIndex(0);
    setPhaseRemaining(activePhases[0]?.secs ?? 4);
    setStage("active");
  }, [rounds, activePhases]);

  // Settle → start het juiste onderdeel
  useEffect(() => {
    if (stage !== "settle") return;
    const t = setInterval(() => {
      setStageRemaining((r) => {
        if (r - TICK / 1000 > 0) return r - TICK / 1000;
        if (level.mode === "rounds") {
          setPhaseIndex(0);
          setPhaseRemaining(activePhases[0]?.secs ?? 4);
          setStage("active");
        } else {
          setPhaseIndex(0);
          setPhaseRemaining(pacedPhases[0]?.secs ?? 4);
          setStage("breathing");
        }
        return 0;
      });
    }, TICK);
    return () => clearInterval(t);
  }, [stage, level.mode, activePhases, pacedPhases]);

  // Paced ademhaling
  useEffect(() => {
    if (stage !== "breathing" || pacedPhases.length === 0) return;
    const t = setInterval(() => {
      elapsedRef.current += TICK / 1000;
      breathElapsedRef.current += TICK / 1000;
      if (cfg.durationMin) {
        setBreathLeft(
          Math.max(0, cfg.durationMin * 60 - breathElapsedRef.current),
        );
      }
      setPhaseRemaining((r) => {
        if (r - TICK / 1000 > 0.001) return r - TICK / 1000;
        const next = (phaseIndex + 1) % pacedPhases.length;
        if (next === 0) {
          const done = countUnits + 1;
          setCountUnits(done);
          const cyclesDone = cfg.cycles && done >= cfg.cycles;
          const timeDone =
            cfg.durationMin && breathElapsedRef.current >= cfg.durationMin * 60;
          if (cyclesDone || timeDone) {
            setStage("done");
            return 0;
          }
        }
        setPhaseIndex(next);
        return pacedPhases[next].secs;
      });
    }, TICK);
    return () => clearInterval(t);
  }, [stage, phaseIndex, countUnits, pacedPhases, cfg]);

  // Rounds — actieve ademhaling (breaths of seconden)
  useEffect(() => {
    if (stage !== "active" || activePhases.length === 0) return;
    const t = setInterval(() => {
      elapsedRef.current += TICK / 1000;
      activeElapsedRef.current += TICK / 1000;
      setPhaseRemaining((r) => {
        if (r - TICK / 1000 > 0.001) return r - TICK / 1000;
        const next = (phaseIndex + 1) % activePhases.length;
        if (next === 0) {
          const breaths = countUnits + 1;
          setCountUnits(breaths);
          const byBreaths = cfg.activeBreaths && breaths >= cfg.activeBreaths;
          const bySec = cfg.activeSec && activeElapsedRef.current >= cfg.activeSec;
          if (byBreaths || bySec) {
            if (cfg.retention) {
              setRetention(0);
              setStage("retention");
            } else {
              nextRound();
            }
            return 0;
          }
        }
        setPhaseIndex(next);
        return activePhases[next].secs;
      });
    }, TICK);
    return () => clearInterval(t);
  }, [stage, phaseIndex, countUnits, activePhases, cfg, nextRound]);

  // Retentie — teller loopt op tot de gebruiker weer ademt
  useEffect(() => {
    if (stage !== "retention") return;
    const t = setInterval(() => {
      elapsedRef.current += TICK / 1000;
      setRetention((r) => r + TICK / 1000);
    }, TICK);
    return () => clearInterval(t);
  }, [stage]);

  // Herstel-hold na retentie
  useEffect(() => {
    if (stage !== "recovery") return;
    const t = setInterval(() => {
      elapsedRef.current += TICK / 1000;
      setStageRemaining((r) => {
        if (r - TICK / 1000 > 0) return r - TICK / 1000;
        nextRound();
        return 0;
      });
    }, TICK);
    return () => clearInterval(t);
  }, [stage, nextRound]);

  function endRetention() {
    haptic("tick");
    maxRetentionRef.current = Math.max(
      maxRetentionRef.current,
      Math.round(retention),
    );
    if (cfg.recoveryHoldSec && cfg.recoveryHoldSec > 0) {
      setStageRemaining(cfg.recoveryHoldSec);
      setStage("recovery");
    } else {
      nextRound();
    }
  }

  // BOLT-teller
  useEffect(() => {
    if (stage !== "bolt" || !boltRunning) return;
    const t = setInterval(() => setBoltSecs((s) => s + TICK / 1000), TICK);
    return () => clearInterval(t);
  }, [stage, boltRunning]);

  // Afronden → sessie loggen
  useEffect(() => {
    if (stage !== "done" || submittedRef.current) return;
    submittedRef.current = true;
    haptic("success");
    startTransition(async () => {
      const result = await completeBreathSession(
        level.level,
        Math.round(elapsedRef.current),
        maxRetentionRef.current > 0 ? maxRetentionRef.current : undefined,
      );
      if (result.error) {
        showMessage(result.error);
        return;
      }
      setAward(result.award);
      showAward(result.award);
    });
  }, [stage, level.level, showAward, showMessage]);

  // ── DONE ────────────────────────────────────────────────────────────────
  if (stage === "done") {
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
            {level.name}
            {award
              ? ` · +${award.amount} XP · Geest`
              : pending
                ? ""
                : " · XP van vandaag al binnen"}
          </p>
        </div>
        <p className="max-w-[280px] text-sm text-muted">
          Mooi ademwerk. Neem dit rustige gevoel mee.
        </p>
        <Link
          href="/geest/ademwerk"
          className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
        >
          Terug naar de leerlijn
        </Link>
      </div>
    );
  }

  // ── BOLT-tool ───────────────────────────────────────────────────────────
  if (stage === "bolt") {
    return (
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-line bg-card p-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          Control Pause
        </p>
        <p className="font-mono text-6xl font-semibold tabular-nums" style={{ color: GEEST }}>
          {Math.floor(boltSecs)}s
        </p>
        {boltSaved == null ? (
          <>
            <p className="max-w-[300px] text-sm text-muted">
              {boltRunning
                ? "Houd je adem in na een normale uitademing. Tik zodra je de eerste drang voelt."
                : "Adem normaal uit, knijp je neus dicht en start. Stop bij de eerste ademdrang."}
            </p>
            {!boltRunning ? (
              <button
                type="button"
                onClick={() => {
                  setBoltSecs(0);
                  setBoltRunning(true);
                }}
                className="rounded-lg px-6 py-2.5 text-sm font-semibold text-ink"
                style={{ background: GEEST }}
              >
                Start meting
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setBoltRunning(false);
                  setBoltSaved(Math.round(boltSecs));
                }}
                className="rounded-lg bg-text px-6 py-2.5 text-sm font-semibold text-ink"
              >
                Eerste ademdrang — stop
              </button>
            )}
          </>
        ) : (
          <>
            <p className="max-w-[300px] text-sm">
              Je Control Pause: <span className="font-semibold">{boltSaved}s</span>.{" "}
              {boltSaved < 20
                ? "Blijf bij de rustige niveaus; boven de 20s openen de zware sessies."
                : "Sterk — dit opent de zware niveaus."}
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await logBolt(boltSaved);
                  const result = await completeBreathSession(level.level);
                  if (!result.error) {
                    setAward(result.award);
                    showAward(result.award);
                  }
                  setStage("done");
                });
              }}
              className="rounded-lg px-6 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
              style={{ background: GEEST }}
            >
              Bewaar meting
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Live: paced / active / retention / recovery / settle ─────────────────
  if (stage !== "intro") {
    let scale = 0.7;
    let label = "";
    let count: number | null = null;
    let sub: string | null = null;
    let transition = 0.6;

    if (stage === "settle") {
      label = "Kom tot rust";
      sub = `Laat je schouders zakken · ${Math.ceil(stageRemaining)}`;
    } else if (stage === "recovery") {
      label = "Herstel-inademing";
      count = Math.ceil(stageRemaining);
      scale = 1;
      sub = `Ronde ${round + 1}/${rounds}`;
    } else if (stage === "retention") {
      label = "Houd vast";
      count = Math.floor(retention);
      scale = 0.5;
      sub = `Ronde ${round + 1}/${rounds} · tik zodra je wilt ademen`;
    } else {
      const phases = stage === "active" ? activePhases : pacedPhases;
      const phase = phases[phaseIndex];
      if (phase) {
        scale = phase.scale;
        transition = phase.secs;
        label = phase.label;
        count = Math.max(1, Math.ceil(phaseRemaining));
        if (stage === "active") {
          const total = cfg.activeBreaths ?? "";
          sub = `Ronde ${round + 1}/${rounds} · ademhaling ${countUnits + 1}${total ? `/${total}` : ""}`;
        } else if (cfg.cycles) {
          sub = `Cyclus ${Math.min(countUnits + 1, cfg.cycles)}/${cfg.cycles}`;
        } else if (cfg.durationMin) {
          sub = `Nog ${formatSecs(breathLeft)}`;
        }
      }
    }

    return (
      <div className="flex flex-col gap-6">
        <BreathOrb
          scale={scale}
          transitionSecs={transition}
          label={label}
          count={count}
          sub={sub}
        />
        {stage === "retention" ? (
          <button
            type="button"
            onClick={endRetention}
            className="mx-auto rounded-lg px-6 py-2.5 text-sm font-semibold text-ink"
            style={{ background: GEEST }}
          >
            Ik moet ademen
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStage("done")}
            className="mx-auto rounded-full border border-line px-4 py-2 text-xs text-muted transition-colors hover:text-text"
          >
            Sessie afronden
          </button>
        )}
      </div>
    );
  }

  // ── INTRO ────────────────────────────────────────────────────────────────
  const heavy = level.needsSafetyAck;
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-line bg-card p-5">
        {level.oneLiner ? (
          <p className="text-sm text-muted">{level.oneLiner}</p>
        ) : null}
        {level.prescription ? (
          <p className="mt-2 font-mono text-xs" style={{ color: GEEST }}>
            {level.prescription}
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-3">
          <Coach title="Opzet" items={level.setup} />
          <Coach title="Zo doe je het" items={level.execution} />
          {level.breathing ? (
            <p className="text-sm">
              <span className="text-muted">Ademhaling: </span>
              {level.breathing}
            </p>
          ) : null}
          {level.mistakes.length > 0 ? (
            <div className="rounded-xl border border-line bg-ink-2 px-3.5 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                Let op
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {level.mistakes.map((m, i) => (
                  <li key={i} className="text-xs text-muted">
                    · {m}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {level.media ? <MediaBlock media={level.media} /> : null}

      {heavy ? (
        <label className="flex items-start gap-3 rounded-2xl border p-4"
          style={{ borderColor: "color-mix(in srgb, var(--attr-kracht) 45%, var(--line))" }}
        >
          <input
            type="checkbox"
            checked={acked}
            onChange={(e) => setAcked(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--attr-kracht)]"
          />
          <span className="text-xs text-muted">
            Ik doe dit liggend/zittend op een veilige plek (nooit bij water of
            tijdens autorijden), en heb geen contra-indicaties (zwangerschap,
            hart-/vaatziekten, hoge bloeddruk, epilepsie, ernstige psychische
            aandoeningen). Tintelingen zijn normaal; ik stop bij nood.
          </span>
        </label>
      ) : null}

      <button
        type="button"
        disabled={!acked}
        onClick={() => {
          if (level.mode === "bolt") {
            setBoltSecs(0);
            setBoltSaved(null);
            setBoltRunning(false);
            setStage("bolt");
          } else if (level.mode === "follow") {
            setStage("done");
          } else {
            beginRunner();
          }
        }}
        className="rounded-lg px-6 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ background: GEEST }}
      >
        {level.mode === "bolt"
          ? "Meet je Control Pause"
          : level.mode === "follow"
            ? "Ik heb de sessie gedaan · +25 XP"
            : `Start · +${level.xp} XP`}
      </button>
      {level.mode === "follow" ? (
        <p className="text-center text-xs text-muted">
          Doe de sessie hierboven met Sandy; tik daarna op de knop om te loggen.
        </p>
      ) : null}
    </div>
  );
}
