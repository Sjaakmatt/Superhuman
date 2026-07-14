"use client";

import { useTransition } from "react";
import { generateShoppingList, toggleShoppingItem } from "@/app/(app)/actions";
import type { ShoppingItemRow } from "@/lib/types";
import { useToast } from "./toast";

interface ShoppingListProps {
  weekStart: string;
  items: ShoppingItemRow[];
}

export function ShoppingList({ weekStart, items }: ShoppingListProps) {
  const [pending, startTransition] = useTransition();
  const { showMessage } = useToast();

  function generate() {
    startTransition(async () => {
      const result = await generateShoppingList(weekStart);
      if (result.error) showMessage(result.error);
      else if (result.items === 0)
        showMessage("Geen ingrediënten gevonden — plan eerst maaltijden in.");
      else showMessage(`Lijst gegenereerd: ${result.items} items.`);
    });
  }

  function toggle(item: ShoppingItemRow) {
    startTransition(async () => {
      const result = await toggleShoppingItem(item.id, !item.checked);
      if (result.error) showMessage(result.error);
    });
  }

  const remaining = items.filter((i) => !i.checked).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
        <p className="text-sm text-muted">
          {items.length > 0 ? `${remaining} van ${items.length} te gaan` : "Nog geen lijst"}
        </p>
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:text-text disabled:opacity-40"
        >
          {items.length > 0 ? "Opnieuw genereren" : "Genereer uit plan"}
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => toggle(item)}
              disabled={pending}
              aria-pressed={item.checked}
              className={`flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-left transition-opacity ${
                item.checked ? "opacity-50" : ""
              }`}
            >
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-md border border-line"
              >
                {item.checked ? (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="var(--attr-voeding)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 8.5 6.5 12 13 4.5" />
                  </svg>
                ) : null}
              </span>
              <span
                className={`min-w-0 flex-1 text-sm ${item.checked ? "line-through" : ""}`}
              >
                {item.name}
              </span>
              {item.qty ? (
                <span className="font-mono text-xs text-muted">
                  {item.qty}
                  {item.unit ? ` ${item.unit}` : ""}
                </span>
              ) : null}
            </button>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Plan maaltijden in en genereer de lijst — ingrediënten worden
            automatisch opgeteld.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
