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
export async function db(): Promise<SupabaseClient | null> {
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
}

/** Service-role client. Alleen voor cron-routes en scripts — nooit in de browser
 *  en nooit in een component. */
export function admin(): SupabaseClient {
  if (!URL || !SERVICE) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY of NEXT_PUBLIC_SUPABASE_URL ontbreekt.');
  }
  return createClient(URL, SERVICE, { auth: { persistSession: false } });
}

/** De ingelogde gebruiker, of null. */
export async function currentUser() {
  const client = await db();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user ?? null;
}
