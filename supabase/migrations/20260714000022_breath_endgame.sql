-- Ademwerk endgame (C0+): de journey als 3 ontgrendelende niveaus (12→13→14)
-- + retentie-logging als diepte-maat voor de doorlopende "gevorderd"-modus.

alter table public.breath_sessions
  add column if not exists max_retention_sec int;

-- complete_breath_session mag nu ook de langste retentie meesturen.
create or replace function public.complete_breath_session(
  p_level int,
  p_duration_sec int default null,
  p_max_retention_sec int default null
) returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_today date := public.user_today();
  v_award jsonb := null;
begin
  if v_user is null then raise exception 'Niet ingelogd'; end if;

  insert into public.breath_sessions
    (user_id, level, duration_sec, max_retention_sec, date)
  values (v_user, p_level, p_duration_sec, p_max_retention_sec, v_today);

  insert into public.session_logs (user_id, kind, date, duration_secs)
  values (v_user, 'breathwork', v_today, p_duration_sec);

  insert into public.user_breath_state (user_id, current_level, updated_at)
  values (v_user, p_level, now())
  on conflict (user_id) do update
    set current_level = greatest(public.user_breath_state.current_level, excluded.current_level),
        updated_at = now();

  if not public.xp_awarded_today('breathwork') then
    v_award := public.award_xp('geest', 25, 'breathwork', null);
  end if;

  return jsonb_build_object('award', v_award);
end;
$function$;
grant execute on function public.complete_breath_session(int, int, int) to authenticated;

-- Niveau 12 wordt de INSTAP-journey (verdieping, ~15-20 min).
update public.breath_levels set
  name = 'Sandy · journey — verdieping',
  one_liner = 'Je eerste echte journey: ~15-20 minuten verbonden ademhaling op Sandy''s muziek.',
  prescription = '15-20 minuten · liggend',
  config = '{"rounds":3}'::jsonb,
  media = '{"provider":"youtube","url":"https://www.youtube.com/watch?v=lUHmOLHKqew","title":"Sandy — Release Stuck Energy in the Body (15 Min)"}'::jsonb
where level = 12;

-- Niveau 13 & 14: langere journeys, elk na 3 comfortabele sessies van de vorige.
insert into public.breath_levels
  (level, slug, name, one_liner, track, mode, setup, execution, breathing,
   mistakes, prescription, config, unlock, needs_safety_ack, media, xp, sort)
values
(13, 'sandy_journey_30', 'Sandy · journey — 30 minuten',
 'Een volledige journey van 30 minuten in 4 ronden — dieper, langer, meer ontlading.',
 'zwaar', 'follow',
 array['Lig op je rug, koptelefoon op, warme ruimte, dekentje bij de hand, ogen dicht.'],
 array['Continue, circulaire ademhaling zonder pauze op Sandy''s beat.','4 ronden met retenties; laat komen wat komt.','Sluit af met stille integratie — blijf even liggen.'],
 'De muziek stuurt tempo en diepte; forceer niets.',
 array['Te snel opbouwen; tintelingen zijn normaal, vertraag bij overweldiging.'],
 '30 minuten, 4 ronden · liggend',
 '{"rounds":4}'::jsonb,
 '{"requires":[{"type":"sessions","level":12,"count":3}]}'::jsonb, true,
 '{"provider":"link","url":"https://www.patreon.com/posts/30-minute-i-4-129173163","title":"Sandy — 30m Gratitude Breathwork, 4 Rounds (Patreon)"}'::jsonb, 25, 13),

(14, 'sandy_journey_diep', 'Sandy · diepe journey (begeleid)',
 'De diepste journey: 30-45 minuten binnen een langere sessie — doe deze bij voorkeur onder begeleiding.',
 'zwaar', 'follow',
 array['Lig op je rug in een veilige, warme ruimte; bij voorkeur met een ervaren facilitator, zeker de eerste keren.'],
 array['Lange, doorlopende verbonden ademhaling met meerdere retentie-ronden.','Ruime stille integratie na afloop.','Ga rustig terug de dag in; plan niets zwaars direct erna.'],
 'Dit is de zwaarste vorm — luister naar je lichaam en stop bij nood.',
 array['Solo doen bij de eerste keren; te lang te snel opbouwen.'],
 '30-45 minuten · liggend · liefst begeleid',
 '{"rounds":5}'::jsonb,
 '{"requires":[{"type":"sessions","level":13,"count":3}]}'::jsonb, true,
 '{"provider":"link","url":"https://www.patreon.com/breathewithsandy","title":"Sandy — langere journeys (Patreon)"}'::jsonb, 25, 14);
