"use client";

import { useState, useTransition } from "react";
import { saveReview } from "@/app/(app)/actions";
import { ATTRIBUTE_KEYS, ATTRIBUTES } from "@/lib/attributes";
import type { ReviewRow } from "@/lib/types";
import { useToast } from "./toast";

interface ReviewFormProps {
  weekStart: string;
  existing: ReviewRow | null;
}

export function ReviewForm({ weekStart, existing }: ReviewFormProps) {
  const [wins, setWins] = useState(existing?.wins ?? "");
  const [lessons, setLessons] = useState(existing?.lessons ?? "");
  const [adjustments, setAdjustments] = useState(existing?.adjustments ?? "");
  const [focusNext, setFocusNext] = useState(existing?.focus_next ?? "");
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      ATTRIBUTE_KEYS.map((k) => [k, existing?.domain_scores?.[k] ?? 7]),
    ),
  );
  const [pending, startTransition] = useTransition();
  const { showAward, showMessage } = useToast();

  function submit() {
    startTransition(async () => {
      const result = await saveReview({
        weekStart,
        wins,
        lessons,
        adjustments,
        domainScores: scores,
        focusNext,
      });
      if (result.error) {
        showMessage(result.error);
        return;
      }
      if (result.award) showAward(result.award);
      else showMessage("Review bijgewerkt.");
    });
  }

  const prompts = [
    {
      label: "Wat ging goed deze week?",
      value: wins,
      set: setWins,
      placeholder: "Wins, hoe klein ook…",
    },
    {
      label: "Wat heb je geleerd?",
      value: lessons,
      set: setLessons,
      placeholder: "Patronen, verrassingen, inzichten…",
    },
    {
      label: "Wat pas je aan?",
      value: adjustments,
      set: setAdjustments,
      placeholder: "Eén of twee concrete aanpassingen…",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {prompts.map((p) => (
        <label key={p.label} className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">{p.label}</span>
          <textarea
            value={p.value}
            onChange={(e) => p.set(e.target.value)}
            rows={3}
            placeholder={p.placeholder}
            className="resize-none rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-sm text-text placeholder:text-muted/60"
          />
        </label>
      ))}

      <fieldset className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <legend className="px-1 text-sm text-muted">Score per domein</legend>
        {ATTRIBUTE_KEYS.map((key) => (
          <label key={key} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: ATTRIBUTES[key].colorVar }}
            />
            <span className="w-24 shrink-0">{ATTRIBUTES[key].label}</span>
            <input
              type="range"
              min={1}
              max={10}
              value={scores[key]}
              onChange={(e) =>
                setScores((s) => ({ ...s, [key]: Number(e.target.value) }))
              }
              aria-label={`Score ${ATTRIBUTES[key].label}`}
              className="min-w-0 flex-1"
              style={{ accentColor: ATTRIBUTES[key].colorVar }}
            />
            <span className="w-6 text-right font-mono">{scores[key]}</span>
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">Focus voor volgende week</span>
        <input
          value={focusNext}
          onChange={(e) => setFocusNext(e.target.value)}
          placeholder="Eén ding dat de week draagt…"
          className="rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-sm text-text placeholder:text-muted/60"
        />
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {existing ? "Review bijwerken" : "Review opslaan · +25 XP"}
      </button>
    </div>
  );
}
