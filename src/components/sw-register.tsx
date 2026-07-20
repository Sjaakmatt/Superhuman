"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const NAV_CACHE = "sh-nav";
const NAV_KEY = "/__pending_nav";

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

    // Snelle route: de app leeft nog en krijgt de route via een bericht.
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (data?.type === "navigate" && typeof data.url === "string") {
        router.push(data.url);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    // Robuuste route: lees een klaarstaande navigatie rechtstreeks uit de Cache.
    // Op iOS faalt in de voorgrond zowel clients.matchAll als een
    // zichtbaarheidswissel, dus we POLLEN de cache — dat werkt in elk scenario.
    let consumed = false;
    const consumePending = async () => {
      if (consumed || !("caches" in window)) return;
      try {
        const cache = await caches.open(NAV_CACHE);
        const res = await cache.match(NAV_KEY);
        if (!res) return;
        await cache.delete(NAV_KEY);
        const { url, at } = (await res.json()) as { url?: string; at?: number };
        if (url && typeof at === "number" && Date.now() - at < 180000) {
          consumed = true;
          router.push(url);
          // resetten zodat een volgende notificatie later weer werkt
          setTimeout(() => {
            consumed = false;
          }, 1500);
        }
      } catch {
        /* geen cache — dan draagt openWindow de route al */
      }
    };

    consumePending();
    const poll = setInterval(consumePending, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") consumePending();
    };
    const onFocus = () => consumePending();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
      clearInterval(poll);
    };
  }, [router]);

  return null;
}
