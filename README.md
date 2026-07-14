# Superhuman OS

Persoonlijk "become superhuman"-dashboard: een RPG-achtig character sheet voor
een echt mens. Zes attributen (Vitaliteit, Kracht, Soepelheid, Voeding, Focus,
Geest) die je levelt door dagelijkse acties, met een pulserende **living core**
als hart van de app.

Volledige opdracht en roadmap: [`SUPERHUMAN_OS_BUILD_BRIEF.md`](./SUPERHUMAN_OS_BUILD_BRIEF.md)
· Projectcontext voor Claude Code: [`CLAUDE.md`](./CLAUDE.md)

## Stack

Next.js 16 (App Router, RSC + Server Actions) · TypeScript strict ·
Tailwind CSS v4 · Supabase (Postgres, Auth, Storage, RLS op alles)

## Setup

1. **Supabase-project**: maak (of kies) een project en pas het schema toe —
   zie [`supabase/README.md`](./supabase/README.md) voor migraties, seed en
   de auth-e-mailtemplate.
2. **Env-vars**: kopieer `.env.example` naar `.env.local` en vul de Supabase
   URL + publishable (of anon) key in.
3. **Draaien**:

```bash
npm install
npm run dev     # http://localhost:3000
```

## Status

**Fase 0 t/m 3** zijn af: living core met dag-completion, attribuut-rings,
watertracker, takenstack, transactionele XP-motor, voeding-check-in,
stretch-player, breathwork-animatie, character sheet met streaks en
week-heatmap, meditatie-player, journaling, oefeningen-bibliotheek,
krachttraining met routine-builder, calorieënteller, voedingsplan en de
auto-gegenereerde boodschappenlijst, doelen-hiërarchie, voorgevulde
wekelijkse review en input-vs-output-trends. Volgende: **Fase 5 —
Notificaties & PWA** (reminders, web-push, service worker, polish).
