import { scale } from '@/components/charts/path';

/* Kleuren komen als CSS-variabele in het SVG-attribuut; zo staat er ook hier
 * geen hex-waarde buiten tokens.css. */

export type WeekBar = { week: number; planned: number; actual: number | null };

/** Gepland tegen gelopen per week. De geplande waarde is de omtrek, het
 *  gelopene de vulling — zo zie je een tekort als een gat, niet als een oordeel. */
export default function WeekBars({ rows, height = 168 }: { rows: WeekBar[]; height?: number }) {
  if (!rows.length) return null;

  const gap = 6;
  const barWidth = 22;
  const width = rows.length * (barWidth + gap);
  const top = 14;
  const bottom = height - 22;
  const max = Math.max(...rows.map((r) => Math.max(r.planned, r.actual ?? 0)), 1);
  const y = scale([0, max * 1.08], [bottom, top]);

  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img"
        aria-label={`Gepland tegen gelopen over ${rows.length} weken`} style={{ maxWidth: '100%' }}>
        {rows.map((row, i) => {
          const x = i * (barWidth + gap);
          const plannedTop = y(row.planned);
          const actual = row.actual ?? 0;
          const actualTop = y(actual);
          const short = row.actual !== null && actual < row.planned * 0.85;
          return (
            <g key={row.week}>
              <rect x={x} y={plannedTop} width={barWidth} height={Math.max(1, bottom - plannedTop)} rx="7"
                fill="none" stroke="var(--hair)" strokeWidth="1.5" />
              {row.actual !== null ? (
                <rect x={x} y={actualTop} width={barWidth} height={Math.max(1, bottom - actualTop)} rx="7"
                  fill={short ? 'var(--l2)' : 'var(--acc)'} />
              ) : null}
              <text x={x + barWidth / 2} y={height - 6} textAnchor="middle" fontSize="9"
                fill="var(--ink3)" className="num">{row.week}</text>
            </g>
          );
        })}
        <line x1="0" y1={bottom + 0.5} x2={width} y2={bottom + 0.5} stroke="var(--hair)" strokeWidth="1" />
      </svg>
    </div>
  );
}
