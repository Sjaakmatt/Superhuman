'use client';

import { useState } from 'react';
import { scale } from '@/components/charts/path';

export type VolumeWeek = {
  week: number;
  phase: string;
  status: string;
  target_km: number;
  /** Null voor weken die nog moeten komen — nul zou "niets gelopen" betekenen. */
  actual_km: number | null;
};

const W = 680;
const H = 260;
const LINKS = 34;
const RECHTS = 8;
const BOVEN = 14;
const ONDER = 32;

/* Gepland tegen gelopen, over 57 weken.
 *
 * Twee reeksen in dezelfde eenheid, dus één y-as — nooit twee schalen.
 * Ze verschillen van vorm (staaf tegen streepjeslijn) en staan in de legenda,
 * zodat kleur nooit het enige onderscheid is. Het geplande volume is een
 * traplijn en geen gladde curve: een weekdoel is een blok, geen verloop, en
 * een gladde lijn zou tussenwaarden suggereren die niet bestaan.
 *
 * De kleuren komen uit tokens.css (--acc tegen --ink3). Dat paar haalt in
 * beide themas de scheiding voor kleurenblindheid (ΔE 15,8 licht en 18,0
 * donker, ruim boven de ondergrens van 15). */
export default function VolumeProfile({
  weeks,
  currentWeek,
}: {
  weeks: VolumeWeek[];
  currentWeek: number | null;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (weeks.length < 2) return null;

  const maxWaarde = Math.max(...weeks.map((w) => Math.max(w.target_km, w.actual_km ?? 0)));
  const { top, stap } = nettePlafond(maxWaarde);
  const y = scale([0, top], [H - ONDER, BOVEN]);
  const band = (W - LINKS - RECHTS) / weeks.length;
  const x = (i: number) => LINKS + i * band;
  const staaf = Math.max(2, band - 2); // 2px lucht tussen de staven

  const ticks = Array.from({ length: Math.round(top / stap) + 1 }, (_, i) => i * stap);
  // Elke achtste week een label, behalve vlak naast het laatste — dan botsen ze.
  const labels = weeks.filter(
    (w, i) => i === 0 || i === weeks.length - 1 || (w.week % 8 === 0 && weeks.length - 1 - i > 2),
  );
  const nu = currentWeek === null ? -1 : weeks.findIndex((w) => w.week === currentWeek);
  const actief = hover ?? (nu >= 0 ? nu : null);
  const gekozen = actief === null ? null : weeks[actief] ?? null;

  // De traplijn: per week een horizontaal stuk op de doelwaarde.
  const trap = weeks
    .map((w, i) => `${i === 0 ? 'M' : 'L'} ${round(x(i))} ${round(y(w.target_km))} L ${round(x(i) + band)} ${round(y(w.target_km))}`)
    .join(' ');

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]" style={{ color: 'var(--ink2)' }}>
        <span className="flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden><line x1="0" y1="4" x2="18" y2="4" stroke="var(--ink3)" strokeWidth="2" strokeDasharray="4 3" /></svg>
          gepland
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: 'var(--acc)' }} />
          gelopen
        </span>
        <span className="flex items-center gap-1.5" style={{ color: 'var(--ink3)' }}>
          <span aria-hidden className="inline-block h-[3px] w-4 rounded-full" style={{ background: 'var(--ink3)', opacity: 0.55 }} />
          deloadweek
        </span>
      </figcaption>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: 'block', height: 'auto' }}
          role="img"
          aria-label={samenvatting(weeks, top)}
          onMouseLeave={() => setHover(null)}
        >
          {/* deloadweken: een streepje onder de as. Een achtergrondvlak valt in
              het donkere thema weg tegen de kaart, een streepje niet. */}
          {weeks.map((w, i) =>
            w.status === 'DELOAD' ? (
              <rect key={`d-${w.week}`} x={round(x(i) + 1)} y={H - ONDER + 2} width={round(band - 2)} height="2.5"
                rx="1.25" fill="var(--ink3)" opacity="0.55" />
            ) : null,
          )}

          {/* rasterlijnen, terughoudend */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={LINKS} y1={round(y(t))} x2={W - RECHTS} y2={round(y(t))} stroke="var(--hair)" strokeWidth="1" />
              <text x={LINKS - 6} y={round(y(t)) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink3)"
                className="num">{t}</text>
            </g>
          ))}

          {/* gelopen */}
          {weeks.map((w, i) =>
            w.actual_km === null || w.actual_km <= 0 ? null : (
              <rect key={`a-${w.week}`} x={round(x(i) + (band - staaf) / 2)} y={round(y(w.actual_km))}
                width={round(staaf)} height={round(H - ONDER - y(w.actual_km))} rx="2" fill="var(--acc)" />
            ),
          )}

          {/* gepland: een vlak voor de vorm van het blok, met de streepjeslijn erop */}
          <path d={`${trap} L ${round(W - RECHTS)} ${H - ONDER} L ${LINKS} ${H - ONDER} Z`} fill="var(--acc-soft)"
            opacity="0.55" />
          <path d={trap} fill="none" stroke="var(--ink3)" strokeWidth="2" strokeDasharray="4 3"
            strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

          {/* deze week */}
          {nu >= 0 ? (
            <line x1={round(x(nu) + band / 2)} y1={BOVEN} x2={round(x(nu) + band / 2)} y2={H - ONDER}
              stroke="var(--acc)" strokeWidth="1.5" />
          ) : null}

          {/* aanwijslijn */}
          {hover !== null ? (
            <line x1={round(x(hover) + band / 2)} y1={BOVEN} x2={round(x(hover) + band / 2)} y2={H - ONDER}
              stroke="var(--ink3)" strokeWidth="1" />
          ) : null}

          <line x1={LINKS} y1={H - ONDER} x2={W - RECHTS} y2={H - ONDER} stroke="var(--hair)" strokeWidth="1" />

          {labels.map((w) => {
            const i = weeks.indexOf(w);
            return (
              <text key={`x-${w.week}`} x={round(x(i) + band / 2)} y={H - 8} textAnchor="middle" fontSize="10"
                fill="var(--ink3)" className="num">{w.week}</text>
            );
          })}

          {/* onzichtbare treffervlakken: groter dan de staaf, dus ook op de telefoon te raken */}
          {weeks.map((w, i) => (
            <rect key={`h-${w.week}`} x={round(x(i))} y={BOVEN} width={round(band)} height={H - ONDER - BOVEN}
              fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)}
              onTouchStart={() => setHover(i)} />
          ))}
        </svg>

        {gekozen ? (
          <div
            className="pointer-events-none absolute top-0 rounded-[var(--r-btn)] px-3 py-2 text-[12px]"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--hair)',
              boxShadow: 'var(--sh)',
              left: `${((actief! + 0.5) / weeks.length) * 100}%`,
              transform: `translateX(${actief! > weeks.length / 2 ? '-100%' : '0'})`,
              minWidth: '150px',
            }}
          >
            <p className="font-semibold">
              Week {gekozen.week}
              {gekozen.status === 'DELOAD' ? ' · deload' : ''}
            </p>
            <p style={{ color: 'var(--ink3)' }}>{gekozen.phase.replace(/^\d+\.\s*/, '')}</p>
            <p className="num mt-1.5">
              gepland <span className="font-semibold">{Math.round(gekozen.target_km)} km</span>
            </p>
            <p className="num">
              gelopen{' '}
              <span className="font-semibold" style={{ color: 'var(--acc)' }}>
                {gekozen.actual_km === null ? 'nog niet' : `${Math.round(gekozen.actual_km * 10) / 10} km`}
              </span>
            </p>
          </div>
        ) : null}
      </div>
    </figure>
  );
}

