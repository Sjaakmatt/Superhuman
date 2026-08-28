-- Wat je werkelijk deed. `date` is de lokale kalenderdag uit start_date_local:
-- een loop van 23:40 hoort bij die dag, niet bij de volgende.

create table if not exists activity (
  id                bigint primary key,          -- Strava-id, dus geen duplicaten
  athlete_id        uuid not null references athlete(id) on delete cascade,
  date              date not null,
  start_local       timestamp not null,
  sport_type        text not null,
  name              text,
  distance_m        numeric,
  moving_s          int,
  elapsed_s         int,
  elev_gain_m       numeric,
  avg_hr            numeric,
  max_hr            numeric,
  avg_cadence       numeric,
  calories          numeric,
  suffer_score      numeric,
  raw               jsonb,
  streams_synced_at timestamptz,
  synced_at         timestamptz not null default now()
);
create index if not exists activity_athlete_date_idx on activity (athlete_id, date);
create index if not exists activity_streams_todo_idx on activity (streams_synced_at) where streams_synced_at is null;

create table if not exists activity_zone (
  activity_id bigint not null references activity(id) on delete cascade,
  zone        text not null,
  seconds     int not null,
  primary key (activity_id, zone)
);

-- Afdaalminuten zijn onze eigen maat, geen Strava-veld: seconden uit de
-- grade_smooth-stream met een verhang steiler dan -4%. Zie CLAUDE.md.
create table if not exists activity_descent (
  activity_id     bigint primary key references activity(id) on delete cascade,
  descent_seconds int not null,
  descent_m       numeric not null,
  method          text not null default 'grade_smooth < -4%'
);
