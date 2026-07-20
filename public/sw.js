/* Superhuman OS service worker: web-push + notificatie-klik.
   Bewust geen agressieve caching — de app is server-first. */

const SW_VERSION = "2026-07-20-deeplink-2";
const DEFAULT_URL = "/vandaag";
const NAV_CACHE = "sh-nav";
const NAV_KEY = "/__pending_nav";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Superhuman OS",
    body: "Tijd voor je volgende actie.",
    url: DEFAULT_URL,
  };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url || DEFAULT_URL },
    }),
  );
});

// Bewaar de doelroute DUURZAAM in de Cache API. In-memory state overleeft niet
// (iOS schiet de service worker tussen klik en paginalaad af); de Cache wel, en
// is bovendien rechtstreeks leesbaar vanuit de pagina — geen timing/messaging.
async function setPending(url) {
  try {
    const cache = await caches.open(NAV_CACHE);
    await cache.put(
      NAV_KEY,
      new Response(JSON.stringify({ url, at: Date.now() }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch {
    /* cache niet beschikbaar — dan valt de app terug op de URL van openWindow */
  }
}

async function readPending() {
  try {
    const cache = await caches.open(NAV_CACHE);
    const res = await cache.match(NAV_KEY);
    if (!res) return null;
    await cache.delete(NAV_KEY);
    const { url, at } = await res.json();
    return url && Date.now() - at < 180000 ? url : null;
  } catch {
    return null;
  }
}

async function openTo(url) {
  const abs = new URL(url, self.location.origin).href;
  await setPending(url);

  const all = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of all) {
    if (new URL(client.url).origin === self.location.origin) {
      try {
        await client.focus();
      } catch {
        /* focus mag falen; de pagina leest de route uit de cache */
      }
      client.postMessage({ type: "navigate", url });
      return;
    }
  }
  await self.clients.openWindow(abs);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || DEFAULT_URL;
  event.waitUntil(openTo(url));
});

self.addEventListener("message", (event) => {
  const type = event.data?.type;
  // Een pagina kan expliciet naar een klaarstaande navigatie vragen.
  if (type === "get-pending-navigation") {
    event.waitUntil(
      (async () => {
        const url = await readPending();
        if (url) event.source?.postMessage({ type: "navigate", url });
      })(),
    );
  }
  // Diagnostiek: welke versie draait er?
  if (type === "ping") {
    event.source?.postMessage({ type: "pong", version: SW_VERSION });
  }
  // Forceer directe activatie van een wachtende nieuwe worker.
  if (type === "skip-waiting") {
    self.skipWaiting();
  }
});
