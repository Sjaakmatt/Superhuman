-- T2 — sessie-player + Vandaag-koppeling.
-- Koppelt het dagritme aan een kracht-ladder-sessie en schrijft de logs
-- (per oefening met ladder_exercise_id + rung + sets). XP: kracht 45, eerste
-- workout per dag (deelt de dag-cap met routine-workouts via source 'workout').

-- 1) Dagritme kan naar een sessie-template verwijzen (kracht_a/kracht_b/auto).
alter table public.schedule_blocks
  add column if not exists session_key text;

-- 2) Standaard-dagritme krijgt een kracht-blok (auto = A/B wisselt per week).
create or replace function public.ensure_default_schedule()
 returns void
 language plpgsql
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_ochtend bigint;
  v_bureau bigint;
  v_unwind bigint;
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;
  if exists (select 1 from public.schedule_blocks where user_id = v_user) then
    return;
  end if;

  select id into v_ochtend from public.routines
    where user_id is null and name = 'Ochtend-mobiliteit' limit 1;
  select id into v_bureau from public.routines
    where user_id is null and name = 'Bureau-reset' limit 1;
  select id into v_unwind from public.routines
    where user_id is null and name = 'Volledige stretch & unwind' limit 1;

  insert into public.schedule_blocks
    (user_id, label, kind, ref_id, start_min, window_min, days, session_key) values
    (v_user, 'Ochtend-mobiliteit', 'stretch', v_ochtend, 450, 90,
      array['MO','TU','WE','TH','FR','SA','SU'], null),
    (v_user, 'Ontbijt', 'meal', null, 480, 120,
      array['MO','TU','WE','TH','FR','SA','SU'], null),
    (v_user, 'Deep work-blok', 'focus', null, 570, 180,
      array['MO','TU','WE','TH','FR'], null),
    (v_user, 'Krachttraining', 'workout', null, 1020, 180,
      array['MO','WE','FR'], 'auto'),
    (v_user, 'Lunch', 'meal', null, 750, 90,
      array['MO','TU','WE','TH','FR','SA','SU'], null),
    (v_user, 'Bureau-reset', 'stretch', v_bureau, 930, 120,
      array['MO','TU','WE','TH','FR'], null),
    (v_user, 'Diner', 'meal', null, 1140, 120,
      array['MO','TU','WE','TH','FR','SA','SU'], null),
    (v_user, 'Avond-unwind', 'stretch', v_unwind, 1230, 90,
      array['MO','TU','WE','TH','FR','SA','SU'], null),
    (v_user, 'Breathwork', 'breath', null, 1290, 60,
      array['MO','TU','WE','TH','FR','SA','SU'], null),
    (v_user, 'Avond-journal', 'journal', null, 1305, 90,
      array['MO','TU','WE','TH','FR','SA','SU'], null);
end;
$function$;

-- 3) Backfill: bestaande gebruikers (die al een dagritme hebben) krijgen
--    alsnog een kracht-blok, zodat de Nu-motor de sessie kan voorstellen.
insert into public.schedule_blocks
  (user_id, label, kind, ref_id, start_min, window_min, days, session_key, enabled)
select distinct b.user_id, 'Krachttraining', 'workout', null::bigint, 1020, 180,
  array['MO','WE','FR']::text[], 'auto', true
from public.schedule_blocks b
where not exists (
  select 1 from public.schedule_blocks w
  where w.user_id = b.user_id and w.kind = 'workout'
);

-- 4) Ladder-sessie afronden: schrijf per oefening een workout_log (met
--    ladder_exercise_id + rung + sets) en ken kracht-XP toe (eerste/dag).
create or replace function public.complete_ladder_session(
  p_template_key text,
  p_duration_secs integer default null,
  p_entries jsonb default '[]'::jsonb
) returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_today date := public.user_today();
  v_award jsonb := null;
  v_entry jsonb;
  v_logged int := 0;
  v_id bigint;
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;

  for v_entry in
    select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb))
  loop
    insert into public.workout_logs
      (user_id, routine_id, date, duration_secs, note, sets,
       ladder_exercise_id, rung)
    values (
      v_user, null, v_today,
      case when v_logged = 0 then p_duration_secs else null end,
      p_template_key,
      coalesce(v_entry->'sets', '[]'::jsonb),
      nullif(v_entry->>'ladder_exercise_id', '')::uuid,
      nullif(v_entry->>'rung', '')::int
    )
    returning id into v_id;
    v_logged := v_logged + 1;
  end loop;

  if v_logged > 0 and not public.xp_awarded_today('workout') then
    v_award := public.award_xp('kracht', 45, 'workout', v_id::text);
  end if;

  return jsonb_build_object('logged', v_logged, 'award', v_award);
end;
$function$;

grant execute on function
  public.complete_ladder_session(text, integer, jsonb) to authenticated;
