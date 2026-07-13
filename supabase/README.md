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

## Auth-instelling

Voor de e-mailbevestigingsflow verwijst de app naar `/auth/confirm` met het
`token_hash`-patroon. Pas in het dashboard (Authentication → Email Templates)
de "Confirm signup"-template aan zodat de link wijst naar:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

en zet de Site URL op je app-URL (lokaal: `http://localhost:3000`).
