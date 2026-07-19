# Superhuman OS

Persoonlijk "become superhuman"-dashboard: een PWA die lichaam, geest, voeding,
beweging en discipline bundelt in één gegamificeerd systeem. Volledige opdracht:
`SUPERHUMAN_OS_BUILD_BRIEF.md`. Visuele referentie: `reference/SuperhumanOS.jsx`
(mockup — nog toe te voegen).

## Werkafspraken

- TypeScript strict, commit per afgeronde subtaak.
- Bouw alleen wat in de huidige fase staat (zie roadmap onderaan).
- RLS **altijd** aanzetten op nieuwe tabellen (`user_id = auth.uid()`).
- Bij architectuurkeuzes met impact: eerst kort overleggen.

## Concept & principes

**Je bent de main character.** Een RPG-achtig character sheet voor een echt
mens: zes attributen die je levelt door dagelijkse acties, met in het midden
een **living core** — een pulserende kern die voller gloeit naarmate je dag
completer is.

- **Meet inputs, niet outputs.** Inputs (getraind, gestretcht, water) stuur je;
  outputs (gewicht, stemming) zijn tonend.
- **Klein en snel loggen**: elke actie < 60 sec.
- **Geen streak-shame**: toon consistentie-%, nooit "streak verbroken" in rood.
- **De wekelijkse review is het stuur**; dagelijks afvinken is de motor.
- **Voeding = check-in**, geen calorieënjacht.

## Tech stack

- **Next.js 16** (App Router, Server Components + Server Actions), TS strict.
  ⚠️ Next 16 verschilt van oudere kennis: **`src/proxy.ts` i.p.v.
  `middleware.ts`**, async `cookies()`/`searchParams`. Raadpleeg
  `node_modules/next/dist/docs/` bij twijfel.
- **Supabase**: Postgres + Auth (via `@supabase/ssr`) + Storage, RLS op alles.
  Clients in `src/lib/supabase/` (client/server/proxy). Env-namen: zie
  `.env.example` (publishable óf anon key).
- **Tailwind CSS v4**: tokens staan als CSS-vars + `@theme` in
  `src/app/globals.css` (geen tailwind.config).
- Charts (later): Recharts of visx. State: server-first; client state alleen
  voor timers/players.

## Design system

Donker, levend, instrument-achtig. Sans voor UI, **mono voor data/getallen**.
Respecteer `prefers-reduced-motion`. Mobile-first, zichtbare keyboard-focus.

Basis: `--ink #0D0C16`, `--ink-2 #15131F`, `--card #1B1826`, `--card-2 #221E30`,
`--line #2C2740`, `--text #ECE9F6`, `--muted #8B86A6`.

## De zes attributen (`src/lib/attributes.ts`)

| key | label | kleur | voedt door |
|-----|-------|-------|-----------|
| `vitaliteit` | Vitaliteit | `#39E0C4` | slaap, herstel, water |
| `kracht` | Kracht | `#FF8A4C` | krachttraining, sport |
| `soepel` | Soepelheid | `#B58CFF` | stretchen, mobiliteit |
| `voeding` | Voeding | `#8FE05B` | check-in, plan volgen |
| `focus` | Focus | `#5B9BFF` | deep work, routines |
| `geest` | Geest | `#FF6FA8` | meditatie, breathwork, journaling |

## Datamodel

Volledig schema in `supabase/migrations/` (+ `supabase/seed.sql`,
toepassen: zie `supabase/README.md`). Kernidee: één flexibel
metrics/logs-systeem (`metrics` + `metric_logs`) + specifieke tabellen voor
content met eigen UX (oefeningen, recepten, meditaties). Nieuw domein
toevoegen = meestal een rij in `metrics`, geen migratie. Gedeelde content
(`exercises`, `meditations`, `breathwork_patterns`) is read-only voor users.
Bij signup maakt een trigger het profiel + de zes `user_attributes` aan.
Streaks en dag-completion worden **afgeleid** uit `xp_events`/logs.

## XP- & levellogica

