"use client";

import { useState, useTransition } from "react";
import { addJournalEntry } from "@/app/(app)/actions";
import { useToast } from "./toast";

const TYPES = [
  { value: "ochtend", label: "Ochtend" },
  { value: "avond", label: "Avond" },
  { value: "dankbaarheid", label: "Dankbaarheid" },
  { value: "vrij", label: "Vrij" },
] as const;

type JournalType = (typeof TYPES)[number]["value"];

export function JournalForm() {
  const [type, setType] = useState<JournalType>("vrij");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState(7);
  const [pending, startTransition] = useTransition();
  const { showAward, showMessage } = useToast();

  function submit() {
    if (!content.trim()) return;
    startTransition(async () => {
      const result = await addJournalEntry({ type, content, mood });
      if (result.error) {
        showMessage(result.error);
        return;
      }
      setContent("");
      if (result.award) showAward(result.award);
      else showMessage("Opgeschreven. Fijn dat je het even liet landen.");
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5">
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            aria-pressed={type === t.value}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              type === t.value
                ? "border-geest bg-geest/10 text-text"
                : "border-line text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        aria-label="Journal-entry"
        className="resize-none rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-sm text-text placeholder:text-muted/60"
        placeholder={
          type === "dankbaarheid"
            ? "Waar ben je vandaag dankbaar voor?"
            : "Wat speelt er?"
        }
      />

      <label className="flex items-center gap-3 text-sm">
        <span className="text-muted">Stemming</span>
        <input
          type="range"
          min={1}
          max={10}
          value={mood}
          onChange={(e) => setMood(Number(e.target.value))}
          className="flex-1 accent-[var(--attr-geest)]"
        />
        <span className="w-8 text-right font-mono">{mood}</span>
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={pending || !content.trim()}
        className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Opslaan
      </button>
    </div>
  );
}
