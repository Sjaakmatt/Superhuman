-- Fase 4: wekelijkse review opslaan + XP naar Focus in één transactie.
-- XP alleen bij de eerste keer opslaan van die week; bijwerken kan altijd.
create or replace function public.save_review(
  p_week_start date,
  p_wins text default null,
  p_lessons text default null,
  p_adjustments text default null,
  p_domain_scores jsonb default null,
  p_focus_next text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_first boolean;
  v_award jsonb := null;
begin
  if v_user is null then
    raise exception 'Niet ingelogd';
  end if;

  v_first := not exists (
    select 1 from public.reviews
    where user_id = v_user and week_start = p_week_start
  );

  insert into public.reviews
    (user_id, week_start, wins, lessons, adjustments, domain_scores, focus_next)
  values
    (v_user, p_week_start, p_wins, p_lessons, p_adjustments, p_domain_scores, p_focus_next)
  on conflict (user_id, week_start)
  do update set wins = excluded.wins,
                lessons = excluded.lessons,
                adjustments = excluded.adjustments,
                domain_scores = excluded.domain_scores,
                focus_next = excluded.focus_next;

  if v_first then
    v_award := public.award_xp('focus', 25, 'review', p_week_start::text);
  end if;

  return jsonb_build_object('award', v_award);
end;
$$;

revoke execute on function
  public.save_review(date, text, text, text, jsonb, text)
from public, anon;
grant execute on function
  public.save_review(date, text, text, text, jsonb, text)
to authenticated;
