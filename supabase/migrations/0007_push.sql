-- Eén rij per apparaat waarop je de ochtendmelding wilt. Sleutels horen bij het
-- abonnement van de browser en zijn niet gevoelig buiten dit doel.
create table if not exists push_subscription (
  endpoint   text primary key,
  athlete_id uuid not null references athlete(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

alter table push_subscription enable row level security;

drop policy if exists push_subscription_own on push_subscription;
create policy push_subscription_own on push_subscription
  for all to authenticated using (athlete_id = my_athlete_id()) with check (athlete_id = my_athlete_id());
