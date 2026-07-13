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

**Fase 0 — Fundament** en **Fase 1 — Vandaag + XP-motor** zijn af: living
core met dag-completion, attribuut-rings, watertracker, takenstack,
transactionele XP-motor, voeding-check-in, stretch-player met timer en
breathwork met bol-animatie. Volgende: **Fase 2 — Progressie + Geest**
(character sheet, streaks, heatmap, meditaties, journaling).