Centrale Server Action `awardXp(userId, attributeKey, amount, source, sourceId)`:
schrijf `xp_events`-rij → `xp += amount`, bij `xp >= xp_max`: level-up en
`xp_max = 100 + (level-1)*25` → retourneer level-up voor toast. Loggen = XP +
log in één transactie.

- **Superhuman-level** = afgerond gemiddelde van de zes attribuut-levels.
- **Dag-completion %** = voltooide / geplande dag-eenheden.
- **Streak per attribuut** = aaneengesloten dagen met ≥ 1 xp_event.

## Schermen (details in brief §7)

Vandaag (core + rings + water + takenstack) · Beweging (stretch-player met
timer & video, kracht, bibliotheek) · Voeding (check-in, calorieën optioneel,
plan, auto-boodschappenlijst) · Geest (meditaties, breathwork-bol, journaling)
· Progressie (character sheet, trends, input-vs-output-overlay) · Doelen
(hiërarchie leven→week) · Wekelijkse review (voorgevuld) · Notificaties ·
Instellingen.

## Roadmap & status

- ✅ **Fase 0 — Fundament**: scaffold, tokens, auth, schema + RLS + seed, app-shell.
- ✅ **Fase 1 — Vandaag + XP-motor**: living core, rings, water, takenstack,
  `awardXp`, food-check-in, stretch-player, breathwork-animatie.
  XP-regels: water 5/glas t/m goal, check-in 20, stretch 40, breathwork 25,
  meditatie 30, metrics eigen `xp_reward` — alleen de eerste log per dag.
  Transacties via Postgres-functies (migration `..003_xp_engine.sql`),
  aangeroepen met `supabase.rpc()` vanuit `src/app/(app)/actions.ts`.
- ✅ **Fase 2 — Progressie + Geest**: character sheet, streaks, heatmap,
  meditatie-bibliotheek + player, journaling (15 XP, `add_journal_entry`).
  Streak-/ritme-berekening in `src/lib/streaks.ts` (afgeleid uit xp_events,
  profiel-tijdzone; vandaag zonder event breekt de streak niet).
- ✅ **Fase 3 — Voeding & Beweging compleet**: bibliotheek met video, kracht-
  logging (routine-builder + `complete_workout`, 45 XP), calorieënteller
  (zonder XP/budget), voedingsplan met weeknavigatie, boodschappenlijst via
  `generate_shopping_list`. Sessie-XP overal eerste-per-dag
  (`xp_awarded_today`, migration `..006`).
- ✅ **Fase 4 — Discipline**: doelen-hiërarchie met metric-ritme (/doelen),
  voorgevulde weekreview (/review, `save_review`, 25 XP focus), trends in
  Progressie (Recharts, twee gestapelde panelen i.p.v. dual-axis;
  chartkleuren `--chart-input`/`--chart-output`, CVD-gevalideerd).
- ✅ **Fase 5 — Notificaties & PWA**: manifest + maskable icons, service
  worker (push + notificatie-klik), /instellingen (profiel, reminders-CRUD,
  push-toggle), Edge Function `send-reminders` (5-min-slots, profiel-tz).
  Handmatig eenmalig: VAPID-secrets + pg_cron-schedule, zie
  `supabase/README.md`.

Alle fasen uit de oorspronkelijke brief zijn af.

## Levende laag (SUPERHUMAN_OS_LIVING_BRIEF.md)

**Model:** XP = blijvend (wie je geworden bent); **momentum** = levenspuls
0-100 per attribuut: +34 bij voeden (cap 100), −17 per niet-gevoede dag
(pg_cron, profiel-tz, na lokale 03:00), zacht verval −12 XP bij ≥2 dagen op
momentum 0. **Stages** op totaal-XP (som zes attributen via `attr_total_xp`):
Sluimerend 0 · Ontwakend 600 · Gedisciplineerd 1800 · Onverzettelijk 3600 ·
Superhuman 6000. `award_xp` retourneert `momentum`, `total_xp` en `new_stage`
(ceremonie-payload zodra ordinal > `profiles.last_stage`; bevestigen met
`ack_stage`). Vitaliteit = gemiddeld momentum / 100.
⚠️ Afwijkingen van de briefing: bestaande per-actie-XP behouden i.p.v.
uniforme FEED_XP=24; decay als pure SQL-functie + pg_cron i.p.v. Edge
Function. `reference/LivingOS.jsx` en `002_exercise_content.sql` ontbreken
nog in de repo (nodig voor L2/L4).

