'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Hit = { date: string; week: number; weekday: string; session_type: string; session_text: string };

export default function PlanSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/plan/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const json = (await res.json()) as { hits: Hit[] };
        setHits(json.hits);
        setOpen(true);
      } catch {
        // Afgebroken verzoek of netwerkfout: laat de vorige treffers staan.
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    function away(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  function go(date: string) {
    setOpen(false);
    setQ('');
    router.push(`/?d=${date}`);
  }

  return (
    <div ref={box} className="relative order-3 w-full side:order-none side:w-[300px]">
      <label className="sr-only" htmlFor={listId}>Zoek in het plan</label>
      <div className="flex items-center gap-2 rounded-[var(--r-btn)] px-3"
        style={{ background: 'var(--card)', border: '1px solid var(--hair)', boxShadow: 'var(--sh)' }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" aria-hidden style={{ color: 'var(--ink3)' }}>
          <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" />
        </svg>
        <input
          id={listId}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter' && hits[0]) go(hits[0].date);
          }}
          placeholder="Zoek een sessie, datum of week"
          className="w-full bg-transparent py-2.5 text-[13px] outline-none"
          style={{ color: 'var(--ink)' }}
          autoComplete="off"
        />
      </div>

      {open && hits.length > 0 ? (
        <ul className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-[62dvh] overflow-auto rounded-[var(--r-tile)] p-1.5"
          style={{ background: 'var(--card)', border: '1px solid var(--hair)', boxShadow: 'var(--sh-lift)' }}>
          {hits.map((h) => (
            <li key={h.date}>
              <button type="button" onClick={() => go(h.date)}
                className="interactive w-full rounded-[var(--r-btn)] px-3 py-2 text-left">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold">{h.session_type}</span>
                  <span className="num shrink-0 text-[11px]" style={{ color: 'var(--ink3)' }}>wk {h.week}</span>
                </span>
                <span className="mt-0.5 block truncate text-[12px]" style={{ color: 'var(--ink3)' }}>
                  {h.weekday.toLowerCase()} {h.date}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
