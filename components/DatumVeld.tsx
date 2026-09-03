'use client';

import { useRouter } from 'next/navigation';

/** Springen naar een dag. `pad` is het scherm waar je blijft; `max` begrenst
 *  hoe ver vooruit je mag — bij loggen tot vandaag, bij kracht mag je verder
 *  kijken. */
export default function DatumVeld({
  pad,
  date,
  min,
  max,
}: {
  pad: string;
  date: string;
  min?: string;
  max?: string;
}) {
  const router = useRouter();
  return (
    <label className="interactive flex items-center gap-2 rounded-[var(--r-btn)] px-3 py-2"
      style={{ background: 'var(--card)', border: '1px solid var(--hair)' }}>
      {/* De browser tekent zelf al een kalendericoon in het veld. */}
      <span className="sr-only">Kies een dag</span>
      <input
        type="date"
        value={date}
        min={min}
        max={max}
        onChange={(e) => { if (e.target.value) router.push(`${pad}?d=${e.target.value}`); }}
        className="num bg-transparent text-[12px] font-semibold outline-none"
        style={{ color: 'var(--ink2)' }}
      />
    </label>
  );
}
