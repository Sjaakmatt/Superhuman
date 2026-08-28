import { describe, expect, it } from 'vitest';
import { base64UrlToBytes, bytesToBase64Url, importVapidKey, vapidToken } from '@/lib/push';

/** Een echt P-256-sleutelpaar, opgebouwd zoals `web-push generate-vapid-keys`
 *  het zou geven: de publieke sleutel als ongecomprimeerd punt, de privé als
 *  ruwe scalar. */
async function keypair() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: bytesToBase64Url(raw), privateKey: jwk.d as string, verify: pair.publicKey };
}

describe('base64url', () => {
  it('gaat heen en weer zonder verlies', () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
    expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes);
  });

  it('bevat geen tekens die een URL breken', () => {
    const bytes = new Uint8Array(Array.from({ length: 64 }, (_, i) => (i * 7) % 256));
    expect(bytesToBase64Url(bytes)).not.toMatch(/[+/=]/);
  });
});

describe('VAPID', () => {
  it('maakt een JWT dat met de publieke sleutel klopt', async () => {
    const { publicKey, privateKey, verify } = await keypair();
    const token = await vapidToken('https://fcm.googleapis.com', 'mailto:sjaak@voorbeeld.nl', publicKey, privateKey);

    const [header, claims, signature] = token.split('.') as [string, string, string];
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      verify,
      base64UrlToBytes(signature),
      new TextEncoder().encode(`${header}.${claims}`),
    );
    expect(ok).toBe(true);
    expect(JSON.parse(new TextDecoder().decode(base64UrlToBytes(header)))).toEqual({ typ: 'JWT', alg: 'ES256' });
  });

  it('zet de pushdienst in aud en verloopt binnen 24 uur', async () => {
    const { publicKey, privateKey } = await keypair();
    const now = Date.UTC(2027, 0, 20, 5, 0, 0);
    const token = await vapidToken('https://updates.push.services.mozilla.com', 'mailto:x@y.nl', publicKey, privateKey, now);
    const claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(token.split('.')[1] as string)));

    expect(claims.aud).toBe('https://updates.push.services.mozilla.com');
    expect(claims.sub).toBe('mailto:x@y.nl');
    expect(claims.exp - Math.floor(now / 1000)).toBeLessThanOrEqual(24 * 3600);
    expect(claims.exp).toBeGreaterThan(Math.floor(now / 1000));
  });

  it('weigert een sleutel die niet klopt in plaats van hem stil te verbouwen', async () => {
    const { privateKey } = await keypair();
    await expect(importVapidKey('bm9wZQ', privateKey)).rejects.toThrow(/65 bytes/);
  });
});
