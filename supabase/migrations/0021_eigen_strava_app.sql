-- Health Connect eruit, je eigen Strava-app erin.
--
-- De Android-brug naar Samsung Health is vervallen: er komt een APK bij kijken
-- die iemand moet bouwen en installeren, en wie Strava gebruikt heeft er niets
-- aan. Wat blijft staan is `activity.source` en `activity.external_id` — die
-- bepalen sinds 0019 wie een activiteit is, en dat is los van waar hij vandaan
-- kwam een betere sleutel dan het Strava-id in de primaire kolom.
--
-- Ervoor in de plaats: je koppelt met je eigen Strava-app. De limieten van
-- Strava gelden per app (200 verzoeken per kwartier, 2.000 per dag), dus twee
-- atleten uit één app halen betekent elkaars quotum opeten.

drop table if exists pairing_code;
drop table if exists device;

alter table wellness drop column if exists sleep_hours_auto;
alter table wellness drop column if exists resting_hr_auto;
alter table wellness drop column if exists weight_kg_auto;

-- Er komt geen health_connect meer binnen; wat er staat is strava of manual.
alter table activity drop constraint if exists activity_source_check;
alter table activity add constraint activity_source_check
  check (source in ('strava', 'manual'));

-- ── je eigen Strava-app ─────────────────────────────────────────────────────
create table if not exists strava_app (
  athlete_id    uuid primary key references athlete(id) on delete cascade,
  client_id     text not null,
  -- De sleutel staat hier omdat er geen andere plek is waar de server hem per
  -- atleet kan vinden. Hij verlaat de server nooit: het scherm toont alleen of
  -- er een sleutel staat, niet welke.
  client_secret text not null,
  updated_at    timestamptz not null default now()
);

alter table strava_app enable row level security;
-- Bewust geen policy, net als strava_token: alleen de server routes met de
-- service-role-sleutel komen erbij, nooit de browser.
