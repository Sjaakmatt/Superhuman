'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

type Bericht = { role: 'user' | 'assistant'; content: string };

/** Wat de coach op dat moment opzoekt, in gewone woorden. */
const BEZIG: Record<string, string> = {
  plan: 'Ik kijk in je plan',
  weken: 'Ik kijk naar je weken',
  activiteiten: 'Ik kijk naar wat je gelopen hebt',
  logboek: 'Ik kijk in je logboek',
  ochtendcheck: 'Ik kijk naar je ochtendchecks',
  zoneverdeling: 'Ik kijk naar je zoneverdeling',
  naslag: 'Ik kijk in de naslag',
  oefeningen: 'Ik kijk naar de oefeningen',
  zoek_in_plan: 'Ik zoek in het plan',
};

/** Voorzetjes die passen bij het scherm waar je staat. */
const VOORZETJES: Record<string, string[]> = {
  '/': ['Wat staat er vandaag en waarom?', 'Ik voel mijn achillespees. Wat doe ik met morgen?'],
  '/loggen': ['Was dit zwaarder dan bedoeld?', 'Hoe verhoudt deze week zich tot het doel?'],
  '/kracht': ['Hoe voer ik deze oefeningen uit?', 'Waarom staat dit blok in deze fase?'],
  '/analyse': ['Loop ik genoeg rustig?', 'Wat valt je op aan mijn laatste vier weken?'],
  '/seizoen': ['Waar ga ik het lastig krijgen?', 'Hoe bereid ik me voor op de volgende mijlpaal?'],
};

const STANDAARD = ['Wat staat er deze week op het programma en waarom?', 'Loop ik genoeg rustig?'];

/** De coach staat niet op een eigen scherm maar hangt over de app heen: je kunt
 *  hem overal openen en hij weet waar je stond toen je het vroeg. */
