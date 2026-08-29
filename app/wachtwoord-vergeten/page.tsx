'use client';

import { useState } from 'react';
import Link from 'next/link';
import AuthCard from '@/components/AuthCard';
import { Fout, Gelukt, Knop, Veld } from '@/components/auth-form';
import { browserDb } from '@/lib/supabase-browser';
import { inHetNederlands } from '@/lib/auth';

export default function WachtwoordVergeten() {
  const [email, setEmail] = useState('');
  const [bezig, setBezig] = useState(false);
  const [verstuurd, setVerstuurd] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function versturen(e: React.FormEvent) {
    e.preventDefault();
    const client = browserDb();
    if (!client) {
      setFout('Geen database verbonden.');
      return;
    }
    setBezig(true);
    setFout(null);

    // Geen redirectTo: het sjabloon in supabase/templates bepaalt zelf waar de
    // link heen gaat, met {{ .SiteURL }}. Zo werkt een uitnodiging vanuit het
    // dashboard net zo goed als een herstelverzoek vanuit de app.
    const { error } = await client.auth.resetPasswordForEmail(email);
    setBezig(false);
    if (error) setFout(inHetNederlands(error.message));
    else setVerstuurd(true);
  }

  return (
    <AuthCard
      title="Wachtwoord vergeten"
      intro="Je krijgt een link waarmee je een nieuw wachtwoord kunt kiezen. Die link is een uur geldig en werkt één keer."
      onder={<Link href="/login" style={{ color: 'var(--acc)' }}>Terug naar inloggen</Link>}
    >
      {verstuurd ? (
        <Gelukt>
          Als er een account bij {email} hoort, staat er nu een link in je mail. Kijk ook even in de map
          met ongewenste post.
        </Gelukt>
      ) : (
        <form onSubmit={versturen} className="flex flex-col gap-4">
          <Veld label="E-mailadres" type="email" name="email" autoComplete="username" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <Fout>{fout}</Fout>
          <Knop bezig={bezig}>Stuur de link</Knop>
        </form>
      )}
    </AuthCard>
  );
}
