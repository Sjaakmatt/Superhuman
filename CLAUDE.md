# Ultra100 — repo-instructies

Persoonlijke trainingsapp voor één gebruiker (Sjaak) die op 2 oktober 2027 een 100 km ultratrail loopt.
Het trainingsplan is 57 weken, 399 dagen, en staat vast in de database — de app voert het uit, hij verzint het niet.

## Stack

- **Next.js 15**, App Router, TypeScript strict. Server Components waar het kan.
- **Supabase** — Postgres, Auth, RLS. Eén gebruiker, maar RLS staat aan.
- **Tailwind v4**, met `tokens.css` als bron van waarheid.
- **Cloudflare Workers** — hosting via OpenNext, en Cron Triggers. Deploy vanaf GitHub Actions.
- **Anthropic API** voor de analyses.
- **Grafieken: met de hand geschreven SVG.** Geen chartbibliotheek. De vormen zijn eenvoudig (staven, één gladde lijn, een ring, een 57×7 raster) en een bibliotheek kost meer dan hij oplevert, zowel in kilobytes als in ontwerpafwijking.

## Harde regels

1. **Nooit trainingsinhoud verzinnen in code.** Elke sessie, elk gewicht, elk voedingsgetal komt uit `plan_day`, `plan_week` of `reference`. Klopt er iets niet, dan wijzig je de seed en seed je opnieuw — niet de component.
2. **Geen hex-waarden buiten `tokens.css`.** Ook niet in SVG: lees CSS-variabelen uit met `getComputedStyle`.
3. **Alle interfacetekst is Nederlands**, in de tweede persoon, zonder uitroeptekens en zonder aanmoediging die niet verdiend is. Termen als "welzijnsscore" en "RPE" worden in de interface gewone woorden ("Hoe voel je je?", "Hoe zwaar voelde het?").
4. **Alarmen komen uit SQL, niet uit het taalmodel.** De escalatieregels zijn deterministisch (zie `lib/rules.ts`). Het model schrijft de toelichting en stelt aanpassingen voor; het beslist nooit zelf of er een alarm afgaat.
5. **Datums zijn `date`, geen `timestamptz`.** Tijdzone is `Europe/Amsterdam`. Een trainingsdag is een kalenderdag, geen moment.
6. **Geen secrets client-side.** Strava-tokens en de Anthropic-sleutel leven alleen in server routes en Edge Functions.
7. **Beide themas zijn ontworpen, niet omgeklapt.** Definieer een kleur nooit alleen binnen een `@media` of `[data-theme]` blok.
8. **Afgeleide getallen berekenen we zelf en documenteren we.** "Afdaalminuten" is onze eigen definitie (zie hieronder) — geen Strava-veld. Zet de definitie in een comment bij de query.

## Definities die je niet mag improviseren

