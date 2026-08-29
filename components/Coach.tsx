'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, Empty } from '@/components/ui';

export type ChatBericht = { role: 'user' | 'assistant'; content: string };

/** Wat de coach op dat moment opzoekt, in gewone woorden. */
const BEZIG: Record<string, string> = {
  plan: 'Ik kijk in je plan',
  weken: 'Ik kijk naar je weken',
  activiteiten: 'Ik kijk naar wat je gelopen hebt',
  logboek: 'Ik kijk in je logboek',
  ochtendcheck: 'Ik kijk naar je ochtendchecks',
  zoneverdeling: 'Ik kijk naar je zoneverdeling',
  naslag: 'Ik kijk in de naslag',
  zoek_in_plan: 'Ik zoek in het plan',
};

const VOORZETJES = [
  'Wat staat er deze week op het programma en waarom?',
  'Hoe verhoudt mijn afgelopen week zich tot het doel?',
  'Ik voel mijn achillespees. Wat doe ik met de sessie van morgen?',
  'Loop ik genoeg rustig?',
];

export default function Coach({ start }: { start: ChatBericht[] }) {
  const [berichten, setBerichten] = useState<ChatBericht[]>(start);
  const [vraag, setVraag] = useState('');
  const [lopend, setLopend] = useState<string | null>(null);
  const [bezig, setBezig] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const onderaan = useRef<HTMLDivElement>(null);
  const bezigMetVragen = lopend !== null;

  useEffect(() => {
    onderaan.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [berichten, lopend, bezig]);

  async function stuur(tekst: string) {
    const schoon = tekst.trim();
    if (!schoon || bezigMetVragen) return;

    setVraag('');
    setFout(null);
    setBerichten((b) => [...b, { role: 'user', content: schoon }]);
    setLopend('');
    setBezig(null);

    let verzameld = '';
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vraag: schoon }),
      });

      if (!res.ok || !res.body) {
        const bericht = await res.json().catch(() => ({ error: 'De coach antwoordde niet.' }));
        throw new Error((bericht as { error?: string }).error ?? 'De coach antwoordde niet.');
      }

      // Regel-voor-regel JSON: alles tot de laatste nieuwe regel is compleet,
      // de rest bewaren we voor het volgende stuk.
      const lezer = res.body.getReader();
      const decoder = new TextDecoder();
      let rest = '';

      for (;;) {
        const { done, value } = await lezer.read();
        if (done) break;
        rest += decoder.decode(value, { stream: true });
        const regels = rest.split('\n');
        rest = regels.pop() ?? '';

        for (const regel of regels) {
          if (!regel.trim()) continue;
          const event = JSON.parse(regel) as
            | { type: 'tekst'; delta: string }
            | { type: 'opzoeken'; naam: string }
            | { type: 'klaar'; tekst: string }
            | { type: 'fout'; bericht: string };

          if (event.type === 'tekst') {
            verzameld += event.delta;
            setBezig(null);
            setLopend(verzameld);
          } else if (event.type === 'opzoeken') {
            setBezig(BEZIG[event.naam] ?? 'Ik zoek iets op');
          } else if (event.type === 'klaar') {
            verzameld = event.tekst || verzameld;
          } else {
            setFout(event.bericht);
          }
        }
      }

      if (verzameld.trim()) setBerichten((b) => [...b, { role: 'assistant', content: verzameld }]);
    } catch (e) {
      setFout((e as Error).message);
    } finally {
      setLopend(null);
      setBezig(null);
    }
  }

  async function wis() {
    if (bezigMetVragen) return;
    const res = await fetch('/api/coach', { method: 'DELETE' });
    if (res.ok) {
      setBerichten([]);
      setFout(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {berichten.length === 0 && !bezigMetVragen ? (
        <Card>
          <Empty title="Vraag maar">
            De coach kent je plan, je gelopen kilometers, je logboek en je ochtendchecks. Hij kan niets aanpassen —
            hij legt uit en denkt mee.
          </Empty>
          <div className="mt-4 flex flex-wrap gap-2">
            {VOORZETJES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => void stuur(v)}
                className="interactive rounded-[var(--r-pill)] px-3 py-2 text-left text-[13px]"
                style={{ background: 'var(--card2)', border: '1px solid var(--hair)', color: 'var(--ink2)' }}
              >
                {v}
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {berichten.map((bericht, i) =>
        bericht.role === 'user' ? (
          <div key={i} className="flex justify-end">
            <p
              className="max-w-[42ch] whitespace-pre-wrap rounded-[var(--r-card)] px-4 py-3 text-[14px]"
              style={{ background: 'var(--acc-soft)', color: 'var(--acc)' }}
            >
              {bericht.content}
            </p>
          </div>
        ) : (
          <Card key={i}>
            <Antwoord tekst={bericht.content} />
          </Card>
        ),
      )}

      {bezigMetVragen ? (
        <Card>
          {lopend ? <Antwoord tekst={lopend} /> : null}
          <p className="mt-2 flex items-center gap-2 text-[13px]" style={{ color: 'var(--ink3)' }}>
            <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: 'var(--acc)' }} />
            {bezig ?? (lopend ? 'Aan het schrijven' : 'Aan het nadenken')}
          </p>
        </Card>
      ) : null}

      {fout ? (
        <Card sunk>
          <p className="text-[13px]" style={{ color: 'var(--warn)' }}>{fout}</p>
        </Card>
      ) : null}

      <div ref={onderaan} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void stuur(vraag);
        }}
        className="sticky bottom-24 flex flex-col gap-2 side:bottom-4"
      >
        <Card className="flex items-end gap-2">
          <textarea
            value={vraag}
            onChange={(e) => setVraag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void stuur(vraag);
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder="Stel je vraag"
            aria-label="Je vraag aan de coach"
            className="min-h-[46px] flex-1 resize-none bg-transparent text-[14px] outline-none"
            style={{ color: 'var(--ink)' }}
          />
          <button
            type="submit"
            disabled={bezigMetVragen || !vraag.trim()}
            className="interactive shrink-0 rounded-[var(--r-btn)] px-4 py-2.5 text-[14px] font-semibold disabled:opacity-40"
            style={{ background: 'var(--acc)', color: 'var(--acc-ink)' }}
          >
            Vraag
          </button>
        </Card>
        {berichten.length ? (
          <button
            type="button"
            onClick={() => void wis()}
            disabled={bezigMetVragen}
            className="self-end text-[12px] underline disabled:opacity-40"
            style={{ color: 'var(--ink3)' }}
          >
            Gesprek wissen
          </button>
        ) : null}
      </form>
    </div>
  );
}

/** Een klein beetje opmaak, met de hand: alinea's, opsommingen en vet. Geen
 *  markdownbibliotheek voor drie tekens. */
function Antwoord({ tekst }: { tekst: string }) {
  const blokken = tekst.trim().split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-3 text-[14px] leading-[1.65]" style={{ color: 'var(--ink2)' }}>
      {blokken.map((blok, i) => {
        const regels = blok.split('\n');
        if (regels.every((r) => /^\s*[-*]\s+/.test(r))) {
          return (
            <ul key={i} className="flex flex-col gap-1.5 pl-4">
              {regels.map((r, j) => (
                <li key={j} className="list-disc">{vet(r.replace(/^\s*[-*]\s+/, ''))}</li>
              ))}
            </ul>
          );
        }
        return <p key={i} className="whitespace-pre-wrap">{vet(blok)}</p>;
      })}
    </div>
  );
}

function vet(regel: string) {
  return regel.split(/(\*\*[^*]+\*\*)/g).map((stuk, i) =>
    stuk.startsWith('**') && stuk.endsWith('**') && stuk.length > 4 ? (
      <strong key={i} style={{ color: 'var(--ink)' }}>{stuk.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{stuk}</span>
    ),
  );
}
