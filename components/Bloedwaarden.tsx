'use client';

import { useState, useTransition } from 'react';
import { deleteBloodPanel, saveBloodPanel, type BloodPanelInput } from '@/lib/actions';
import { Card, CardTitle, Empty, Note } from '@/components/ui';
import { formatShort } from '@/lib/date';
import type { BloodPanel } from '@/lib/types';

/* De bepalingen die deze app bewaart, in de volgorde waarin een uitslag ze
 * meestal geeft. De eenheden staan erbij zoals een Nederlands lab ze schrijft;
 * de app rekent niet om, hij bewaart wat jij invult. */
const VELDEN = [
  { key: 'ferritin', label: 'Ferritine', unit: 'µg/L' },
  { key: 'tsat', label: 'Transferrinesaturatie', unit: '%' },
  { key: 'hb', label: 'Hemoglobine', unit: 'mmol/L' },
  { key: 'crp', label: 'CRP', unit: 'mg/L' },
  { key: 'b12', label: 'Vitamine B12', unit: 'pmol/L' },
  { key: 'vit_d', label: 'Vitamine D', unit: 'nmol/L' },
  { key: 'tsh', label: 'TSH', unit: 'mIE/L' },
] as const;

type Veld = (typeof VELDEN)[number]['key'];
type Concept = Record<Veld, string> & { date: string; note: string };

const LEEG: Omit<Concept, 'date'> = {
  ferritin: '', tsat: '', hb: '', crp: '', b12: '', vit_d: '', tsh: '', note: '',
};

const getal = (tekst: string): number | null => {
  const schoon = tekst.trim().replace(',', '.');
  if (!schoon) return null;
  const n = Number(schoon);
  return Number.isFinite(n) ? n : null;
};

