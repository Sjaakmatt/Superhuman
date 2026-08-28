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
// dus die gaat hier mee.
//
// Cloudflare-crons draaien in UTC. De tijden staan op wintertijd; in de zomer
// vuren ze een uur later op de klok. Zie README.
const CRON_ROUTES = {
  '10 2 * * *': '/api/strava/sync', // 03:10 — nachtelijke sync
  '0 5 * * *': '/api/push/daily', // 06:00 — melding met de sessie van vandaag
  '5 5 * * *': '/api/insight/daily', // 06:05 — de dagelijkse analyse
  '0 17 * * 5': '/api/insight/longrun', // vrijdag 18:00 — briefing voor de longrun
  '0 19 * * 0': '/api/insight/weekly', // zondag 20:00 — de weekanalyse
};

const handler = {
  fetch(request, env, ctx) {
    return openNextWorker.fetch(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    const path = CRON_ROUTES[event.cron];
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