- ✅ **L1 — Levende laag datamodel**: migration `..009_living_layer.sql`
  (momentum/idle_days, evolution_stages + seed, last_stage/last_decay_on,
  schedule_blocks + RLS), `award_xp` v2, `decay_user_attributes` +
  `run_momentum_decay`, cron-job `momentum-decay` (elk uur op :05).
- ✅ **L2 — Levende core + ceremonie**: LivingCore (deeltjes/gloed uit
  stage, adem op vitaliteit), momentum-cellen (lucide-icons, tik → domein),
  home-hero met stage-voortgang + state-regel, EvolutionCeremony (ack via
  `ackStage`). Content-pack toegepast: 30 oefeningen met coaching_cues,
  6 gedeelde programma's (user_id null, eigen leespolicies).
- ✅ **L3 — De spiegel**: `computeReflections` (src/lib/reflections.ts,
  puur/testbaar) — verval-alarm 4 > drempel 3.5 > dim 3 > streak 2 >
  vitaliteit-stemming 1-1.5 > cross-domein 0.8 (bewegen×stemming bij ≥5
  mood-dagen, anders voed-ritme bij ≥3 dagen); max 2 regels, Mirror-UI op
  Vandaag met gekleurde linkerrand. Decay kreeg een gratieperiode voor
  nieuwe accounts (migration `..011`).
- ✅ **L4 — Sessie-diepte**: session-engine (`src/lib/session.ts`:
  buildTimeline, activeCue, breathScale, explainTempo). Stretch-player is
  een state machine (INTRO→COUNT-IN→HOLD met ademindicator + getimede cues
  →REST met preview; bilateraal "wissel van kant") die een programma draait
  → `/beweging/stretch/[id]`. Kracht-logger met sets/tempo-uitleg/cue/fout,
  rust-timer per set en progressive overload ("vorige keer" uit
  `workout_logs.sets`, migration `..012`). Breathwork: settle-in 10s,
  fase-tellingen, ronde-teller, zachte afsluiting. Beweging-hub toont de
  gedeelde programma's per moment.
- ✅ **L5 — Voeding tot leven**: `src/lib/nutrition.ts` (MEAL_WINDOWS met
  richttijden, mealStatus nu/straks/gehad, activeMeal, hydrationTarget).
  /voeding is een begeleide dag: Nu-regel + maaltijd-tijdlijn met vensters
  en gekoppelde recepten (MealTimeline tikt op de klok in profiel-tz),
  HydrationDay met doel-tot-nu + nudge, check-in als coaching. Migration
  `..013` (meal_plan.target_min, recipes.prep_min); planMeal zet default
  richttijd.
- ✅ **L6 — "Nu"-motor**: `src/lib/now.ts` (pickNowBlock: actief-en-niet-
  gedaan blok, anders straks-preview; kind→route/cta/regel). NowCard bovenaan
  Vandaag tikt op de klok (profiel-tz), stelt één primaire actie voor met
  straks-preview, of een rustige "je bent bij"-staat. `schedule_blocks`
  geseed via `ensure_default_schedule` (dagritme → gedeelde routines),
  dagritme-lijst + toggle in /instellingen, `sync_schedule_reminders` maakt
  web-push-reminders (kind 'block') uit de blokken. Migration `..014`.
- ✅ **L7 — Levende copy + zintuigen**: `src/lib/haptics.ts` (vibrate-tik
  bij voeden, puls bij level-up/ceremonie, gated op reduced-motion),
  gekoppeld via de XP-toast en EvolutionCeremony. Reduced-motion
  neutraliseert animaties + transitions + scroll; zachte rise-in op
  Nu-kaart/spiegel. Copy-sweep: lege staten nodigen uit, succes-toasts als
  warme stem, missers met compassie (geen streak-shame).

