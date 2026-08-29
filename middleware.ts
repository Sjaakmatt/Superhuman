import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Routes zonder inlogplicht. De api-routes regelen hun eigen toegang: de
// cron-routes met CRON_SECRET, /api/strava/connect met de sessie zelf.
//
// /wachtwoord-herstellen staat er bewust NIET bij: daar hoort de sessie te
// staan die /auth/bevestig uit de herstel-link heeft gezet.
const PUBLIC = ['/login', '/wachtwoord-vergeten', '/auth', '/offline', '/api'];

/** Ververst de Supabase-sessie bij elk verzoek en stuurt uitgelogde bezoekers
 *  naar /login. Zonder database blijft alles open: de app toont dan alleen het
 *  plan uit de seed en bewaart niets. */
export async function middleware(request: NextRequest) {
  if (!URL || !ANON) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(URL, ANON, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  if (!data.user && !PUBLIC.some((p) => path.startsWith(p))) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = '';
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-maskable.svg|manifest.webmanifest|sw.js).*)'],
};