| Begrip | Definitie |
|---|---|
| **Afdaalminuten** | Seconden uit de `grade_smooth`-stream waarin het verhang < −4% is, gesommeerd per activiteit. Dit is onze maat, geen Strava-veld. |
| **Z2-drift** | Gemiddelde hartslag op geplande Z2-sessies min het Z2-plafond (152). Alleen sessies met `planned_zone = 'Z2'` en ≥ 20 min. |
| **Weeksprong** | Weekvolume gedeeld door het maximum van de twee voorgaande weken. Vlag boven 1,30. Niet vergelijken met alleen de vorige week: een deloadweek verlaagt de chronische belasting niet. |
| **Welzijn** | Som van vijf items van 1–7 (geslapen, fris, benen, rust in je hoofd, zin om te gaan) = 5–35. Vergelijk met het 14-daags gemiddelde, nooit met een populatienorm. |
| **Zones na een hertest** | De banden uit `reference.zones` geschaald naar de gemeten HRmax, met dezelfde percentages (Z1 tot 64,9%, Z2 tot 80,9%, Z3 tot 88,8%, Z4 tot 96,8%). Tempo's schalen niet mee: die volgen niet uit een hartslag. Zodra `athlete.hr_max_measured_on` staat, winnen de eigen banden van de naslag — lees ze via `getZones()`, nooit rechtstreeks via `getReference('zones')`. |
| **Wat een mijlpaal oplevert** | Het veld `logs` op een mijlpaal in de seed: `hrmax` een gemeten maximumhartslag, `bloed` een bloedpanel, `loop` een activiteit die uit Strava komt. Leeg = alleen een notitie. De kaart leest dat veld; hij raadt nooit uit de titel. |
| **Aerobe efficiëntie** | Meters per minuut gedeeld door de gemiddelde hartslag. Meetellen doen `Run`/`TrailRun` van ≥ 20 min waarvan de **gemeten** gemiddelde hartslag in de Z2-band valt — dus de uitkomst, niet de bedoeling. Zo begint de lijn bij je eerste duurloop en niet pas op de eerste plandag, en telt een Z2-sessie die je te hard liep niet mee. Staat er een intensieve dag gepland (zone met Z3, Z4 of Z5), dan valt hij alsnog af: een interval kan gemiddeld in Z2 uitkomen. Let op het verschil met de **Z2-drift**, die juist wél op de bedoeling filtert — die vraagt of je een sessie die Z2 hóórde te zijn te hard liep. Niet gecorrigeerd voor helling; de hoogtemeters staan bij elk punt. De lijn is het voortschrijdend gemiddelde over vijf sessies. |
| **Pijnmodel** | Pijn ≤5/10 tijdens is toegestaan, moet de volgende ochtend 0 zijn, en mag niet week op week stijgen. Alle drie moeten kloppen. |

## Mappen

```
app/                 routes (vandaag, loggen, kracht, analyse, seizoen)
  api/strava/sync    dagelijkse sync, aangeroepen door de Cron Trigger
  api/insight/[kind] daily | weekly | longrun | debrief
  api/coach          het gesprek met de coach, streamt regel-voor-regel JSON
components/          UI, dun, zonder datalogica
components/charts/   handgeschreven SVG-componenten
lib/db.ts            Supabase client
lib/metrics.ts       afgeleide getallen (één plek, getest)
lib/rules.ts         deterministische escalatieregels
lib/strava.ts        OAuth, sync, streams
lib/insight.ts       promptopbouw + Anthropic-aanroep
lib/coach.ts         het gesprek: systeemprompt, leesgereedschappen, de lus
components/CoachWidget.tsx  de coach hangt over elk scherm, geen eigen route
supabase/migrations/ SQL
supabase/seed/       plan-seed.json, reference-seed.json
styles/tokens.css    kleuren en typografie — bron van waarheid
```

## Tests die er echt toe doen

- `lib/metrics.ts` — afdaalminuten uit een echte stream, zoneverdeling, weeksprong over een deloadweek heen.
- `lib/rules.ts` — elke escalatieregel met een geval dat wel en een dat niet vuurt.
- Seed-integriteit: 399 dagen, 57 weken, elke dag hoort bij een bestaande week, weektotaal = som van de dagen.
- `lib/coach.ts` — de begrenzing van een opgevraagd bereik, en dat geen enkel gereedschap kan schrijven.
- `lib/date.ts` — de maandhulpjes van de agenda, inclusief schrikkeljaar en jaargrens.
- `lib/metrics.ts` — het herschalen van de zones na een HRmax-hertest: geen gat en geen overlap tussen de banden.
- `lib/metrics.ts` — aerobe efficiëntie stijgt bij een lagere hartslag én bij een hoger tempo, en het voortschrijdend gemiddelde begint bij het eerste punt.

## Wat je niet moet bouwen

Geen social feed, geen badges, geen streak-vuurtjes, geen pushmelding die je aanmoedigt. Dit is een stuurinstrument voor één persoon. Als een functie hem harder laat trainen dan het plan zegt, is het de verkeerde functie.
