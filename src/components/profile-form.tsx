"use client";

import { useState, useTransition } from "react";
import { saveProfile } from "@/app/(app)/actions";
import { useToast } from "./toast";

const COMMON_TIMEZONES = [
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/London",
  "Europe/Lisbon",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Australia/Sydney",
];

interface ProfileFormProps {
  initial: { displayName: string; timezone: string };
}

export function ProfileForm({ initial }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [pending, startTransition] = useTransition();
  const { showMessage } = useToast();

  function save() {
    startTransition(async () => {
      const result = await saveProfile({ displayName, timezone });
      showMessage(result.error ?? "Profiel opgeslagen.");
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">Naam</span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Hoe mogen we je noemen?"
          className="rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-text placeholder:text-muted/60"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">Tijdzone (stuurt je dag- en streaklogica)</span>
        <input
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          list="tijdzones"
          className="rounded-lg border border-line bg-ink-2 px-3 py-2.5 font-mono text-sm text-text"
        />
        <datalist id="tijdzones">
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz} />
          ))}
        </datalist>
      </label>
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Opslaan
      </button>
    </div>
  );
}
