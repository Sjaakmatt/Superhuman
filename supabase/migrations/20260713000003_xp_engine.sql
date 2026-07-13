-- XP-motor (Fase 1, build brief §6).
-- Alles als Postgres-functies zodat log + XP altijd in één transactie zitten:
-- de domein-functies (log_water, checkin_food, ...) roepen award_xp intern aan.
-- Security invoker: RLS blijft gewoon gelden, alles loopt via auth.uid().

-- "Vandaag" in de tijdzone van de gebruiker (profiel), niet in UTC.
create or replace function public.user_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select timezone from public.profiles where id = auth.uid()),
    'Europe/Amsterdam'
  ))::date;
$$;

-- === Kern: XP toekennen + level-ups afhandelen ===
-- Curve: xp_max = 100 + (level - 1) * 25
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
  v_level_up boolean := false;
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

  update public.user_attributes
  set level = v_level, xp = v_xp, xp_max = v_xp_max
  where user_id = v_user and key = p_attribute_key;

  return jsonb_build_object(
    'attribute_key', p_attribute_key,
    'amount', p_amount,
    'level', v_level,
    'xp', v_xp,
    'xp_max', v_xp_max,
    'level_up', v_level_up
  );
end;
$$;

-- === Water: +/- 1 glas; 5 XP per glas tot aan de goal ===
create or replace function public.log_water(p_delta int)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date := public.user_today();
  v_glasses int;
  v_goal int;
  v_award jsonb := null;
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;
  if p_delta not in (-1, 1) then
    raise exception 'Delta moet -1 of 1 zijn';
  end if;

  insert into public.water_logs (user_id, date, glasses)
  values (v_user, v_today, greatest(p_delta, 0))
  on conflict (user_id, date)
  do update set glasses = greatest(public.water_logs.glasses + p_delta, 0)
  returning glasses, goal into v_glasses, v_goal;

  -- XP alleen bij een toegevoegd glas binnen de goal (geen farming voorbij de goal)
  if p_delta = 1 and v_glasses <= v_goal then
    v_award := public.award_xp('vitaliteit', 5, 'water', v_today::text);
  end if;

  return jsonb_build_object('glasses', v_glasses, 'goal', v_goal, 'award', v_award);
end;
$$;

-- === Voeding: dagelijkse check-in; XP alleen bij de eerste van de dag ===
create or replace function public.checkin_food(
  p_satisfied boolean,
  p_feeling text,
  p_note text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date := public.user_today();
  v_existing bigint;
  v_award jsonb := null;
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;

  select id into v_existing
  from public.food_checkins
  where user_id = v_user and date = v_today;

  insert into public.food_checkins (user_id, date, satisfied, feeling, note)
  values (v_user, v_today, p_satisfied, p_feeling, p_note)
  on conflict (user_id, date)
  do update set satisfied = excluded.satisfied,
                feeling = excluded.feeling,
                note = excluded.note;

  if v_existing is null then
    v_award := public.award_xp('voeding', 20, 'food_checkin', v_today::text);
  end if;

  return jsonb_build_object('award', v_award);
end;
$$;

-- === Sessies: stretch (workout_log) / breathwork / meditation (session_log) ===
create or replace function public.complete_session(
  p_kind text,
  p_ref_id bigint default null,
  p_duration_secs int default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date := public.user_today();
  v_id bigint;
  v_award jsonb;
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;

  if p_kind = 'stretch' then
    insert into public.workout_logs (user_id, date, duration_secs)
    values (v_user, v_today, p_duration_secs)
    returning id into v_id;
    v_award := public.award_xp('soepel', 40, 'stretch', v_id::text);
  elsif p_kind = 'breathwork' then
    insert into public.session_logs (user_id, kind, ref_id, date, duration_secs)
    values (v_user, 'breathwork', p_ref_id, v_today, p_duration_secs)
    returning id into v_id;
    v_award := public.award_xp('geest', 25, 'breathwork', v_id::text);
  elsif p_kind = 'meditation' then
    insert into public.session_logs (user_id, kind, ref_id, date, duration_secs)
    values (v_user, 'meditation', p_ref_id, v_today, p_duration_secs)
    returning id into v_id;
    v_award := public.award_xp('geest', 30, 'meditation', v_id::text);
  else
    raise exception 'Onbekende sessie-soort: %', p_kind;
  end if;

  return jsonb_build_object('log_id', v_id, 'award', v_award);
end;
$$;

-- === Metric-taken: one-tap loggen; XP alleen bij de eerste log van de dag ===
create or replace function public.log_metric(
  p_metric_id bigint,
  p_value numeric default 1
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date := public.user_today();
  v_metric record;
  v_existing bigint;
  v_award jsonb := null;
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;

  select * into v_metric
  from public.metrics
  where id = p_metric_id and user_id = v_user;

  if not found then
    raise exception 'Onbekende metric';
  end if;

  select id into v_existing
  from public.metric_logs
  where user_id = v_user and metric_id = p_metric_id and date = v_today;

  insert into public.metric_logs (user_id, metric_id, date, value)
  values (v_user, p_metric_id, v_today, p_value)
  on conflict (user_id, metric_id, date)
  do update set value = excluded.value;

  if v_existing is null
     and v_metric.direction = 'input'
     and v_metric.attribute_key is not null
     and v_metric.xp_reward > 0 then
    v_award := public.award_xp(
      v_metric.attribute_key, v_metric.xp_reward, 'metric', p_metric_id::text
    );
  end if;

  return jsonb_build_object('award', v_award);
end;
$$;

-- === Standaard-metrics voor de takenstack (idempotent) ===
create or replace function public.ensure_default_metrics()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;

  if not exists (select 1 from public.metrics where user_id = v_user) then
    insert into public.metrics (user_id, key, label, attribute_key, type, xp_reward) values
      (v_user, 'deep_work', 'Deep work-blok', 'focus', 'boolean', 25),
      (v_user, 'slaap_7u', '7+ uur geslapen', 'vitaliteit', 'boolean', 15);
  end if;
end;
$$;

-- Alleen ingelogde gebruikers mogen deze functies aanroepen
revoke execute on function
  public.award_xp(text, int, text, text),
  public.log_water(int),
  public.checkin_food(boolean, text, text),
  public.complete_session(text, bigint, int),
  public.log_metric(bigint, numeric),
  public.ensure_default_metrics()
from public, anon;
grant execute on function
  public.award_xp(text, int, text, text),
  public.log_water(int),
  public.checkin_food(boolean, text, text),
  public.complete_session(text, bigint, int),
  public.log_metric(bigint, numeric),
  public.ensure_default_metrics()
to authenticated;
