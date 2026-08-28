-- Opnieuw draaien mag: elke policy wordt eerst gedropt. `create policy` kent
-- geen IF NOT EXISTS, dus zonder die drop breekt een tweede run.
--
-- Eén gebruiker, maar RLS staat aan. Het plan is voor iedereen die is ingelogd
-- leesbaar en voor niemand schrijfbaar (alleen de seed met de service-role-sleutel
-- komt erdoorheen). De persoonlijke tabellen hangen aan athlete.

create or replace function my_athlete_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select id from athlete where user_id = auth.uid() $$;

alter table plan_week      enable row level security;
alter table plan_day       enable row level security;
alter table reference      enable row level security;
alter table exercise       enable row level security;
alter table athlete        enable row level security;
alter table strava_token   enable row level security;
alter table shoe           enable row level security;
alter table activity       enable row level security;
alter table activity_zone  enable row level security;
alter table activity_descent enable row level security;
alter table wellness       enable row level security;
alter table session_log    enable row level security;
alter table strength_session enable row level security;
alter table strength_set   enable row level security;
alter table blood_panel    enable row level security;
alter table insight        enable row level security;
alter table plan_adjustment enable row level security;

-- Lezen mag; schrijven niet. Zo kan een fout in de app het plan nooit veranderen.
do $$
declare t text;
begin
  foreach t in array array['plan_week', 'plan_day', 'reference', 'exercise'] loop
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format(
      'create policy %I on %I for select to authenticated using (true)',
      t || '_read', t);
  end loop;
end $$;

drop policy if exists athlete_self on athlete;
create policy athlete_self on athlete
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- strava_token krijgt bewust geen policy: tokens leven alleen in server routes
-- met de service-role-sleutel, nooit in de browser.

drop policy if exists activity_own on activity;
create policy activity_own on activity
  for all to authenticated using (athlete_id = my_athlete_id()) with check (athlete_id = my_athlete_id());

drop policy if exists activity_zone_own on activity_zone;
create policy activity_zone_own on activity_zone
  for all to authenticated
  using (exists (select 1 from activity a where a.id = activity_id and a.athlete_id = my_athlete_id()))
  with check (exists (select 1 from activity a where a.id = activity_id and a.athlete_id = my_athlete_id()));

drop policy if exists activity_descent_own on activity_descent;
create policy activity_descent_own on activity_descent
  for all to authenticated
  using (exists (select 1 from activity a where a.id = activity_id and a.athlete_id = my_athlete_id()))
  with check (exists (select 1 from activity a where a.id = activity_id and a.athlete_id = my_athlete_id()));

do $$
declare t text;
begin
  foreach t in array array['wellness', 'session_log', 'strength_session', 'insight', 'plan_adjustment'] loop
    execute format('drop policy if exists %I on %I', t || '_own', t);
    execute format(
      'create policy %I on %I for all to authenticated using (athlete_id = my_athlete_id()) with check (athlete_id = my_athlete_id())',
      t || '_own', t);
  end loop;
end $$;

drop policy if exists strength_set_own on strength_set;
create policy strength_set_own on strength_set
  for all to authenticated
  using (exists (select 1 from strength_session s where s.id = session_id and s.athlete_id = my_athlete_id()))
  with check (exists (select 1 from strength_session s where s.id = session_id and s.athlete_id = my_athlete_id()));

-- Schoenen en bloedwaarden hangen niet aan een atleet: deze app heeft er één.
-- Komt er ooit een tweede, dan is dit de plek waar je een athlete_id toevoegt.
drop policy if exists shoe_all on shoe;
create policy shoe_all on shoe for all to authenticated using (true) with check (true);
drop policy if exists blood_panel_all on blood_panel;
create policy blood_panel_all on blood_panel for all to authenticated using (true) with check (true);
