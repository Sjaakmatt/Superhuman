# Superhuman OS — Build Brief voor Claude Code

Dit document is de opdracht voor Claude Code om een persoonlijk "become superhuman"-dashboard te bouwen: een progressieve web-app die lichaam, geest, voeding, beweging en discipline bundelt in één gegamificeerd systeem.

---

## 0. Hoe je dit gebruikt

1. Maak een lege repo aan en start Claude Code erin.
2. Zet het bestand `SuperhumanOS.jsx` (de bestaande mockup) in de repo, bijvoorbeeld in `/reference/`. Dit is de **visuele referentie** voor de look & feel, de "living core", de attribuut-rings en het speelgevoel. Bouw de echte schermen in die stijl.
3. Plak sectie **9 (Eerste opdracht)** als eerste bericht in Claude Code. Verwijs naar dit hele bestand.
4. Kopieer secties 1–8 naar een `CLAUDE.md` in de repo-root, zodat Claude Code de context bij elke sessie automatisch meeneemt.
5. Bouw **fase voor fase** (sectie 8). Laat Claude Code na elke fase committen en pas doorgaan na jouw akkoord.

**Werkafspraken voor Claude Code:** TypeScript strict, commit per afgeronde subtaak, geen features tegelijk bouwen die niet in de huidige fase staan, RLS altijd aanzetten op nieuwe tabellen, en bij architectuurkeuzes met impact eerst kort overleggen.

---

## 1. Concept & filosofie

**Je bent de main character.** In plaats van een saaie habit-tracker is dit een RPG-achtig character sheet voor een echt mens. Zes **attributen** die je letterlijk levelt door dagelijkse acties. In het midden een **living core**: een pulserende kern die voller en helderder wordt naarmate je je dag voltooit — dat is de "superhuman progressie", geen balkje maar een wezen dat je voedt.

Kernprincipes die in het hele ontwerp moeten zitten:

- **Meet vooral inputs, niet outputs.** Inputs zijn wat je vandaag controleert (getraind, gestretcht, gemediteerd, water gedronken). Outputs (gewicht, HRV, stemming) volgen en zijn tonend, niet sturend.
- **Klein loggen, snel loggen.** Elke dagelijkse actie moet in < 60 sec te loggen zijn.
- **Geen streak-shame.** Streaks motiveren, maar een gemiste dag straft niet af. Toon "consistentie %", niet "streak verbroken" in rood.
- **De wekelijkse review is het stuur.** Dagelijks afvinken is de motor; de review is waar je bijstuurt. Bouw deze loop vanaf het begin mee.
- **Voeding = check-in, geen calorieënjacht.** "Hoe voelde je eten vandaag" staat centraal; de calorieënteller is een optioneel hulpmiddel, geen streng budget dat de gebruiker afstraft.

---

## 2. Tech stack

