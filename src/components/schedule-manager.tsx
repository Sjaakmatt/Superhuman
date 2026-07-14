"use client";

import { useTransition } from "react";
import {
  syncScheduleReminders,
  toggleScheduleBlock,
} from "@/app/(app)/actions";
import { minToTime } from "@/lib/nutrition";
import type { ScheduleBlockRow } from "@/lib/types";
import { useToast } from "./toast";

export function ScheduleManager({ blocks }: { blocks: ScheduleBlockRow[] }) {
  const [pending, startTransition] = useTransition();
  const { showMessage } = useToast();

  function toggle(block: ScheduleBlockRow) {
    startTransition(async () => {
      const result = await toggleScheduleBlock(block.id, !block.enabled);
      if (result.error) showMessage(result.error);
    });
  }

  function sync() {
    startTransition(async () => {
      const result = await syncScheduleReminders();
      if (result.error) showMessage(result.error);
      else
        showMessage(
          `${result.count} herinnering${result.count === 1 ? "" : "en"} uit je dagritme gezet.`,
        );
    });
  }

  const sorted = [...blocks].sort((a, b) => a.start_min - b.start_min);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {sorted.map((block) => (
          <li
            key={block.id}
            className={`flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 ${
              block.enabled ? "" : "opacity-50"
            }`}
          >
            <span className="w-12 shrink-0 font-mono text-xs text-muted">
              {minToTime(block.start_min)}
            </span>
            <span className="min-w-0 flex-1 text-sm">{block.label}</span>
            <button
              type="button"
              onClick={() => toggle(block)}
              disabled={pending}
              aria-pressed={block.enabled}
              className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                block.enabled
                  ? "border-focus-attr bg-focus-attr/10 text-text"
                  : "border-line text-muted"
              }`}
            >
              {block.enabled ? "aan" : "uit"}
            </button>
          </li>
        ))}
        {blocks.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Je dagritme verschijnt na je eerste bezoek aan Vandaag.
          </li>
        ) : null}
      </ul>

      <button
        type="button"
        onClick={sync}
        disabled={pending || blocks.length === 0}
        className="rounded-lg border border-line px-4 py-2.5 text-sm text-muted transition-colors hover:text-text disabled:opacity-40"
      >
        Herinneringen synchroniseren uit dagritme
      </button>
    </div>
  );
}
