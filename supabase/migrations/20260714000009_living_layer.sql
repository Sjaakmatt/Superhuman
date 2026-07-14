-- Levende laag (L1, living brief §2-3).
-- XP = wie je geworden bent (blijvend). Momentum = je huidige levenspuls
-- (0-100, springt omhoog bij voeden, zakt dagelijks bij verwaarlozing).
-- Constants: FEED_MOM = 34, DECAY = 17/dag, VERVAL_XP = 12 (≥2 dagen op 0).

-- === Momentum + verval op attributen ===
alter table user_attributes add column if not exists momentum numeric default 50;
alter table user_attributes add column if not exists idle_days int default 0;
alter table user_attributes add column if not exists momentum_updated_at timestamptz default now();

-- === Evolutie-stadia (gedeelde config, read-only) ===
create table if not exists evolution_stages (
  ordinal int primary key,
  name text not null,
  min_total_xp int not null,
  particles int not null,      -- deeltjes rond de core
  rings int not null,
  hue text not null,
  glow numeric not null,
  line text not null           -- ceremonie-tekst
);
insert into evolution_stages (ordinal,name,min_total_xp,particles,rings,hue,glow,line) values
 (0,'Sluimerend',0,0,1,'#6A6480',0.22,'Een vonk die nog moet ontwaken. Voed jezelf.'),
 (1,'Ontwakend',600,3,1,'#7A5CE0',0.5,'Je begint te leven. Iets komt op gang.'),
 (2,'Gedisciplineerd',1800,6,2,'#8B7CFF',0.78,'Ritme wordt tweede natuur.'),
 (3,'Onverzettelijk',3600,9,2,'#39E0C4',1.0,'Weinig krijgt je nog van je koers.'),
 (4,'Superhuman',6000,14,3,'#FF6FA8',1.3,'Je bent iets geworden.')
on conflict (ordinal) do nothing;

alter table evolution_stages enable row level security;
create policy "Stages lezen" on evolution_stages
  for select to authenticated using (true);

-- === Profiel: laatst gevierde stage + laatste decay-run ===
alter table profiles add column if not exists last_stage int default 0;
alter table profiles add column if not exists last_decay_on date;

-- === Dagritme: tijd-gebonden blokken (motor voor de "Nu"-kaart, L6) ===
create table if not exists schedule_blocks (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade,
  label text not null,
  kind text not null,          -- stretch|breath|workout|meditation|meal|water|focus|review
  ref_id bigint,               -- bv routine_id of recipe_id
  start_min int not null,      -- minuten na middernacht (bv 450 = 07:30)
  window_min int default 60,   -- hoe lang dit blok "nu" is
  days text[] default array['MO','TU','WE','TH','FR','SA','SU'],
  enabled boolean default true
);
alter table schedule_blocks enable row level security;
create policy "Eigen blokken" on schedule_blocks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- === Totaal-XP: opgebouwde XP over alle levels heen ===
-- Per attribuut: xp binnen het level + de volgemaakte levels
-- (xp_max-curve: 100 + (level-1)*25). Verval verlaagt xp en telt dus door.
create or replace function public.attr_total_xp(p_level int, p_xp int)
returns int
language sql
immutable
set search_path = ''
as $$
  select p_xp + 100 * (p_level - 1) + 25 * ((p_level - 1) * (p_level - 2)) / 2;
$$;

