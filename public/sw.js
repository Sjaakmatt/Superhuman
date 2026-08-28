/* Zo weinig mogelijk service worker: de schil offline, verder niets cachen.
   Een trainingsapp die verouderde cijfers toont is erger dan een die zegt dat
   hij geen verbinding heeft. */
const SHELL = 'ultra100-shell-v1';
const OFFLINE = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll([OFFLINE, '/icon.svg'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});

/* De push komt zonder inhoud binnen — dat scheelt de payloadversleuteling en
   houdt de melding actueel. We halen de tekst hier op. */
self.addEventListener('push', (event) => {
  event.waitUntil(
    fetch('/api/push/today', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((data) =>
        self.registration.showNotification((data && data.title) || 'Vandaag', {
          body: (data && data.body) || 'Open de app voor de sessie van vandaag.',
          icon: '/icon.svg',
          badge: '/icon.svg',
          data: { url: (data && data.url) || '/' },
          tag: 'vandaag',
        }),
      ),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) if ('focus' in client) return client.navigate(url).then((c) => c && c.focus());
      return self.clients.openWindow(url);
    }),
  );
});
