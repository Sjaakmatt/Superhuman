-- Handinvoer: negentig seconden per dag. Dit is het onderdeel met het beste
-- bewijs, dus het mag nooit stuk zijn.

create table if not exists wellness (
  date        date primary key,
  athlete_id  uuid not null references athlete(id) on delete cascade,
  slept       int check (slept between 1 and 7),
  fresh       int check (fresh between 1 and 7),
  legs        int check (legs between 1 and 7),
  mind        int check (mind between 1 and 7),
  motivation  int check (motivation between 1 and 7),
  total       int generated always as (slept + fresh + legs + mind + motivation) stored,
  sleep_hours numeric,
  resting_hr  int,
  weight_kg   numeric,
  created_at  timestamptz not null default now()
);

create table if not exists session_log (
  id                uuid primary key default gen_random_uuid(),
  athlete_id        uuid not null references athlete(id) on delete cascade,
  date              date not null,
  activity_id       bigint references activity(id) on delete set null,
  rpe               int check (rpe between 1 and 10),
  pain_score        int check (pain_score between 0 and 10),
  pain_note         text,
  pain_next_morning int check (pain_next_morning between 0 and 10),
  shoe_id           uuid references shoe(id),
  carbs_g_per_h     numeric,
  gi_score          int check (gi_score between 0 and 10),
  taped             boolean,
  note              text,
  created_at        timestamptz not null default now()
);
-- Eén log per dag houdt het loggen simpel en maakt "overschrijven" mogelijk.
create unique index if not exists session_log_day_idx on session_log (athlete_id, date);

create table if not exists strength_session (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references athlete(id) on delete cascade,
  date         date not null,
  block        text not null,
  completed_at timestamptz
);
create unique index if not exists strength_session_day_idx on strength_session (athlete_id, date);

create table if not exists strength_set (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references strength_session(id) on delete cascade,
  exercise   text not null references exercise(slug),
  set_no     int not null,
  weight_kg  numeric,
  reps       int,
  done       boolean not null default false,
  unique (session_id, exercise, set_no)
);

create table if not exists blood_panel (
  date     date primary key,
  ferritin numeric,
  crp      numeric,
  tsat     numeric,
  hb       numeric,
  b12      numeric,
  vit_d    numeric,
  tsh      numeric,
  note     text
);
