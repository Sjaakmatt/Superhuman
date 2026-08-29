import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Zonder omgevingsvariabelen draait de app nog, maar zonder database:
 *  het plan komt dan uit de seed en de invoerschermen zeggen dat eerlijk. */
export function dbConfigured(): boolean {
  return Boolean(URL && ANON);
}

/** Client voor server components en route handlers: de sessie van de gebruiker,
 *  dus RLS is van kracht. */
export const db = cache(async (): Promise<SupabaseClient | null> => {
  if (!URL || !ANON) return null;
  const store = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server components mogen geen cookies zetten; de middleware doet dat.
        }
      },
    },
  });
});

/** Service-role client. Alleen voor cron-routes en scripts — nooit in de browser
 *  en nooit in een component. */
export function admin(): SupabaseClient {
  if (!URL || !SERVICE) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY of NEXT_PUBLIC_SUPABASE_URL ontbreekt.');
  }
  return createClient(URL, SERVICE, { auth: { persistSession: false } });
}

/** De ingelogde gebruiker, of null. Doet een netwerkcall; wil je alleen weten
 *  wie het is, gebruik dan currentUserId(). */
export async function currentUser() {
  const client = await db();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user ?? null;
}

/** Het mailadres uit het token. Staat er geen naam ingevuld, dan is dit alles
 *  wat de schil heeft om een letter van te maken — en dat mag geen netwerkcall
 *  kosten bij elk scherm. */
export const currentEmail = cache(async (): Promise<string | null> => {
  const client = await db();
  if (!client) return null;
  const { data } = await client.auth.getClaims();
  const email = (data?.claims as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' ? email : null;
});

/** Het id van de ingelogde gebruiker, uit het token zelf.
 *
 *  Dit project ondertekent zijn tokens asymmetrisch, dus getClaims controleert
 *  de handtekening lokaal met WebCrypto — geen netwerkcall. Dat scheelt bij elk
 *  scherm een rondje naar Supabase, en de meeste queries hebben verder niets
 *  van het gebruikersobject nodig. */
export const currentUserId = cache(async (): Promise<string | null> => {
  const client = await db();
  if (!client) return null;
  const { data } = await client.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === 'string' ? sub : null;
});

/** Wie leest, en namens wie.
 *
 *  Zonder `athleteId` leest de sessie van de gebruiker zelf en doet RLS het
 *  filteren. Met `athleteId` — de cron, met de service-role-sleutel — staat RLS
 *  uit en filteren we zelf. Zonder dat filter zou de nachtelijke analyse van de
 *  een op de cijfers van de ander draaien. */
export type Reader = { client: SupabaseClient; athleteId: string | null };

/** De meegegeven lezer, of anders de sessie van de gebruiker. */
export async function reader(given?: Reader): Promise<Reader | null> {
  if (given) return given;
  const client = await db();
  return client ? { client, athleteId: null } : null;
}

/** Een lezer die namens één atleet leest, met de service-role-sleutel. Alleen
 *  voor cron-routes en scripts. */
export function readerFor(athleteId: string): Reader {
  return { client: admin(), athleteId };
}