**Alle levende-laag-fasen (L1-L7) zijn af.** Het OS leeft: geen dood
dashboard, altijd een volgende stap + spiegel; acties hebben voelbaar
gevolg (momentum, ademende cellen, verval); groei transformeert zichtbaar
(core-evolutie + ceremonie); elke sessie stuurt en houdt vast.

## Beweging-diepte & visuele reset (SUPERHUMAN_OS_BEWEGING_BRIEF.md)

**Kern:** calisthenics-**ladders** — per bewegingspatroon een reeks treden
van makkelijk→moeilijk. Progressie (trede omhoog) ís de beloning, geen XP.
De sessie-engine weet waar je op elke ladder staat en leidt je set voor set.
⚠️ Afwijking van de briefing: de ladder-oefeningen staan in een **eigen
tabel `ladder_exercises`** (niet de bestaande `exercises` vervangen — die
voedt nog de mobiliteit/stretch-flow die de briefing behoudt).

- ✅ **T0 — Data & content**: migration `..015_training_ladders.sql`
  (`movement_patterns`, `ladder_exercises`, `session_templates`+`_slots`,
  `user_ladder_state`, `run_logs`; `workout_logs` + `ladder_exercise_id`/
  `rung`; signup-trigger + `ensure_ladder_state`; RLS op alles). Seed
  `..016`: 9 patronen, **46 treden** volledig gecoacht (setup/execution/
  breathing/mistakes + prescriptie + advance + regressie/progressie via
  slug), 2 sessie-templates (`kracht_a`/`kracht_b`) + slots. Kalibratie:
  trek_vert op trede 3 (profiel 1-3 pull-ups). Alles op het project +
  RLS geverifieerd (anon ziet niets, gedeeld leesbaar, state afgeschermd).
- ✅ **T1 — Engine (lib)**: `src/lib/training/` — `ladders.ts`
  (buildLadderIndex, exerciseAtRung, clampRung, next/prevRung),
  `generateSession.ts` (slot→trede, target, tempo, rust, vorige keer;
  `sessionKeyForWeek` A/B), `progression.ts` (evaluateAdvance,
  applyProgression: promotie bij `metStreak>=2`, geen auto-degradatie,
  suggestsRegression), `sessionMachine.ts` (buildStrengthSteps: platte
  panel/set/rest/summary-tijdlijn). Pure + getest met **vitest** (`npm test`,
  11 tests). Testfiles buiten de Next-build (tsconfig exclude).
- ✅ **T2 — Sessie-player + Vandaag-koppeling**: migration `..017`
  (`schedule_blocks.session_key`, kracht-blok in `ensure_default_schedule` +
  backfill bestaande users, `complete_ladder_session` → een workout_log per
  oefening met ladder_exercise_id/rung/sets + kracht 45 XP eerste/dag).
  Data-laag `src/lib/training/data.ts` (snake→camel loaders,
  `buildSessionBundle` met ladder-strips, `resolveSessionKey` auto=week-A/B).
  Route `/beweging/sessie/[key]` (auto|kracht_a|kracht_b) met
  `LadderSessionPlayer` — state machine: coaching-paneel (opzet/uitvoering/
  ademhaling/fouten + `LadderStrip` met huidige trede), set-logger (rep-teller,
  schoon-&-tempo-toggle, vorige keer), rust-timer, samenvatting met
  trede-ceremonie. Progressie in de getypte engine (alleen reps/tempo van de
  client vertrouwd; drempels uit DB) → `user_ladder_state`-upsert in
  `completeLadderSession`. Nu-motor 'workout' → `/beweging/sessie/auto`;
  kracht-CTA op de Beweging-hub.
