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

Alle fasen uit de brief zijn af. Nieuw werk = nieuwe afspraken met de
gebruiker; blijf committen per afgeronde subtaak.

## Commands

```bash
npm run dev    # dev server
npm run build  # productiebuild (moet groen zijn vóór commit)
npm run lint   # eslint
npx tsc --noEmit
```
