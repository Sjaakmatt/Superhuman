'use client';

import { useState, useTransition } from 'react';
import { inviteAthlete, resendInvitation, revokeInvitation } from '@/lib/actions';
import { Card, CardTitle, Empty, Note, Pill } from '@/components/ui';
import type { Uitnodiging } from '@/lib/data';

const TOON = {
  actief: { tekst: 'actief', tone: 'acc' as const },
  uitgenodigd: { tekst: 'uitgenodigd', tone: 'neutral' as const },
  'niet aangemaakt': { tekst: 'niet aangemaakt', tone: 'warn' as const },
};

/** Wie er binnen mag. Zonder rij in deze lijst weigert de database het account,
 *  ook als "aanmelden toestaan" in Supabase per ongeluk aanstaat. */
export default function Uitnodigingen({
  uitnodigingen,
  jij,
}: {
  uitnodigingen: Uitnodiging[];
  jij: string | null;
}) {
  const [email, setEmail] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [bevestig, setBevestig] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function uitnodigen(e: React.FormEvent) {
    e.preventDefault();
    const adres = email.trim();
    if (!adres) return;
    setBezig(true);
    setFout(null);
    startTransition(async () => {
      const res = await inviteAthlete(adres);
      setBezig(false);
      if (res.ok) setEmail('');
      else setFout(res.error);
    });
  }

  function opnieuw(adres: string) {
    setFout(null);
    startTransition(async () => {
      const res = await resendInvitation(adres);
      if (!res.ok) setFout(res.error);
    });
  }

  function intrekken(adres: string) {
    if (bevestig !== adres) {
      setBevestig(adres);
      return;
    }
    setBevestig(null);
    setFout(null);
    startTransition(async () => {
      const res = await revokeInvitation(adres);
      if (!res.ok) setFout(res.error);
    });
  }

  return (
    <Card>
      <CardTitle aside={`${uitnodigingen.length} ${uitnodigingen.length === 1 ? 'genodigde' : 'genodigden'}`}>
        Wie er binnen mag
      </CardTitle>

      <p className="mb-4 max-w-[58ch] text-[14px] leading-relaxed" style={{ color: 'var(--ink2)' }}>
        Iemand die je hier toevoegt krijgt een uitnodiging per mail en kiest zelf een wachtwoord.
        Hij ziet zijn eigen lege plan — niet dat van jou.
      </p>

      {jij ? (
        <div className="mb-3 flex items-center gap-3 rounded-[var(--r-tile)] px-4 py-3" style={{ background: 'var(--acc-soft)' }}>
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" style={{ color: 'var(--acc)' }}>{jij}</span>
          <Pill tone="acc">jij</Pill>
        </div>
      ) : null}

      {uitnodigingen.length ? (
        <ul className="flex flex-col">
          {uitnodigingen.map((u) => {
            const toon = TOON[u.status];
            const wachtOpBevestiging = bevestig === u.email;
            return (
              <li key={u.email} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b py-3 last:border-0"
                style={{ borderColor: 'var(--hair)' }}>
                <span className="min-w-0 flex-1 truncate text-[14px]">{u.email}</span>
                <Pill tone={toon.tone}>{toon.tekst}</Pill>
                {u.status !== 'actief' ? (
                  <button type="button" onClick={() => opnieuw(u.email)}
                    className="text-[12px] font-semibold" style={{ color: 'var(--acc)' }}>
                    opnieuw sturen
                  </button>
                ) : null}
                <button type="button" onClick={() => intrekken(u.email)}
                  className="text-[12px] font-semibold"
                  style={{ color: wachtOpBevestiging ? 'var(--crit)' : 'var(--ink3)' }}>
                  {wachtOpBevestiging
                    ? u.status === 'actief'
                      ? 'zeker weten? account en logboek gaan weg'
                      : 'zeker weten?'
                    : 'intrekken'}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty title="Nog niemand uitgenodigd">Je bent voorlopig de enige met toegang.</Empty>
      )}

      <form onSubmit={uitnodigen} className="mt-4 flex flex-wrap gap-2">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="naam@voorbeeld.nl" autoComplete="off"
          className="min-w-[200px] flex-1 rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
          style={{ background: 'var(--card2)', color: 'var(--ink)' }} />
        <button type="submit" disabled={bezig}
          className="interactive rounded-[var(--r-btn)] px-4 py-2.5 text-[13px] font-semibold"
          style={{ background: 'var(--acc)', color: 'var(--acc-ink)', opacity: bezig ? 0.7 : 1 }}>
          {bezig ? 'versturen…' : 'Uitnodigen'}
        </button>
      </form>

      {fout ? <p className="mt-3 text-[12px]" style={{ color: 'var(--crit)' }}>{fout}</p> : null}

      <Note>
        Intrekken haalt het adres van de lijst en verwijdert het account. Wat die persoon logde gaat
        mee — vandaar de tweede klik.
      </Note>
    </Card>
  );
}
