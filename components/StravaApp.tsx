'use client';

import { useState, useTransition } from 'react';
import { deleteStravaApp, saveStravaApp } from '@/lib/actions';
import { Note } from '@/components/ui';

/* Je eigen Strava-app. De limieten van Strava gelden per app, dus iedereen
 * maakt er zelf één aan; wie dat niet doet valt terug op de app uit de
 * omgeving. De sleutel gaat één kant op: het scherm laat hem nooit meer zien. */
export default function StravaApp({
  app,
  domein,
}: {
  app: { client_id: string; eigen: boolean } | null;
  domein: string;
}) {
  const [open, setOpen] = useState(!app);
  const [clientId, setClientId] = useState(app?.eigen ? app.client_id : '');
  const [sleutel, setSleutel] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [weg, setWeg] = useState(false);
  const [bezig, startTransition] = useTransition();

  function bewaar(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    startTransition(async () => {
      const res = await saveStravaApp(clientId, sleutel);
      if (res.ok) {
        setSleutel('');
        setOpen(false);
      } else {
        setFout(res.error);
      }
    });
  }

  function verwijder() {
    if (!weg) {
      setWeg(true);
      return;
    }
    setWeg(false);
    setFout(null);
    startTransition(async () => {
      const res = await deleteStravaApp();
      if (res.ok) {
        setClientId('');
        setOpen(true);
      } else {
        setFout(res.error);
      }
    });
  }

  if (!open && app) {
    return (
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-[13px]" style={{ color: 'var(--ink3)' }}>
          {app.eigen
            ? `Je eigen Strava-app, client-id ${app.client_id}. De sleutel staat opgeslagen.`
            : `App uit de omgeving, client-id ${app.client_id}.`}
        </p>
        <button type="button" onClick={() => setOpen(true)} className="text-[13px] font-semibold"
          style={{ color: 'var(--acc)' }}>
          {app.eigen ? 'Andere app invullen' : 'Eigen app invullen'}
        </button>
        {app.eigen ? (
          <button type="button" onClick={verwijder} disabled={bezig} className="text-[13px] font-semibold"
            style={{ color: weg ? 'var(--crit)' : 'var(--ink3)' }}>
            {weg ? 'Zeker weten? De koppeling gaat mee.' : 'Verwijderen'}
          </button>
        ) : null}
        {fout ? <p className="w-full text-[13px]" style={{ color: 'var(--crit)' }}>{fout}</p> : null}
      </div>
    );
  }

  return (
    <form onSubmit={bewaar} className="mb-3 flex flex-col gap-3 rounded-[var(--r-tile)] p-4"
      style={{ background: 'var(--card2)' }}>
      <div>
        <p className="text-[14px] font-semibold">Maak je eigen Strava-app</p>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-[13px] leading-relaxed"
          style={{ color: 'var(--ink2)' }}>
          <li>
            Ga naar{' '}
            <a href="https://www.strava.com/settings/api" target="_blank" rel="noreferrer"
              style={{ color: 'var(--acc)' }}>strava.com/settings/api</a>{' '}
            en log in met je eigen Strava-account.
          </li>
          <li>Vul een naam in (bijvoorbeeld Ultra100), kies categorie <em>Training</em> en zet je website op <code>https://{domein}</code>.</li>
          <li>Bij <em>Authorization Callback Domain</em> vul je precies <code>{domein}</code> in — zonder https en zonder schuine streep.</li>
          <li>Sla op. Strava toont dan een <em>Client ID</em> en een <em>Client Secret</em>; die twee horen hieronder.</li>
        </ol>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="strava-id" className="text-[13px] font-medium">Client ID</label>
          <input id="strava-id" inputMode="numeric" value={clientId} onChange={(e) => setClientId(e.target.value)}
            placeholder="123456"
            className="num mt-1.5 block w-32 rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
            style={{ background: 'var(--card)', color: 'var(--ink)' }} />
        </div>
        <div className="min-w-[220px] flex-1">
          <label htmlFor="strava-sleutel" className="text-[13px] font-medium">Client Secret</label>
          <input id="strava-sleutel" type="password" autoComplete="off" value={sleutel}
            onChange={(e) => setSleutel(e.target.value)} placeholder="veertig tekens"
            className="num mt-1.5 block w-full rounded-[var(--r-btn)] px-3 py-2.5 text-[14px] outline-none"
            style={{ background: 'var(--card)', color: 'var(--ink)' }} />
        </div>
        <button type="submit" disabled={bezig}
          className="interactive rounded-[var(--r-btn)] px-4 py-2.5 text-[13px] font-semibold"
          style={{ background: 'var(--acc)', color: 'var(--acc-ink)' }}>
          {bezig ? 'bezig…' : 'Bewaren'}
        </button>
        {app ? (
          <button type="button" onClick={() => { setOpen(false); setFout(null); }}
            className="text-[13px] font-semibold" style={{ color: 'var(--ink3)' }}>
            Laat maar
          </button>
        ) : null}
      </div>

      {fout ? <p className="text-[13px]" style={{ color: 'var(--crit)' }}>{fout}</p> : null}
      <Note>
        De sleutel blijft op de server; hij komt nooit in je browser en is hierna niet meer op te vragen.
        Kwijt? Maak er bij Strava een nieuwe aan en vul die hier in.
      </Note>
    </form>
  );
}
