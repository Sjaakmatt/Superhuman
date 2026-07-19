"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Registreert de service worker en navigeert de app op notificatie-kliks. */
export function SwRegister() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // updateViaCache: 'none' → het sw.js-script wordt altijd vers opgehaald,
    // zodat fixes daadwerkelijk in de geïnstalleerde PWA landen.
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => reg.update().catch(() => undefined))
      .catch(() => undefined);

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (data?.type === "navigate" && typeof data.url === "string") {
        router.push(data.url);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    // Vraag de service worker of er een navigatie klaarstaat (bv. na een tik op
    // een notificatie die de PWA opende). Meerdere keren proberen, want op iOS
    // opent de PWA soms op de start-url en is de pagina nog niet klaar.
    const askPending = () => {
      navigator.serviceWorker.ready
        .then((reg) =>
          (reg.active ?? navigator.serviceWorker.controller)?.postMessage({
            type: "get-pending-navigation",
          }),
        )
        .catch(() => undefined);
    };
    askPending();
    const t1 = setTimeout(askPending, 500);
    const t2 = setTimeout(askPending, 1500);

    const onVisible = () => {
      if (document.visibilityState === "visible") askPending();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [router]);

  return null;
}