- **Next.js 14+** (App Router, Server Components + Server Actions), **TypeScript** (strict).
- **Supabase**: Postgres (data), Auth (e-mail/OAuth), Storage (oefening-video's, meditatie-audio/video), Row Level Security op alles.
- **Tailwind CSS** voor styling. Design-tokens uit sectie 3.
- **Charts**: lightweight lib (bv. Recharts of visx) voor trends in Progressie.
- **PWA**: installeerbaar, service worker voor web-push-notificaties.
- **State**: server-first (Server Actions + RSC); client state alleen waar nodig (timers, players).
- Optioneel: **Supabase Edge Functions + pg_cron** voor geplande reminders/notificaties.

---

## 3. Design system

Neem de sfeer over uit `SuperhumanOS.jsx`: donker, levend, instrument-achtig. Eén bold element (de core), de rest rustig en gedisciplineerd.

**Kleuren**
```
--ink:      #0D0C16   /* achtergrond diep */
--ink-2:    #15131F   /* panelen / sheets */
--card:     #1B1826
--card-2:   #221E30
--line:     #2C2740   /* borders */
--text:     #ECE9F6
--muted:    #8B86A6
```

**Attribuut-kleuren (elk attribuut heeft een eigen gloed)**
```
Vitaliteit  #39E0C4   (aqua)
Kracht      #FF8A4C   (amber)
Soepelheid  #B58CFF   (violet)
Voeding     #8FE05B   (lime)
Focus       #5B9BFF   (blauw)
Geest       #FF6FA8   (rose)
```

**Typografie**: sans voor UI (system-ui / Inter), **monospace voor data en getallen** (levels, XP, timers) — dat versterkt het "instrument"-gevoel.

**Signature**: de living core met pulserende aura en groeiende glow. Kalme Vandaag-view boven, rijke analytics in Progressie. Respecteer `prefers-reduced-motion`. Mobile-first, zichtbare keyboard-focus.

---

## 4. De zes attributen

Alles wat de gebruiker doet voedt één van deze stats. Zo blijft "alles bijhouden" behapbaar en voelt het als groeien.

| key | label | voedt door |
|-----|-------|-----------|
| `vitaliteit` | Vitaliteit | slaap, herstel, water |
| `kracht` | Kracht | krachttraining, sport |
| `soepel` | Soepelheid | stretchen, mobiliteit |
| `voeding` | Voeding | voeding-check-in, plan volgen |
| `focus` | Focus | deep work, routines, discipline |
| `geest` | Geest | meditatie, breathwork, journaling, stemming |

---

## 5. Datamodel (Supabase / Postgres)

Kernidee: één flexibel metrics/logs-systeem + specifieke tabellen voor content die eigen UX nodig heeft (oefeningen, maaltijden, meditaties). Een nieuw domein toevoegen = meestal een rij in `metrics`, geen migratie.

**Zet op elke tabel RLS aan** met policy `user_id = auth.uid()` (behalve gedeelde content-tabellen zoals `exercises`, `meditations`, `breathwork_patterns` die read-only voor iedereen mogen zijn).

> Het volledige, actuele schema staat in `supabase/migrations/` — dat is de bron van waarheid. Hieronder de oorspronkelijke schets uit de brief.

```sql
-- === Gebruiker ===
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  timezone text default 'Europe/Amsterdam',
  onboarded_at timestamptz,
  created_at timestamptz default now()
);

-- === Attributen (voortgang per gebruiker) ===
create table user_attributes (
  user_id uuid references auth.users on delete cascade,
  key text not null,                 -- vitaliteit|kracht|soepel|voeding|focus|geest
  level int not null default 1,
  xp int not null default 0,
  xp_max int not null default 100,
  primary key (user_id, key)
);

-- === XP-events (audit + geschiedenis + streaks) ===
create table xp_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  attribute_key text not null,
  amount int not null,
  source text not null,              -- 'stretch','workout','meditation','water',...
  source_id text,
  created_at timestamptz default now()
);

-- === Flexibele metrics + logs ===
create table metrics (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  key text not null,
  label text not null,
  attribute_key text,                -- koppelt aan een attribuut
  type text not null,                -- boolean|count|scale|quantity|duration
  unit text,
  cadence text default 'daily',      -- daily|weekly
  direction text default 'input',    -- input|output
  target numeric,
  xp_reward int default 20,
  active boolean default true
);
create table metric_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  metric_id bigint references metrics on delete cascade,
  date date not null default current_date,
  value numeric,
  note text,
  created_at timestamptz default now(),
  unique (user_id, metric_id, date)
);

-- === Beweging: oefeningen, routines, logs ===
create table exercises (              -- gedeelde content (read-only voor users)
  id bigint generated always as identity primary key,
  name text not null,
  kind text not null,                 -- stretch|strength|mobility|cardio
  default_secs int,
  reps int,
  cue text,
  muscle_group text,
  video_url text                      -- Supabase Storage
);
create table routines (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  name text not null,
  kind text not null                  -- stretch|workout
);
create table routine_exercises (
  routine_id bigint references routines on delete cascade,
  exercise_id bigint references exercises,
  position int not null,
  secs int, reps int, sets int,
  primary key (routine_id, position)
);
create table workout_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  routine_id bigint references routines,
  date date default current_date,
  duration_secs int,
  note text,
  created_at timestamptz default now()
);

-- === Voeding ===
create table food_checkins (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  date date not null default current_date,
  satisfied boolean,                  -- "voldaan aan je voeding?"
  feeling text,                       -- licht & energiek | prima | te zwaar | ...
  note text,
  unique (user_id, date)
);
create table recipes (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  name text not null,
  ingredients jsonb,                  -- [{name, qty, unit}]
  calories int, protein int, carbs int, fat int,
  instructions text
);
create table meal_plan (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  date date not null,
  meal_type text not null,            -- ontbijt|lunch|diner|snack
  recipe_id bigint references recipes
);
create table shopping_items (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  week_start date not null,
  name text not null, qty numeric, unit text,
  checked boolean default false
);
create table calorie_logs (           -- optioneel/licht
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  date date default current_date,
  item text, calories int, protein int, carbs int, fat int,
  created_at timestamptz default now()
);

-- === Geest ===
create table meditations (            -- gedeelde content
  id bigint generated always as identity primary key,
  title text not null,
  category text,                      -- focus|slaap|kalmte|reset
  media_type text,                    -- voice|video
  media_url text,
  duration_secs int,
  description text
);
create table breathwork_patterns (    -- gedeelde content
  id bigint generated always as identity primary key,
  name text not null,                 -- '4-7-8', 'box', ...
  phases jsonb not null               -- [{label,secs,scale}]
);
create table session_logs (           -- meditatie/breathwork afronding
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  kind text not null,                 -- meditation|breathwork
  ref_id bigint,
  date date default current_date,
  duration_secs int,
  created_at timestamptz default now()
);
create table journal_entries (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  date date default current_date,
  type text,                          -- ochtend|avond|vrij|dankbaarheid
  content text,
  mood int                            -- 1..10
);

-- === Discipline & structuur ===
create table goals (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  title text not null,
  horizon text not null,              -- leven|jaar|kwartaal|week
  parent_id bigint references goals,
  status text default 'active',
  target_date date,
  linked_metric_id bigint references metrics
);
create table reviews (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  week_start date not null,
  wins text, lessons text, adjustments text,
  domain_scores jsonb,                -- {vitaliteit:8, kracht:6, ...}
  focus_next text,
  unique (user_id, week_start)
);

-- === Water & reminders ===
create table water_logs (
  user_id uuid references auth.users on delete cascade,
  date date not null default current_date,
  glasses int default 0,
  goal int default 8,
  primary key (user_id, date)
);
create table reminders (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  kind text not null,                 -- water|stretch|meditation|review|custom
  label text,
  schedule jsonb,                     -- {times:['09:00','13:00'], days:['MO'..], interval_min}
  enabled boolean default true
);
create table push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  subscription jsonb not null,        -- web-push subscription object
  created_at timestamptz default now()
);
```

Streaks en dag-completion worden **afgeleid** uit `xp_events` / `*_logs` (geen aparte opslag nodig).

---

## 6. XP- & levellogica

Centrale server-side functie `awardXp(userId, attributeKey, amount, source, sourceId)`:

1. Schrijf een rij in `xp_events`.
2. Update `user_attributes`: `xp += amount`. Zolang `xp >= xp_max`: `xp -= xp_max`, `level += 1`, en verhoog `xp_max` volgens een curve (bv. `xp_max = 100 + (level-1)*25`).
3. Retourneer of er een level-up was → frontend toont een toast ("+40 XP · Soepelheid · LEVEL UP!").

Afgeleide waarden:
- **Superhuman-level** = afgerond gemiddelde van de zes attribuut-levels.
- **Dag-completion %** = voltooide dag-eenheden / geplande dag-eenheden (taken + watergoal).
- **Streak per attribuut** = aantal aaneengesloten dagen met ≥ 1 `xp_event` voor dat attribuut.

Elke voltooibare actie heeft een `xp_reward` en een `attribute_key`. Loggen = award XP + log opslaan, in één Server Action (transactie).

---

## 7. Features & schermen

### 7.1 Vandaag (home)
De living core bovenaan (level + dag-%), daaronder de zes attribuut-rings (XP-fractie per attribuut), watertracker met +1, en de takenstack van vandaag. Elke taak: icoon in attribuutkleur, label, meta, XP-reward, one-tap of opent een player. Voltooide taken tonen een vinkje en dimmen. Voltooien laat de core voller gloeien. **Referentie: `SuperhumanOS.jsx`.**

### 7.2 Beweging
- **Stretch-player**: sequentie van oefeningen, **timer per oefening** met auto-advance, play/pause/skip, voortgangsdots, en een **video** per oefening (Supabase Storage). Aan het eind → XP naar Soepelheid + `workout_log`/`session`.
- **Krachttraining**: routines met oefeningen (sets/reps), loggen, XP naar Kracht.
- **Oefeningen-bibliotheek**: doorzoekbare lijst met filmpjes, filterbaar op type/spiergroep. Routines samenstellen uit de bibliotheek.

### 7.3 Voeding
- **Dagelijkse check-in**: "Voldaan aan je voeding?" ja/nee + gevoel (chips: licht & energiek / prima / te zwaar / te weinig / gestrest gegeten) + vrije notitie. XP naar Voeding.
- **Calorieënteller**: licht en optioneel — items loggen met calorieën/macro's. Framing gezond, geen afstraffend budget.
- **Voedingsplan**: recepten per dag/maaltijd (ontbijt/lunch/diner/snack).
- **Wekelijkse boodschappenlijst**: **auto-gegenereerd** uit het voedingsplan (ingrediënten optellen), afvinkbaar.

### 7.4 Geest
- **Geleide meditaties**: bibliotheek met categorieën (focus/slaap/kalmte/reset), **video óf voice**, afspeelbaar in-app met ring-timer. Voltooien → XP naar Geest.
- **Breathwork**: begeleide patronen (4-7-8, box, ...) met **ademende bol-animatie** (in/hold/uit), rondes-teller, begeleiding via voice/video. XP naar Geest.
- **Journaling & stemming**: ochtend/avond/dankbaarheid/vrij, met mood-score (1–10) die als output in Progressie verschijnt.

### 7.5 Progressie (character sheet)
Groot Superhuman-level, week-heatmap/ritme, per attribuut een level + XP-bar + streak. **Trends** met 7d/30d rolling averages, en de killer-feature: **input tegen output overlayen** (bv. gem. slaap over stemming, of trainingsdagen over HRV) zodat de gebruiker persoonlijke hefbomen ontdekt.

### 7.6 Doelen
Hiërarchie leven → jaar → kwartaal → week (self-referential `parent_id`), uitklapbaar, elk doel koppelbaar aan een metric zodat voortgang zichtbaar is (niet alleen een vinkje).

### 7.7 Wekelijkse review
**Begeleide flow met data al voorgevuld**: "je week in cijfers" (completion, trends, wat wegzakte), dan prompts voor wins/lessen/aanpassingen, score per domein, en focus voor volgende week. Voorvullen maakt het 5 min i.p.v. 30. Sluit de loop.

### 7.8 Notificaties & reminders
- **Water-reminder** (interval overdag), plus reminders voor stretch, meditatie en de wekelijkse review.
- Instelbaar per type (tijden, dagen, aan/uit) via `reminders`.
- **Web-push** via service worker + `push_subscriptions`. Geplande verzending via Supabase Edge Function + pg_cron. In-app notificaties als MVP-fallback.

### 7.9 Instellingen
Profiel, tijdzone, reminder-configuratie, welke metrics/attributen actief zijn, thema.

---

## 8. Bouwfasen (roadmap)

Bouw strikt in deze volgorde. Commit per fase, wacht op akkoord.

- **Fase 0 — Fundament**: Next.js + TS + Tailwind scaffold, Supabase koppelen, auth (login/signup), volledig DB-schema + RLS + seed-data (oefeningen, meditaties, breathwork-patterns), design-tokens uit sectie 3, app-shell met bottom-nav.
- **Fase 1 — Vandaag + XP-motor**: living core, attribuut-rings, watertracker, takenstack, `awardXp`-Server Action, food-check-in, **stretch-player met timer**, **breathwork-animatie**. (Dit maakt het meteen bruikbaar en leuk.)
- **Fase 2 — Progressie + Geest**: character sheet, streaks, week-heatmap, meditatie-bibliotheek + player, journaling.
- **Fase 3 — Voeding & Beweging compleet**: oefeningen-bibliotheek met video, krachttraining-logging, calorieënteller, voedingsplan, auto-boodschappenlijst.
- **Fase 4 — Discipline-laag**: doelen-hiërarchie, wekelijkse review-flow (voorgevuld), trends met input-vs-output-overlay.
- **Fase 5 — Notificaties & PWA**: reminders-engine, web-push, service worker, installeerbaar maken, polish + animaties + reduced-motion.

---

## 9. Later / optioneel

Niet nu bouwen, wel vast vastgelegd zodat het schema het aankan: slaap-tracking, koppeling met Apple Health / smartwatch (HRV, rust-HR, stappen), foto-progressie, supplementen, koud douchen, leeslijst/skills, sociale connectie, en een "vanity"-vrije samengestelde score alleen als decomponeerbaar. Voeg deze toe als nieuwe `metrics`-rijen of kleine tabellen wanneer je eraan toe bent.