export default function Bloedwaarden({ panels, today }: { panels: BloodPanel[]; today: string }) {
  const [concept, setConcept] = useState<Concept>({ date: today, ...LEEG });
  const [open, setOpen] = useState(panels.length === 0);
  const [state, setState] = useState<'leeg' | 'bezig' | 'bewaard' | 'fout'>('leeg');
  const [fout, setFout] = useState<string | null>(null);
  const [teVerwijderen, setTeVerwijderen] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const nulmeting = panels[0] ?? null;

  function bewaar() {
    setState('bezig');
    setFout(null);
    const input: BloodPanelInput = {
      date: concept.date,
      ferritin: getal(concept.ferritin),
      tsat: getal(concept.tsat),
      hb: getal(concept.hb),
      crp: getal(concept.crp),
      b12: getal(concept.b12),
      vit_d: getal(concept.vit_d),
      tsh: getal(concept.tsh),
      note: concept.note.trim() || null,
    };
    startTransition(async () => {
      const res = await saveBloodPanel(input);
      if (res.ok) {
        setState('bewaard');
        setConcept({ date: today, ...LEEG });
        setOpen(false);
      } else {
        setState('fout');
        setFout(res.error);
      }
    });
  }

  function laadIn(panel: BloodPanel) {
    setConcept({
      date: panel.date,
      ferritin: panel.ferritin?.toString() ?? '',
      tsat: panel.tsat?.toString() ?? '',
      hb: panel.hb?.toString() ?? '',
      crp: panel.crp?.toString() ?? '',
      b12: panel.b12?.toString() ?? '',
      vit_d: panel.vit_d?.toString() ?? '',
      tsh: panel.tsh?.toString() ?? '',
      note: panel.note ?? '',
    });
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
          Na elk bloedpanel uit je plan vul je hier de waarden in. Daarmee verdwijnt het signaal op Analyse en kun je
          zien welke kant je ferritine op beweegt.
        </Empty>
      ) : null}

      {[...panels].reverse().map((panel, i) => {
        const isNulmeting = panel.date === nulmeting?.date;
        return (
          <div key={panel.date} className="border-b py-4 first:pt-0 last:border-0"
            style={{ borderColor: 'var(--hair)' }}>
            <div className="mb-2 flex items-baseline gap-2">
              <p className="text-[14px] font-semibold">{formatShort(panel.date, today)}</p>
              <span className="text-[11px]" style={{ color: 'var(--ink3)' }}>
                {isNulmeting ? 'nulmeting' : `${i === 0 ? 'laatste · ' : ''}vergeleken met je nulmeting`}
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

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 side:grid-cols-4">
              {VELDEN.filter((v) => panel[v.key] !== null).map((v) => {
                const waarde = Number(panel[v.key]);
                const basis = isNulmeting ? null : nulmeting?.[v.key];
                const verschil = basis === null || basis === undefined ? null : waarde - Number(basis);
                return (
                  <div key={v.key}>
                    <dd className="num text-[15px] font-semibold">
                      {waarde}
                      <span className="ml-1 text-[11px] font-medium" style={{ color: 'var(--ink3)' }}>{v.unit}</span>
                    </dd>
                    <dt className="text-[11px]" style={{ color: 'var(--ink3)' }}>
                      {v.label}
                      {verschil !== null && verschil !== 0 ? (
                        <span className="num ml-1">
                          {verschil > 0 ? '+' : ''}{Math.round(verschil * 10) / 10}
                        </span>
                      ) : null}
                    </dt>
                  </div>
                );
              })}
            </dl>
            {panel.note ? (
              <p className="mt-2 text-[13px]" style={{ color: 'var(--ink2)' }}>{panel.note}</p>
            ) : null}
          </div>
        );
      })}

      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            bewaar();
          }}
          className="mt-4 flex flex-col gap-4 rounded-[var(--r-tile)] p-4"
          style={{ background: 'var(--card2)' }}
        >
          <div>
            <label htmlFor="bp-datum" className="text-[13px] font-medium">Prikdatum</label>
            <input id="bp-datum" type="date" value={concept.date} required
              onChange={(e) => setConcept({ ...concept, date: e.target.value })}
              className="num mt-1.5 block w-full rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
              style={{ background: 'var(--card)', color: 'var(--ink)' }} />
          </div>

          <div className="grid grid-cols-2 gap-3 side:grid-cols-3">
            {VELDEN.map((v) => (
              <div key={v.key}>
                <label htmlFor={`bp-${v.key}`} className="text-[13px] font-medium">{v.label}</label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input id={`bp-${v.key}`} inputMode="decimal" value={concept[v.key]}
                    onChange={(e) => setConcept({ ...concept, [v.key]: e.target.value })}
                    className="num w-full rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
                    style={{ background: 'var(--card)', color: 'var(--ink)' }} />
                  <span className="shrink-0 text-[12px]" style={{ color: 'var(--ink3)' }}>{v.unit}</span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label htmlFor="bp-notitie" className="text-[13px] font-medium">Notitie</label>
            <textarea id="bp-notitie" rows={2} value={concept.note}
              onChange={(e) => setConcept({ ...concept, note: e.target.value })}
              placeholder="Wat de arts zei, of wat je gebruikte."
              className="mt-1.5 block w-full resize-y rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
              style={{ background: 'var(--card)', color: 'var(--ink)' }} />
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={state === 'bezig'}
              className="interactive rounded-[var(--r-btn)] px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50"
              style={{ background: 'var(--acc)', color: 'var(--acc-ink)' }}>
              {state === 'bezig' ? 'Opslaan…' : 'Bewaren'}
            </button>
            <span className="text-[12px]" style={{ color: 'var(--ink3)' }}>
              Wat je leeg laat, blijft leeg — dat is iets anders dan nul.
            </span>
          </div>
        </form>
      ) : null}

      {fout ? <p className="mt-3 text-[12px]" style={{ color: 'var(--crit)' }}>{fout}</p> : null}

      <Note>
        Vergelijk met je eigen nulmeting, niet met de ondergrens van het lab. Wat de waarden betekenen bespreek je met
        je arts; deze app bewaart ze alleen en laat de beweging zien.
      </Note>
    </Card>
  );
}
