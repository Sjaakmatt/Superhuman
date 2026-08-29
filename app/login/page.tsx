'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import AuthCard from '@/components/AuthCard';
import { Fout, Knop, Veld } from '@/components/auth-form';
import { browserDb } from '@/lib/supabase-browser';
import { inHetNederlands } from '@/lib/auth';

/** Inloggen met e-mailadres en wachtwoord. Geen registratie: deze app heeft
 *  één gebruiker, en aanmelden staat uit in Supabase. */
function Formulier() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(params.get('fout'));

  async function inloggen(e: React.FormEvent) {
    e.preventDefault();
    const client = browserDb();
    if (!client) {
      setFout('Geen database verbonden.');
      return;
    }
    setBezig(true);
    setFout(null);

    const { error } = await client.auth.signInWithPassword({ email, password: wachtwoord });
    if (error) {
      setFout(inHetNederlands(error.message));
      setBezig(false);
      return;
    }
    // Volledige navigatie, zodat de server de nieuwe sessiecookie meteen ziet.
    router.replace('/');
    router.refresh();
  }

  return (
    <AuthCard
      title="Inloggen"
      onder={
        <>
          Wachtwoord kwijt?{' '}
          <Link href="/wachtwoord-vergeten" style={{ color: 'var(--acc)' }}>Stuur me een herstel-link</Link>
        </>
      }
    >
      <form onSubmit={inloggen} className="flex flex-col gap-4">
        <Veld label="E-mailadres" type="email" name="email" autoComplete="username" required
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <Veld label="Wachtwoord" type="password" name="password" autoComplete="current-password" required
          value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} />
        <Fout>{fout}</Fout>
        <Knop bezig={bezig}>Inloggen</Knop>
      </form>
    </AuthCard>
  );
}

export default function Login() {
  return (
    <Suspense>
      <Formulier />
    </Suspense>
  );
}
