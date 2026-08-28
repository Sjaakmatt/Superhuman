-- Het plan en de vaste referentie. Read-only na de seed: de app voert het plan
-- uit, hij verzint het niet. Wijzigen doe je in supabase/seed en opnieuw seeden.

create table if not exists plan_week (
  week               int primary key check (week between 1 and 57),
  start_date         date not null unique,
  phase              text not null,
  status             text not null,
  target_km          numeric not null,
  compact_km         numeric not null,
  longrun_km         numeric not null,
  sunday_km          numeric not null,
  midweek_km         numeric not null,
  hm_target          int not null,
  descent_min_target int not null,
  strength_sessions  int not null,
  focus              text not null
);

create table if not exists plan_day (
  date            date primary key,
  week            int not null references plan_week(week),
  weekday         text not null,
  phase           text not null,
  week_status     text not null,
  session_type    text not null,
  session_text    text not null,
  planned_km      numeric not null default 0,
  planned_min     int not null default 0,
  zone            text,
  pace_range      text,
  strength_block  text,
  strength_detail text
);
create index if not exists plan_day_week_idx on plan_day (week);

-- zones, krachtfases, voedingsschema en mijlpalen: één rij per sleutel,
-- zodat de app nooit een getal in code hoeft te zetten.
create table if not exists reference (
  key   text primary key,
  value jsonb not null
);

create table if not exists exercise (
  slug         text primary key,
  name         text not null,
  block        text not null,
  unit         text not null,
  default_sets int not null default 3,
  note         text
);

create table if not exists athlete (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references auth.users(id) on delete cascade,
  strava_athlete_id bigint unique,
  hr_max            int not null default 188,
  hr_zones          jsonb not null default '[]'::jsonb,
  race_date         date not null default date '2027-10-02',
  timezone          text not null default 'Europe/Amsterdam',
  created_at        timestamptz not null default now()
);

create table if not exists strava_token (
  athlete_id    uuid primary key references athlete(id) on delete cascade,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  scope         text,
  updated_at    timestamptz not null default now()
);

create table if not exists shoe (
  id      uuid primary key default gen_random_uuid(),
  name    text not null,
  drop_mm int,
  km      numeric not null default 0,
  retired boolean not null default false
);
