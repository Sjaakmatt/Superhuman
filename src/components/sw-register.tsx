"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Registreert de service worker en navigeert de app op notificatie-kliks. */
export function SwRegister() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => undefined);

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (data?.type === "navigate" && typeof data.url === "string") {
        router.push(data.url);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    // Net geopend/herleefd vanuit een notificatie? Haal een eventueel gemiste
    // navigatie op bij de service worker.
    navigator.serviceWorker.ready
      .then((reg) =>
        reg.active?.postMessage({ type: "get-pending-navigation" }),
      )
      .catch(() => undefined);

    return () =>
      navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}
