-- Health Connect als tweede bron naast Strava.
--
-- Samsung Health schrijft naar Health Connect; een Android-app leest dat uit en
-- levert het hier aan. Vanaf hier weet de rest van de app niet meer waar een
-- activiteit vandaan komt, en dat is het punt.
--
-- Over de sleutel: activity.id is historisch het Strava-id. Dat blijft zo voor
-- wat er staat — de verwijzingen uit activity_zone, activity_descent en
-- session_log omzetten zou een riskante herschrijving zijn voor niets. In plaats
-- daarvan krijgt de tabel een reeks die ver boven elk Strava-id begint, zodat
-- nieuwe rijen zonder Strava-id ook een sleutel hebben. Wie een activiteit is,
-- bepaalt voortaan (athlete_id, source, external_id) — niet meer de sleutel.

alter table activity add column if not exists source text not null default 'strava'
  check (source in ('strava', 'manual', 'health_connect'));
alter table activity add column if not exists external_id text;

update activity set external_id = id::text where external_id is null;

do $$
begin
  if not exists (select 1 from activity where external_id is null) then
    alter table activity alter column external_id set not null;
  end if;
end $$;

comment on column activity.external_id is
  'Het Strava-activiteit-id, of het record-id uit Health Connect. Uniek binnen (athlete, source).';

-- Zelfde activiteit twee keer aanleveren mag nooit twee rijen opleveren.
create unique index if not exists activity_bron_extern
  on activity (athlete_id, source, external_id);

-- Een reeks die begint waar geen enkel Strava-id ooit komt (die zitten rond
-- 1,6 × 10^10 en groeien langzaam). Zo botsen gegenereerde sleutels nooit met
-- een Strava-id dat later binnenkomt.
do $$
begin
  if not exists (
    select 1 from pg_class where relname = 'activity_id_seq' and relkind = 'S'
  ) then
    create sequence activity_id_seq start with 9000000000000000;
    alter table activity alter column id set default nextval('activity_id_seq');
    alter sequence activity_id_seq owned by activity.id;
  end if;
end $$;

-- ── gekoppelde apparaten ─────────────────────────────────────────────────────
create table if not exists device (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references athlete(id) on delete cascade,
  naam         text not null default 'Telefoon',
  -- Nooit het token zelf: een lek in de database geeft dan niemand toegang.
  token_hash   text not null unique,
  laatste_sync timestamptz,
  laatste_fout text,
  created_at   timestamptz not null default now()
);
create index if not exists device_athlete on device (athlete_id);

-- Koppelcodes: kort geldig, eenmalig bruikbaar.
create table if not exists pairing_code (
  code       text primary key,
  athlete_id uuid not null references athlete(id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz
);

alter table device enable row level security;
alter table pairing_code enable row level security;

drop policy if exists device_eigen on device;
create policy device_eigen on device
  for all to authenticated
  using (athlete_id = my_athlete_id()) with check (athlete_id = my_athlete_id());

drop policy if exists pairing_eigen on pairing_code;
create policy pairing_eigen on pairing_code
  for all to authenticated
  using (athlete_id = my_athlete_id()) with check (athlete_id = my_athlete_id());

-- De ingest-route draait met de service-role-sleutel en gaat dus langs RLS heen;
-- die controleert zelf op token_hash en zet athlete_id.

-- ── wat de telefoon meet, naast wat je zelf invult ───────────────────────────
alter table wellness add column if not exists sleep_hours_auto numeric;
alter table wellness add column if not exists resting_hr_auto  int;
alter table wellness add column if not exists weight_kg_auto   numeric;

comment on column wellness.sleep_hours_auto is
  'Uit Health Connect. De handmatige kolom blijft leidend: wat je zelf invult wordt hier nooit door overschreven.';
