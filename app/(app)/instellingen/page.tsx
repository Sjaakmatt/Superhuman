import Bronnen from '@/components/Bronnen';
import HartslagMax from '@/components/HartslagMax';
import StravaOphalen from '@/components/StravaOphalen';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import ShoeList from '@/components/ShoeList';
import PushToggle from '@/components/PushToggle';
import Uitloggen from '@/components/Uitloggen';
import Uitnodigingen from '@/components/Uitnodigingen';
import { Card, CardTitle, Empty, Note, Pill } from '@/components/ui';
import { getApparaten, getAthlete, getInvitations, getLastSync, getShoes, getZones } from '@/lib/data';
import { currentUser } from '@/lib/db';
import { dbConfigured } from '@/lib/db';
import { insightConfigured } from '@/lib/insight';
import { stravaConfigured } from '@/lib/strava';
import { planSource } from '@/lib/plan';
import { today as todayIn } from '@/lib/date';

export default async function Instellingen({ searchParams }: { searchParams: Promise<{ strava?: string }> }) {
  const params = await searchParams;
  const now = todayIn();
  const [athlete, shoes, zones, user] = await Promise.all([
    getAthlete(),
    getShoes(),
    getZones(),
    currentUser(),
  ]);
  const [laatsteSync, apparaten] = await Promise.all([
    athlete?.strava_athlete_id ? getLastSync() : Promise.resolve(null),
    dbConfigured() ? getApparaten() : Promise.resolve([]),
  ]);
  // De lijst is alleen zichtbaar voor wie hem mag beheren.
  const uitnodigingen = athlete?.can_invite ? await getInvitations() : [];

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4 pt-2">
      <Card>
        <CardTitle>Weergave</CardTitle>
        <ThemeToggle />
        <Note>Beide themas zijn ontworpen, niet omgeklapt. Zonder keuze volgt de app je systeem.</Note>
      </Card>

      <Card>
        <CardTitle aside={<Pill tone={athlete?.strava_athlete_id ? 'acc' : 'neutral'}>
          {athlete?.strava_athlete_id ? 'verbonden' : 'niet verbonden'}
        </Pill>}>
          Strava
        </CardTitle>
        {params.strava ? (
          <p className="mb-3 text-[13px]" style={{ color: params.strava === 'verbonden' ? 'var(--acc)' : 'var(--crit)' }}>
            {params.strava === 'verbonden' ? 'Gelukt. De eerste sync haalt alles vanaf 1 juni 2026 op.' : `Mislukt: ${params.strava}`}
          </p>
        ) : null}
        {stravaConfigured() ? (
          <a href="/api/strava/connect" className="interactive inline-block rounded-[var(--r-btn)] px-4 py-2.5 text-[13px] font-semibold"
            style={{ background: 'var(--acc)', color: 'var(--acc-ink)' }}>
            {athlete?.strava_athlete_id ? 'Opnieuw koppelen' : 'Koppel Strava'}
          </a>
        ) : (
          <Empty title="Nog geen Strava-app">
            Maak er één aan op strava.com/settings/api met scope <code>activity:read_all,profile:read_all</code> en zet
            <code> STRAVA_CLIENT_ID</code> en <code>STRAVA_CLIENT_SECRET</code> in je omgeving.
          </Empty>
        )}
        {athlete?.strava_athlete_id ? <StravaOphalen laatst={laatsteSync} /> : null}
        <Note>
          De sync draait elke nacht rond 03:10 en haalt alles op wat er sinds je laatste activiteit bij is gekomen —
          ook trainingen die niet op het plan stonden. Tokens leven alleen server-side.
        </Note>
      </Card>

      <Card>
        <CardTitle aside={`HRmax ${zones.hr_max}`}>Hartslagzones</CardTitle>
        <ul className="flex flex-col">
          {zones.bands.map((b) => (
            <li key={b.key} className="flex items-center gap-3 border-b py-2.5 last:border-0" style={{ borderColor: 'var(--hair)' }}>
              <span className="w-8 shrink-0 text-[13px] font-bold">{b.key}</span>
              <span className="flex-1 text-[13px]">{b.name}</span>
              <span className="num text-[13px]" style={{ color: 'var(--ink2)' }}>{b.hr_min}–{b.hr_max}</span>
              <span className="num w-24 text-right text-[12px]" style={{ color: 'var(--ink3)' }}>{b.pace}</span>
            </li>
          ))}
        </ul>
        <Note>{zones.source}</Note>
        {dbConfigured() && athlete ? (
          <HartslagMax hrMax={zones.hr_max} measuredOn={athlete.hr_max_measured_on} today={now} />
        ) : null}
        <Note>
          Je bloedwaarden en je eerdere metingen staan bij{' '}
          <Link href="/seizoen" style={{ color: 'var(--acc)' }}>Seizoen, onder Metingen</Link>.
        </Note>
      </Card>

      {dbConfigured() ? <Bronnen apparaten={apparaten} /> : null}

      <PushToggle vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />

      <ShoeList shoes={shoes} writable={dbConfigured()} />

      {athlete?.can_invite ? (
        <Uitnodigingen uitnodigingen={uitnodigingen} jij={user?.email ?? null} />
      ) : null}

      <Uitloggen email={user?.email ?? null} />

      <Card sunk>
        <CardTitle>Verbindingen</CardTitle>
        <ul className="flex flex-col gap-2 text-[13px]">
          <Row label="Database" ok={dbConfigured()} detail={planSource() === 'seed' ? 'plan komt uit supabase/seed' : 'plan komt uit de database'} />
          <Row label="Strava" ok={stravaConfigured()} detail="OAuth-app en sleutels" />
          <Row label="Anthropic" ok={insightConfigured()} detail="voor de analyses" />
        </ul>
        <Note>
          Ontbreekt er iets, kijk dan in <code>.env.example</code>. Zonder database toont de app het plan maar bewaart hij niets.
        </Note>
      </Card>
    </div>
  );
}

function Row({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <li className="flex items-center gap-3">
      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[var(--r-pill)]"
        style={{ background: ok ? 'var(--acc)' : 'var(--ink3)' }} />
      <span className="font-medium">{label}</span>
      <span style={{ color: 'var(--ink3)' }}>{detail}</span>
      <span className="ml-auto text-[12px]" style={{ color: ok ? 'var(--acc)' : 'var(--ink3)' }}>
        {ok ? 'ingesteld' : 'ontbreekt'}
      </span>
    </li>
  );
}
