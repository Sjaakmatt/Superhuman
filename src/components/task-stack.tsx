"use client";

import Link from "next/link";
import { useTransition } from "react";
import { logMetric } from "@/app/(app)/actions";
import { ATTRIBUTES } from "@/lib/attributes";
import type { DayTask } from "@/lib/types";
import { useToast } from "./toast";

function TaskIcon({ task }: { task: DayTask }) {
  const color = ATTRIBUTES[task.attribute].colorVar;
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line"
      style={task.done ? undefined : { boxShadow: `0 0 10px -2px ${color}` }}
    >
      {task.done ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8.5 6.5 12 13 4.5" />
        </svg>
      ) : (
        <span
          className="size-2.5 rounded-full"
          style={{ background: color }}
        />
      )}
    </span>
  );
}

function TaskBody({ task }: { task: DayTask }) {
  return (
    <>
      <TaskIcon task={task} />
      <span className="min-w-0 flex-1 text-left">
        <span className={`block text-sm ${task.done ? "line-through" : ""}`}>
          {task.label}
        </span>
        <span className="block text-xs text-muted">{task.meta}</span>
      </span>
      <span className="font-mono text-xs text-muted">+{task.xp} XP</span>
    </>
  );
}

export function TaskStack({ tasks }: { tasks: DayTask[] }) {
  const [pending, startTransition] = useTransition();
  const { showAward, showMessage } = useToast();

  function complete(metricId: number) {
    startTransition(async () => {
      const result = await logMetric(metricId);
      if (result.error) showMessage(result.error);
      else showAward(result.award);
    });
  }

  return (
    <section aria-label="Taken van vandaag" className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted">Vandaag</h2>
      <ul className="flex flex-col gap-2">
        {tasks.map((task) => {
          const baseClass = `flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-3 transition-opacity ${
            task.done ? "opacity-50" : ""
          }`;
          return (
            <li key={task.id}>
              {task.href && !task.done ? (
                <Link href={task.href} className={baseClass}>
                  <TaskBody task={task} />
                </Link>
              ) : task.metricId && !task.done ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => complete(task.metricId!)}
                  className={`${baseClass} disabled:opacity-60`}
                >
                  <TaskBody task={task} />
                </button>
              ) : (
                <div className={baseClass}>
                  <TaskBody task={task} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
