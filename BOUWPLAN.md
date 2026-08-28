# Ultra100 — bouwplan voor Claude Code

**Persoonlijke trainingsapp voor de 100 km op 2 oktober 2027.**
Zeven fases, elk met een prompt die je in Claude Code kunt plakken en een "klaar wanneer" waaraan je kunt afmeten of het af is.

---

## Wat je in handen hebt

| Bestand | Wat het is |
|---|---|
| `plan-seed.json` | Het volledige plan: 57 weken en 399 dagen, met sessietekst, volumes, zones, hoogtemeters, afdaalminuten en krachtblokken |
| `reference-seed.json` | Zones, oefeningen, krachtfases, voedingsschema per fase, mijlpalen |
| `tokens.css` | Kleuren en typografie — de bron van waarheid, beide themas |
| `CLAUDE.md` | Repo-instructies en de definities die je niet mag improviseren |
| Prototype | https://claude.ai/code/artifact/6a2f6941-5333-4e6a-9ccc-c3e4ed0a8044 — de vijf schermen, klikbaar |

---

## Architectuur in het kort

```
Strava  ──OAuth──▶  /api/strava/sync  ──▶  activity, activity_zone, activity_descent
                    (Vercel Cron 03:10)              │
                                                     ▼
plan_day / plan_week  ────────────────────▶   lib/metrics.ts  ──▶  v_week_actual, v_intensity_28d
        ▲                                            │
        │                                            ▼
   supabase/seed                              lib/rules.ts  (deterministische alarmen)
                                                     │
wellness / session_log / strength_set ───────────────┤
   (handinvoer)                                      ▼
                                            lib/insight.ts  ──Anthropic──▶  insight + proposals
                                                     │
                                                     ▼
                                        app/  vandaag · loggen · kracht · analyse · seizoen
```

De belangrijkste architectuurkeuze: **de alarmen zijn SQL, de taal is AI.** Of er een grens wordt overschreden bepaalt `lib/rules.ts` deterministisch. Het model schrijft de toelichting en doet voorstellen, maar beslist nooit of er iets mis is. Zo krijg je nooit een model dat een blessuresignaal wegredeneert, en kun je elke waarschuwing terugvoeren op een regel die je kunt lezen.

---

## Datamodel

