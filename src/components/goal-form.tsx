"use client";

import { useState, useTransition } from "react";
import { createGoal } from "@/app/(app)/actions";
import type { GoalRow, MetricRow } from "@/lib/types";
import { HORIZONS, type Horizon } from "./goal-tree";
import { useToast } from "./toast";

const PARENT_HORIZON: Record<Horizon, Horizon | null> = {
  leven: null,
  jaar: "leven",
  kwartaal: "jaar",
  week: "kwartaal",
};

interface GoalFormProps {
  goals: GoalRow[];
  metrics: Pick<MetricRow, "id" | "label">[];
}

export function GoalForm({ goals, metrics }: GoalFormProps) {
  const [title, setTitle] = useState("");
  const [horizon, setHorizon] = useState<Horizon>("week");
  const [parentId, setParentId] = useState("");
  const [metricId, setMetricId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [pending, startTransition] = useTransition();
  const { showMessage } = useToast();

  const parentHorizon = PARENT_HORIZON[horizon];
  const parentOptions = parentHorizon
    ? goals.filter((g) => g.horizon === parentHorizon)
    : [];

  function save() {
    startTransition(async () => {
      const result = await createGoal({
        title,
        horizon,
        parentId: parentId ? Number(parentId) : undefined,
        linkedMetricId: metricId ? Number(metricId) : undefined,
        targetDate: targetDate || undefined,
      });
      if (result.error) {
        showMessage(result.error);
        return;
      }
      setTitle("");
      setParentId("");
      setMetricId("");
      setTargetDate("");
      showMessage("Doel toegevoegd.");
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nieuw doel…"
        aria-label="Titel"
        className="rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-sm text-text placeholder:text-muted/60"
      />

      <div className="flex flex-wrap gap-2">
        {HORIZONS.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => {
              setHorizon(h);
              setParentId("");
            }}
            aria-pressed={horizon === h}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              horizon === h
                ? "border-focus-attr bg-focus-attr/10 text-text"
                : "border-line text-muted hover:text-text"
            }`}
          >
            {h}
          </button>
        ))}
      </div>

      {parentHorizon ? (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">Hoort bij ({parentHorizon}-doel)</span>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="rounded-lg border border-line bg-ink-2 px-2 py-2 text-sm text-text"
          >
            <option value="">— geen —</option>
            {parentOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1.5 text-sm">
          <span className="text-muted">Metric (optioneel)</span>
          <select
            value={metricId}
            onChange={(e) => setMetricId(e.target.value)}
            className="rounded-lg border border-line bg-ink-2 px-2 py-2 text-sm text-text"
          >
            <option value="">— geen —</option>
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1.5 text-sm">
          <span className="text-muted">Deadline (optioneel)</span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="rounded-lg border border-line bg-ink-2 px-2 py-2 font-mono text-sm text-text"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={pending || !title.trim()}
        className="rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Doel toevoegen
      </button>
    </div>
  );
}
