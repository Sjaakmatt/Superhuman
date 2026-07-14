-- L4: sets per workout loggen (progressive overload).
alter table workout_logs add column if not exists sets jsonb;

-- complete_workout accepteert nu de daadwerkelijk gedane sets:
-- [{exercise_id, name, sets:[{reps,weight}]}]. XP-logica ongewijzigd.
create or replace function public.complete_workout(
  p_routine_id bigint,
  p_duration_secs int default null,
  p_note text default null,
  p_sets jsonb default null
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

  -- Gedeelde programma's (user_id null) mogen ook gelogd worden
  if not found then
    select kind into v_kind
    from public.routines
    where id = p_routine_id and user_id is null;
    if not found then
      raise exception 'Onbekende routine';
    end if;
  end if;

  insert into public.workout_logs (user_id, routine_id, date, duration_secs, note, sets)
  values (v_user, p_routine_id, v_today, p_duration_secs, p_note, p_sets)
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

revoke execute on function public.complete_workout(bigint, int, text, jsonb)
  from public, anon;
grant execute on function public.complete_workout(bigint, int, text, jsonb)
  to authenticated;
