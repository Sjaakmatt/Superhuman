'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthCard from '@/components/AuthCard';
import { Fout, Knop, Veld } from '@/components/auth-form';
import { browserDb } from '@/lib/supabase-browser';
import { inHetNederlands, keurWachtwoord, MINIMALE_WACHTWOORDLENGTE } from '@/lib/auth';

/** Je komt hier via de herstel-link, met een sessie die /auth/bevestig heeft
 *  gezet. Zonder die sessie valt er niets te herstellen. */
export default function WachtwoordHerstellen() {
  const router = useRouter();
  const [wachtwoord, setWachtwoord] = useState('');
  const [herhaling, setHerhaling] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [sessie, setSessie] = useState<'onbekend' | 'ja' | 'nee'>('onbekend');

  useEffect(() => {
    const client = browserDb();
    if (!client) {
      setSessie('nee');
      return;
    }
    client.auth.getUser().then(({ data }) => setSessie(data.user ? 'ja' : 'nee'));
  }, []);

  async function opslaan(e: React.FormEvent) {
    e.preventDefault();
    const bezwaar = keurWachtwoord(wachtwoord);
    if (bezwaar) {
      setFout(bezwaar);
      return;
    }
    if (wachtwoord !== herhaling) {
      setFout('De twee wachtwoorden zijn niet gelijk.');
      return;
    }

    const client = browserDb();
    if (!client) return;
    setBezig(true);
    setFout(null);

    const { error } = await client.auth.updateUser({ password: wachtwoord });
    if (error) {
      setFout(inHetNederlands(error.message));
      setBezig(false);
      return;
    }
    router.replace('/');
    router.refresh();
  }

  if (sessie === 'nee') {
    return (
      <AuthCard title="Deze link werkt niet meer">
        <Fout>
          De herstel-link is verlopen of al gebruikt. Vraag er een nieuwe aan op{' '}
          <a href="/wachtwoord-vergeten" style={{ color: 'inherit', textDecoration: 'underline' }}>
            wachtwoord vergeten
          </a>
          .
        </Fout>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Nieuw wachtwoord" intro="Kies iets dat je onthoudt zonder het op te schrijven.">
      <form onSubmit={opslaan} className="flex flex-col gap-4">
        <Veld label="Nieuw wachtwoord" type="password" name="new-password" autoComplete="new-password"
          required value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)}
          hint={`Minstens ${MINIMALE_WACHTWOORDLENGTE} tekens. Een zin werkt beter dan een kort woord met tekens erin.`} />
        <Veld label="Nog een keer" type="password" name="confirm-password" autoComplete="new-password"
          required value={herhaling} onChange={(e) => setHerhaling(e.target.value)} />
        <Fout>{fout}</Fout>
        <Knop bezig={bezig || sessie === 'onbekend'}>Wachtwoord opslaan</Knop>
      </form>
    </AuthCard>
  );
}
