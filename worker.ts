// Eigen Worker-entrypoint voor OpenNext.
//
// De door OpenNext gegenereerde worker (`.open-next/worker.js`) exporteert
// alleen een fetch-handler en zijn Durable Objects. Door er een eigen entry
// omheen te zetten kunnen we er een `scheduled()` aan hangen voor de Cloudflare
// Cron Triggers, zonder de OpenNext-build te raken.
//
// Dit bestand staat buiten tsc (zie tsconfig "exclude") omdat de import pas
// resolvet ná `opennextjs-cloudflare build`.
import openNextWorker from './.open-next/worker.js';

// De Durable Objects van OpenNext moeten vanaf de entry geëxporteerd worden.
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';

// Cron-expressie → interne route. De routes controleren zelf CRON_SECRET,
// dus die gaat hier mee. Deze lijst moet gelijk lopen met "triggers.crons" in
// wrangler.jsonc; test/cron.test.ts bewaakt dat.
//
// Cloudflare-crons draaien in UTC. De tijden staan op wintertijd; in de zomer
// vuren ze een uur later op de klok. Zie README.
const CRON_ROUTES = {
  '10 2 * * *': '/api/strava/sync', // 03:10 — nachtelijke sync
  '0 5 * * *': '/api/push/daily', // 06:00 — melding met de sessie van vandaag
  '5 5 * * *': '/api/insight/daily', // 06:05 — de dagelijkse analyse
  '0 17 * * FRI': '/api/insight/longrun', // vrijdag 18:00 — briefing voor de longrun
  '0 19 * * SUN': '/api/insight/weekly', // zondag 20:00 — de weekanalyse
};

// Cloudflare geeft de expressie terug zoals hij geconfigureerd is, maar we
// vertrouwen niet op de exacte schrijfwijze: hoofdletters en dubbele spaties
// mogen het opzoeken niet breken.
const normaliseer = (cron) => cron.trim().replace(/\s+/g, ' ').toUpperCase();

const ROUTE_OP_CRON = new Map(
  Object.entries(CRON_ROUTES).map(([cron, route]) => [normaliseer(cron), route]),
);

const handler = {
  fetch(request, env, ctx) {
    return openNextWorker.fetch(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    const path = ROUTE_OP_CRON.get(normaliseer(event.cron));
    if (!path) {
      console.warn(`[cron] onbekende expressie: ${event.cron}`);
      return;
    }

    const run = openNextWorker.fetch(
      new Request(`https://ultra100.internal${path}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${env.CRON_SECRET ?? ''}` },
      }),
      env,
      ctx,
    );

    // waitUntil, anders kapt de tick het verzoek halverwege af.
    ctx.waitUntil(
      run
        .then(async (res) => {
          const body = (await res.text()).slice(0, 300);
          if (res.ok) console.log(`[cron] ${path} → ${body}`);
          else console.error(`[cron] ${path} → ${res.status}: ${body}`);
        })
        .catch((err) => console.error(`[cron] ${path} faalde:`, err)),
    );
  },
};

export default handler;
