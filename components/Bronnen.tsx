'use client';

import { useState } from 'react';
import { Card, CardTitle, Note } from '@/components/ui';

export type Apparaat = {
  id: string;
  naam: string;
  laatste_sync: string | null;
  laatste_fout: string | null;
};

/* Waar je cijfers vandaan komen, en de koppelcode voor een telefoon.
 *
 * De code is vijftien minuten geldig en eenmalig. Het token dat de telefoon
 * ervoor terugkrijgt zie je nergens: dat gaat één keer over de lijn. */
export default function Bronnen({ apparaten }: { apparaten: Apparaat[] }) {
  const [code, setCode] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function maakCode() {
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch('/api/devices/pairing-code', { method: 'POST' });
      const body = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !body.code) throw new Error(body.error ?? 'Aanmaken mislukt.');
      setCode(body.code);
    } catch (e) {
      setFout((e as Error).message);
    } finally {
      setBezig(false);
    }
  }

  return (
    <Card>
      <CardTitle aside={apparaten.length ? `${apparaten.length} gekoppeld` : 'geen'}>Telefoon</CardTitle>

      {apparaten.length ? (
        <ul className="mb-4 flex flex-col">
          {apparaten.map((a) => (
            <li key={a.id} className="flex items-baseline gap-3 border-b py-2.5 last:border-0"
              style={{ borderColor: 'var(--hair)' }}>
              <span className="text-[14px] font-medium">{a.naam}</span>
              <span className="text-[12px]" style={{ color: 'var(--ink3)' }}>{geleden(a.laatste_sync)}</span>
              {a.laatste_fout ? (
                <span className="ml-auto text-[12px]" style={{ color: 'var(--warn)' }}>{a.laatste_fout}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {code ? (
        <div className="rounded-[var(--r-tile)] px-4 py-4 text-center" style={{ background: 'var(--card2)' }}>
          <p className="num text-[28px] font-bold tracking-[.18em]">{code}</p>
          <p className="mt-1.5 text-[12px]" style={{ color: 'var(--ink3)' }}>
            Vul deze in de app op je telefoon in. Vijftien minuten geldig, daarna maak je een nieuwe.
          </p>
        </div>
      ) : (
        <button type="button" onClick={() => void maakCode()} disabled={bezig}
          className="interactive rounded-[var(--r-btn)] px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50"
          style={{ background: 'var(--acc)', color: 'var(--acc-ink)' }}>
          {bezig ? 'Bezig…' : apparaten.length ? 'Nog een telefoon koppelen' : 'Telefoon koppelen'}
        </button>
      )}

      {fout ? <p className="mt-3 text-[12px]" style={{ color: 'var(--crit)' }}>{fout}</p> : null}

      <Note>
        Samsung Health schrijft naar Health Connect; de app op je telefoon leest dat uit en stuurt het hierheen, elke
        drie uur. Je hardlopen komt in dezelfde lijst als Strava. Slaap, rustpols en gewicht vullen de ochtendcheck
        aan — wat je zelf invult wordt nooit overschreven.
      </Note>
    </Card>
  );
}

function geleden(iso: string | null): string {
  if (!iso) return 'nog niets binnengekomen';
  const minuten = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minuten) || minuten < 2) return 'zojuist';
  if (minuten < 60) return `${minuten} minuten geleden`;
  const uren = Math.round(minuten / 60);
  if (uren < 24) return `${uren} uur geleden`;
  const dagen = Math.round(uren / 24);
  return `${dagen} ${dagen === 1 ? 'dag' : 'dagen'} geleden`;
}
