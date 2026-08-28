/* Web push zonder bibliotheek: `web-push` leunt op node:https en node:crypto en
 * draait daarom niet op Cloudflare Workers. Wat overblijft is de Web Crypto API,
 * en dat is genoeg — mits we een melding zonder inhoud versturen.
 *
 * Een push zonder payload heeft alleen een VAPID-handtekening nodig; de
 * payloadversleuteling uit RFC 8291 valt dan helemaal weg. De service worker
 * haalt de tekst zelf op bij /api/push/today. Bijkomend voordeel: de melding
 * toont wat er nú in het plan staat, niet wat er stond toen de cron vuurde. */

export type Subscription = { endpoint: string; p256dh: string; auth: string };

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

const enc = new TextEncoder();

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** De privésleutel is de ruwe 32-byte scalar, de publieke een ongecomprimeerd
 *  punt (0x04 ‖ x ‖ y). Web Crypto wil ze samen als JWK. */
export async function importVapidKey(publicKey: string, privateKey: string): Promise<CryptoKey> {
  const point = base64UrlToBytes(publicKey);
  if (point.length !== 65 || point[0] !== 0x04) {
    throw new Error('VAPID_PUBLIC_KEY is geen ongecomprimeerd P-256-punt van 65 bytes.');
  }
  const d = base64UrlToBytes(privateKey);
  if (d.length !== 32) throw new Error('VAPID_PRIVATE_KEY is geen scalar van 32 bytes.');

  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: bytesToBase64Url(point.slice(1, 33)),
      y: bytesToBase64Url(point.slice(33, 65)),
      d: bytesToBase64Url(d),
      ext: false,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

/** Het JWT dat de pushdienst bewijst dat de melding van ons komt. Twaalf uur
 *  geldig; de specificatie staat hoogstens 24 toe. */
export async function vapidToken(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string,
  now: number = Date.now(),
): Promise<string> {
  const header = bytesToBase64Url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = bytesToBase64Url(
    enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })),
  );
  const signingInput = `${header}.${claims}`;

  const key = await importVapidKey(publicKey, privateKey);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(signingInput),
  );

  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export type SendResult = 'verstuurd' | 'verlopen' | 'mislukt';

/** Verstuurt één melding zonder inhoud. `verlopen` betekent dat het abonnement
 *  weg mag: het apparaat heeft de app verwijderd of de toestemming ingetrokken. */
export async function send(subscription: Subscription): Promise<SendResult> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error('VAPID-sleutels ontbreken.');

  const audience = new URL(subscription.endpoint).origin;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:ultra100@localhost';
  const token = await vapidToken(audience, subject, publicKey, privateKey);

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      authorization: `vapid t=${token}, k=${publicKey}`,
      ttl: '3600',
      urgency: 'normal',
      'content-length': '0',
    },
  });

  if (response.status === 404 || response.status === 410) return 'verlopen';
  if (!response.ok) {
    console.error(`[push] ${audience} gaf ${response.status}: ${(await response.text()).slice(0, 200)}`);
    return 'mislukt';
  }
  return 'verstuurd';
}
