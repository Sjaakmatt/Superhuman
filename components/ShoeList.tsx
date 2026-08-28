'use client';

import { useState, useTransition } from 'react';
import { addShoe, retireShoe } from '@/lib/actions';
import { Card, CardTitle, Empty } from '@/components/ui';
import type { Shoe } from '@/lib/types';

/** Schoenen en hun kilometerstand. Boven de 700 km meldt de regel `shoe-worn`. */
export default function ShoeList({ shoes, writable }: { shoes: Shoe[]; writable: boolean }) {
  const [name, setName] = useState('');
  const [drop, setDrop] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = { name: name.trim(), drop_mm: drop ? Number(drop) : null };
    setName('');
    setDrop('');
    startTransition(async () => {
      const res = await addShoe(payload);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <Card>
      <CardTitle aside={`${shoes.filter((s) => !s.retired).length} in gebruik`}>Schoenen</CardTitle>

      {shoes.length ? (
        <ul className="mb-4 flex flex-col">
          {shoes.map((shoe) => (
            <li key={shoe.id} className="flex items-center gap-3 border-b py-2.5 last:border-0"
              style={{ borderColor: 'var(--hair)', opacity: shoe.retired ? 0.5 : 1 }}>
              <span className="flex-1 text-[14px] font-medium">{shoe.name}</span>
              {shoe.drop_mm !== null ? (
                <span className="num text-[12px]" style={{ color: 'var(--ink3)' }}>{shoe.drop_mm} mm</span>
              ) : null}
              <span className="num w-20 text-right text-[13px]"
                style={{ color: shoe.km > 700 ? 'var(--warn)' : 'var(--ink2)' }}>
                {Math.round(shoe.km)} km
              </span>
              {writable ? (
                <button type="button" onClick={() => startTransition(() => void retireShoe(shoe.id, !shoe.retired))}
                  className="text-[12px] font-semibold" style={{ color: 'var(--ink3)' }}>
                  {shoe.retired ? 'terug' : 'op rust'}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="Nog geen schoenen">Voeg er één toe, dan houdt de app de kilometers bij per logregel.</Empty>
      )}

      {writable ? (
        <form onSubmit={add} className="mt-4 flex flex-wrap gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Naam"
            className="min-w-[160px] flex-1 rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
            style={{ background: 'var(--card2)', color: 'var(--ink)' }} />
          <input value={drop} onChange={(e) => setDrop(e.target.value)} inputMode="numeric" placeholder="drop"
            className="num w-20 rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
            style={{ background: 'var(--card2)', color: 'var(--ink)' }} />
          <button type="submit" className="interactive rounded-[var(--r-btn)] px-4 py-2.5 text-[13px] font-semibold"
            style={{ background: 'var(--acc)', color: 'var(--acc-ink)' }}>
            Toevoegen
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-3 text-[12px]" style={{ color: 'var(--crit)' }}>{error}</p> : null}
    </Card>
  );
}
