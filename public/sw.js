/* Superhuman OS service worker: web-push + notificatie-klik.
   Bewust geen agressieve caching — de app is server-first. */

const DEFAULT_URL = "/vandaag";

// Onthoud kort de laatst-gevraagde navigatie, zodat een net-herleefde PWA-pagina
// (waarvan de JS was weggegooid en de eerste postMessage miste) 'm alsnog ophaalt.
let pendingNavigation = null; // { url, at }

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

// Open de app op de juiste route. Bestaat er al een venster, dan focussen we dat
// en laten de app zélf client-side navigeren (betrouwbaarder dan client.navigate
// in een geïnstalleerde PWA). Anders openen we een nieuw venster op de route.
async function openTo(url) {
  const all = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of all) {
    if (new URL(client.url).origin === self.location.origin) {
      pendingNavigation = { url, at: Date.now() };
      await client.focus();
      client.postMessage({ type: "navigate", url });
      return;
    }
  }
  pendingNavigation = null;
  await self.clients.openWindow(url);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || DEFAULT_URL;
  event.waitUntil(openTo(url));
});

// Een (mogelijk net herleefde) pagina vraagt of er nog een navigatie klaarstaat.
self.addEventListener("message", (event) => {
  if (event.data?.type === "get-pending-navigation") {
    const p = pendingNavigation;
    pendingNavigation = null;
    if (p && Date.now() - p.at < 120000) {
      event.source?.postMessage({ type: "navigate", url: p.url });
    }
  }
});
