import Link from 'next/link';
import Bloedwaarden from '@/components/Bloedwaarden';
import HartslagMax from '@/components/HartslagMax';
import { Card, CardTitle, Empty, Note } from '@/components/ui';
import { formatShort, type IsoDate } from '@/lib/date';
import type { BloodPanel, HrTest, Milestone } from '@/lib/types';
import type { IjkPunt } from '@/lib/data';

/* Alles wat je gemeten hebt, naast elkaar. Het plan zegt in week 14 "die drie
 * leg je in week 39 en week 53 ernaast" — dit is die plek.
 *
 * Niets hier wordt ingevuld: de looppunten komen uit de nachtelijke Strava-sync,
 * de bloedwaarden uit Instellingen, de HRmax uit de test. */
export default function Metingen({
  milestones,
  ijkpunten,
  hrTests,
  panels,
  today,
  hrMax,
  hrMeasuredOn,
  writable,
}: {
  milestones: Milestone[];
  ijkpunten: Map<IsoDate, IjkPunt>;
  hrTests: HrTest[];
  panels: BloodPanel[];
  today: IsoDate;
  hrMax: number;
  hrMeasuredOn: IsoDate | null;
  /** Zonder database kun je kijken maar niet invullen. */
  writable: boolean;
}) {
  const loopdagen = milestones.filter((m) => m.logs === 'loop' && m.date <= today);
  const nulmeting = panels[0] ?? null;
  const leeg = !loopdagen.length && !hrTests.length && !panels.length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
      <CardTitle aside="wat je gemeten hebt">Metingen</CardTitle>

      {leeg ? (
        <Empty title="Nog niets gemeten">
          Hier komt wat je tests opleveren: de looppunten uit Strava, je bloedwaarden en je gemeten maximumhartslag.
          De eerste twee vul je hieronder in; de looppunten komen vanzelf binnen.
        </Empty>
      ) : null}

      {loopdagen.length ? (
        <section className="mb-6">
          <h3 className="mb-2 text-[13px] font-semibold">IJkpunten</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-[13px]">
              <thead>
                <tr style={{ color: 'var(--ink3)' }}>
                  <Kop>dag</Kop>
                  <Kop>test</Kop>
                  <Kop rechts>km</Kop>
                  <Kop rechts>tijd</Kop>
                  <Kop rechts>tempo</Kop>
                  <Kop rechts>hm</Kop>
                  <Kop rechts>hartslag</Kop>
                  <Kop rechts>afdaal</Kop>
                </tr>
              </thead>
              <tbody>
                {loopdagen.map((m) => {
                  const p = ijkpunten.get(m.date) ?? null;
                  return (
                    <tr key={m.date} className="border-t" style={{ borderColor: 'var(--hair)' }}>
                      <Cel>
                        <Link href={`/?d=${m.date}`} className="num" style={{ color: 'var(--ink2)' }}>
                          {formatShort(m.date, today)}
                        </Link>
                      </Cel>
                      <Cel>{m.title}</Cel>
                      {p ? (
                        <>
                          <Cel rechts num>{p.km}</Cel>
                          <Cel rechts num>{uren(p.minutes)}</Cel>
                          <Cel rechts num>{tempo(p.km, p.minutes)}</Cel>
                          <Cel rechts num>{p.hm}</Cel>
                          <Cel rechts num>{p.avg_hr ?? '—'}</Cel>
                          <Cel rechts num>{p.descent_min ?? '—'}</Cel>
                        </>
                      ) : (
                        <td colSpan={6} className="py-2 text-right text-[12px]" style={{ color: 'var(--ink3)' }}>
                          nog niets uit Strava
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Note>
            Tempo en hartslag naast elkaar zeggen meer dan elk apart: sneller lopen bij dezelfde hartslag is de winst
            waar dit plan op stuurt. De afstanden verschillen, dus vergelijk het tempo, niet de tijd.
          </Note>
        </section>
      ) : null}

      {hrTests.length ? (
        <section className="mb-6">
          <h3 className="mb-2 text-[13px] font-semibold">Maximumhartslag</h3>
          <ul className="flex flex-col">
            {[...hrTests].reverse().map((t, i, alle) => {
              const vorige = alle[i + 1];
              const verschil = vorige ? t.hr_max - vorige.hr_max : null;
              return (
                <li key={t.date} className="flex items-baseline gap-3 border-b py-2 last:border-0"
                  style={{ borderColor: 'var(--hair)' }}>
                  <span className="num w-16 shrink-0 text-[12px]" style={{ color: 'var(--ink3)' }}>
                    {formatShort(t.date, today)}
                  </span>
                  <span className="num text-[15px] font-semibold">{t.hr_max}</span>
                  <span className="text-[12px]" style={{ color: 'var(--ink3)' }}>bpm</span>
                  {verschil !== null && verschil !== 0 ? (
                    <span className="num text-[12px]" style={{ color: 'var(--ink3)' }}>
                      {verschil > 0 ? '+' : ''}{verschil} sinds de vorige
                    </span>
                  ) : null}
                  {t.note ? (
                    <span className="ml-auto truncate text-[12px]" style={{ color: 'var(--ink3)' }}>{t.note}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {panels.length ? (
        <section>
          <h3 className="mb-2 text-[13px] font-semibold">Bloedwaarden</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-[13px]">
              <thead>
                <tr style={{ color: 'var(--ink3)' }}>
                  <Kop>dag</Kop>
                  <Kop rechts>ferritine</Kop>
                  <Kop rechts>TSAT</Kop>
                  <Kop rechts>Hb</Kop>
                  <Kop rechts>CRP</Kop>
                  <Kop rechts>vit D</Kop>
                  <Kop rechts>B12</Kop>
                  <Kop rechts>TSH</Kop>
                </tr>
              </thead>
              <tbody>
                {[...panels].reverse().map((p) => (
                  <tr key={p.date} className="border-t" style={{ borderColor: 'var(--hair)' }}>
                    <Cel>
                      <span className="num" style={{ color: 'var(--ink2)' }}>{formatShort(p.date, today)}</span>
                      {p.date === nulmeting?.date ? (
                        <span className="ml-1 text-[11px]" style={{ color: 'var(--ink3)' }}>T0</span>
                      ) : null}
                    </Cel>
                    <Cel rechts num>{p.ferritin ?? '—'}</Cel>
                    <Cel rechts num>{p.tsat ?? '—'}</Cel>
                    <Cel rechts num>{p.hb ?? '—'}</Cel>
                    <Cel rechts num>{p.crp ?? '—'}</Cel>
                    <Cel rechts num>{p.vit_d ?? '—'}</Cel>
                    <Cel rechts num>{p.b12 ?? '—'}</Cel>
                    <Cel rechts num>{p.tsh ?? '—'}</Cel>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Note>Vergelijk met je eigen nulmeting, niet met de ondergrens van het lab.</Note>
        </section>
      ) : null}
      </Card>

      {/* Invoeren gebeurt hier, bij de cijfers zelf. Metingen zijn gegevens,
          geen instelling — daarom staan ze niet meer onder Instellingen. */}
      {writable ? (
        <>
          <Bloedwaarden panels={panels} today={today} />
          <Card>
            <CardTitle aside={`nu ${hrMax} bpm`}>Maximumhartslag</CardTitle>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink2)' }}>
              De uitslag van de HRmax-test. Je zonegrenzen schalen mee, en de vorige metingen blijven staan zodat je
              ziet welke kant je maximum op gaat.
            </p>
            <HartslagMax hrMax={hrMax} measuredOn={hrMeasuredOn} today={today} />
          </Card>
        </>
      ) : null}
    </div>
  );
}

/** "2u14" leest sneller dan "134 min" zodra het over een wedstrijd gaat. */
function uren(minuten: number): string {
  if (minuten < 60) return `${minuten}m`;
  return `${Math.floor(minuten / 60)}u${String(minuten % 60).padStart(2, '0')}`;
}

/** Minuten per kilometer, de enige maat die tussen 25 en 100 km vergelijkbaar is. */
function tempo(km: number, minuten: number): string {
  if (!km || !minuten) return '—';
  const perKm = minuten / km;
  const m = Math.floor(perKm);
  const s = Math.round((perKm - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function Kop({ children, rechts }: { children: React.ReactNode; rechts?: boolean }) {
  return (
    <th className={`pb-2 text-[11px] font-semibold uppercase tracking-[.06em] ${rechts ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Cel({ children, rechts, num }: { children: React.ReactNode; rechts?: boolean; num?: boolean }) {
  return (
    <td className={`py-2.5 ${rechts ? 'pl-3 text-right' : 'pr-3'} ${num ? 'num' : ''}`}>{children}</td>
  );
}
