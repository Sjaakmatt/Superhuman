import type { CSSProperties, ReactNode } from 'react';

export function Card({
  children,
  className = '',
  sunk = false,
  padded = true,
  style,
}: {
  children: ReactNode;
  className?: string;
  sunk?: boolean;
  /** Zet uit wanneer de kaart zelf tot de rand tekent, zoals de belastingstreep. */
  padded?: boolean;
  style?: CSSProperties;
}) {
  return (
    <section
      className={`rounded-[var(--r-card)] ${padded ? 'p-5' : ''} ${className}`}
      style={{
        background: sunk ? 'var(--card2)' : 'var(--card)',
        boxShadow: sunk ? 'none' : 'var(--sh)',
        border: '1px solid var(--hair)',
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-[12px] font-bold uppercase tracking-[.09em]" style={{ color: 'var(--ink3)' }}>
        {children}
      </h2>
      {aside ? <div className="text-[12px]" style={{ color: 'var(--ink3)' }}>{aside}</div> : null}
    </div>
  );
}

export function Stat({
  value,
  unit,
  label,
  tone,
}: {
  value: ReactNode;
  unit?: string;
  label: string;
  tone?: 'warn' | 'crit' | 'acc';
}) {
  const color = tone === 'warn' ? 'var(--warn)' : tone === 'crit' ? 'var(--crit)' : tone === 'acc' ? 'var(--acc)' : 'var(--ink)';
  return (
    <div>
      <p className="num text-[26px] font-semibold leading-none" style={{ color }}>
        {value}
        {unit ? <span className="ml-1 text-[13px] font-medium" style={{ color: 'var(--ink3)' }}>{unit}</span> : null}
      </p>
      <p className="mt-1.5 text-[12px]" style={{ color: 'var(--ink3)' }}>{label}</p>
    </div>
  );
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'acc' | 'warn' | 'crit';
}) {
  const map = {
    neutral: { background: 'var(--sunk)', color: 'var(--ink2)' },
    acc: { background: 'var(--acc-soft)', color: 'var(--acc)' },
    warn: { background: 'var(--warn-s)', color: 'var(--warn)' },
    crit: { background: 'var(--crit-s)', color: 'var(--crit)' },
  } as const;
  return (
    <span className="inline-flex items-center rounded-[var(--r-pill)] px-2.5 py-1 text-[11px] font-semibold" style={map[tone]}>
      {children}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--r-tile)] px-5 py-8 text-center" style={{ background: 'var(--card2)' }}>
      <p className="text-[14px] font-semibold">{title}</p>
      {children ? <p className="mx-auto mt-1.5 max-w-[46ch] text-[13px]" style={{ color: 'var(--ink3)' }}>{children}</p> : null}
    </div>
  );
}

/** Eén regel uitleg onder een kaart: waar het getal vandaan komt. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[12px] leading-relaxed" style={{ color: 'var(--ink3)' }}>{children}</p>;
}

export function Grid({ children, min = 150 }: { children: ReactNode; min?: number }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` }}>
      {children}
    </div>
  );
}
