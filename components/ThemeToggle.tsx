'use client';

import { useEffect, useState } from 'react';

type Choice = 'light' | 'dark' | 'systeem';
const KEY = 'ultra100-theme';

function apply(choice: Choice) {
  const root = document.documentElement;
  if (choice === 'systeem') {
    root.removeAttribute('data-theme');
    localStorage.removeItem(KEY);
  } else {
    root.setAttribute('data-theme', choice);
    localStorage.setItem(KEY, choice);
  }
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [choice, setChoice] = useState<Choice>('systeem');

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    setChoice(stored === 'light' || stored === 'dark' ? stored : 'systeem');
  }, []);

  function pick(next: Choice) {
    setChoice(next);
    apply(next);
  }

  const label: Record<Choice, string> = { light: 'Licht', dark: 'Donker', systeem: 'Systeem' };

  if (compact) {
    const next: Choice = choice === 'light' ? 'dark' : choice === 'dark' ? 'systeem' : 'light';
    return (
      <button type="button" onClick={() => pick(next)} aria-label={`Weergave: ${label[choice]}. Wissel naar ${label[next]}.`}
        className="interactive grid h-10 w-10 place-items-center rounded-[var(--r-btn)]"
        style={{ background: 'var(--card)', color: 'var(--ink2)', boxShadow: 'var(--sh)' }}>
        <Glyph choice={choice} />
      </button>
    );
  }

  return (
    <div role="group" aria-label="Weergave" className="grid grid-cols-3 gap-1 rounded-[var(--r-btn)] p-1"
      style={{ background: 'var(--card2)' }}>
      {(['light', 'dark', 'systeem'] as Choice[]).map((c) => (
        <button key={c} type="button" onClick={() => pick(c)} aria-pressed={choice === c}
          className="flex items-center justify-center gap-1.5 rounded-[var(--r-btn)] py-1.5 text-[11px] font-semibold"
          style={{
            background: choice === c ? 'var(--card)' : 'transparent',
            color: choice === c ? 'var(--ink)' : 'var(--ink3)',
            boxShadow: choice === c ? 'var(--sh)' : 'none',
          }}>
          <Glyph choice={c} />
          {label[c]}
        </button>
      ))}
    </div>
  );
}

function Glyph({ choice }: { choice: Choice }) {
  const common = { viewBox: '0 0 24 24', width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (choice === 'dark') return <svg {...common}><path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" /></svg>;
  if (choice === 'light') return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></svg>;
  return <svg {...common}><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8" /></svg>;
}