-- === award_xp v2: xp + momentum + idle-reset + stage-detectie, één transactie ===
create or replace function public.award_xp(
  p_attribute_key text,
  p_amount int,
  p_source text,
  p_source_id text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_level int;
  v_xp int;
  v_xp_max int;
  v_momentum numeric;
  v_level_up boolean := false;
  v_total int;
  v_last_stage int;
  v_stage record;
  v_new_stage jsonb := null;
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;
  if p_amount <= 0 then
    raise exception 'XP-amount moet positief zijn';
  end if;

  insert into public.xp_events (user_id, attribute_key, amount, source, source_id)
  values (v_user, p_attribute_key, p_amount, p_source, p_source_id);

  select level, xp, xp_max into v_level, v_xp, v_xp_max
  from public.user_attributes
  where user_id = v_user and key = p_attribute_key
  for update;

  if not found then
    raise exception 'Onbekend attribuut: %', p_attribute_key;
  end if;

  v_xp := v_xp + p_amount;
  while v_xp >= v_xp_max loop
    v_xp := v_xp - v_xp_max;
    v_level := v_level + 1;
    v_xp_max := 100 + (v_level - 1) * 25;
    v_level_up := true;
  end loop;

  -- Voeden: momentum springt omhoog (FEED_MOM = 34), idle reset
  update public.user_attributes
  set level = v_level,
      xp = v_xp,
      xp_max = v_xp_max,
      momentum = least(100, momentum + 34),
      idle_days = 0,
      momentum_updated_at = now()
  where user_id = v_user and key = p_attribute_key
  returning momentum into v_momentum;

  -- Stage-detectie op totaal-XP over de zes attributen
  select coalesce(sum(public.attr_total_xp(level, xp)), 0) into v_total
  from public.user_attributes
  where user_id = v_user;

  select coalesce(last_stage, 0) into v_last_stage
  from public.profiles
  where id = v_user;

  select * into v_stage
  from public.evolution_stages
  where min_total_xp <= v_total
  order by ordinal desc
  limit 1;

  if found and v_stage.ordinal > v_last_stage then
    -- Evolutie te vieren: frontend toont de ceremonie en bevestigt via ack_stage
    v_new_stage := jsonb_build_object(
      'ordinal', v_stage.ordinal,
      'name', v_stage.name,
      'line', v_stage.line,
      'hue', v_stage.hue,
      'particles', v_stage.particles,
      'rings', v_stage.rings,
      'glow', v_stage.glow
    );
  end if;

  return jsonb_build_object(
    'attribute_key', p_attribute_key,
    'amount', p_amount,
    'level', v_level,
    'xp', v_xp,
    'xp_max', v_xp_max,
    'level_up', v_level_up,
    'momentum', v_momentum,
    'total_xp', v_total,
    'new_stage', v_new_stage
  );
end;
$$;

-- Ceremonie gezien → onthoud de stage zodat hij precies één keer verschijnt
create or replace function public.ack_stage(p_ordinal int)
returns void
language sql
set search_path = ''
as $$
  update public.profiles
  set last_stage = greatest(coalesce(last_stage, 0), p_ordinal)
  where id = auth.uid();
$$;

-- === Nachtelijke decay (draait via pg_cron, elk uur; verwerkt gebruikers
-- === bij wie het lokaal ná 03:00 is en die vandaag nog niet verwerkt zijn) ===
create or replace function public.decay_user_attributes(p_user uuid, p_target_day date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_row record;
  v_fed boolean;
  v_new_momentum numeric;
  v_decayed int := 0;
  v_verval int := 0;
begin
  select coalesce(timezone, 'Europe/Amsterdam') into v_tz
  from public.profiles where id = p_user;

  for v_row in
    select key, momentum, idle_days, xp
    from public.user_attributes
    where user_id = p_user
  loop
    v_fed := exists (
      select 1 from public.xp_events e
      where e.user_id = p_user
        and e.attribute_key = v_row.key
        and (e.created_at at time zone v_tz)::date = p_target_day
    );
    if v_fed then
      continue;
    end if;

    -- DECAY = 17/dag; zacht verval (VERVAL_XP = 12) bij ≥2 dagen op 0.
    -- Nooit onder 0, nooit een level onder 1 (xp blijft ≥ 0 binnen het level).
    v_new_momentum := greatest(0, v_row.momentum - 17);
    update public.user_attributes
    set momentum = v_new_momentum,
        idle_days = idle_days + 1,
        momentum_updated_at = now(),
        xp = case
          when v_new_momentum <= 0 and idle_days + 1 >= 2
          then greatest(0, xp - 12)
          else xp
        end
    where user_id = p_user and key = v_row.key;

    v_decayed := v_decayed + 1;
    if v_new_momentum <= 0 and v_row.idle_days + 1 >= 2 and v_row.xp > 0 then
      v_verval := v_verval + 1;
    end if;
  end loop;

  return jsonb_build_object('decayed', v_decayed, 'verval', v_verval);
end;
$$;

create or replace function public.run_momentum_decay()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile record;
  v_local_date date;
  v_local_hour int;
  v_users int := 0;
begin
  for v_profile in
    select id, coalesce(timezone, 'Europe/Amsterdam') as tz, last_decay_on
    from public.profiles
  loop
    v_local_date := (now() at time zone v_profile.tz)::date;
    v_local_hour := extract(hour from now() at time zone v_profile.tz)::int;

    if v_local_hour >= 3
       and (v_profile.last_decay_on is null or v_profile.last_decay_on < v_local_date)
    then
      perform public.decay_user_attributes(v_profile.id, v_local_date - 1);
      update public.profiles set last_decay_on = v_local_date where id = v_profile.id;
      v_users := v_users + 1;
    end if;
  end loop;

  return jsonb_build_object('users', v_users);
end;
$$;

-- Rechten: ack_stage voor ingelogde gebruikers; decay alleen voor de cron
revoke execute on function public.ack_stage(int) from public, anon;
grant execute on function public.ack_stage(int) to authenticated;
revoke execute on function
  public.decay_user_attributes(uuid, date),
  public.run_momentum_decay()
from public, anon, authenticated;
