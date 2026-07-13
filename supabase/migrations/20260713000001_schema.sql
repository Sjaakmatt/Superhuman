-- Superhuman OS — volledig schema (build brief §5)
-- Kernidee: één flexibel metrics/logs-systeem + specifieke tabellen voor
-- content met eigen UX (oefeningen, maaltijden, meditaties).

-- === Gebruiker ===
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  timezone text default 'Europe/Amsterdam',
  onboarded_at timestamptz,
  created_at timestamptz default now()
);

-- === Attributen (voortgang per gebruiker) ===
create table user_attributes (
  user_id uuid references auth.users on delete cascade,
  key text not null,                 -- vitaliteit|kracht|soepel|voeding|focus|geest
  level int not null default 1,
  xp int not null default 0,
  xp_max int not null default 100,
  primary key (user_id, key)
);

-- === XP-events (audit + geschiedenis + streaks) ===
create table xp_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  attribute_key text not null,
  amount int not null,
  source text not null,              -- 'stretch','workout','meditation','water',...
  source_id text,
  created_at timestamptz default now()
);
create index xp_events_user_created_idx on xp_events (user_id, created_at);

-- === Flexibele metrics + logs ===
create table metrics (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  key text not null,
  label text not null,
  attribute_key text,                -- koppelt aan een attribuut
  type text not null,                -- boolean|count|scale|quantity|duration
  unit text,
  cadence text default 'daily',      -- daily|weekly
  direction text default 'input',    -- input|output
  target numeric,
  xp_reward int default 20,
  active boolean default true
);
create table metric_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  metric_id bigint references metrics on delete cascade,
  date date not null default current_date,
  value numeric,
  note text,
  created_at timestamptz default now(),
  unique (user_id, metric_id, date)
);

-- === Beweging: oefeningen, routines, logs ===
create table exercises (              -- gedeelde content (read-only voor users)
  id bigint generated always as identity primary key,
  name text not null,
  kind text not null,                 -- stretch|strength|mobility|cardio
  default_secs int,
  reps int,
  cue text,
  muscle_group text,
  video_url text                      -- Supabase Storage
);
create table routines (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  name text not null,
  kind text not null                  -- stretch|workout
);
create table routine_exercises (
  routine_id bigint references routines on delete cascade,
  exercise_id bigint references exercises,
  position int not null,
  secs int, reps int, sets int,
  primary key (routine_id, position)
);
create table workout_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  routine_id bigint references routines,
  date date default current_date,
  duration_secs int,
  note text,
  created_at timestamptz default now()
);
create index workout_logs_user_date_idx on workout_logs (user_id, date);

-- === Voeding ===
create table food_checkins (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  date date not null default current_date,
  satisfied boolean,                  -- "voldaan aan je voeding?"
  feeling text,                       -- licht & energiek | prima | te zwaar | ...
  note text,
  unique (user_id, date)
);
create table recipes (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  name text not null,
  ingredients jsonb,                  -- [{name, qty, unit}]
  calories int, protein int, carbs int, fat int,
  instructions text
);
create table meal_plan (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  date date not null,
  meal_type text not null,            -- ontbijt|lunch|diner|snack
  recipe_id bigint references recipes
);
create table shopping_items (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  week_start date not null,
  name text not null, qty numeric, unit text,
  checked boolean default false
);
create table calorie_logs (           -- optioneel/licht
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  date date default current_date,
  item text, calories int, protein int, carbs int, fat int,
  created_at timestamptz default now()
);
create index calorie_logs_user_date_idx on calorie_logs (user_id, date);

-- === Geest ===
create table meditations (            -- gedeelde content
  id bigint generated always as identity primary key,
  title text not null,
  category text,                      -- focus|slaap|kalmte|reset
  media_type text,                    -- voice|video
  media_url text,
  duration_secs int,
  description text
);
create table breathwork_patterns (    -- gedeelde content
  id bigint generated always as identity primary key,
  name text not null,                 -- '4-7-8', 'box', ...
  phases jsonb not null               -- [{label,secs,scale}]
);
create table session_logs (           -- meditatie/breathwork afronding
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  kind text not null,                 -- meditation|breathwork
  ref_id bigint,
  date date default current_date,
  duration_secs int,
  created_at timestamptz default now()
);
create index session_logs_user_date_idx on session_logs (user_id, date);
create table journal_entries (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  date date default current_date,
  type text,                          -- ochtend|avond|vrij|dankbaarheid
  content text,
  mood int                            -- 1..10
);
create index journal_entries_user_date_idx on journal_entries (user_id, date);

-- === Discipline & structuur ===
create table goals (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  title text not null,
  horizon text not null,              -- leven|jaar|kwartaal|week
  parent_id bigint references goals,
  status text default 'active',
  target_date date,
  linked_metric_id bigint references metrics
);
create table reviews (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  week_start date not null,
  wins text, lessons text, adjustments text,
  domain_scores jsonb,                -- {vitaliteit:8, kracht:6, ...}
  focus_next text,
  unique (user_id, week_start)
);

-- === Water & reminders ===
create table water_logs (
  user_id uuid references auth.users on delete cascade,
  date date not null default current_date,
  glasses int default 0,
  goal int default 8,
  primary key (user_id, date)
);
create table reminders (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  kind text not null,                 -- water|stretch|meditation|review|custom
  label text,
  schedule jsonb,                     -- {times:['09:00','13:00'], days:['MO'..], interval_min}
  enabled boolean default true
);
create table push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  subscription jsonb not null,        -- web-push subscription object
  created_at timestamptz default now()
);

-- === Nieuwe gebruiker: profiel + zes attributen automatisch aanmaken ===
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.user_attributes (user_id, key)
  select new.id, k
  from unnest(array['vitaliteit','kracht','soepel','voeding','focus','geest']) as k;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
