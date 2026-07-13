import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

/** Supabase-client voor Server Components, Server Actions en Route Handlers. */
export async function createClient() {
  // cookies() eerst: dat markeert de route als dynamisch, zodat de
  // env-check niet tijdens de statische build afgaat.
  const cookieStore = await cookies();
  const { url, key } = getSupabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // setAll vanuit een Server Component: cookies worden dan
          // door de proxy (updateSession) ververst.
        }
      },
    },
  });
}