```sql
-- ── het plan (read-only na seed) ────────────────────────────────
create table plan_week (
  week            int primary key check (week between 1 and 57),
  start_date      date not null unique,
  phase           text not null,
  status          text not null,          -- opbouw | DELOAD | TAPER | WEDSTRIJD | ...
  target_km       numeric not null,
  compact_km      numeric not null,       -- de x0,8 variant bij tijdgebrek
  longrun_km      numeric not null,
  sunday_km       numeric not null,
  midweek_km      numeric not null,
  hm_target       int not null,
  descent_min_target int not null,
  strength_sessions  int not null,
  focus           text not null
);

create table plan_day (
  date            date primary key,
  week            int not null references plan_week(week),
  weekday         text not null,
  phase           text not null,
  week_status     text not null,
  session_type    text not null,
  session_text    text not null,
  planned_km      numeric not null default 0,
  planned_min     int not null default 0,
  zone            text,                    -- Z1 | Z2 | Z2/Z3 | Z4 | UP | -
  pace_range      text,
  strength_block  text,                    -- 'Kracht A - ...' of null
  strength_detail text
);

-- ── de atleet ───────────────────────────────────────────────────
create table athlete (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id),
  strava_athlete_id bigint unique,
  hr_max            int not null default 188,
  hr_zones          jsonb not null,        -- uit reference-seed.json
  race_date         date not null default '2027-10-02',
  timezone          text not null default 'Europe/Amsterdam'
);

create table strava_token (
  athlete_id    uuid primary key references athlete(id) on delete cascade,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null
);

-- ── wat je deed ─────────────────────────────────────────────────
create table activity (
  id            bigint primary key,        -- Strava-id
  athlete_id    uuid not null references athlete(id) on delete cascade,
  date          date not null,             -- lokale kalenderdag
  start_local   timestamp not null,
  sport_type    text not null,
  name          text,
  distance_m    numeric,
  moving_s      int,
  elapsed_s     int,
  elev_gain_m   numeric,
  avg_hr        numeric,
  max_hr        numeric,
  avg_cadence   numeric,
  calories      numeric,
  suffer_score  numeric,
  raw           jsonb,
  streams_synced_at timestamptz,
  synced_at     timestamptz not null default now()
);
create index on activity (athlete_id, date);

create table activity_zone (             -- uit de hartslagstream
  activity_id bigint references activity(id) on delete cascade,
  zone        text not null,             -- Z1..Z5
  seconds     int not null,
  primary key (activity_id, zone)
);

create table activity_descent (          -- onze eigen maat, zie CLAUDE.md
  activity_id     bigint primary key references activity(id) on delete cascade,
  descent_seconds int not null,
  descent_m       numeric not null,
  method          text not null default 'grade_smooth < -4%'
);

-- ── hoe het voelde (handinvoer, 90 sec per dag) ─────────────────
create table wellness (
  date        date primary key,
  athlete_id  uuid not null references athlete(id) on delete cascade,
  slept       int check (slept between 1 and 7),
  fresh       int check (fresh between 1 and 7),
  legs        int check (legs between 1 and 7),
  mind        int check (mind between 1 and 7),
  motivation  int check (motivation between 1 and 7),
  total       int generated always as (slept+fresh+legs+mind+motivation) stored,
  sleep_hours numeric,
  resting_hr  int,
  weight_kg   numeric,
  created_at  timestamptz not null default now()
);

create table session_log (
  id                  uuid primary key default gen_random_uuid(),
  date                date not null,
  activity_id         bigint references activity(id) on delete set null,
  rpe                 int check (rpe between 1 and 10),
  pain_score          int check (pain_score between 0 and 10),
  pain_note           text,
  pain_next_morning   int check (pain_next_morning between 0 and 10),
  shoe_id             uuid references shoe(id),
  carbs_g_per_h       numeric,        -- alleen longruns
  gi_score            int check (gi_score between 0 and 10),
  taped               boolean,
  note                text,
  created_at          timestamptz not null default now()
);

create table shoe (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  drop_mm   int,
  km        numeric not null default 0,
  retired   boolean not null default false
);

-- ── kracht ──────────────────────────────────────────────────────
create table exercise (
  slug         text primary key,
  name         text not null,
  block        text not null,          -- A | B | C
  unit         text not null,          -- kg | lichaam | sec | band | contacten
  default_sets int not null default 3,
  note         text
);

create table strength_session (
  id           uuid primary key default gen_random_uuid(),
  date         date not null,
  block        text not null,
  completed_at timestamptz
);

create table strength_set (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references strength_session(id) on delete cascade,
  exercise     text not null references exercise(slug),
  set_no       int not null,
  weight_kg    numeric,
  reps         int,
  done         boolean not null default false,
  unique (session_id, exercise, set_no)
);

-- ── metingen ────────────────────────────────────────────────────
create table blood_panel (
  date       date primary key,
  ferritin   numeric, crp numeric, tsat numeric, hb numeric,
  b12 numeric, vit_d numeric, tsh numeric,
  note       text
);

-- ── wat de app terugzegt ────────────────────────────────────────
create table insight (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,          -- daily | weekly | debrief | alert
  period_start date not null,
  period_end   date not null,
  body_md      text not null,
  findings     jsonb not null default '[]',
  proposals    jsonb not null default '[]',
  rule_hits    jsonb not null default '[]',   -- welke deterministische regels vuurden
  status       text not null default 'new',   -- new | accepted | dismissed
  created_at   timestamptz not null default now()
);

create table plan_adjustment (
  id          uuid primary key default gen_random_uuid(),
  date        date not null references plan_day(date),
  field       text not null,
  old_value   text,
  new_value   text,
  source      text not null,           -- ai | user
  insight_id  uuid references insight(id),
  created_at  timestamptz not null default now()
);
```

Views die je één keer schrijft en overal gebruikt:

