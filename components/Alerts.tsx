import type { RuleHit } from '@/lib/rules';

const TONE = {
  stop: { bg: 'var(--crit-s)', ink: 'var(--crit)', label: 'Stop' },
  warn: { bg: 'var(--warn-s)', ink: 'var(--warn)', label: 'Let op' },
  info: { bg: 'var(--ok-s)', ink: 'var(--ok)', label: 'Ter info' },
} as const;

/** Alarmen komen uit lib/rules.ts, niet uit het taalmodel. Een stop is niet
 *  weg te klikken: die staat er tot de regel niet meer vuurt. */
export default function Alerts({ hits }: { hits: RuleHit[] }) {
  if (!hits.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {hits.map((hit) => {
        const tone = TONE[hit.level];
        return (
          <div key={hit.id} className="rounded-[var(--r-card)] p-4"
            style={{ background: tone.bg, border: `1px solid ${tone.ink}` }}>
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[.09em]" style={{ color: tone.ink }}>
                {tone.label}
              </span>
              <h2 className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>{hit.title}</h2>
            </div>
            <p className="mt-1.5 max-w-[70ch] text-[13px] leading-relaxed" style={{ color: 'var(--ink2)' }}>
              {hit.detail}
            </p>
            <p className="mt-2 text-[11px]" style={{ color: 'var(--ink3)' }}>
              Regel <code>{hit.id}</code>
              {hit.since ? ` · sinds ${hit.since}` : ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}
