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
# 1. Migraties: plak supabase/migrations/*.sql in volgorde in de SQL-editor,
#    of draai ze met de Supabase CLI. Opnieuw draaien mag — alles is idempotent.
# 2. Seed:
npm run db:seed                # zet 57 weken, 399 dagen, oefeningen en referentie klaar
```

Twee dingen die de linter terecht meldt en die zo horen: `strava_token` heeft RLS
aan zonder policy (alleen server routes met de service-role-sleutel komen erbij),
en `my_athlete_id()` is aanroepbaar door ingelogde gebruikers (de RLS-policies
hebben dat nodig; hij geeft alleen je eigen id terug).

## Inloggen

Supabase Auth met **e-mailadres en wachtwoord**. Geen magic link, geen registratie:
deze app heeft één gebruiker. De inlogschermen staan buiten de app-schil — vóór je
bent ingelogd zie je geen navigatie en geen gegevens.

| Scherm | |
|---|---|
| `/login` | inloggen |
| `/wachtwoord-vergeten` | herstel-link aanvragen |
| `/wachtwoord-herstellen` | nieuw wachtwoord kiezen; vereist de sessie uit de link |
| `/auth/bevestig` | wisselt het token uit de mail in voor een sessie, op de server |

Uitloggen zit onder Instellingen.

### Eenmalig instellen in Supabase

**Authentication → Sign In / Providers → Email**

- **Confirm email**: aan
- **Enable email provider**: aan
- **Allow new users to sign up**: **uit** — één gebruiker, dus niemand meldt zich aan
- **Minimum password length**: 10 of hoger (de app keurt zelf ook op 10)

**Authentication → URL Configuration**

- Site URL: `https://ultra100.factumai.nl` — de sjablonen bouwen hun links hierop
- Redirect URLs: `https://ultra100.factumai.nl/**` en `http://localhost:3000/**`

**Project Settings → Authentication → SMTP Settings** — via Resend

| Veld | Waarde |
|---|---|
| Host | `smtp.resend.com` |
| Port | `587` (STARTTLS) — 465 kan ook, dat is meteen SSL |
| Username | `resend` — letterlijk dat woord, niet je e-mailadres |
| Password | je Resend API-sleutel (`re_…`) |
| Sender email | een adres op een in Resend geverifieerd domein, bijvoorbeeld `ultra100@factumai.nl` |
| Sender name | `Ultra100` |

De API-sleutel hoort alleen hier thuis. De app verstuurt zelf geen mail — dat doet
Supabase — dus er is geen `RESEND_API_KEY` in deze repo en die hoeft ook niet op de
Worker te staan.

Twee dingen die je anders pas merkt als er geen mail aankomt:

- **Verifieer het afzenderdomein in Resend** (Domains → Add Domain) en zet de
  SPF-, DKIM- en DMARC-records klaar. Zonder die records belandt de herstel-link
  in de map met ongewenste post, of nergens.
- **Supabase zet na het aanzetten van eigen SMTP een limiet van 30 mails per uur.**
  Voor één gebruiker ruim voldoende, maar hij staat er, en je vindt hem onder
  Authentication → Rate Limits.

**Authentication → Emails → Templates**

Plak de vier sjablonen uit `supabase/templates/`:

| Bestand | Template in het dashboard |
|---|---|
| `wachtwoord-herstellen.html` | Reset Password |
| `uitnodiging.html` | Invite user |
| `bevestig-aanmelding.html` | Confirm signup |
| `wijzig-emailadres.html` | Change Email Address |

Ze verwijzen naar `{{ .SiteURL }}/auth/bevestig?token_hash={{ .TokenHash }}&type=…`
in plaats van naar `{{ .ConfirmationURL }}`. Dat is bewust: zo wisselt de server het
token in voor een sessie vóór het eerste scherm rendert, wat betrouwbaarder is dan
het in de browser afhandelen.

**Let op de kleuren.** E-mailclients kennen geen CSS-variabelen, dus in die vier
bestanden staan de kleuren uit `styles/tokens.css` letterlijk. Dat is de enige
plek in dit project waar een hex-waarde buiten `tokens.css` mag staan — pas je de
tokens aan, loop dan ook de sjablonen na.

### Je account aanmaken

Authentication → Users → Add user, met **Auto Confirm User** aan. De `athlete`-rij
komt er automatisch bij, en de eerste gebruiker wordt de eigenaar: alleen die mag
anderen uitnodigen.

### Toegang op uitnodiging

