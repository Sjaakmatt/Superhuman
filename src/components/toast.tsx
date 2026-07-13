"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { ATTRIBUTES } from "@/lib/attributes";
import type { XpAward } from "@/lib/xp";

interface ToastState {
  id: number;
  award?: XpAward;
  message?: string;
}

interface ToastContextValue {
  /** Toont "+40 XP · Soepelheid" en bij level-up een extra regel. */
  showAward: (award: XpAward | null) => void;
  showMessage: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast buiten ToastProvider gebruikt");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: Omit<ToastState, "id">) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ ...next, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const showAward = useCallback(
    (award: XpAward | null) => {
      if (award) show({ award });
    },
    [show],
  );

  const showMessage = useCallback(
    (message: string) => show({ message }),
    [show],
  );

  const attr = toast?.award ? ATTRIBUTES[toast.award.attributeKey] : null;

  return (
    <ToastContext.Provider value={{ showAward, showMessage }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4"
      >
        {toast ? (
          <div
            key={toast.id}
            className="rounded-full border border-line bg-card-2 px-4 py-2 text-center shadow-lg"
            style={
              attr
                ? { boxShadow: `0 0 24px -6px ${attr.colorVar}` }
                : undefined
            }
          >
            {toast.award && attr ? (
              <p className="font-mono text-sm">
                <span style={{ color: attr.colorVar }}>
                  +{toast.award.amount} XP · {attr.label}
                </span>
                {toast.award.levelUp ? (
                  <span className="ml-2 font-semibold text-text">
                    LEVEL UP! → L{toast.award.level}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="text-sm text-text">{toast.message}</p>
            )}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
