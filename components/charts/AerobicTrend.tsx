'use client';

import { useState } from 'react';
import { scale, smoothPath } from '@/components/charts/path';
import { daysBetween, formatShort, type IsoDate } from '@/lib/date';
import { rollingMean } from '@/lib/metrics';
import type { AeroobPunt } from '@/lib/data';

const W = 680;
const H = 250;
const LINKS = 40;
const RECHTS = 10;
const BOVEN = 14;
const ONDER = 28;

/** Over hoeveel sessies de trendlijn middelt. Losse sessies wisselen sterk met
 *  weer, ondergrond en vermoeidheid; vijf is genoeg om dat te dempen zonder een
 *  echte verandering weg te vlakken. */
const VENSTER = 5;

/* Aerobe efficiëntie over tijd: meters per minuut per hartslag.
 *
 * Eén maat, dus één kleur — geen legenda voor kleur nodig. Het onderscheid zit
 * in de vorm: elke Z2-sessie is een punt, de lijn is het voortschrijdend
 * gemiddelde. De x-as loopt op datum en niet op volgnummer, zodat een periode
 * zonder trainen als een gat te zien is en niet wordt weggedrukt. */
export default function AerobicTrend({ points }: { points: AeroobPunt[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 3) return null;

  const eerste = points[0]!.date;
  const laatste = points[points.length - 1]!.date;
  const spanne = Math.max(1, daysBetween(eerste, laatste));

  const waarden = points.map((p) => p.ef);
  const trend = rollingMean(waarden, VENSTER);

  const laag = Math.min(...waarden, ...trend);
  const hoog = Math.max(...waarden, ...trend);
  const marge = (hoog - laag) * 0.18 || 0.05;
  // Rasterlijnen op ronde waarden: 1,10 · 1,15 · 1,20 leest, 1,08 · 1,13 · 1,17 niet.
  const { onder, boven, stap } = netteAs(laag - marge, hoog + marge);
  const y = scale([onder, boven], [H - ONDER, BOVEN]);
  const x = (datum: IsoDate) => LINKS + (daysBetween(eerste, datum) / spanne) * (W - LINKS - RECHTS);

  const lijn = smoothPath(points.map((p, i) => ({ x: x(p.date), y: y(trend[i]!) })));
  const ticks = Array.from({ length: Math.round((boven - onder) / stap) + 1 }, (_, i) =>
    Math.round((onder + i * stap) * 1000) / 1000,
  );
  const gekozen = hover === null ? null : points[hover] ?? null;

  // Waar hij begon en waar hij nu staat, over hetzelfde venster gemiddeld.
  const start = trend[Math.min(VENSTER - 1, trend.length - 1)]!;
  const nu = trend[trend.length - 1]!;
  const groei = Math.round(((nu - start) / start) * 1000) / 10;

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]" style={{ color: 'var(--ink2)' }}>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--acc)', opacity: 0.45 }} />
          losse sessie
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden><line x1="0" y1="4" x2="18" y2="4" stroke="var(--acc)" strokeWidth="2.5" /></svg>
          gemiddelde over {VENSTER}
        </span>
        {points.length > VENSTER ? (
          <span className="num" style={{ color: 'var(--ink3)' }}>
            {groei >= 0 ? '+' : ''}{String(groei).replace('.', ',')}% sinds je eerste vijf sessies
          </span>
        ) : null}
      </figcaption>

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', height: 'auto' }}
          role="img" aria-label={samenvatting(points, trend)} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={LINKS} y1={round(y(t))} x2={W - RECHTS} y2={round(y(t))} stroke="var(--hair)" strokeWidth="1" />
              <text x={LINKS - 6} y={round(y(t)) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink3)" className="num">
                {t.toFixed(2).replace('.', ',')}
              </text>
            </g>
          ))}

          <path d={lijn} fill="none" stroke="var(--acc)" strokeWidth="2.5" strokeLinecap="round"
            strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

          {points.map((p, i) => (
            <circle key={p.date + i} cx={round(x(p.date))} cy={round(y(p.ef))} r={hover === i ? 5 : 3}
              fill="var(--acc)" opacity={hover === i ? 1 : 0.45}
              stroke={hover === i ? 'var(--card)' : 'none'} strokeWidth="2" />
          ))}

          <line x1={LINKS} y1={H - ONDER} x2={W - RECHTS} y2={H - ONDER} stroke="var(--hair)" strokeWidth="1" />

          <text x={LINKS} y={H - 9} textAnchor="start" fontSize="10" fill="var(--ink3)" className="num">
            {formatShort(eerste)}
          </text>
          <text x={W - RECHTS} y={H - 9} textAnchor="end" fontSize="10" fill="var(--ink3)" className="num">
            {formatShort(laatste, eerste)}
          </text>

          {/* Treffervlakken: breder dan een punt van drie pixels. */}
          {points.map((p, i) => {
            const vorige = i === 0 ? x(p.date) : (x(points[i - 1]!.date) + x(p.date)) / 2;
            const volgende = i === points.length - 1 ? x(p.date) : (x(p.date) + x(points[i + 1]!.date)) / 2;
            return (
              <rect key={`h-${p.date}-${i}`} x={round(vorige)} y={BOVEN} width={Math.max(4, round(volgende - vorige))}
                height={H - ONDER - BOVEN} fill="transparent" onMouseEnter={() => setHover(i)}
                onTouchStart={() => setHover(i)} />
            );
          })}
        </svg>

        {gekozen ? (
          <div className="pointer-events-none absolute top-0 rounded-[var(--r-btn)] px-3 py-2 text-[12px]"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--hair)',
              boxShadow: 'var(--sh)',
              left: `${(daysBetween(eerste, gekozen.date) / spanne) * 100}%`,
              transform: `translateX(${daysBetween(eerste, gekozen.date) / spanne > 0.5 ? '-100%' : '0'})`,
              minWidth: '160px',
            }}>
            <p className="font-semibold">{formatShort(gekozen.date, laatste)}</p>
            <p className="num mt-1.5">
              efficiëntie <span className="font-semibold" style={{ color: 'var(--acc)' }}>
                {gekozen.ef.toFixed(2).replace('.', ',')}
              </span>
            </p>
            <p className="num" style={{ color: 'var(--ink3)' }}>
              {gekozen.km} km · {gekozen.minutes} min · {gekozen.avg_hr} bpm
            </p>
            <p className="num" style={{ color: 'var(--ink3)' }}>{gekozen.hm} hoogtemeters</p>
          </div>
        ) : null}
      </div>
    </figure>
  );
}

function samenvatting(points: AeroobPunt[], trend: number[]): string {
  const eerste = trend[0]!.toFixed(2).replace('.', ',');
  const laatste = trend[trend.length - 1]!.toFixed(2).replace('.', ',');
  return `Aerobe efficiëntie over ${points.length} Z2-sessies, van ${eerste} naar ${laatste} meter per minuut per hartslag. Hoger is beter.`;
}

/** Een as met vier of vijf rasterlijnen op ronde stappen, ruim genoeg om alle
 *  punten te bevatten. */
function netteAs(laag: number, hoog: number): { onder: number; boven: number; stap: number } {
  const bereik = hoog - laag || 0.1;
  const stap = [0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2].find((k) => bereik / k <= 5) ?? 0.5;
  return {
    onder: Math.floor(laag / stap) * stap,
    boven: Math.ceil(hoog / stap) * stap,
    stap,
  };
}

const round = (n: number) => Math.round(n * 100) / 100;