export default function CoachWidget() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [geladen, setGeladen] = useState(false);
  const [berichten, setBerichten] = useState<Bericht[]>([]);
  const [vraag, setVraag] = useState('');
  const [lopend, setLopend] = useState<string | null>(null);
  const [bezig, setBezig] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const onderaan = useRef<HTMLDivElement>(null);
  const invoer = useRef<HTMLTextAreaElement>(null);
  const bezigMetVragen = lopend !== null;

  const stuur = useCallback(
    async (tekst: string) => {
      const schoon = tekst.trim();
      if (!schoon || lopend !== null) return;

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
          body: JSON.stringify({ vraag: schoon, pad: pathname, datum: params.get('d') ?? undefined }),
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
    },
    [lopend, pathname, params],
  );

  // Een kaart elders in de app kan de coach openen met een vraag al ingevuld.
  useEffect(() => {
    function onVraag(e: Event) {
      const tekst = (e as CustomEvent<string>).detail;
      setOpen(true);
      setVraag(typeof tekst === 'string' ? tekst : '');
      requestAnimationFrame(() => invoer.current?.focus());
    }
    window.addEventListener('coach:vraag', onVraag);
    return () => window.removeEventListener('coach:vraag', onVraag);
  }, []);

  // De geschiedenis halen we pas op als je hem voor het eerst opent.
  useEffect(() => {
    if (!open || geladen) return;
    setGeladen(true);
    void fetch('/api/coach')
      .then((r) => (r.ok ? r.json() : { berichten: [] }))
      .then((d: { berichten?: Bericht[] }) => setBerichten(d.berichten ?? []))
      .catch(() => {});
  }, [open, geladen]);

  useEffect(() => {
    if (open) onderaan.current?.scrollIntoView({ block: 'end' });
  }, [open, berichten, lopend, bezig]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function wis() {
    if (bezigMetVragen) return;
    const res = await fetch('/api/coach', { method: 'DELETE' });
    if (res.ok) {
      setBerichten([]);
      setFout(null);
    }
  }

  const voorzetjes = VOORZETJES[pathname] ?? STANDAARD;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Vraag het de coach"
        className="interactive fixed right-4 z-40 flex items-center gap-2 rounded-[var(--r-pill)] px-4 py-3 text-[14px] font-semibold shadow-lg"
        style={{
          background: 'var(--acc)',
          color: 'var(--acc-ink)',
          bottom: 'calc(76px + env(safe-area-inset-bottom))',
        }}
      >
        <Praatwolk />
        <span className="hidden side:inline">Coach</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Coach sluiten"
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-40 side:hidden"
        style={{ background: 'color-mix(in srgb, var(--ground) 70%, transparent)' }}
      />

      <aside
        role="dialog"
        aria-label="Coach"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[86dvh] flex-col rounded-t-[var(--r-card)] side:inset-y-0 side:left-auto side:right-0 side:max-h-none side:w-[420px] side:rounded-none"
        style={{ background: 'var(--card)', borderLeft: '1px solid var(--hair)', boxShadow: 'var(--sh)' }}
      >
        <header className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--hair)' }}>
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-[var(--r-btn)]"
            style={{ background: 'var(--acc-soft)', color: 'var(--acc)' }}>
            <Praatwolk />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold tracking-tight">Coach</p>
            <p className="truncate text-[11px]" style={{ color: 'var(--ink3)' }}>
              kent je plan en je cijfers · verandert niets
            </p>
          </div>
          {berichten.length ? (
            <button type="button" onClick={() => void wis()} disabled={bezigMetVragen}
              className="text-[12px] underline disabled:opacity-40" style={{ color: 'var(--ink3)' }}>
              Wissen
            </button>
          ) : null}
          <button type="button" onClick={() => setOpen(false)} aria-label="Sluiten"
            className="interactive grid h-8 w-8 place-items-center rounded-[var(--r-btn)]"
            style={{ background: 'var(--card2)', color: 'var(--ink2)' }}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {berichten.length === 0 && !bezigMetVragen ? (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink2)' }}>
                Vraag maar. De coach kent je plan, je gelopen kilometers, je logboek en je ochtendchecks, en hij ziet
                op welk scherm je staat. Hij kan niets aanpassen — hij legt uit en denkt mee.
              </p>
              {voorzetjes.map((v) => (
                <button key={v} type="button" onClick={() => void stuur(v)}
                  className="interactive rounded-[var(--r-btn)] px-3 py-2.5 text-left text-[13px]"
                  style={{ background: 'var(--card2)', border: '1px solid var(--hair)', color: 'var(--ink2)' }}>
                  {v}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
            {berichten.map((bericht, i) =>
              bericht.role === 'user' ? (
                <p key={i} className="ml-auto max-w-[32ch] whitespace-pre-wrap rounded-[var(--r-btn)] px-3 py-2 text-[13px]"
                  style={{ background: 'var(--acc-soft)', color: 'var(--acc)' }}>
                  {bericht.content}
                </p>
              ) : (
                <Antwoord key={i} tekst={bericht.content} />
              ),
            )}

            {bezigMetVragen ? (
              <div>
                {lopend ? <Antwoord tekst={lopend} /> : null}
                <p className="mt-2 flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink3)' }}>
                  <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                    style={{ background: 'var(--acc)' }} />
                  {bezig ?? (lopend ? 'Aan het schrijven' : 'Aan het nadenken')}
                </p>
              </div>
            ) : null}

            {fout ? <p className="text-[12px]" style={{ color: 'var(--warn)' }}>{fout}</p> : null}
          </div>
          <div ref={onderaan} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void stuur(vraag);
          }}
          className="flex items-end gap-2 px-4 py-3"
          style={{ borderTop: '1px solid var(--hair)', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <textarea
            ref={invoer}
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
            className="min-h-[44px] flex-1 resize-none rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
            style={{ background: 'var(--card2)', color: 'var(--ink)' }}
          />
          <button type="submit" disabled={bezigMetVragen || !vraag.trim()}
            className="interactive shrink-0 rounded-[var(--r-btn)] px-4 py-2.5 text-[14px] font-semibold disabled:opacity-40"
            style={{ background: 'var(--acc)', color: 'var(--acc-ink)' }}>
            Vraag
          </button>
        </form>
      </aside>
    </>
  );
}

function Praatwolk() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 5h14v10H9l-4 4zM9 9h6M9 12h4" />
    </svg>
  );
}

/** Een klein beetje opmaak, met de hand: alinea's, opsommingen en vet. Geen
 *  markdownbibliotheek voor drie tekens. */
function Antwoord({ tekst }: { tekst: string }) {
  const blokken = tekst.trim().split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-2.5 text-[13px] leading-[1.6]" style={{ color: 'var(--ink2)' }}>
      {blokken.map((blok, i) => {
        const regels = blok.split('\n');
        if (regels.every((r) => /^\s*[-*]\s+/.test(r))) {
          return (
            <ul key={i} className="flex flex-col gap-1 pl-4">
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
