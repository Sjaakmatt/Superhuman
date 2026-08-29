'use client';

import { useState, useTransition } from 'react';
import { deleteBloodPanel, saveBloodPanel, type BloodPanelInput } from '@/lib/actions';
import { Card, CardTitle, Empty, Note } from '@/components/ui';
import { formatShort } from '@/lib/date';
import type { BloodMarker, BloodPanel } from '@/lib/types';

/* Welke bepalingen er zijn komt uit de naslag, niet uit dit bestand: een lab
 * geeft er twintig terug en welke daarvan iets aan je training veranderen is
 * een keuze die in de seed hoort. */

const getal = (tekst: string): number | null => {
  const schoon = tekst.trim().replace(',', '.');
  if (!schoon) return null;
  const n = Number(schoon);
  return Number.isFinite(n) ? n : null;
};

const nl = (n: number) => String(n).replace('.', ',');

export default function Bloedwaarden({
  panels,
  markers,
  today,
}: {
  panels: BloodPanel[];
  markers: BloodMarker[];
  today: string;
}) {
  const [datum, setDatum] = useState(today);
  const [ruw, setRuw] = useState<Record<string, string>>({});
  const [notitie, setNotitie] = useState('');
  const [open, setOpen] = useState(panels.length === 0);
  const [state, setState] = useState<'leeg' | 'bezig' | 'fout'>('leeg');
  const [fout, setFout] = useState<string | null>(null);
  const [teVerwijderen, setTeVerwijderen] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const nulmeting = panels[0] ?? null;
  const groepen = [...new Set(markers.map((m) => m.group))];

  function bewaar() {
    setState('bezig');
    setFout(null);
    const values: Record<string, number> = {};
    for (const m of markers) {
      const n = getal(ruw[m.code] ?? '');
      if (n !== null) values[m.code] = n;
    }
    const input: BloodPanelInput = { date: datum, note: notitie.trim() || null, values };
    startTransition(async () => {
      const res = await saveBloodPanel(input);
      if (res.ok) {
        setState('leeg');
        setRuw({});
        setNotitie('');
        setDatum(today);
        setOpen(false);
      } else {
        setState('fout');
        setFout(res.error);
      }
    });
  }

  function laadIn(panel: BloodPanel) {
    setDatum(panel.date);
    setRuw(Object.fromEntries(Object.entries(panel.values).map(([code, waarde]) => [code, nl(waarde)])));
    setNotitie(panel.note ?? '');
    setOpen(true);
    setState('leeg');
  }

  function verwijder(date: string) {
    startTransition(async () => {
      const res = await deleteBloodPanel(date);
      if (!res.ok) setFout(res.error);
      setTeVerwijderen(null);
    });
  }

  return (
    <Card>
      <CardTitle
        aside={
          <button type="button" onClick={() => setOpen((o) => !o)} className="font-semibold"
            style={{ color: 'var(--acc)' }}>
            {open ? 'Sluiten' : 'Uitslag invoeren'}
          </button>
        }
      >
        Bloedwaarden
      </CardTitle>

      {panels.length === 0 && !open ? (
        <Empty title="Nog geen uitslag">
          Na elk bloedpanel uit je plan vul je hier de waarden in. Daarmee verdwijnt het signaal op Analyse en zie je
          welke kant je ferritine op beweegt.
        </Empty>
      ) : null}

      {[...panels].reverse().map((panel, i) => {
        const isNulmeting = panel.date === nulmeting?.date;
        const ingevuld = markers.filter((m) => panel.values[m.code] !== undefined);
        return (
          <div key={panel.date} className="border-b py-4 first:pt-0 last:border-0" style={{ borderColor: 'var(--hair)' }}>
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <p className="text-[14px] font-semibold">{formatShort(panel.date, today)}</p>
              <span className="text-[11px]" style={{ color: 'var(--ink3)' }}>
                {isNulmeting ? 'nulmeting' : i === 0 ? 'laatste' : ''}
              </span>
              <span className="ml-auto flex gap-3 text-[12px]">
                <button type="button" onClick={() => laadIn(panel)} className="underline"
                  style={{ color: 'var(--ink3)' }}>Wijzig</button>
                {teVerwijderen === panel.date ? (
                  <button type="button" onClick={() => verwijder(panel.date)} className="font-semibold"
                    style={{ color: 'var(--crit)' }}>Zeker weten?</button>
                ) : (
                  <button type="button" onClick={() => setTeVerwijderen(panel.date)} className="underline"
                    style={{ color: 'var(--ink3)' }}>Verwijder</button>
                )}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 side:grid-cols-3">
              {ingevuld.map((m) => {
                const waarde = panel.values[m.code]!;
                const basis = isNulmeting ? undefined : nulmeting?.values[m.code];
                const verschil = basis === undefined ? null : Math.round((waarde - basis) * 10) / 10;
                return (
                  <div key={m.code}>
                    <dd className="num text-[15px] font-semibold">
                      {nl(waarde)}
                      <span className="ml-1 text-[11px] font-medium" style={{ color: 'var(--ink3)' }}>{m.unit}</span>
                    </dd>
                    <dt className="text-[11px]" style={{ color: 'var(--ink3)' }}>
                      {m.label}
                      {verschil ? <span className="num ml-1">{verschil > 0 ? '+' : ''}{nl(verschil)}</span> : null}
                    </dt>
                  </div>
                );
              })}
            </dl>
            {panel.note ? <p className="mt-2 text-[13px]" style={{ color: 'var(--ink2)' }}>{panel.note}</p> : null}
          </div>
        );
      })}

      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            bewaar();
          }}
          className="mt-4 flex flex-col gap-5 rounded-[var(--r-tile)] p-4"
          style={{ background: 'var(--card2)' }}
        >
          <div>
            <label htmlFor="bp-datum" className="text-[13px] font-medium">Prikdatum</label>
            <input id="bp-datum" type="date" value={datum} required onChange={(e) => setDatum(e.target.value)}
              className="num mt-1.5 block w-full rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
              style={{ background: 'var(--card)', color: 'var(--ink)' }} />
          </div>

          {groepen.map((groep) => (
            <fieldset key={groep} className="border-0 p-0">
              <legend className="mb-2 text-[12px] font-semibold uppercase tracking-[.08em]"
                style={{ color: 'var(--ink3)' }}>{groep}</legend>
              {/* Alleen naam, veld en eenheid. Waaróm een bepaling er staat is
                  eenmalig te lezen, niet elke keer dat je iets invult; die zin
                  blijft in de naslag voor de coach. */}
              <div className="grid grid-cols-1 gap-2 side:grid-cols-2">
                {markers.filter((m) => m.group === groep).map((m) => (
                  <div key={m.code} className="flex max-w-[330px] items-center gap-2">
                    <label htmlFor={`bp-${m.code}`} className="flex-1 text-[13px] font-medium">{m.label}</label>
                    <input id={`bp-${m.code}`} inputMode="decimal" value={ruw[m.code] ?? ''}
                      onChange={(e) => setRuw({ ...ruw, [m.code]: e.target.value })}
                      className="num w-20 shrink-0 rounded-[var(--r-btn)] px-3 py-2 text-[14px] outline-none"
                      style={{ background: 'var(--card)', color: 'var(--ink)' }} />
                    <span className="w-[74px] shrink-0 text-[12px]" style={{ color: 'var(--ink3)' }}>{m.unit}</span>
                  </div>
                ))}
              </div>
            </fieldset>
          ))}

          <div>
            <label htmlFor="bp-notitie" className="text-[13px] font-medium">Notitie</label>
            <textarea id="bp-notitie" rows={2} value={notitie} onChange={(e) => setNotitie(e.target.value)}
              placeholder="Wat de arts zei, of wat je gebruikte."
              className="mt-1.5 block w-full resize-y rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
              style={{ background: 'var(--card)', color: 'var(--ink)' }} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={state === 'bezig'}
              className="interactive rounded-[var(--r-btn)] px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50"
              style={{ background: 'var(--acc)', color: 'var(--acc-ink)' }}>
              {state === 'bezig' ? 'Opslaan…' : 'Bewaren'}
            </button>
            <span className="text-[12px]" style={{ color: 'var(--ink3)' }}>
              Niet bepaald? Laat leeg. Leeg is iets anders dan nul.
            </span>
          </div>
        </form>
      ) : null}

      {fout ? <p className="mt-3 text-[12px]" style={{ color: 'var(--crit)' }}>{fout}</p> : null}

      <Note>Vergelijk met je eigen nulmeting, niet met de ondergrens van het lab.</Note>
    </Card>
  );
}
