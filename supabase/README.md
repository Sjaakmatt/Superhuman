# Supabase setup

## Migraties toepassen

**Optie A — Supabase CLI (aanbevolen):**

```bash
supabase login
supabase link --project-ref <JOUW_PROJECT_REF>
supabase db push          # voert migrations/ uit
supabase db query < supabase/seed.sql   # of plak seed.sql in de SQL editor
```

**Optie B — SQL editor (dashboard):** voer de bestanden in volgorde uit:

1. `migrations/20260713000001_schema.sql` — alle tabellen + nieuwe-gebruiker-trigger
2. `migrations/20260713000002_rls.sql` — RLS aan op alles + policies
3. `seed.sql` — gedeelde content (oefeningen, meditaties, breathwork)

## Structuur

- Gebruikers-data: RLS-policy `user_id = auth.uid()` op elke tabel.
- Gedeelde content (`exercises`, `meditations`, `breathwork_patterns`):
  read-only voor ingelogde gebruikers, beheer via service role / dashboard.
- Bij signup maakt de `on_auth_user_created`-trigger automatisch een profiel
  en de zes attribuut-rijen (`user_attributes`) aan.

## Web-push (Fase 5)

De Edge Function `functions/send-reminders/` matcht elke 5 minuten de
`reminders` tegen de lokale tijd (profiel-tijdzone) en stuurt web-push naar
alle `push_subscriptions` van die gebruiker. Setup:

1. **VAPID-secrets** (eenmalig):

   ```bash
   supabase secrets set --project-ref <REF> \
     VAPID_PUBLIC_KEY=<public key> \
     VAPID_PRIVATE_KEY=<private key> \
     VAPID_SUBJECT=mailto:jij@voorbeeld.nl
   ```

   Dezelfde public key hoort in `.env.local` als
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Genereren: `npx web-push generate-vapid-keys`.

2. **Function deployen** (als dat nog niet via MCP is gebeurd):

   ```bash
   supabase functions deploy send-reminders --project-ref <REF>
   ```

3. **Elke 5 minuten aanroepen** via pg_cron + pg_net (SQL editor):

   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;

   select cron.schedule(
     'send-reminders',
     '*/5 * * * *',
     $$
     select net.http_post(
       url := 'https://<REF>.supabase.co/functions/v1/send-reminders',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer <ANON_KEY>'
       ),
       body := '{}'::jsonb
     );
     $$
   );
   ```

   De anon key volstaat: de functie draait zelf met de service-role key
   die Edge Functions automatisch krijgen.

## Auth-instelling

Voor de e-mailbevestigingsflow verwijst de app naar `/auth/confirm` met het
`token_hash`-patroon. Pas in het dashboard (Authentication → Email Templates)
de "Confirm signup"-template aan zodat de link wijst naar:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

en zet de Site URL op je app-URL (lokaal: `http://localhost:3000`).

## Momentum-decay (levende laag)

`run_momentum_decay()` draait elk uur via pg_cron (job `momentum-decay`,
`5 * * * *`) en verwerkt gebruikers bij wie het lokaal na 03:00 is, één keer
per dag (`profiles.last_decay_on`). Pure SQL — geen Edge Function of secrets
nodig. Beheer:

```sql
select * from cron.job;                       -- status
select cron.unschedule('momentum-decay');     -- uitzetten
```
