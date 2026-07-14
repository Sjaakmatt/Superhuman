"use client";

import { useState, useTransition } from "react";
import { checkinFood } from "@/app/(app)/actions";
import { useToast } from "./toast";

export const FEELINGS = [
  "licht & energiek",
  "prima",
  "te zwaar",
  "te weinig",
  "gestrest gegeten",
] as const;

interface FoodCheckinFormProps {
  initial?: {
    satisfied: boolean | null;
    feeling: string | null;
    note: string | null;
  } | null;
}

export function FoodCheckinForm({ initial }: FoodCheckinFormProps) {
  const [satisfied, setSatisfied] = useState<boolean | null>(
    initial?.satisfied ?? null,
  );
  const [feeling, setFeeling] = useState<string | null>(
    initial?.feeling ?? null,
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [pending, startTransition] = useTransition();
  const { showAward, showMessage } = useToast();

  const alreadyCheckedIn = Boolean(initial);
  const canSubmit = satisfied !== null && feeling !== null && !pending;

  function submit() {
    if (satisfied === null || feeling === null) return;
    startTransition(async () => {
      const result = await checkinFood({ satisfied, feeling, note });
      if (result.error) {
        showMessage(result.error);
      } else if (result.award) {
        showAward(result.award);
      } else {
        showMessage("Bijgewerkt. Morgen bouw je hierop voort.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-line bg-card p-5">
      <fieldset>
        <legend className="text-sm">Voldaan aan je voeding?</legend>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {[
            { value: true, label: "Ja" },
            { value: false, label: "Nee" },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setSatisfied(opt.value)}
              aria-pressed={satisfied === opt.value}
              className={`rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                satisfied === opt.value
                  ? "border-voeding bg-voeding/10 text-text"
                  : "border-line text-muted hover:text-text"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm">Hoe voelde je eten vandaag?</legend>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {FEELINGS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFeeling(f)}
              aria-pressed={feeling === f}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                feeling === f
                  ? "border-voeding bg-voeding/10 text-text"
                  : "border-line text-muted hover:text-text"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">Notitie (optioneel)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="resize-none rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-text placeholder:text-muted/60"
          placeholder="Bijv. veel zin in zoet vanmiddag…"
        />
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {alreadyCheckedIn ? "Check-in bijwerken" : "Check-in opslaan · +20 XP"}
      </button>
    </div>
  );
}
