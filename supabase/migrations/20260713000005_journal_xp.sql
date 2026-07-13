-- Journaling (Fase 2): entry opslaan + XP naar Geest in één transactie.
-- Meerdere entries per dag mogen; XP alleen bij de eerste van de dag.
create or replace function public.add_journal_entry(
  p_type text,
  p_content text,
  p_mood int default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date := public.user_today();
  v_first boolean;
  v_id bigint;
  v_award jsonb := null;
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;
  if p_type not in ('ochtend', 'avond', 'dankbaarheid', 'vrij') then
    raise exception 'Onbekend journal-type: %', p_type;
  end if;
  if p_mood is not null and (p_mood < 1 or p_mood > 10) then
    raise exception 'Mood moet tussen 1 en 10 liggen';
  end if;
  if coalesce(trim(p_content), '') = '' then
    raise exception 'Entry is leeg';
  end if;

  v_first := not exists (
    select 1 from public.journal_entries
    where user_id = v_user and date = v_today
  );

  insert into public.journal_entries (user_id, date, type, content, mood)
  values (v_user, v_today, p_type, p_content, p_mood)
  returning id into v_id;

  if v_first then
    v_award := public.award_xp('geest', 15, 'journal', v_id::text);
  end if;

  return jsonb_build_object('entry_id', v_id, 'award', v_award);
end;
$$;

revoke execute on function public.add_journal_entry(text, text, int) from public, anon;
grant execute on function public.add_journal_entry(text, text, int) to authenticated;
