# Ultra100

Persoonlijke trainingsapp voor de 100 km op **2 oktober 2027**. Het plan is 57 weken en
399 dagen, staat vast in de database, en de app voert het uit — hij verzint het niet.

De repo-instructies en de definities die je niet mag improviseren staan in
[`CLAUDE.md`](./CLAUDE.md); het bouwplan met de zeven fases in
[`BOUWPLAN.md`](./BOUWPLAN.md).

## Aan de praat

```bash
npm install
cp .env.example .env.local     # vul in wat je hebt; zonder database werkt de app ook
npm run dev
```

Zonder Supabase draait de app gewoon: hij leest het plan uit `supabase/seed/` en zegt op
elk invoerscherm dat er niets bewaard wordt. Met Supabase:

```bash
# draai supabase/migrations/*.sql in volgorde (SQL editor of supabase db push)
npm run db:seed                # zet 57 weken, 399 dagen, oefeningen en referentie klaar
```

De seed weigert te draaien als het plan niet klopt — hij draait eerst dezelfde
controles als `test/seed.test.ts`.

## Controles

```bash
npm run typecheck
npm run lint
npm test          # 53 tests: seed-integriteit, afgeleide getallen, twaalf regels, krachtparser
npm run build
```

## Hoe het in elkaar zit

```
Strava  ──OAuth──▶  /api/strava/sync  ──▶  activity, activity_zone, activity_descent
                    (cron 02:10 UTC)               │
                                                   ▼
plan_day / plan_week  ──────────────────▶   lib/metrics.ts  ──▶  v_week_actual
        ▲                                          │
        │                                          ▼
   supabase/seed                            lib/rules.ts  (deterministische alarmen)
                                                   │
wellness / session_log / strength_set ─────────────┤
   (handinvoer)                                    ▼
                                          lib/insight.ts  ──Anthropic──▶  insight + voorstellen
                                                   │
                                                   ▼
                                    app/  vandaag · loggen · kracht · analyse · seizoen
```

**De alarmen zijn code, de taal is AI.** Of een grens wordt overschreden bepaalt
`lib/rules.ts` deterministisch, met een test per regel. Het model schrijft de toelichting
en doet voorstellen, maar beslist nooit of er iets mis is. Elke waarschuwing in de app
toont de regel-id waar hij vandaan komt.

### Mappen

| Pad | Wat er staat |
|---|---|
| `app/` | de vijf schermen, plus instellingen, inloggen en de api-routes |
| `components/` | interface, dun, zonder datalogica |
| `components/charts/` | handgeschreven SVG — geen grafiekbibliotheek |
| `lib/metrics.ts` | afgeleide getallen: afdaalminuten, zoneverdeling, weeksprong, welzijnstrend |
| `lib/rules.ts` | de twaalf escalatieregels |
| `lib/strava.ts` | OAuth, sync, streams, rate limits |
| `lib/insight.ts` | promptopbouw en de Anthropic-aanroep |
| `lib/plan.ts` | het plan lezen, uit de database of uit de seed |
| `supabase/migrations/` | SQL, in volgorde |
| `styles/tokens.css` | kleur en typografie — de enige plek met hex-waarden |

## Crons

Vercel draait crons in **UTC**. De tijden hieronder staan op wintertijd (UTC+1); in de
zomer vuren ze een uur later op de klok. Dat is bewust: liever een uur te laat dan een
melding om vijf uur 's ochtends.

| Route | UTC | Amsterdam (winter) |
|---|---|---|
| `/api/strava/sync` | `10 2 * * *` | 03:10 |
| `/api/push/daily` | `0 5 * * *` | 06:00 |
| `/api/insight/daily` | `5 5 * * *` | 06:05 |
| `/api/insight/longrun` | `0 17 * * 5` | vrijdag 18:00 |
| `/api/insight/weekly` | `0 19 * * 0` | zondag 20:00 |

Alle cron-routes eisen `Authorization: Bearer $CRON_SECRET`. Vercel stuurt die mee.
Buiten productie mag het zonder, zodat je ze lokaal kunt aanroepen:

```bash
curl -X POST localhost:3000/api/insight/weekly
```

## Strava

Je hebt een **eigen** OAuth-app nodig (strava.com/settings/api), scope
`activity:read_all,profile:read_all`, callback `https://<domein>/api/strava/callback`.
De sync haalt bij de eerste keer alles op vanaf 1 augustus 2026 en daarna alleen wat
erbij kwam. Streams gaan per activiteit, dus hoogstens veertig per keer — dat past binnen
de honderd verzoeken per kwartier.

## Wat er nog niet is

Fase 7 uit het bouwplan: het voedingsscherm en de wedstrijddag-modus voor 2 oktober 2027.
Die bouw je pas in de zomer van 2027, wanneer je weet wat je er werkelijk op wilt hebben.
