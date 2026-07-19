-- Ademwerk-curriculum (C0) — gated leerlijn rond Breathe With Sandy.
-- Gedeelde content (breath_levels) read-only; user-voortgang + logs onder RLS.

-- 1) De niveaus (gedeelde content).
create table if not exists public.breath_levels (
  id uuid primary key default gen_random_uuid(),
  level int not null unique,
  slug text not null unique,
  name text not null,
  one_liner text,
  track text not null,                 -- kalmerend | brug | zwaar
  mode text not null,                  -- paced | bolt | rounds | follow
  setup text[] not null default '{}',
  execution text[] not null default '{}',
  breathing text,
  mistakes text[] not null default '{}',
  prescription text,
  config jsonb not null default '{}'::jsonb,   -- mode-specifieke player-config
  unlock jsonb not null default '{"requires":[]}'::jsonb,
  needs_safety_ack boolean not null default false,
  media jsonb,                         -- {provider,url,title}
  xp int not null default 25,
  sort int not null default 0
);

alter table public.breath_levels enable row level security;
create policy "breath_levels read" on public.breath_levels
  for select to authenticated using (true);

-- 2) Waar de gebruiker staat (onthoudt het hoogst gedane niveau).
create table if not exists public.user_breath_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_level int not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.user_breath_state enable row level security;
create policy "own breath_state" on public.user_breath_state
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 3) Gelogde sessies (voeden de ontgrendeling).
create table if not exists public.breath_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  level int not null,
  duration_sec int,
  date date not null,
  created_at timestamptz not null default now()
);
alter table public.breath_sessions enable row level security;
create policy "own breath_sessions" on public.breath_sessions
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create index if not exists breath_sessions_user_level_idx
  on public.breath_sessions (user_id, level);

-- 4) BOLT / Control Pause-metingen (de CO2-poort).
create table if not exists public.bolt_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  seconds int not null,
  date date not null,
  created_at timestamptz not null default now()
);
alter table public.bolt_logs enable row level security;
create policy "own bolt_logs" on public.bolt_logs
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 5) Sessie afronden: log + geest 25 XP (eerste ademwerk/dag) + session_log
--    (zodat de bestaande Vandaag-detectie op kind 'breathwork' blijft werken).
create or replace function public.complete_breath_session(
  p_level int,
  p_duration_sec int default null
) returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_today date := public.user_today();
  v_award jsonb := null;
begin
  if v_user is null then raise exception 'Niet ingelogd'; end if;

  insert into public.breath_sessions (user_id, level, duration_sec, date)
  values (v_user, p_level, p_duration_sec, v_today);

  insert into public.session_logs (user_id, kind, date, duration_secs)
  values (v_user, 'breathwork', v_today, p_duration_sec);

  insert into public.user_breath_state (user_id, current_level, updated_at)
  values (v_user, p_level, now())
  on conflict (user_id) do update
    set current_level = greatest(public.user_breath_state.current_level, excluded.current_level),
        updated_at = now();

  if not public.xp_awarded_today('breathwork') then
    v_award := public.award_xp('geest', 25, 'breathwork', null);
  end if;

  return jsonb_build_object('award', v_award);
end;
$function$;
grant execute on function public.complete_breath_session(int, int) to authenticated;

-- 6) BOLT-meting loggen (geen XP).
create or replace function public.log_bolt(p_seconds int)
returns void
 language plpgsql
 set search_path to ''
as $function$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Niet ingelogd'; end if;
  insert into public.bolt_logs (user_id, seconds, date)
  values (v_user, p_seconds, public.user_today());
end;
$function$;
grant execute on function public.log_bolt(int) to authenticated;
