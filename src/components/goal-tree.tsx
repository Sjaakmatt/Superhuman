"use client";

import { useState, useTransition } from "react";
import { deleteGoal, setGoalStatus } from "@/app/(app)/actions";
import type { GoalRow } from "@/lib/types";
import { useToast } from "./toast";

export const HORIZONS = ["leven", "jaar", "kwartaal", "week"] as const;
export type Horizon = (typeof HORIZONS)[number];

interface GoalTreeProps {
  goals: GoalRow[];
  /** ritme-% (0-100) per gekoppelde metric, laatste 28 dagen */
  metricRhythm: Record<number, number>;
  metricLabels: Record<number, string>;
}

interface GoalNode extends GoalRow {
  children: GoalNode[];
}

function buildTree(goals: GoalRow[]): GoalNode[] {
  const nodes = new Map<number, GoalNode>(
    goals.map((g) => [g.id, { ...g, children: [] }]),
  );
  const roots: GoalNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const horizonRank = (g: GoalNode) =>
    HORIZONS.indexOf(g.horizon as Horizon) ?? 0;
  const sortRec = (list: GoalNode[]) => {
    list.sort((a, b) => horizonRank(a) - horizonRank(b) || a.id - b.id);
    list.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function GoalItem({
  node,
  depth,
  rhythm,
  labels,
}: {
  node: GoalNode;
  depth: number;
  rhythm: Record<number, number>;
  labels: Record<number, string>;
}) {
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const { showMessage } = useToast();
  const done = node.status === "done";

  function toggleDone() {
    startTransition(async () => {
      const result = await setGoalStatus(node.id, done ? "active" : "done");
      if (result.error) showMessage(result.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteGoal(node.id);
      if (result.error) showMessage(result.error);
    });
  }

  return (
    <li>
      <div
        className={`flex items-center gap-2.5 rounded-2xl border border-line bg-card p-3 ${
          done ? "opacity-50" : ""
        }`}
        style={{ marginLeft: depth * 16 }}
      >
        <button
          type="button"
          onClick={toggleDone}
          disabled={pending}
          aria-pressed={done}
          aria-label={done ? "Markeer als actief" : "Markeer als afgerond"}
          className="flex size-6 shrink-0 items-center justify-center rounded-md border border-line"
        >
          {done ? (
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              stroke="var(--attr-focus)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 8.5 6.5 12 13 4.5" />
            </svg>
          ) : null}
        </button>

        <div className="min-w-0 flex-1">
          <p className={`text-sm ${done ? "line-through" : ""}`}>{node.title}</p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {node.horizon}
            {node.target_date ? ` · ${node.target_date}` : ""}
            {node.linked_metric_id && labels[node.linked_metric_id]
              ? ` · ${labels[node.linked_metric_id]}`
              : ""}
          </p>
          {node.linked_metric_id != null &&
          rhythm[node.linked_metric_id] != null ? (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${rhythm[node.linked_metric_id]}%`,
                    background: "var(--attr-focus)",
                  }}
                />
              </div>
              <span className="font-mono text-[10px] text-muted">
                {rhythm[node.linked_metric_id]}%
              </span>
            </div>
          ) : null}
        </div>

        {node.children.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Subdoelen inklappen" : "Subdoelen uitklappen"}
            className="size-8 shrink-0 rounded-full border border-line text-muted transition-colors hover:text-text"
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label="Doel verwijderen"
            className="size-8 shrink-0 rounded-full border border-line text-muted transition-colors hover:text-text"
          >
            ×
          </button>
        )}
      </div>
      {open && node.children.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2">
          {node.children.map((child) => (
            <GoalItem
              key={child.id}
              node={child}
              depth={depth + 1}
              rhythm={rhythm}
              labels={labels}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function GoalTree({ goals, metricRhythm, metricLabels }: GoalTreeProps) {
  const roots = buildTree(goals);

  if (roots.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
        Nog geen doelen — begin bij een levensdoel en werk omlaag naar de week.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {roots.map((node) => (
        <GoalItem
          key={node.id}
          node={node}
          depth={0}
          rhythm={metricRhythm}
          labels={metricLabels}
        />
      ))}
    </ul>
  );
}