Onder Instellingen staat "Wie er binnen mag". Voeg je daar een adres toe, dan gaat
er een uitnodiging uit via het `uitnodiging.html`-sjabloon en kiest die persoon zelf
een wachtwoord. Hij krijgt zijn **eigen lege plan** — logboek, kracht, analyses en
Strava staan per persoon gescheiden via RLS.

De lijst is geen sier: een trigger op `auth.users` weigert elk account waarvoor geen
uitnodiging klaarstaat. Die controle staat in de database, niet in een
dashboard-instelling, zodat "aanmelden toestaan" per ongeluk aanzetten geen gat
maakt. De eerste gebruiker is de uitzondering — anders kwam er nooit iemand binnen.

Intrekken haalt het adres van de lijst én verwijdert het account. Alles wat die
persoon logde gaat mee; de interface vraagt daarom om een tweede klik.

De seed weigert te draaien als het plan niet klopt — hij draait eerst dezelfde
controles als `test/seed.test.ts`.

## Controles

```bash
npm run typecheck
npm run lint
npm test          # 70 tests: seed-integriteit, afgeleide getallen, twaalf regels, krachtparser, VAPID, crons, foutmeldingen
npm run build
```

## Hoe het in elkaar zit

```
Strava  ──OAuth──▶  /api/strava/sync  ──▶  activity, activity_zone, activity_descent
              (Cron Trigger 02:10 UTC)             │
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
| `app/(app)/` | de vijf schermen plus instellingen, binnen de schil |
| `app/login/`, `app/wachtwoord-*/` | de inlogschermen, bewust buiten de schil |
| `app/api/` | sync, analyses, push |
| `supabase/templates/` | de e-mailsjablonen voor Supabase Auth |
| `components/` | interface, dun, zonder datalogica |
| `components/charts/` | handgeschreven SVG — geen grafiekbibliotheek |
| `lib/metrics.ts` | afgeleide getallen: afdaalminuten, zoneverdeling, weeksprong, welzijnstrend |
| `lib/rules.ts` | de twaalf escalatieregels |
| `lib/strava.ts` | OAuth, sync, streams, rate limits |
| `lib/insight.ts` | promptopbouw en de Anthropic-aanroep |
| `lib/plan.ts` | het plan lezen, uit de database of uit de seed |
| `supabase/migrations/` | SQL, in volgorde |
| `worker.ts` | Cloudflare-entrypoint: fetch plus `scheduled()` voor de crons |
| `wrangler.jsonc` | Worker-configuratie, crons en niet-geheime vars |
| `styles/tokens.css` | kleur en typografie — de enige plek met hex-waarden |

## Deploy — Cloudflare Workers

De app draait op Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare).
Elke merge naar `main` bouwt en deployt automatisch; zie
`.github/workflows/deploy.yml`.

```bash
npm run preview   # lokaal draaien zoals op de Worker
npm run deploy    # handmatig deployen (vereist wrangler-login)
```

### Eenmalig instellen

**Repo-secrets** (Settings → Secrets and variables → Actions → Secrets):

| Secret | Waar hij vandaan komt |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens, scope **Workers Scripts Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare-dashboard, rechterkolom |

**Repo-variables** (zelfde scherm, tabblad Variables). Next bakt `NEXT_PUBLIC_*`
bij de build in de client-bundel, dus die kúnnen niet op de Worker staan:

| Variable | |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | vereist |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | vereist — neem de korte `sb_publishable_…`, niet de lange JWT |
| `NEXT_PUBLIC_SITE_URL` | optioneel — de Strava-callback valt anders terug op de URL van het verzoek |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | optioneel — leeg betekent geen ochtendmelding |

De deploy weigert te draaien als een vereiste waarde leeg is, een placeholder
bevat, **of niet de vorm van een Supabase-sleutel heeft**. Dat laatste is er
bijgekomen nadat een half geplakte JWT — alleen het stuk vóór de eerste punt —
door de controle glipte en pas bij het inloggen als "Invalid API key" opdook.

Neem daarom de korte `sb_publishable_…`-sleutel. Die is één regel zonder punten
en overleeft knippen en plakken; de lange JWT breekt bij de eerste punt als je
hem uit een omgebroken regel selecteert.

**Worker-secrets** (server-side, nooit in de repo). Draai dit vanuit de repo-root,
zodat wrangler `wrangler.jsonc` oppikt:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put CRON_SECRET
npx wrangler secret put STRAVA_CLIENT_ID
npx wrangler secret put STRAVA_CLIENT_SECRET
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
```

