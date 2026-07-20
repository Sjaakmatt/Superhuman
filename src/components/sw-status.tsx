"use client";

import { useEffect, useState } from "react";

/** Toont welke service-worker-versie actief is + een knop om te verversen. */
export function SwStatus() {
  const [version, setVersion] = useState<string>("controleren…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      const id = setTimeout(() => setVersion("niet ondersteund"), 0);
      return () => clearTimeout(id);
    }
    let answered = false;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; version?: string } | null;
      if (data?.type === "pong" && data.version) {
        answered = true;
        setVersion(data.version);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    const ping = () =>
      navigator.serviceWorker.controller?.postMessage({ type: "ping" });
    ping();
    const t = setTimeout(() => {
      if (!answered) {
        setVersion(
          navigator.serviceWorker.controller
            ? "oude versie (reageert niet)"
            : "nog niet actief",
        );
      }
    }, 1500);

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      clearTimeout(t);
    };
  }, []);

  async function refresh() {
    if (!("serviceWorker" in navigator)) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;
      await reg.update();
      // Wachtende nieuwe worker meteen laten activeren.
      reg.waiting?.postMessage({ type: "skip-waiting" });
      // Herlaad zodra de nieuwe worker de controle overneemt.
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => window.location.reload(),
        { once: true },
      );
      // Als er niks te activeren viel, herlaad na een korte tel toch.
      setTimeout(() => window.location.reload(), 2500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Service worker</p>
        <p className="mt-0.5 font-mono text-xs text-muted">{version}</p>
      </div>
      <button
        type="button"
        onClick={refresh}
        disabled={busy}
        className="rounded-lg border border-line px-4 py-2 text-sm text-muted transition-colors hover:text-text disabled:opacity-40"
      >
        Ververs
      </button>
    </div>
  );
}
