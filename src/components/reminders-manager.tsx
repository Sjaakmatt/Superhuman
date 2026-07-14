"use client";

import { useState, useTransition } from "react";
import {
  deleteReminder,
  toggleReminder,
  upsertReminder,
} from "@/app/(app)/actions";
import type { ReminderRow } from "@/lib/types";
import { useToast } from "./toast";

const KINDS = [
  { value: "water", label: "Water" },
  { value: "stretch", label: "Stretchen" },
  { value: "meditation", label: "Meditatie" },
  { value: "review", label: "Weekreview" },
  { value: "custom", label: "Anders" },
] as const;

const DAYS = [
  { code: "MO", label: "ma" },
  { code: "TU", label: "di" },
  { code: "WE", label: "wo" },
  { code: "TH", label: "do" },
  { code: "FR", label: "vr" },
  { code: "SA", label: "za" },
  { code: "SU", label: "zo" },
] as const;

const ALL_DAYS = DAYS.map((d) => d.code);

function parseTimes(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter((t) => /^\d{1,2}:\d{2}$/.test(t))
    .map((t) => (t.length === 4 ? `0${t}` : t));
}

export function RemindersManager({ reminders }: { reminders: ReminderRow[] }) {
  const [kind, setKind] = useState<string>("water");
  const [label, setLabel] = useState("");
  const [timesRaw, setTimesRaw] = useState("09:00");
  const [days, setDays] = useState<string[]>(ALL_DAYS);
  const [pending, startTransition] = useTransition();
  const { showMessage } = useToast();

  function toggleDay(code: string) {
    setDays((d) =>
      d.includes(code) ? d.filter((c) => c !== code) : [...d, code],
    );
  }

  function add() {
    const times = parseTimes(timesRaw);
    startTransition(async () => {
      const result = await upsertReminder({
        kind,
        label: label || (KINDS.find((k) => k.value === kind)?.label ?? kind),
        times,
        days: ALL_DAYS.filter((c) => days.includes(c)),
        enabled: true,
      });
      if (result.error) {
        showMessage(result.error);
        return;
      }
      setLabel("");
      showMessage("Reminder toegevoegd.");
    });
  }

  function toggle(reminder: ReminderRow) {
    startTransition(async () => {
      const result = await toggleReminder(reminder.id, !reminder.enabled);
      if (result.error) showMessage(result.error);
    });
  }

  function remove(id: number) {
    startTransition(async () => {
      const result = await deleteReminder(id);
      if (result.error) showMessage(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Nieuwe reminder */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              aria-pressed={kind === k.value}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                kind === k.value
                  ? "border-vitaliteit bg-vitaliteit/10 text-text"
                  : "border-line text-muted hover:text-text"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        {kind === "custom" ? (
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Waar wil je aan herinnerd worden?"
            aria-label="Label"
            className="rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-sm text-text placeholder:text-muted/60"
          />
        ) : null}
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">Tijden (bijv. 09:00, 13:00, 17:00)</span>
          <input
            value={timesRaw}
            onChange={(e) => setTimesRaw(e.target.value)}
            className="rounded-lg border border-line bg-ink-2 px-3 py-2.5 font-mono text-sm text-text"
          />
        </label>
        <div className="flex gap-1.5" role="group" aria-label="Dagen">
          {DAYS.map((d) => (
            <button
              key={d.code}
              type="button"
              onClick={() => toggleDay(d.code)}
              aria-pressed={days.includes(d.code)}
              className={`flex-1 rounded-lg border py-1.5 font-mono text-xs transition-colors ${
                days.includes(d.code)
                  ? "border-vitaliteit bg-vitaliteit/10 text-text"
                  : "border-line text-muted hover:text-text"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={add}
          disabled={pending || parseTimes(timesRaw).length === 0 || days.length === 0}
          className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Reminder toevoegen
        </button>
      </div>

      {/* Bestaande reminders */}
      <ul className="flex flex-col gap-2">
        {reminders.map((reminder) => (
          <li
            key={reminder.id}
            className={`flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 ${
              reminder.enabled ? "" : "opacity-50"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm">{reminder.label ?? reminder.kind}</p>
              <p className="font-mono text-xs text-muted">
                {(reminder.schedule?.times ?? []).join(" · ")}
                {" — "}
                {(reminder.schedule?.days ?? []).length === 7
                  ? "elke dag"
                  : (reminder.schedule?.days ?? [])
                      .map(
                        (c) => DAYS.find((d) => d.code === c)?.label ?? c,
                      )
                      .join(" ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggle(reminder)}
              disabled={pending}
              aria-pressed={reminder.enabled}
              className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                reminder.enabled
                  ? "border-vitaliteit bg-vitaliteit/10 text-text"
                  : "border-line text-muted"
              }`}
            >
              {reminder.enabled ? "aan" : "uit"}
            </button>
            <button
              type="button"
              onClick={() => remove(reminder.id)}
              disabled={pending}
              aria-label="Reminder verwijderen"
              className="size-8 shrink-0 rounded-full border border-line text-muted transition-colors hover:text-text"
            >
              ×
            </button>
          </li>
        ))}
        {reminders.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Nog geen reminders — een water-reminder overdag is een goed begin.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
