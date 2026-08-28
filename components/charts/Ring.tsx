/** Eén ring: aandeel van het plan dat achter je ligt. */
export default function Ring({
  value,
  label,
  sub,
  size = 132,
}: {
  value: number;
  label: string;
  sub?: string;
  size?: number;
}) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
        aria-label={`${label}: ${Math.round(clamped * 100)} procent`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sunk)" strokeWidth={stroke} />
        {clamped > 0 ? (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--acc)" strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={`${c * clamped} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        ) : null}
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="num"
          fontSize="24" fontWeight="600" fill="var(--ink)">{Math.round(clamped * 100)}%</text>
      </svg>
      <div>
        <p className="text-[14px] font-semibold">{label}</p>
        {sub ? <p className="mt-1 max-w-[28ch] text-[12px]" style={{ color: 'var(--ink3)' }}>{sub}</p> : null}
      </div>
    </div>
  );
}
