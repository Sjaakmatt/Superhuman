import webpush from 'web-push';

/* Eén melding per dag, om zes uur, met de sessie van vandaag erin. Geen
 * aanmoediging, geen streak: alleen wat er op het programma staat. */

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error('VAPID-sleutels ontbreken.');
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:ultra100@localhost',
    publicKey,
    privateKey,
  );
}

export type Subscription = { endpoint: string; p256dh: string; auth: string };

/** Stuurt de melding. Geeft false terug als het abonnement niet meer bestaat —
 *  dan mag de rij weg. */
export async function send(sub: Subscription, payload: { title: string; body: string; url: string }): Promise<boolean> {
  configure();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return true;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return false;
    throw error;
  }
}
