-- Row Level Security voor alle tabellen (build brief §5).
-- Gebruikers-data: user_id = auth.uid() voor alles.
-- Gedeelde content (exercises, meditations, breathwork_patterns): read-only.

-- === Profiles (PK is de user-id zelf) ===
alter table profiles enable row level security;
create policy "Eigen profiel lezen" on profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Eigen profiel bijwerken" on profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- === Gedeelde content: read-only voor ingelogde gebruikers ===
alter table exercises enable row level security;
create policy "Oefeningen lezen" on exercises
  for select to authenticated using (true);

alter table meditations enable row level security;
create policy "Meditaties lezen" on meditations
  for select to authenticated using (true);

alter table breathwork_patterns enable row level security;
create policy "Breathwork-patronen lezen" on breathwork_patterns
  for select to authenticated using (true);

-- === Gebruikers-data: volledige toegang tot eigen rijen ===
-- (één 'for all'-policy per tabel: select/insert/update/delete)

alter table user_attributes enable row level security;
create policy "Eigen attributen" on user_attributes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table xp_events enable row level security;
create policy "Eigen xp-events" on xp_events
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table metrics enable row level security;
create policy "Eigen metrics" on metrics
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table metric_logs enable row level security;
create policy "Eigen metric-logs" on metric_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table routines enable row level security;
create policy "Eigen routines" on routines
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- routine_exercises heeft geen user_id: eigenaarschap via de routine
alter table routine_exercises enable row level security;
create policy "Eigen routine-oefeningen" on routine_exercises
  for all to authenticated
  using (exists (
    select 1 from routines r
    where r.id = routine_id and r.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from routines r
    where r.id = routine_id and r.user_id = (select auth.uid())
  ));

alter table workout_logs enable row level security;
create policy "Eigen workout-logs" on workout_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table food_checkins enable row level security;
create policy "Eigen food-checkins" on food_checkins
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table recipes enable row level security;
create policy "Eigen recepten" on recipes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table meal_plan enable row level security;
create policy "Eigen voedingsplan" on meal_plan
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table shopping_items enable row level security;
create policy "Eigen boodschappen" on shopping_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table calorie_logs enable row level security;
create policy "Eigen calorie-logs" on calorie_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table session_logs enable row level security;
create policy "Eigen sessie-logs" on session_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table journal_entries enable row level security;
create policy "Eigen journal" on journal_entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table goals enable row level security;
create policy "Eigen doelen" on goals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table reviews enable row level security;
create policy "Eigen reviews" on reviews
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table water_logs enable row level security;
create policy "Eigen water-logs" on water_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table reminders enable row level security;
create policy "Eigen reminders" on reminders
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table push_subscriptions enable row level security;
create policy "Eigen push-subscriptions" on push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
