-- Het plan was van iedereen die inlogde.
--
-- plan_week, plan_day en reference stonden onder RLS als "lezen mag, schrijven
-- niet" — voor élke ingelogde gebruiker. Met één gebruiker klopte dat. Nodig je
-- iemand uit, dan opent hij de app en ziet hij jouw 399 dagen, jouw mijlpalen,
-- jouw zones en jouw bloedpanelmomenten. Dat is niet "een eigen leeg plan", dat
-- is meekijken.
--
-- Het plan krijgt daarom een eigenaar. Wie er geen heeft, ziet er geen.

-- ── de sleutels moeten mee: twee mensen hebben dezelfde datums en weeknummers ─
alter table plan_week add column if not exists athlete_id uuid references athlete(id) on delete cascade;
alter table plan_day  add column if not exists athlete_id uuid references athlete(id) on delete cascade;
alter table reference add column if not exists athlete_id uuid references athlete(id) on delete cascade;

-- Wat er staat is van de eerste atleet; die heeft het geseed.
update plan_week set athlete_id = (select id from athlete order by created_at limit 1) where athlete_id is null;
update plan_day  set athlete_id = (select id from athlete order by created_at limit 1) where athlete_id is null;
update reference set athlete_id = (select id from athlete order by created_at limit 1) where athlete_id is null;

do $$
begin
  if not exists (select 1 from plan_week where athlete_id is null) then
    alter table plan_week alter column athlete_id set not null;
    alter table plan_day  alter column athlete_id set not null;
    alter table reference alter column athlete_id set not null;
  end if;
end $$;

-- Eerst de verwijzingen los, dan de sleutels om, dan terug.
alter table plan_day        drop constraint if exists plan_day_week_fkey;
alter table plan_adjustment drop constraint if exists plan_adjustment_date_fkey;

alter table plan_week drop constraint if exists plan_week_start_date_key;
alter table plan_week drop constraint if exists plan_week_pkey;
alter table plan_week add primary key (athlete_id, week);
alter table plan_week add constraint plan_week_start_uniek unique (athlete_id, start_date);

alter table plan_day drop constraint if exists plan_day_pkey;
alter table plan_day add primary key (athlete_id, date);
alter table plan_day add constraint plan_day_week_fkey
  foreign key (athlete_id, week) references plan_week (athlete_id, week) on delete cascade;

alter table reference drop constraint if exists reference_pkey;
alter table reference add primary key (athlete_id, key);

alter table plan_adjustment add constraint plan_adjustment_dag_fkey
  foreign key (athlete_id, date) references plan_day (athlete_id, date) on delete cascade;

-- ── RLS: je eigen plan, en dat van niemand anders ────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['plan_week', 'plan_day', 'reference'] loop
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format('drop policy if exists %I on %I', t || '_eigen', t);
    execute format(
      'create policy %I on %I for select to authenticated using (athlete_id = my_athlete_id())',
      t || '_eigen', t);
  end loop;
end $$;

-- Schrijven blijft aan de seed met de service-role-sleutel: een fout in de app
-- mag het plan niet kunnen veranderen. Dat was zo en dat blijft zo.

-- `exercise` blijft gedeeld. Dat is een lijstje bewegingen — "back squat, kg" —
-- en niet iemands trainingsinhoud.
