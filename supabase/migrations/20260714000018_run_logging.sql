-- T4 — Hardlopen. Log een run (afstand, duur, RPE) en ken vitaliteit-XP toe
-- (conditioning voedt vitaliteit), eerste run per dag. De trend is de beloning.

create or replace function public.log_run(
  p_kind text,
  p_distance_km numeric default null,
  p_duration_min integer default null,
  p_rpe integer default null,
  p_note text default null,
  p_ran_on date default null
) returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_day date := coalesce(p_ran_on, public.user_today());
  v_id uuid;
  v_award jsonb := null;
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;

  insert into public.run_logs
    (user_id, kind, distance_km, duration_min, rpe, note, ran_on)
  values (v_user, p_kind, p_distance_km, p_duration_min, p_rpe, p_note, v_day)
  returning id into v_id;

  if not public.xp_awarded_today('run') then
    v_award := public.award_xp('vitaliteit', 30, 'run', v_id::text);
  end if;

  return jsonb_build_object('run_id', v_id, 'award', v_award);
end;
$function$;

grant execute on function
  public.log_run(text, numeric, integer, integer, text, date) to authenticated;
