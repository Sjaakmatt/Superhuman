/** De intensiteitsverdeling als één balk. Het doel staat eronder als streepje,
 *  zodat afwijking zichtbaar is zonder tweede grafiek. */
export default function DistributionBar({
  actual,
  target,
}: {
  actual: { z1_z2: number; z3: number; z4_z5: number };
  target: { z1_z2: number; z3: number; z4_z5: number };
}) {
  const parts = [
    { key: 'z1_z2', label: 'Z1–Z2', color: 'var(--l2)', value: actual.z1_z2, goal: target.z1_z2 },
    { key: 'z3', label: 'Z3', color: 'var(--l3)', value: actual.z3, goal: target.z3 },
    { key: 'z4_z5', label: 'Z4–Z5', color: 'var(--l4)', value: actual.z4_z5, goal: target.z4_z5 },
  ];
  const total = parts.reduce((t, p) => t + p.value, 0);

  return (
    <div>
      <div className="flex h-9 w-full overflow-hidden rounded-[var(--r-pill)]" style={{ background: 'var(--sunk)' }}>
        {total > 0
          ? parts.map((p) => (
              <div key={p.key} style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
                title={`${p.label}: ${Math.round((p.value / total) * 100)}%`} />
            ))
          : null}
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {parts.map((p) => (
          <div key={p.key} className="flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-2.5 rounded-[var(--r-pill)]" style={{ background: p.color }} />
            <dt className="text-[12px]" style={{ color: 'var(--ink2)' }}>{p.label}</dt>
            <dd className="num text-[13px] font-semibold">
              {total > 0 ? `${Math.round((p.value / total) * 100)}%` : '—'}
              <span className="ml-1 text-[11px] font-medium" style={{ color: 'var(--ink3)' }}>
                doel {Math.round(p.goal * 100)}%
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
