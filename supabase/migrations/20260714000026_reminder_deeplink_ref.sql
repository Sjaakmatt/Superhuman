-- Blok-reminders dragen nu ook `refId` mee, zodat stretch-blokken direct naar
-- het juiste programma deeplinken (bv. Avond-unwind → /beweging/stretch/9)
-- i.p.v. de programma-lijst. Spiegelt de href-logica in src/lib/now.ts.

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
      'days', to_jsonb(b.days),
      'blockKind', b.kind,
      'refId', b.ref_id
    ),
    true
  from public.schedule_blocks b
  where b.user_id = v_user and b.enabled;

  get diagnostics v_count = row_count;
  return jsonb_build_object('reminders', v_count);
end;
$$;

revoke execute on function public.sync_schedule_reminders() from public, anon;
grant execute on function public.sync_schedule_reminders() to authenticated;

-- Backfill: herbouw blok-reminders mét refId voor alle users.
delete from public.reminders where kind = 'block';

insert into public.reminders (user_id, kind, label, schedule, enabled)
select
  b.user_id,
  'block',
  b.label,
  jsonb_build_object(
    'times', jsonb_build_array(
      lpad((b.start_min / 60)::text, 2, '0') || ':' ||
      lpad((b.start_min % 60)::text, 2, '0')
    ),
    'days', to_jsonb(b.days),
    'blockKind', b.kind,
    'refId', b.ref_id
  ),
  true
from public.schedule_blocks b
where b.enabled;