```sql
create view v_week_actual as
select w.week, w.start_date, w.target_km, w.hm_target, w.descent_min_target,
       coalesce(sum(a.distance_m)/1000, 0)               as actual_km,
       coalesce(sum(a.moving_s)/60, 0)                   as actual_min,
       coalesce(sum(a.elev_gain_m), 0)                   as actual_hm,
       coalesce(sum(d.descent_seconds)/60, 0)            as actual_descent_min,
       count(distinct s.id) filter (where s.completed_at is not null) as strength_done
from plan_week w
left join plan_day pd on pd.week = w.week
left join activity a  on a.date = pd.date and a.sport_type in ('Run','TrailRun')
left join activity_descent d on d.activity_id = a.id
left join strength_session s on s.date = pd.date
group by w.week, w.start_date, w.target_km, w.hm_target, w.descent_min_target;
```

---

## Strava — waar het misgaat als je niet oplet

- **Eigen OAuth-app nodig.** De MCP-koppeling in de chat is niet hetzelfde als een app-koppeling. Maak er één aan op strava.com/settings/api, scope `activity:read_all,profile:read_all`, callback `https://<domein>/api/strava/callback`.
- **Access tokens verlopen na 6 uur.** Bewaar het refresh token en ververs bij elke sync; Strava geeft soms een nieuw refresh token terug — dan moet je dat opslaan, anders ben je na verloop van tijd uitgelogd.
- **Rate limits: 100 requests per 15 minuten, 1.000 per dag.** Streams zijn één request per activiteit. Haal streams alleen op voor hardloopactiviteiten die je nog niet hebt (`streams_synced_at is null`), en maximaal 40 per run.
- **Streams die je nodig hebt:** `time,heartrate,altitude,grade_smooth,velocity_smooth,distance`. `grade_smooth` is waar de afdaalminuten uit komen.
- **Datum ≠ tijdstip.** Gebruik `start_date_local` en neem daar de kalenderdag van. Een avondloop mag niet op de volgende dag belanden.
- **Backfill eenmalig.** Bij het eerste inloggen alle activiteiten sinds 2026-08-01 ophalen, gepagineerd, met pauzes. Daarna alleen `after=<laatste sync>`.

Afdaalminuten berekenen:

```ts
// grade_smooth is procent verhang, time is seconden sinds start.
// Wij tellen elke seconde waarin het verhang steiler dan -4% is.
// Dit is onze definitie, niet die van Strava — zie CLAUDE.md.
export function descentSeconds(time: number[], grade: number[]) {
  let s = 0;
  for (let i = 1; i < time.length; i++) {
    if (grade[i] < -4) s += time[i] - time[i - 1];
  }
  return s;
}
```

---

## De regels die deterministisch moeten zijn

`lib/rules.ts` — elke regel geeft `{ id, level: 'info'|'warn'|'stop', title, detail, since }`.

| id | Vuurt wanneer | Niveau |
|---|---|---|
| `pain-morning` | `pain_next_morning > 0` | warn |
| `pain-rising` | pijnscore stijgt drie weken op rij op dezelfde plek | stop |
| `pain-high` | `pain_score > 5` | stop |
| `wellness-drop` | totaal ≥2 onder het 14-daags gemiddelde, twee dagen achtereen | warn |
| `wellness-sustained` | 7-daags gemiddelde ≥3 onder basislijn, ≥5 dagen | stop |
| `week-jump` | weekvolume > 1,30 × max(twee voorgaande weken) | warn |
| `z2-drift` | ≥3 van 6 Z2-sessies met gemiddelde HR > 152 | warn |
| `descent-behind` | afdaalminuten < 80% van weekdoel, drie weken op rij | warn |
| `strength-behind` | krachtadherentie < 70% over vier weken | warn |
| `weight-drop` | > 1% gewichtsverlies per week in een opbouwblok | warn |
| `blood-due` | bloedpanel-mijlpaal verstreken zonder invoer | info |
| `shoe-worn` | schoen > 700 km | info |

`stop` betekent: de app toont het bovenaan Vandaag en het voorstel is rust, niet een aangepaste sessie. Die staat kan het model niet wegschrijven.

---

## De AI-laag

Vier momenten, alle vier een server route met een cron erachter:

