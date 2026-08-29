'use client';

import type { InputHTMLAttributes } from 'react';

export function Veld({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[14px] font-medium">{label}</span>
      <input
        {...props}
        className="rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
        style={{ background: 'var(--card2)', color: 'var(--ink)' }}
      />
      {hint ? <span className="text-[12px]" style={{ color: 'var(--ink3)' }}>{hint}</span> : null}
    </label>
  );
}

export function Knop({ bezig, children }: { bezig: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={bezig}
      className="interactive mt-1 rounded-[var(--r-btn)] px-4 py-3 text-[14px] font-bold"
      style={{ background: 'var(--acc)', color: 'var(--acc-ink)', opacity: bezig ? 0.7 : 1 }}>
      {bezig ? 'bezig…' : children}
    </button>
  );
}

export function Fout({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-[var(--r-tile)] px-4 py-3 text-[13px]"
      style={{ background: 'var(--crit-s)', color: 'var(--crit)' }}>
      {children}
    </p>
  );
}

export function Gelukt({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[var(--r-tile)] px-4 py-3 text-[13px] leading-relaxed"
      style={{ background: 'var(--acc-soft)', color: 'var(--acc)' }}>
      {children}
    </p>
  );
}
