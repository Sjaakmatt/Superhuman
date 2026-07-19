-- Meditatie-leerlijn (C2) — schema.
--
-- Reconstructie van de migratie die eerder direct via de Supabase MCP is
-- toegepast (naam `meditation_curriculum`), zodat een schone database volledig
-- uit deze map te herbouwen is. Idempotent geschreven (if not exists / or
-- replace) zodat het veilig is op een bestaande database.

-- Gedeelde niveaus (read-only voor ingelogde users).
create table if not exists public.meditation_levels (
  id uuid primary key default gen_random_uuid(),
  level integer not null,
  slug text not null unique,
  name text not null,
  one_liner text,
  instruction text[] default '{}'::text[],
  guidance text,
  target_min integer not null default 5,
  unlock jsonb not null default '{"requires": []}'::jsonb,
  media jsonb,
  xp integer not null default 30,
  sort integer not null default 0
);

-- Per-user voortgang (huidig niveau).
create table if not exists public.user_meditation_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_level integer not null default 1,
  updated_at timestamptz not null default now()
);

-- Gelogde sessies.
create table if not exists public.meditation_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  level integer not null,
  duration_sec integer,
  date date not null,
  created_at timestamptz not null default now()
);

alter table public.meditation_levels enable row level security;
alter table public.user_meditation_state enable row level security;
alter table public.meditation_sessions enable row level security;

drop policy if exists "meditation_levels read" on public.meditation_levels;
create policy "meditation_levels read" on public.meditation_levels
  for select to authenticated using (true);

drop policy if exists "own meditation_state" on public.user_meditation_state;
create policy "own meditation_state" on public.user_meditation_state
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own meditation_sessions" on public.meditation_sessions;
create policy "own meditation_sessions" on public.meditation_sessions
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Sessie afronden: log + state-upsert + geest 30 XP (alleen de eerste per dag).
create or replace function public.complete_meditation_session(
  p_level integer,
  p_duration_sec integer default null
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

  insert into public.meditation_sessions (user_id, level, duration_sec, date)
  values (v_user, p_level, p_duration_sec, v_today);

  insert into public.session_logs (user_id, kind, date, duration_secs)
  values (v_user, 'meditation', v_today, p_duration_sec);

  insert into public.user_meditation_state (user_id, current_level, updated_at)
  values (v_user, p_level, now())
  on conflict (user_id) do update
    set current_level = greatest(public.user_meditation_state.current_level, excluded.current_level),
        updated_at = now();

  if not public.xp_awarded_today('meditation') then
    v_award := public.award_xp('geest', 30, 'meditation', null);
  end if;

  return jsonb_build_object('award', v_award);
end;
$function$;