| Route | Wanneer | Wat erin gaat | Wat eruit komt |
|---|---|---|---|
| `/api/insight/daily` | 06:00 dagelijks | sessie van vandaag, gisteren, welzijn 7d, actieve regels | één alinea + eventueel een aangepaste sessie |
| `/api/insight/weekly` | zondag 20:00 | weekcijfers, verdeling, stuurvariabelen, welzijnstrend, regels | verhaal + 1–3 concrete voorstellen |
| `/api/insight/longrun` | vrijdag 18:00 | zaterdagsessie, fase, voedingsschema, weer | briefing met gram per uur, kleding, tape, schoen |
| `/api/insight/debrief` | na week 14, 27, 39, 53 | wedstrijd-/testdata + logs | wat werkte, wat aanpassen in de resterende weken |

**Stuur nooit ruwe activiteiten mee.** Bereken eerst in `lib/metrics.ts`, stuur een compacte JSON van ~40 getallen. Dat scheelt tokens en het maakt de output stabieler.

De systeemprompt legt vast: Nederlands, tweede persoon, geen aanmoediging zonder aanleiding, altijd onderscheid tussen "dit is onderbouwd" en "dit is mijn inschatting", en voorstellen altijd als `{day, field, from, to, reason}` zodat de knop "Overnemen" ze kan wegschrijven naar `plan_adjustment`.

Antwoord als JSON:
```ts
{ body_md: string,
  findings: {title: string, detail: string, severity: 'info'|'warn'}[],
  proposals: {date: string, field: string, from: string, to: string, reason: string}[] }
```

---

## Bouwvolgorde

### Fase 0 — Casco (½ dag)

> Zet een Next.js 15-project op met TypeScript strict, Tailwind v4 en Supabase. Neem `tokens.css` over als enige bron van kleur en typografie. Bouw de schil: zijbalk links op ≥1040px met merk, vijf navigatie-items, weergaveknop en profiel onderaan; onder die breedte een tabbalk onderin met vier tabs. Begroeting en zoekbalk bovenin. Licht/donker-knop die de keuze in `localStorage` bewaart en zowel `prefers-color-scheme` als een expliciete keuze respecteert. Alle vijf routes bestaan met lege kaarten. Neem `CLAUDE.md` op in de root.

**Klaar wanneer** je door alle vijf schermen kunt navigeren, de themaknop werkt in beide richtingen, en er nergens een hex-waarde buiten `tokens.css` staat.

### Fase 1 — Het plan staat in de database (½ dag)

> Schrijf de migraties voor `plan_week`, `plan_day`, `athlete`, `exercise` en `shoe`. Maak een seed-script dat `plan-seed.json` en `reference-seed.json` inleest. Bouw het Vandaag-scherm zodat het de sessie van vandaag uit `plan_day` haalt, plus de resterende dagen van de week, en de weekfocus uit `plan_week`. Schrijf een test die controleert dat er 399 dagen en 57 weken zijn, dat elke dag bij een bestaande week hoort, en dat het weektotaal gelijk is aan de som van de dagen.

**Klaar wanneer** Vandaag de echte sessie van vandaag toont zonder één hardgecodeerde string, en de seed-test groen is.

### Fase 2 — Loggen (1 dag) ← *hier zit de meeste waarde*

> Bouw de handinvoer: de ochtendcheck met vijf schuifjes op Vandaag, het logscherm per training (RPE, pijn tijdens, plek, schoen, notitie), en het krachtscherm met per set gewicht en herhalingen, een vinkje, en de waarden van de vorige keer ernaast. Sla op in `wellness`, `session_log`, `strength_session` en `strength_set`. Optimistische UI: de invoer voelt direct, de opslag gebeurt op de achtergrond. Werk de kilometerstand van de schoen bij bij elke logregel.

**Klaar wanneer** je een week lang kunt loggen zonder Strava, en de gegevens na herladen nog kloppen. Vanaf hier is de app al bruikbaar — gebruik hem echt terwijl je de rest bouwt.

### Fase 3 — Strava (1 dag)

