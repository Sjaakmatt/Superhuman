import { scale, smoothPath } from '@/components/charts/path';

export type Point = { label: string; value: number | null };

/** Eén gladde lijn met een basislijn erachter. Gebruikt voor de welzijnstrend
 *  en voor het weekvolumeprofiel. */
export default function Trend({
  points,
  baseline,
  height = 130,
  markIndex,
  ariaLabel,
}: {
  points: Point[];
  baseline?: number | null;
  height?: number;
  markIndex?: number;
  ariaLabel: string;
}) {
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (values.length < 2) return null;

  const width = 640;
  const top = 12;
  const bottom = height - 18;
  const min = Math.min(...values, baseline ?? Infinity);
  const max = Math.max(...values, baseline ?? -Infinity);
  const pad = (max - min) * 0.15 || 1;
  const y = scale([min - pad, max + pad], [bottom, top]);
  const x = scale([0, points.length - 1], [4, width - 4]);

  const drawn = points
    .map((p, i) => ({ x: x(i), y: p.value === null ? null : y(p.value) }))
    .filter((p): p is { x: number; y: number } => p.y !== null);

  const line = smoothPath(drawn);
  const area = `${line} L ${drawn[drawn.length - 1]!.x} ${bottom} L ${drawn[0]!.x} ${bottom} Z`;
  const mark = markIndex !== undefined ? points[markIndex] : undefined;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none"
      role="img" aria-label={ariaLabel} style={{ display: 'block' }}>
      <path d={area} fill="var(--acc-soft)" />
      {baseline !== null && baseline !== undefined ? (
        <line x1="0" y1={y(baseline)} x2={width} y2={y(baseline)} stroke="var(--ink3)" strokeWidth="1"
          strokeDasharray="3 5" />
      ) : null}
      <path d={line} fill="none" stroke="var(--acc)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        vectorEffect="non-scaling-stroke" />
      {mark && mark.value !== null && markIndex !== undefined ? (
        <circle cx={x(markIndex)} cy={y(mark.value)} r="4.5" fill="var(--acc)" stroke="var(--card)" strokeWidth="2.5" />
      ) : null}
    </svg>
  );
}
