'use client';

import { useState } from 'react';
import { browserDb } from '@/lib/supabase-browser';
import { Card, CardTitle, Empty } from '@/components/ui';

/** Eén gebruiker, dus geen registratie: een inloglink per e-mail volstaat.
 *  RLS hangt aan deze sessie, dus zonder inloggen zie je geen eigen gegevens. */
export default function Login() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'leeg' | 'bezig' | 'verstuurd' | 'fout'>('leeg');
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const client = browserDb();
    if (!client) {
      setState('fout');
      setError('Geen database verbonden.');
      return;
    }
    setState('bezig');
    const { error: authError } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (authError) {
      setState('fout');
      setError(authError.message);
    } else {
      setState('verstuurd');
    }
  }

  return (
    <div className="mx-auto flex max-w-[460px] flex-col gap-4 pt-8">
      <Card>
        <CardTitle>Inloggen</CardTitle>
        {state === 'verstuurd' ? (
          <Empty title="Kijk in je mail">Er staat een link klaar. Die logt je in op dit apparaat.</Empty>
        ) : (
          <form onSubmit={send} className="flex flex-col gap-3">
            <label htmlFor="email" className="text-[14px]">Je e-mailadres</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
              style={{ background: 'var(--card2)', color: 'var(--ink)' }} />
            <button type="submit" disabled={state === 'bezig'}
              className="interactive rounded-[var(--r-btn)] px-4 py-3 text-[14px] font-bold"
              style={{ background: 'var(--acc)', color: 'var(--acc-ink)' }}>
              {state === 'bezig' ? 'versturen…' : 'Stuur me een link'}
            </button>
            {error ? <p className="text-[12px]" style={{ color: 'var(--crit)' }}>{error}</p> : null}
          </form>
        )}
      </Card>
    </div>
  );
}