> Bouw de OAuth-flow, de tokenopslag met verversing, en `/api/strava/sync`. Eenmalige backfill vanaf 2026-08-01, daarna incrementeel. Haal streams op voor hardloopactiviteiten en bereken zoneseconden en afdaalminuten volgens de definities in `CLAUDE.md`. Zet een Vercel Cron op 03:10. Koppel elke activiteit automatisch aan de `session_log` van dezelfde dag. Respecteer de rate limits met een wachtrij en exponentiële backoff.

**Klaar wanneer** de sync twee keer achter elkaar kan draaien zonder duplicaten, en de afdaalminuten van een bekende bergafloop kloppen met wat je zelf uit de GPX rekent.

### Fase 4 — Analyse en regels (1 dag)

> Schrijf `lib/metrics.ts` (weekcijfers, intensiteitsverdeling over 28 dagen, Z2-drift, weeksprong, welzijnstrend) en `lib/rules.ts` met de twaalf regels uit het bouwplan. Bouw het Analyse-scherm: gepland tegen gelopen, de verdeling, de stuurvariabelen. Actieve `stop`-regels verschijnen bovenaan Vandaag en zijn niet weg te klikken. Schrijf voor elke regel een test met een geval dat wel vuurt en een dat niet vuurt.

**Klaar wanneer** alle twaalf regels getest zijn en het Analyse-scherm dezelfde getallen toont als een handmatige controle in SQL.

### Fase 5 — De AI-laag (1 dag)

> Bouw `lib/insight.ts` met de promptopbouw en de Anthropic-aanroep, en de vier routes. Sla het antwoord op in `insight`. Voorstellen krijgen een knop "Overnemen" die naar `plan_adjustment` schrijft en `plan_day` bijwerkt, met de oude waarde bewaard. Crons: 06:00 dagelijks, vrijdag 18:00, zondag 20:00.

**Klaar wanneer** de weekanalyse van een echte week iets zegt dat je zelf niet had gezien, en het overnemen van een voorstel het schema meetbaar verandert.

### Fase 6 — Seizoen en telefoon (½ dag)

> Bouw het Seizoen-scherm: het weekvolumeprofiel als gladde lijn met de huidige week gemarkeerd, het 57×7 raster met kleur naar belasting, de mijlpalen. Maak er een installeerbare PWA van met een pushmelding om 06:00 met de sessie van vandaag.

### Fase 7 — De laatste twee schermen (later)

Voeding (koolhydraten per uur per fase, natrium, bloedwaarden met de interpretatieregels) en een wedstrijddag-modus voor 2 oktober: pacing op 46–48% bij km 50, de vijf blokken, dropbags, de beslisboom bij misselijkheid. Bouw die pas in de zomer van 2027 — dan weet je wat je er werkelijk op wilt hebben.

---

## Volgorde-verantwoording

Fase 2 vóór fase 3 is bewust. De handinvoer is het onderdeel met het beste bewijs — subjectieve dagvragen voorspellen overbelasting beter dan hartslagvariabiliteit — en het is tegelijk het enige onderdeel dat afhangt van of jij het volhoudt. Als die gewoonte er na drie weken niet in zit, moet het ontwerp veranderen, en dat wil je weten vóórdat je een dag aan Strava-synchronisatie besteedt.

Fase 4 vóór fase 5 is even bewust. Zodra de deterministische regels er zijn, kan de AI-laag ernaar verwijzen in plaats van zelf te oordelen. Andersom bouw je een model dat zijn eigen alarmen verzint.

## Wat je onderweg tegenkomt

- **Tijdzones.** Een loop van 23:40 hoort bij die dag, niet bij de volgende. Test het.
- **Ontbrekende hartslag.** Niet elke activiteit heeft een stream. Zoneverdeling moet `null` kunnen zijn zonder de weekcijfers te breken.
- **Handmatige activiteiten** in Strava hebben geen streams. Vang dat af.
- **De plandata verandert.** Na de HRmax-test in week 6 kloppen je zones niet meer. Zet ze in `athlete.hr_zones`, niet in code, en laat de zoneberekening opnieuw draaien over bestaande activiteiten.
- **Een gemiste week is normaal.** 64% van de ultralopers verliest jaarlijks trainingsdagen. De app mag daar nooit op reageren met schuld — alleen met een aangepast plan.