/** Een plafond op een rond getal, met vier of vijf rasterlijnen. Zo krijg je
 *  0, 25, 50, 75, 100, 125 in plaats van 0, 35, 70 — en geen derde van de
 *  hoogte die leeg blijft. */
function nettePlafond(max: number): { top: number; stap: number } {
  const stap = [5, 10, 20, 25, 50, 100, 200].find((s) => max / s <= 5) ?? 500;
  return { top: Math.max(stap * 3, Math.ceil(max / stap) * stap), stap };
}

/** Wat een schermlezer van de grafiek moet weten: het bereik en de vergelijking,
 *  niet 57 losse getallen. */
function samenvatting(weeks: VolumeWeek[], top: number): string {
  const gelopen = weeks.filter((w) => w.actual_km !== null);
  const doel = gelopen.reduce((t, w) => t + w.target_km, 0);
  const echt = gelopen.reduce((t, w) => t + (w.actual_km ?? 0), 0);
  const hoogste = weeks.reduce((a, b) => (b.target_km > a.target_km ? b : a));
  return `Geplande en gelopen kilometers per week over ${weeks.length} weken, van 0 tot ${top} kilometer. De zwaarste week is week ${hoogste.week} met ${Math.round(hoogste.target_km)} kilometer. Tot nu toe stond er ${Math.round(doel)} kilometer gepland en liep je er ${Math.round(echt)}.`;
}

const round = (n: number) => Math.round(n * 100) / 100;
