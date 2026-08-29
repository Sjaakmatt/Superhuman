-- Toegang op uitnodiging, en de app echt per persoon.
--
-- Tot nu toe ging het schema ervan uit dat er één gebruiker was. Dat stond zo
-- in 0006_rls.sql: schoenen en bloedwaarden hingen aan niemand, en wellness en
-- blood_panel hadden de datum als primaire sleutel. Met een tweede persoon
-- betekent dat: elkaars schoenen zien, en niet allebei op dezelfde dag een
-- ochtendcheck kunnen invullen. Alle tabellen zijn nog leeg, dus dit is het
-- goedkoopste moment om het recht te zetten.

-- ── wie er binnen mag ────────────────────────────────────────────────────────
create table if not exists invitation (
  email       text primary key,
  invited_by  uuid references athlete(id) on delete set null,
  invited_at  timestamptz not null default now(),
  -- Gevuld zodra Supabase het account aanmaakt (dat gebeurt bij het versturen
  -- van de uitnodiging, niet pas bij het accepteren).
  user_id     uuid references auth.users(id) on delete set null,
  note        text
);

-- Alleen wie mag uitnodigen, beheert de lijst. Dat recht krijgt de eerste
-- gebruiker; genodigden krijgen het niet.
alter table athlete add column if not exists can_invite boolean not null default false;

alter table invitation enable row level security;
drop policy if exists invitation_beheer on invitation;
create policy invitation_beheer on invitation
  for all to authenticated
  using (exists (select 1 from athlete a where a.id = my_athlete_id() and a.can_invite))
  with check (exists (select 1 from athlete a where a.id = my_athlete_id() and a.can_invite));

-- ── de deur ─────────────────────────────────────────────────────────────────
-- De eerste gebruiker mag altijd binnen en wordt de eigenaar. Daarna komt er
-- niemand bij zonder rij in `invitation`. Deze controle staat in de database en
-- niet in een dashboard-instelling, zodat "aanmelden toestaan" per ongeluk
-- aanzetten geen gat maakt.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eerste boolean;
  uitgenodigd boolean;
begin
  select count(*) = 0 into eerste from public.athlete;
  select exists (select 1 from public.invitation i where lower(i.email) = lower(new.email))
    into uitgenodigd;

  if not eerste and not uitgenodigd then
    raise exception 'Geen uitnodiging voor %. Voeg het adres eerst toe onder Instellingen.', new.email
      using errcode = 'check_violation';
  end if;

  insert into public.athlete (user_id, hr_max, hr_zones, can_invite)
  values (
    new.id,
    coalesce((select (value ->> 'hr_max')::int from public.reference where key = 'zones'), 188),
    coalesce((select value -> 'bands' from public.reference where key = 'zones'), '[]'::jsonb),
    eerste
  )
  on conflict (user_id) do nothing;

  update public.invitation set user_id = new.id where lower(email) = lower(new.email);
  return new;
end $$;

revoke execute on function handle_new_user() from public, anon, authenticated;

-- ── per persoon in plaats van per app ───────────────────────────────────────
alter table shoe add column if not exists athlete_id uuid references athlete(id) on delete cascade;
alter table blood_panel add column if not exists athlete_id uuid references athlete(id) on delete cascade;

-- De tabellen zijn leeg; met gegevens erin zou hier eerst een backfill staan.
do $$
begin
  if (select count(*) from shoe) = 0 then
    alter table shoe alter column athlete_id set not null;
  end if;
  if (select count(*) from blood_panel) = 0 then
    alter table blood_panel alter column athlete_id set not null;
  end if;
end $$;

-- Datum alleen volstaat niet meer als sleutel: twee mensen loggen op dezelfde dag.
alter table wellness drop constraint if exists wellness_pkey;
alter table wellness add primary key (athlete_id, date);

alter table blood_panel drop constraint if exists blood_panel_pkey;
alter table blood_panel add primary key (athlete_id, date);

drop policy if exists shoe_all on shoe;
drop policy if exists shoe_own on shoe;
create policy shoe_own on shoe
  for all to authenticated using (athlete_id = my_athlete_id()) with check (athlete_id = my_athlete_id());

drop policy if exists blood_panel_all on blood_panel;
drop policy if exists blood_panel_own on blood_panel;
create policy blood_panel_own on blood_panel
  for all to authenticated using (athlete_id = my_athlete_id()) with check (athlete_id = my_athlete_id());
