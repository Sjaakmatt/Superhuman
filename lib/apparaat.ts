import { admin } from '@/lib/db';

/* Koppelen van een telefoon aan een atleet.
 *
 * Het token gaat één keer over de lijn en wordt daarna alleen als hash bewaard:
 * een lek in de database geeft dan niemand toegang. Web Crypto in plaats van
 * node:crypto, want dit draait op Workers. */

export async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Zonder klinkers en zonder 0/O/1/I: anders typt hij hem verkeerd over. */
const ALFABET = 'ACDEFGHJKLMNPQRTUVWXY34679';

export function koppelcode(lengte = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(lengte));
  return Array.from(bytes, (b) => ALFABET[b % ALFABET.length]).join('');
}

export function apparaatToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Het apparaat achter een Authorization-header, of null. */
export async function apparaatVanVerzoek(request: Request) {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;

  const { data } = await admin()
    .from('device')
    .select('id, athlete_id')
    .eq('token_hash', await hashToken(auth.slice(7)))
    .maybeSingle();

  return (data as { id: string; athlete_id: string } | null) ?? null;
}