| Secret | Waar hij vandaan komt | Wat er niet werkt zonder |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API keys → `service_role` | alle crons: sync, analyses, melding |
| `CRON_SECRET` | zelf kiezen: `openssl rand -base64 32` | alle cron-routes geven 401 — ze falen dicht, en dat hoort |
| `STRAVA_CLIENT_ID` | strava.com/settings/api | Strava koppelen geeft 503 |
| `STRAVA_CLIENT_SECRET` | idem | idem |
| `ANTHROPIC_API_KEY` | console.anthropic.com | de vier analyses geven 503 |
| `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` | de ochtendmelding geeft 503 |

`VAPID_SUBJECT` staat al als gewone var in `wrangler.jsonc` en hoeft dus niet als
secret. `ANTHROPIC_MODEL` is optioneel; zonder die var gebruikt de app het nieuwste
Sonnet-model.

Secrets overleven een deploy: `wrangler deploy` laat staan wat er staat, dus je zet
ze één keer. En de vier `NEXT_PUBLIC_*` horen hier **niet** thuis — Next bakt die
bij de build in de bundel, dus een Worker-secret met die naam doet niets. Die staan
in GitHub → Variables.

Zonder deze zes werkt de app gewoon: het plan, het loggen en de analyse-schermen
draaien op je eigen sessie. Ze zetten Strava, de AI-analyses en de melding aan.

**Eigen domein** koppel je via het dashboard (Worker → Settings → Domains &
Routes → Add Custom Domain), niet via wrangler: de deploy-token heeft geen
rechten op zone-routes. De app draait op **https://ultra100.factumai.nl**.

Drie plekken willen datzelfde adres kennen:

| Waar | Waarde |
|---|---|
| GitHub repo-Variable `NEXT_PUBLIC_SITE_URL` | `https://ultra100.factumai.nl` |
| Strava → API → Authorization Callback Domain | `ultra100.factumai.nl` |
| Supabase → Auth → URL Configuration → Site URL | `https://ultra100.factumai.nl` |
| Supabase → Auth → Redirect URLs | `https://ultra100.factumai.nl/**` en `http://localhost:3000/**` |

## Crons

Cloudflare draait Cron Triggers in **UTC**. De tijden hieronder staan op
wintertijd (UTC+1); in de zomer vuren ze een uur later op de klok. Dat is bewust:
liever een uur te laat dan een melding om vijf uur 's ochtends.

| Route | UTC | Amsterdam (winter) |
|---|---|---|
| `/api/strava/sync` | `10 2 * * *` | 03:10 |
| `/api/push/daily` | `0 5 * * *` | 06:00 |
| `/api/insight/daily` | `5 5 * * *` | 06:05 |
| `/api/insight/longrun` | `0 17 * * FRI` | vrijdag 18:00 |
| `/api/insight/weekly` | `0 19 * * SUN` | zondag 20:00 |

**Weekdagen schrijf je voluit.** Cloudflare telt `1 = zondag` tot `7 = zaterdag`,
waar de meeste cron-systemen bij `0 = zondag` beginnen. Een `0` weigert Cloudflare
bij het deployen, maar een `5` zou stilzwijgend donderdag betekenen in plaats van
vrijdag — en dat merk je pas als een briefing een week uitblijft.

De expressies staan op twee plekken: in `wrangler.jsonc` (welke crons bestaan) en
in `worker.ts` (welke route erbij hoort). `test/cron.test.ts` bewaakt dat die twee
gelijk blijven, dat elke route bestaat, en dat er geen cijfer als weekdag staat.

Alle cron-routes eisen `Authorization: Bearer $CRON_SECRET`; `scheduled()` stuurt
die mee. Buiten productie mag het zonder, zodat je ze lokaal kunt aanroepen:

```bash
curl -X POST localhost:3000/api/insight/weekly
```

## CI

`.github/workflows/ci.yml` draait op elke push en pull request:

- **checks** — typecheck, lint, 70 tests en `next build`. De build draait bewust
  zonder Supabase-variabelen: de app moet ook zonder database bouwen.
- **worker** — `opennextjs-cloudflare build` plus een wrangler dry-run. Dat vangt
  fouten in `worker.ts` en `wrangler.jsonc` die `next build` niet ziet.

## Strava

Je hebt een **eigen** OAuth-app nodig (strava.com/settings/api), scope
`activity:read_all,profile:read_all`, callback `https://<domein>/api/strava/callback`.
De sync haalt bij de eerste keer alles op vanaf 1 juni 2026 en daarna alleen wat
erbij kwam. Streams gaan per activiteit, dus hoogstens veertig per keer — dat past binnen
de honderd verzoeken per kwartier.

## Wat er nog niet is

Fase 7 uit het bouwplan: het voedingsscherm en de wedstrijddag-modus voor 2 oktober 2027.
Die bouw je pas in de zomer van 2027, wanneer je weet wat je er werkelijk op wilt hebben.