- ✅ **T3 — Hub, ladder-map & bibliotheek**: data-laag `loadLadderMap`/
  `loadLadderDetail`/`stripFromEntry`. `/beweging` herbouwd: Vandaag-kaart
  (krachtsessie op trainingsdag, anders rustdag→mobiliteit), **ladder-map**
  per patroon gegroepeerd op categorie (kracht/elasticiteit/mobiliteit) met
  horizontale sporten (`LadderMapRow`) — trede X/Y + volgende trede in één
  blik. Encyclopedie `/beweging/bibliotheek` herzien rond de ladders
  (per patroon, makkelijk→moeilijk, huidige trede gemarkeerd), detailpagina
  `/beweging/bibliotheek/[slug]` met volledige coaching + status ("dit is
  jouw huidige trede"). Losse ingangen `/beweging/mobiliteit` (stretch-flows)
  en `/beweging/hardlopen` (stub voor T4).
- ✅ **T4 — Hardlopen & mobiliteit**: migration `..018` (`log_run` →
  run_log + vitaliteit 30 XP eerste run/dag; conditioning voedt vitaliteit).
  `src/lib/running.ts` (paceMinPerKm/formatPace, weekStartOf, weeklyVolume,
  runSummary — puur, 4 vitest-tests). `/beweging/hardlopen` compleet:
  `RunLogger` (soort, afstand, duur, RPE, datum, notitie → live tempo),
  samenvattingstegels (weekvolume, runs, gem. tempo), `RunTrend` (Recharts:
  weekvolume-bars + tempo-lijn min/km, lager=sneller), recente runs. Mobiliteit
  als **dagelijkse flow**: `/beweging/mobiliteit` toont vandaag-afgerond-status.
- ✅ **T5 — Visuele reset**: nieuw palet in `globals.css` (bijna-zwart
  `--bg #0A0A0B`, `--surface-1/2/3`, `--hairline`; betekenislaag
  `--effort`/`--calm`/`--alive`) met legacy-namen als aliassen zodat het hele
  OS mee-restyled. Typografie: **Space Grotesk** (display, koppen met
  negatieve tracking) · **Inter** (body) · **JetBrains Mono** (data/eyebrows).
  Betekenis in kleur: warm=inspanning (sets, Nu-actie), koel=rust (rust-timers
  → `--calm`), pop=progressie (trede-ceremonie + ladder-doeltrede → `--alive`).
  themeColor/manifest/icon naar `#0A0A0B`. Focus-ring koel; reduced-motion
  intact.

**De hele Beweging-brief (T0–T5) is af.** Kracht is een set-voor-set
begeleide ladder-sessie met voelbare progressie; hardlopen en mobiliteit
hebben hun eigen spoor; de encyclopedie is diep en per-ladder; en het OS
draagt de nieuwe, rustige bijna-zwarte stijl met de ladder als signatuur.

Commit per fase; stop na elke fase voor akkoord.

Commit per fase; stop na elke fase voor akkoord van de gebruiker.

## Gated curriculum (SUPERHUMAN_OS_CURRICULUM_BRIEF.md)

Diepgaand onderzoek (4 parallelle agents) → fijnmazige, **gated** leerlijnen:
calisthenics (8 ladders × ~12), mobiliteit (7 sporen × 10), meditatie (11),
ademwerk (12, rond **Breathe With Sandy**). Gedeeld gating-model + gecureerde
media (Engelstalige video/audio mag; app-copy blijft NL). Bouwplan C0-C4.

- ✅ **C0 — Ademwerk-PoC**: migraties `..020/..021` (`breath_levels` +
  `user_breath_state` + `breath_sessions` + `bolt_logs`, RLS;
  `complete_breath_session` → geest 25 XP + session_log, `log_bolt`). Getypte
  ontgrendel-lib `src/lib/breath.ts` (`evaluateUnlock`, CO₂-poort BOLT ≥ 20s,
  5 vitest-tests) + `breath-data.ts`. `/geest/ademwerk` = gated pad (12 niveaus,
  sloten tonen "nog X te gaan", zwaar-badges), `/geest/ademwerk/[slug]` met
  `BreathPlayer`: **ademhalings-orb** (paced), **BOLT-tool** (niveau 2),
  **rounds + retentie** (Wim Hof/holds), **follow-embed** (Sandy's video),
  veiligheids-ack vóór de zware niveaus. Nu-motor + Vandaag-taak → `/geest/ademwerk`.
- ⬜ **C1 mobiliteit · C2 meditatie · C3 calisthenics-verdieping · C4 generalisatie**

## Commands

```bash
npm run dev    # dev server
npm run build  # productiebuild (moet groen zijn vóór commit)
npm run lint   # eslint
npx tsc --noEmit
```
