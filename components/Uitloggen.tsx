'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardTitle, Note } from '@/components/ui';
import { browserDb } from '@/lib/supabase-browser';

/** Uitloggen hoorde er nog niet te zijn toen inloggen via een mail-link ging.
 *  Met een wachtwoord wil je het wel: op een gedeeld apparaat is dit de enige
 *  manier om de sessie te beëindigen. */
export default function Uitloggen({ email }: { email: string | null }) {
  const router = useRouter();
  const [bezig, setBezig] = useState(false);

  async function uitloggen() {
    const client = browserDb();
    if (!client) return;
    setBezig(true);
    await client.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <Card sunk>
      <CardTitle aside={email ?? undefined}>Sessie</CardTitle>
      <button type="button" onClick={uitloggen} disabled={bezig}
        className="interactive rounded-[var(--r-btn)] px-4 py-2.5 text-[13px] font-semibold"
        style={{ background: 'var(--card)', color: 'var(--ink2)', border: '1px solid var(--hair)' }}>
        {bezig ? 'bezig…' : 'Uitloggen'}
      </button>
      <Note>Je blijft ingelogd tot je hier op drukt. Wachtwoord kwijt? Log uit en gebruik de herstel-link op het inlogscherm.</Note>
    </Card>
  );
}
