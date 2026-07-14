-- L6: de "Nu"-motor. Standaard-dagritme + reminders uit blokken.

-- Seed een standaard-dagritme bij eerste bezoek (idempotent).
-- Stretch-blokken verwijzen naar de gedeelde programma's (user_id null).
create or replace function public.ensure_default_schedule()
returns void
language plpgsql
set search_path = ''
as $$
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
    (user_id, label, kind, ref_id, start_min, window_min, days) values
    (v_user, 'Ochtend-mobiliteit', 'stretch', v_ochtend, 450, 90,
      array['MO','TU','WE','TH','FR','SA','SU']),
    (v_user, 'Ontbijt', 'meal', null, 480, 120,
      array['MO','TU','WE','TH','FR','SA','SU']),
    (v_user, 'Deep work-blok', 'focus', null, 570, 180,
      array['MO','TU','WE','TH','FR']),
    (v_user, 'Lunch', 'meal', null, 750, 90,
      array['MO','TU','WE','TH','FR','SA','SU']),
    (v_user, 'Bureau-reset', 'stretch', v_bureau, 930, 120,
      array['MO','TU','WE','TH','FR']),
    (v_user, 'Diner', 'meal', null, 1140, 120,
      array['MO','TU','WE','TH','FR','SA','SU']),
    (v_user, 'Avond-unwind', 'stretch', v_unwind, 1230, 90,
      array['MO','TU','WE','TH','FR','SA','SU']),
    (v_user, 'Breathwork', 'breath', null, 1290, 60,
      array['MO','TU','WE','TH','FR','SA','SU']),
    (v_user, 'Avond-journal', 'journal', null, 1305, 90,
      array['MO','TU','WE','TH','FR','SA','SU']);
end;
$$;

-- Herinneringen synchroniseren uit de ingeschakelde dagritme-blokken.
-- Vervangt eerder gesynchroniseerde blok-reminders (kind 'block').
create or replace function public.sync_schedule_reminders()
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

  delete from public.reminders where user_id = v_user and kind = 'block';

  insert into public.reminders (user_id, kind, label, schedule, enabled)
  select
    v_user,
    'block',
    b.label,
    jsonb_build_object(
      'times', jsonb_build_array(
        lpad((b.start_min / 60)::text, 2, '0') || ':' ||
        lpad((b.start_min % 60)::text, 2, '0')
      ),
      'days', to_jsonb(b.days)
    ),
    true
  from public.schedule_blocks b
  where b.user_id = v_user and b.enabled;

  get diagnostics v_count = row_count;
  return jsonb_build_object('reminders', v_count);
end;
$$;

revoke execute on function
  public.ensure_default_schedule(),
  public.sync_schedule_reminders()
from public, anon;
grant execute on function
  public.ensure_default_schedule(),
  public.sync_schedule_reminders()
to authenticated;
