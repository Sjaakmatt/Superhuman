-- Beweging-diepte (T0): ladder-datamodel.
-- ⚠️ Bewuste afwijking van de briefing: de ladder-oefeningen krijgen een
-- eigen tabel `ladder_exercises` i.p.v. de bestaande `exercises` te
-- vervangen. De huidige `exercises`/`routines`/`routine_exercises` blijven
-- de mobiliteit/stretch-flow voeden (die de briefing behoudt); ze slopen
-- zou werkende content weggooien. De ladder is een parallel, schoon systeem.

-- === Bewegingscategorieën (gedeeld, read-only) ===
create table if not exists movement_patterns (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,      -- trek_vert, duw_vert, been_knie, ...
  label text not null,
  category text not null,        -- kracht | elasticiteit | mobiliteit
  blurb text,
  sort int not null default 0
);

-- === Ladder-oefeningen: elke rij is één trede op één ladder ===
create table if not exists ladder_exercises (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references movement_patterns on delete cascade,
  rung int not null,             -- 1 = makkelijkst
  slug text unique not null,
  name text not null,
  one_liner text,
  -- Coaching (content-checklist)
  setup text[] not null default '{}',
  execution text[] not null default '{}',
  breathing text,
  mistakes text[] not null default '{}',
  -- Prescriptie
  tempo text,
  rep_low int,
  rep_high int,
  hold_sec int,                  -- voor isometrische treden
  rest_sec int,
  is_unilateral boolean not null default false,
  -- Progressie
  advance_reps int,
  advance_sets int,
  advance_note text,
  regression_slug text,          -- linkt op slug (opgelost in de app/lib)
  progression_slug text,
  -- Meta
  equipment text,                -- geen | rekstok | dip | verhoging
  demo_url text,
  muscles text[] not null default '{}',
  unique (pattern_id, rung)
);
create index ladder_exercises_pattern_idx on ladder_exercises (pattern_id, rung);

-- === Sessie-blauwdrukken (gedeeld, read-only) ===
create table if not exists session_templates (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,      -- kracht_a | kracht_b
  label text not null,
  blurb text
);
create table if not exists session_template_slots (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references session_templates on delete cascade,
  sort int not null,
  slot_type text not null,       -- warmup | work | finisher | cooldown
  pattern_id uuid references movement_patterns,
  sets int,
  note text
);
create index session_template_slots_tpl_idx on session_template_slots (template_id, sort);

-- === Waar de gebruiker staat op elke ladder (per user, RLS) ===
create table if not exists user_ladder_state (
  user_id uuid not null references auth.users on delete cascade,
  pattern_id uuid not null references movement_patterns on delete cascade,
  current_rung int not null default 1,
  sessions_at_rung int not null default 0,
  met_streak int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, pattern_id)
);

-- === Hardlopen (per user, RLS) ===
create table if not exists run_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null,            -- rustig | tempo
  distance_km numeric,
  duration_min int,
  rpe int,                       -- 1-10 gevoel
  note text,
  ran_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index run_logs_user_date_idx on run_logs (user_id, ran_on);

-- === workout_logs: koppeling aan de ladder + trede ===
alter table workout_logs add column if not exists ladder_exercise_id uuid
  references ladder_exercises;
alter table workout_logs add column if not exists rung int;

-- === RLS ===
alter table movement_patterns enable row level security;
create policy "Patronen lezen" on movement_patterns
  for select to authenticated using (true);

alter table ladder_exercises enable row level security;
create policy "Ladder-oefeningen lezen" on ladder_exercises
  for select to authenticated using (true);

alter table session_templates enable row level security;
create policy "Templates lezen" on session_templates
  for select to authenticated using (true);

alter table session_template_slots enable row level security;
create policy "Template-slots lezen" on session_template_slots
  for select to authenticated using (true);

alter table user_ladder_state enable row level security;
create policy "Eigen ladder-state" on user_ladder_state
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table run_logs enable row level security;
create policy "Eigen runs" on run_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- === Signup: ladder-state op rung 1 voor elk patroon ===
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, last_decay_on)
  values (new.id, (now() at time zone 'Europe/Amsterdam')::date);
  insert into public.user_attributes (user_id, key)
  select new.id, k
  from unnest(array['vitaliteit','kracht','soepel','voeding','focus','geest']) as k;
  insert into public.user_ladder_state (user_id, pattern_id)
  select new.id, mp.id from public.movement_patterns mp;
  return new;
end;
$$;

-- Ladder-state initialiseren voor een gebruiker (idempotent).
-- Aangeroepen vanuit de app zodat bestaande accounts + nieuwe patronen
-- altijd een rij hebben.
create or replace function public.ensure_ladder_state()
returns void
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd';
  end if;
  insert into public.user_ladder_state (user_id, pattern_id)
  select auth.uid(), mp.id
  from public.movement_patterns mp
  on conflict (user_id, pattern_id) do nothing;
end;
$$;

revoke execute on function public.ensure_ladder_state() from public, anon;
grant execute on function public.ensure_ladder_state() to authenticated;
