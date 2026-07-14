-- Fase 3: krachttraining, voedingsplan en boodschappenlijst.

-- Helper: is er vandaag (profiel-tijdzone) al XP toegekend voor deze bron?
create or replace function public.xp_awarded_today(p_source text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.xp_events
    where user_id = auth.uid()
      and source = p_source
      and (created_at at time zone coalesce(
        (select timezone from public.profiles where id = auth.uid()),
        'Europe/Amsterdam'
      ))::date = public.user_today()
  );
$$;

-- === Sessies: XP voortaan alleen bij de eerste sessie per soort per dag ===
-- (loggen blijft altijd mogelijk; alleen de beloning wordt gededuplicieerd,
-- consistent met water/check-in/metrics)
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
  v_award jsonb := null;
  v_first boolean;
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;

  v_first := not public.xp_awarded_today(p_kind);

  if p_kind = 'stretch' then
    insert into public.workout_logs (user_id, date, duration_secs)
    values (v_user, v_today, p_duration_secs)
    returning id into v_id;
    if v_first then
      v_award := public.award_xp('soepel', 40, 'stretch', v_id::text);
    end if;
  elsif p_kind = 'breathwork' then
    insert into public.session_logs (user_id, kind, ref_id, date, duration_secs)
    values (v_user, 'breathwork', p_ref_id, v_today, p_duration_secs)
    returning id into v_id;
    if v_first then
      v_award := public.award_xp('geest', 25, 'breathwork', v_id::text);
    end if;
  elsif p_kind = 'meditation' then
    insert into public.session_logs (user_id, kind, ref_id, date, duration_secs)
    values (v_user, 'meditation', p_ref_id, v_today, p_duration_secs)
    returning id into v_id;
    if v_first then
      v_award := public.award_xp('geest', 30, 'meditation', v_id::text);
    end if;
  else
    raise exception 'Onbekende sessie-soort: %', p_kind;
  end if;

  return jsonb_build_object('log_id', v_id, 'award', v_award);
end;
$$;

-- === Routine-workout afronden: log + XP naar Kracht (of Soepelheid) ===
create or replace function public.complete_workout(
  p_routine_id bigint,
  p_duration_secs int default null,
  p_note text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date := public.user_today();
  v_kind text;
  v_id bigint;
  v_award jsonb := null;
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;

  select kind into v_kind
  from public.routines
  where id = p_routine_id and user_id = v_user;

  if not found then
    raise exception 'Onbekende routine';
  end if;

  insert into public.workout_logs (user_id, routine_id, date, duration_secs, note)
  values (v_user, p_routine_id, v_today, p_duration_secs, p_note)
  returning id into v_id;

  if v_kind = 'workout' then
    if not public.xp_awarded_today('workout') then
      v_award := public.award_xp('kracht', 45, 'workout', v_id::text);
    end if;
  else
    if not public.xp_awarded_today('stretch') then
      v_award := public.award_xp('soepel', 40, 'stretch', v_id::text);
    end if;
  end if;

  return jsonb_build_object('log_id', v_id, 'award', v_award);
end;
$$;

-- === Voedingsplan: één recept per (dag, maaltijd) ===
create unique index if not exists meal_plan_user_date_meal_idx
  on public.meal_plan (user_id, date, meal_type);

-- === Boodschappenlijst genereren uit het weekplan ===
-- Telt ingrediënten (jsonb [{name, qty, unit}]) van alle geplande recepten
-- in de week [p_week_start, +6] op per (naam, eenheid). Handmatig
-- afgevinkte status gaat bij regenereren verloren — bewust simpel.
create or replace function public.generate_shopping_list(p_week_start date)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_count int;
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;

  delete from public.shopping_items
  where user_id = v_user and week_start = p_week_start;

  insert into public.shopping_items (user_id, week_start, name, qty, unit)
  select
    v_user,
    p_week_start,
    ing->>'name',
    sum(nullif(ing->>'qty', '')::numeric),
    nullif(ing->>'unit', '')
  from public.meal_plan mp
  join public.recipes r on r.id = mp.recipe_id
  cross join lateral jsonb_array_elements(coalesce(r.ingredients, '[]'::jsonb)) ing
  where mp.user_id = v_user
    and mp.date between p_week_start and p_week_start + 6
    and coalesce(ing->>'name', '') <> ''
  group by ing->>'name', nullif(ing->>'unit', '');

  get diagnostics v_count = row_count;
  return jsonb_build_object('items', v_count);
end;
$$;

revoke execute on function
  public.xp_awarded_today(text),
  public.complete_workout(bigint, int, text),
  public.generate_shopping_list(date)
from public, anon;
grant execute on function
  public.xp_awarded_today(text),
  public.complete_workout(bigint, int, text),
  public.generate_shopping_list(date)
to authenticated;
